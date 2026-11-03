-- =============================================================================
-- 20261103000001 : notifications hors application (Web Push / VAPID)
-- - push_subscriptions : un abonnement par navigateur / appareil.
-- - push_outbox : événements à pousser, alimentés par les triggers métier.
-- - Aucun accès direct pour app_user : abonnements via RPC, outbox via triggers
--   SECURITY DEFINER, envoi via le rôle propriétaire (worker Next.js).
-- =============================================================================

create table if not exists public.push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_push_subscriptions_user
  on public.push_subscriptions (user_id);

create table if not exists public.push_outbox (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  event_key    text not null unique,
  kind         text not null,
  title        text not null,
  body         text not null,
  url          text not null default '/',
  tag          text,
  amount       integer not null default 0,
  created_at   timestamptz not null default now(),
  available_at timestamptz not null default now(),
  attempts     integer not null default 0,
  sent_at      timestamptz,
  last_error   text
);
create index if not exists idx_push_outbox_pending
  on public.push_outbox (available_at) where sent_at is null;
create index if not exists idx_push_outbox_user
  on public.push_outbox (user_id, created_at desc);
create index if not exists idx_push_outbox_sent
  on public.push_outbox (sent_at) where sent_at is not null;

alter table public.push_subscriptions enable row level security;
alter table public.push_outbox        enable row level security;

-- Tables privées : le serveur Next.js passe par le rôle propriétaire.
revoke all on public.push_subscriptions, public.push_outbox from public, app_user;

-- ---------- Abonnement / désabonnement (appelé au nom du joueur) -----------
create or replace function public.upsert_push_subscription(
  p_user_id    uuid,
  p_endpoint   text,
  p_p256dh     text,
  p_auth       text,
  p_user_agent text default null
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform private.assert_caller(p_user_id);
  if coalesce(btrim(p_endpoint), '') = ''
     or coalesce(btrim(p_p256dh), '') = ''
     or coalesce(btrim(p_auth), '') = '' then
    raise exception 'invalid_subscription';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (p_user_id, btrim(p_endpoint), btrim(p_p256dh), btrim(p_auth), left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        updated_at = now();
end $$;

create or replace function public.delete_push_subscription(p_user_id uuid, p_endpoint text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform private.assert_caller(p_user_id);
  delete from public.push_subscriptions
   where user_id = p_user_id and endpoint = p_endpoint;
end $$;

create or replace function public.delete_all_push_subscriptions(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform private.assert_caller(p_user_id);
  delete from public.push_subscriptions where user_id = p_user_id;
end $$;

revoke all on function public.upsert_push_subscription(uuid, text, text, text, text) from public;
revoke all on function public.delete_push_subscription(uuid, text) from public;
revoke all on function public.delete_all_push_subscriptions(uuid) from public;
grant execute on function public.upsert_push_subscription(uuid, text, text, text, text) to app_user;
grant execute on function public.delete_push_subscription(uuid, text) to app_user;
grant execute on function public.delete_all_push_subscriptions(uuid) to app_user;

-- ---------- Outbox : un événement poussé au maximum une fois ----------------
create or replace function private.push_enqueue(
  p_user_id   uuid,
  p_event_key text,
  p_kind      text,
  p_title     text,
  p_body      text,
  p_url       text,
  p_tag       text,
  p_amount    integer default 0
) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.push_outbox (user_id, event_key, kind, title, body, url, tag, amount)
  select p_user_id, p_event_key, p_kind, p_title, p_body, p_url, p_tag, p_amount
   where p_user_id is not null
     and exists (
       select 1 from public.push_subscriptions s where s.user_id = p_user_id
     )
  on conflict (event_key) do nothing;
$$;

-- ---------- Marché : offre reçue --------------------------------------------
create or replace function private.push_offer_created() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_seller uuid;
  v_card   text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select l.seller_id, coalesce(l.card_name, t.name, 'une carte')
    into v_seller, v_card
    from public.marketplace_listings l
    left join public.user_cards uc on uc.id = l.card_id
    left join public.card_templates t on t.id = coalesce(l.card_template_id, uc.template_id)
   where l.id = new.listing_id;

  if v_seller is not null and v_seller <> new.buyer_id then
    perform private.push_enqueue(
      v_seller,
      'offer:' || new.id::text || ':received',
      'offer_received',
      'Nouvelle offre',
      format('%s pièces pour %s', new.amount, v_card),
      '/marketplace',
      'offer-' || new.id::text,
      new.amount);
  end if;

  return new;
exception when others then
  return new; -- une notification ne doit jamais bloquer une transaction métier
end $$;

drop trigger if exists push_offer_created on public.marketplace_offers;
create trigger push_offer_created
  after insert on public.marketplace_offers
  for each row execute function private.push_offer_created();

-- ---------- Marché : offre acceptée / refusée -------------------------------
create or replace function private.push_offer_resolved() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_card text;
begin
  if new.status not in ('accepted', 'rejected')
     or old.status is not distinct from new.status then
    return new;
  end if;

  select coalesce(l.card_name, t.name, 'une carte')
    into v_card
    from public.marketplace_listings l
    left join public.user_cards uc on uc.id = l.card_id
    left join public.card_templates t on t.id = coalesce(l.card_template_id, uc.template_id)
   where l.id = new.listing_id;

  if new.status = 'accepted' then
    perform private.push_enqueue(
      new.buyer_id,
      'offer:' || new.id::text || ':accepted',
      'offer_accepted',
      'Offre acceptée',
      format('Votre offre de %s pièces pour %s a été acceptée.', new.amount, v_card),
      '/marketplace',
      'offer-' || new.id::text || '-resolved',
      new.amount);
  else
    perform private.push_enqueue(
      new.buyer_id,
      'offer:' || new.id::text || ':rejected',
      'offer_rejected',
      'Offre refusée',
      format('Votre offre pour %s a été refusée : %s pièces remboursées.', v_card, new.amount),
      '/marketplace',
      'offer-' || new.id::text || '-resolved',
      new.amount);
  end if;

  return new;
exception when others then
  return new;
end $$;

drop trigger if exists push_offer_resolved on public.marketplace_offers;
create trigger push_offer_resolved
  after update of status on public.marketplace_offers
  for each row execute function private.push_offer_resolved();

-- ---------- Marché : vente conclue ------------------------------------------
create or replace function private.push_sale() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_card text;
begin
  if new.status <> 'sold' or old.status is not distinct from 'sold' then
    return new;
  end if;

  select coalesce(new.card_name, t.name, 'une carte')
    into v_card
    from public.card_templates t
   where t.id = new.card_template_id;

  perform private.push_enqueue(
    new.seller_id,
    'sale:' || new.id::text,
    'sale',
    'Carte vendue',
    format('%s : +%s pièces', coalesce(v_card, 'une carte'), coalesce(new.seller_net, 0)),
    '/marketplace',
    'sale-' || new.id::text,
    coalesce(new.seller_net, 0));

  return new;
exception when others then
  return new;
end $$;

drop trigger if exists push_sale on public.marketplace_listings;
create trigger push_sale
  after update of status on public.marketplace_listings
  for each row execute function private.push_sale();

-- ---------- Duels : résultat pour le défenseur ------------------------------
create or replace function private.push_duel_result() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_attacker text;
  v_won      boolean := new.result <> 'attacker_win';
begin
  select username into v_attacker from public.profiles where id = new.attacker_id;
  v_attacker := coalesce(v_attacker, 'Un pilote');

  if v_won then
    perform private.push_enqueue(
      new.defender_id,
      'duel:' || new.id::text,
      'duel_won',
      'Duel repoussé',
      format('%s n''a pas passé votre configuration%s', v_attacker,
             case when new.defender_coins > 0
                  then format(' : +%s pièces', new.defender_coins)
                  else '' end),
      '/duel',
      'duel-' || new.id::text,
      new.defender_coins);
  else
    perform private.push_enqueue(
      new.defender_id,
      'duel:' || new.id::text,
      'duel_lost',
      'Défaite en duel',
      format('%s a battu votre configuration.', v_attacker),
      '/duel',
      'duel-' || new.id::text,
      0);
  end if;

  return new;
exception when others then
  return new;
end $$;

drop trigger if exists push_duel_result on public.duels_history;
create trigger push_duel_result
  after insert on public.duels_history
  for each row execute function private.push_duel_result();

-- ---------- Duels : demande reçue -------------------------------------------
create or replace function private.push_duel_request() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_challenger text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select username into v_challenger from public.profiles where id = new.challenger_id;

  perform private.push_enqueue(
    new.target_id,
    'duel_request:' || new.id::text,
    'duel_request',
    'Demande de duel',
    format('%s vous défie en duel.', coalesce(v_challenger, 'Un pilote')),
    '/duel',
    'duel-request-' || new.id::text,
    0);

  return new;
exception when others then
  return new;
end $$;

drop trigger if exists push_duel_request on public.duel_challenges;
create trigger push_duel_request
  after insert on public.duel_challenges
  for each row execute function private.push_duel_request();

-- ---------- Classement : prime versée ---------------------------------------
create or replace function private.push_payout() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform private.push_enqueue(
    new.user_id,
    'payout:' || new.id::text,
    'payout',
    'Prime de classement',
    format('%s (#%s) : +%s pièces',
           case when new.period = 'weekly' then 'Classement de la semaine'
                else 'Classement du mois' end,
           new.rank, new.coins),
    '/leaderboard',
    'payout-' || new.id::text,
    new.coins);

  return new;
exception when others then
  return new;
end $$;

drop trigger if exists push_payout on public.leaderboard_payouts;
create trigger push_payout
  after insert on public.leaderboard_payouts
  for each row execute function private.push_payout();
