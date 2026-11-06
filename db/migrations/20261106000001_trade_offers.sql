-- =============================================================================
-- 0601 : Échanges directs entre joueurs (troc)
--
-- Deux listes de cartes, un seul côté peut ajouter des pièces (l'initiateur de
-- la proposition). Aucun séquestre : rien n'est bloqué à la création. Toutes
-- les vérifications (propriété, intégrité, 10 pièces de taxe par joueur) sont
-- faites au moment de l'acceptation. Une contre-offre inverse les rôles et
-- repart sur 24 h.
-- =============================================================================

create type public.trade_status as enum (
  'pending', 'accepted', 'declined', 'cancelled', 'expired', 'failed'
);

create table public.trade_offers (
  id             uuid primary key default gen_random_uuid(),
  proposer_id    uuid not null references public.profiles (id) on delete cascade,
  recipient_id   uuid not null references public.profiles (id) on delete cascade,
  -- Uniquement les pièces de l'initiateur. Toujours 0 côté destinataire.
  proposer_coins integer not null default 0 check (proposer_coins >= 0),
  -- Nombre d'items au moment de la création : permet de détecter une carte
  -- supprimée entre-temps (recyclage) même si la ligne d'item a été cascadée.
  item_count     integer not null default 0 check (item_count >= 0),
  status         public.trade_status not null default 'pending',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  expires_at     timestamptz not null default (now() + interval '24 hours'),
  resolved_at    timestamptz,
  check (proposer_id <> recipient_id)
);
create index idx_trade_offers_proposer
  on public.trade_offers (proposer_id, updated_at desc) where status = 'pending';
create index idx_trade_offers_recipient
  on public.trade_offers (recipient_id, updated_at desc) where status = 'pending';
create index idx_trade_offers_expiry
  on public.trade_offers (expires_at) where status = 'pending';

create table public.trade_offer_items (
  id         uuid primary key default gen_random_uuid(),
  trade_id   uuid not null references public.trade_offers (id) on delete cascade,
  side       text not null check (side in ('proposer', 'recipient')),
  card_id    uuid not null references public.user_cards (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (trade_id, card_id)
);
create index idx_trade_items_trade on public.trade_offer_items (trade_id);
create index idx_trade_items_card  on public.trade_offer_items (card_id);

-- ---------- RLS --------------------------------------------------------------
alter table public.trade_offers      enable row level security;
alter table public.trade_offer_items enable row level security;

grant select on public.trade_offers, public.trade_offer_items to app_user;

create policy trade_offers_select on public.trade_offers for select to app_user
  using (proposer_id = (select public.current_uid())
         or recipient_id = (select public.current_uid()));

create policy trade_items_select on public.trade_offer_items for select to app_user
  using (exists (
    select 1 from public.trade_offers t
     where t.id = trade_id
       and (t.proposer_id = (select public.current_uid())
            or t.recipient_id = (select public.current_uid()))
  ));

-- Les cartes citées dans une offre en attente sont visibles par les deux
-- parties, même si elles ne sont pas exposées en vente (inventaire du troc).
drop policy if exists user_cards_select on public.user_cards;
create policy user_cards_select on public.user_cards for select to app_user
  using (
    owner_id = (select public.current_uid())
    or is_listed
    or exists (
      select 1
        from public.trade_offer_items i
        join public.trade_offers t on t.id = i.trade_id
       where i.card_id = user_cards.id
         and t.status = 'pending'
         and (t.proposer_id = (select public.current_uid())
              or t.recipient_id = (select public.current_uid()))
    )
  );

-- ---------- Validation commune ---------------------------------------------
create or replace function private.validate_trade_side(p_user uuid, p_card_ids uuid[])
returns void
language plpgsql
set search_path = public, pg_temp as $$
begin
  if coalesce(array_length(p_card_ids, 1), 0) > 5 then
    raise exception 'too_many_trade_cards';
  end if;

  if exists (
    select 1 from unnest(coalesce(p_card_ids, '{}'::uuid[])) cid
     group by cid having count(*) > 1
  ) then
    raise exception 'invalid_trade_cards';
  end if;

  if exists (
    select 1
      from unnest(coalesce(p_card_ids, '{}'::uuid[])) cid
     where not exists (
       select 1
         from public.user_cards uc
         join public.card_templates t on t.id = uc.template_id
        where uc.id = cid
          and uc.owner_id = p_user
          and not uc.is_destroyed
          and not coalesce(uc.in_recycle_bin, false)
          and t.restricted_to_username is null
     )
  ) then
    raise exception 'trade_card_not_owned';
  end if;
end $$;

-- ---------- Inventaire public d'un destinataire -----------------------------
-- Lecture seule, réservée à la préparation d'un échange. Les cartes détruites
-- et celles déposées dans la benne sont exclues.
create or replace function public.trade_partner(p_viewer uuid, p_username text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_target public.profiles%rowtype;
  v_cards  jsonb;
begin
  perform private.assert_caller(p_viewer);

  select * into v_target
    from public.profiles
   where lower(username) = lower(btrim(p_username))
   limit 1;
  if not found then return null; end if;

  select coalesce(jsonb_agg(
           (to_jsonb(uc) || jsonb_build_object('card_templates', to_jsonb(t)))
           order by uc.acquired_at desc
         ), '[]'::jsonb)
    into v_cards
    from public.user_cards uc
    join public.card_templates t on t.id = uc.template_id
   where uc.owner_id = v_target.id
     and not uc.is_destroyed
     and not coalesce(uc.in_recycle_bin, false)
     and t.restricted_to_username is null;

  return jsonb_build_object(
    'user', jsonb_build_object('id', v_target.id, 'username', v_target.username),
    'cards', v_cards
  );
end $$;

-- ---------- Expiration opportuniste -----------------------------------------
create or replace function public.expire_trade_offers(p_user uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform private.assert_caller(p_user);
  update public.trade_offers
     set status = 'expired', resolved_at = now()
   where status = 'pending'
     and expires_at <= now()
     and (proposer_id = p_user or recipient_id = p_user);
end $$;

-- ---------- Création ---------------------------------------------------------
create or replace function public.create_trade_offer(
  p_proposer_id uuid,
  p_recipient_id uuid,
  p_proposer_card_ids uuid[],
  p_recipient_card_ids uuid[],
  p_coins integer default 0
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_p      uuid[] := coalesce(p_proposer_card_ids, '{}'::uuid[]);
  v_r      uuid[] := coalesce(p_recipient_card_ids, '{}'::uuid[]);
  v_coins  integer := coalesce(p_coins, 0);
  v_id     uuid;
begin
  perform private.assert_caller(p_proposer_id);

  if p_recipient_id is null or not exists (select 1 from public.profiles where id = p_recipient_id) then
    raise exception 'profile_not_found';
  end if;
  if p_proposer_id = p_recipient_id then
    raise exception 'cannot_trade_self';
  end if;
  if v_coins < 0 then
    raise exception 'invalid_amount';
  end if;
  if v_p && v_r then
    raise exception 'invalid_trade_cards';
  end if;

  perform private.validate_trade_side(p_proposer_id, v_p);
  perform private.validate_trade_side(p_recipient_id, v_r);

  if cardinality(v_p) + cardinality(v_r) = 0 and v_coins = 0 then
    raise exception 'empty_trade';
  end if;

  insert into public.trade_offers (proposer_id, recipient_id, proposer_coins, item_count)
  values (p_proposer_id, p_recipient_id, v_coins, cardinality(v_p) + cardinality(v_r))
  returning id into v_id;

  insert into public.trade_offer_items (trade_id, side, card_id)
  select v_id, 'proposer', unnest(v_p);
  insert into public.trade_offer_items (trade_id, side, card_id)
  select v_id, 'recipient', unnest(v_r);

  return v_id;
end $$;

-- ---------- Annulation / refus ----------------------------------------------
create or replace function public.cancel_trade_offer(p_user_id uuid, p_trade_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_t public.trade_offers%rowtype;
begin
  perform private.assert_caller(p_user_id);

  select * into v_t from public.trade_offers where id = p_trade_id for update;
  if not found then raise exception 'trade_not_found'; end if;
  if v_t.proposer_id <> p_user_id then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_t.status <> 'pending' then raise exception 'trade_not_pending'; end if;

  update public.trade_offers
     set status = 'cancelled', resolved_at = now()
   where id = v_t.id;
end $$;

-- ---------- Contre-offre -----------------------------------------------------
-- Le destinataire devient l'initiateur : les rôles et les cartes sont inversés,
-- les pièces de l'ancien initiateur sont effacées et le délai repart à 24 h.
create or replace function public.counter_trade_offer(
  p_user_id uuid,
  p_trade_id uuid,
  p_proposer_card_ids uuid[],
  p_recipient_card_ids uuid[],
  p_coins integer default 0
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_t         public.trade_offers%rowtype;
  v_p         uuid[] := coalesce(p_proposer_card_ids, '{}'::uuid[]);
  v_r         uuid[] := coalesce(p_recipient_card_ids, '{}'::uuid[]);
  v_coins     integer := coalesce(p_coins, 0);
  v_other     uuid;
begin
  perform private.assert_caller(p_user_id);

  select * into v_t from public.trade_offers where id = p_trade_id for update;
  if not found then raise exception 'trade_not_found'; end if;
  if v_t.recipient_id <> p_user_id then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_t.status <> 'pending' then raise exception 'trade_not_pending'; end if;

  if v_t.expires_at <= now() then
    update public.trade_offers
       set status = 'expired', resolved_at = now()
     where id = v_t.id;
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if v_coins < 0 then raise exception 'invalid_amount'; end if;
  if v_p && v_r then raise exception 'invalid_trade_cards'; end if;

  v_other := v_t.proposer_id;
  perform private.validate_trade_side(p_user_id, v_p);
  perform private.validate_trade_side(v_other, v_r);

  if cardinality(v_p) + cardinality(v_r) = 0 and v_coins = 0 then
    raise exception 'empty_trade';
  end if;

  delete from public.trade_offer_items where trade_id = v_t.id;

  insert into public.trade_offer_items (trade_id, side, card_id)
  select v_t.id, 'proposer', unnest(v_p);
  insert into public.trade_offer_items (trade_id, side, card_id)
  select v_t.id, 'recipient', unnest(v_r);

  update public.trade_offers
     set proposer_id    = p_user_id,
         recipient_id   = v_other,
         proposer_coins  = v_coins,
         item_count      = cardinality(v_p) + cardinality(v_r),
         status          = 'pending',
         updated_at      = now(),
         expires_at      = now() + interval '24 hours',
         resolved_at     = null
   where id = v_t.id;

  return jsonb_build_object('ok', true, 'id', v_t.id);
end $$;

-- ---------- Acceptation ------------------------------------------------------
create or replace function public.respond_trade_offer(
  p_user_id uuid,
  p_trade_id uuid,
  p_accept boolean
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c_tax      constant integer := 10;
  v_t        public.trade_offers%rowtype;
  v_p        public.profiles%rowtype;
  v_r        public.profiles%rowtype;
  v_card     record;
  v_listing  record;
  v_missing  boolean := false;
begin
  perform private.assert_caller(p_user_id);

  select * into v_t from public.trade_offers where id = p_trade_id for update;
  if not found then raise exception 'trade_not_found'; end if;
  if v_t.recipient_id <> p_user_id then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_t.status <> 'pending' then raise exception 'trade_not_pending'; end if;

  if v_t.expires_at <= now() then
    update public.trade_offers
       set status = 'expired', resolved_at = now()
     where id = v_t.id;
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if not p_accept then
    update public.trade_offers
       set status = 'declined', resolved_at = now()
     where id = v_t.id;
    return jsonb_build_object('ok', true, 'accepted', false);
  end if;

  -- Annonces actives des cartes échangées d'abord (même ordre que l'achat
  -- marketplace : annonce -> profils -> cartes), pour éviter un interblocage
  -- avec un achat simultané.
  perform 1
     from public.marketplace_listings l
    where l.status = 'active'
      and l.card_id in (select card_id from public.trade_offer_items where trade_id = v_t.id)
    order by l.id
    for update;

  -- Ordre de verrouillage constant : profils (par id), cartes (par id).
  perform 1
     from public.profiles
    where id in (v_t.proposer_id, v_t.recipient_id)
    order by id
    for update;
  select * into v_p from public.profiles where id = v_t.proposer_id;
  select * into v_r from public.profiles where id = v_t.recipient_id;

  if (select count(*) from public.trade_offer_items where trade_id = v_t.id) <> v_t.item_count then
    v_missing := true;
  end if;

  for v_card in
    select uc.id, uc.owner_id, uc.is_destroyed,
           coalesce(uc.in_recycle_bin, false) as in_bin,
           i.side
      from public.trade_offer_items i
      join public.user_cards uc on uc.id = i.card_id
     where i.trade_id = v_t.id
     order by uc.id
     for update of uc
  loop
    if v_card.is_destroyed or v_card.in_bin then
      v_missing := true;
    end if;
    if v_card.side = 'proposer' and v_card.owner_id <> v_t.proposer_id then
      v_missing := true;
    end if;
    if v_card.side = 'recipient' and v_card.owner_id <> v_t.recipient_id then
      v_missing := true;
    end if;
  end loop;

  if v_missing then
    update public.trade_offers
       set status = 'failed', resolved_at = now()
     where id = v_t.id;
    return jsonb_build_object('ok', false, 'reason', 'cards_unavailable');
  end if;

  -- Chaque partie doit pouvoir payer sa taxe ; l'initiateur paie en plus les
  -- pièces qu'il a promises.
  if v_p.coins < v_t.proposer_coins + c_tax or v_r.coins < c_tax then
    update public.trade_offers
       set status = 'failed', resolved_at = now()
     where id = v_t.id;
    return jsonb_build_object('ok', false, 'reason', 'insufficient_funds');
  end if;

  if v_t.proposer_coins > 0 then
    perform private.adjust_coins(v_t.proposer_id, -v_t.proposer_coins, 'trade_offer', v_t.id);
    perform private.adjust_coins(v_t.recipient_id, v_t.proposer_coins, 'trade_offer', v_t.id);
  end if;
  perform private.adjust_coins(v_t.proposer_id, -c_tax, 'trade_tax', v_t.id);
  perform private.adjust_coins(v_t.recipient_id, -c_tax, 'trade_tax', v_t.id);

  for v_card in
    select card_id, side
      from public.trade_offer_items
     where trade_id = v_t.id
     order by card_id
  loop
    perform private.detach_card(v_card.card_id);

    -- Si la carte était en vente, l'annonce est clôturée proprement (les offres
    -- en attente sont remboursées) avant le changement de propriétaire.
    for v_listing in
      select id from public.marketplace_listings
       where card_id = v_card.card_id and status = 'active'
       order by id
       for update
    loop
      perform private.refund_pending_offers(v_listing.id);
      update public.marketplace_listings
         set status = 'cancelled', closed_at = now()
       where id = v_listing.id;
    end loop;

    update public.user_cards
       set owner_id = case when v_card.side = 'proposer' then v_t.recipient_id else v_t.proposer_id end,
           is_listed = false
     where id = v_card.card_id;
  end loop;

  update public.trade_offers
     set status = 'accepted', resolved_at = now(), updated_at = now()
   where id = v_t.id;

  return jsonb_build_object(
    'ok', true,
    'accepted', true,
    'tax', c_tax,
    'coins_offered', v_t.proposer_coins
  );
end $$;

-- ---------- Droits d'exécution ----------------------------------------------
revoke all on function public.trade_partner(uuid, text)                                  from public;
revoke all on function public.expire_trade_offers(uuid)                                  from public;
revoke all on function public.create_trade_offer(uuid, uuid, uuid[], uuid[], integer)     from public;
revoke all on function public.cancel_trade_offer(uuid, uuid)                             from public;
revoke all on function public.counter_trade_offer(uuid, uuid, uuid[], uuid[], integer)    from public;
revoke all on function public.respond_trade_offer(uuid, uuid, boolean)                    from public;

grant execute on function public.trade_partner(uuid, text)                               to app_user;
grant execute on function public.expire_trade_offers(uuid)                               to app_user;
grant execute on function public.create_trade_offer(uuid, uuid, uuid[], uuid[], integer)  to app_user;
grant execute on function public.cancel_trade_offer(uuid, uuid)                          to app_user;
grant execute on function public.counter_trade_offer(uuid, uuid, uuid[], uuid[], integer) to app_user;
grant execute on function public.respond_trade_offer(uuid, uuid, boolean)                 to app_user;
