-- Notifications in-app et push pour les échanges directs et les réponses aux défis.

create index if not exists idx_trade_offers_recipient_status_resolved
  on public.trade_offers (recipient_id, status, resolved_at desc);
create index if not exists idx_trade_offers_proposer_status_resolved
  on public.trade_offers (proposer_id, status, resolved_at desc);

create or replace function public.my_notifications(p_user_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_seen timestamptz;
  v_items jsonb;
begin
  perform private.assert_caller(p_user_id);
  select notifications_seen_at into v_seen from profiles where id = p_user_id;

  with ev as (
    select 'offer_received'::text as kind, o.created_at as at, l.card_name as label,
           o.amount as amount, null::integer as item_count, null::timestamptz as expires_at
      from marketplace_offers o
      join marketplace_listings l on l.id = o.listing_id
     where l.seller_id = p_user_id and o.status = 'pending'
       and o.created_at > now() - interval '30 days'
    union all
    select 'sale', l.closed_at, l.card_name, l.seller_net, null::integer, null::timestamptz
      from marketplace_listings l
     where l.seller_id = p_user_id and l.status = 'sold'
       and l.closed_at > now() - interval '30 days'
    union all
    select case o.status when 'accepted' then 'offer_accepted' else 'offer_rejected' end,
           o.resolved_at, l.card_name, o.amount, null::integer, null::timestamptz
      from marketplace_offers o
      join marketplace_listings l on l.id = o.listing_id
     where o.buyer_id = p_user_id and o.status in ('accepted', 'rejected')
       and o.resolved_at > now() - interval '30 days'
    union all
    select case d.result when 'attacker_win' then 'duel_lost' else 'duel_won' end,
           d.created_at, p.username, d.defender_coins, null::integer, null::timestamptz
      from duels_history d
      join profiles p on p.id = d.attacker_id
     where d.defender_id = p_user_id and d.created_at > now() - interval '30 days'
    union all
    select 'duel_request', c.created_at, p.username, 0, null::integer, null::timestamptz
      from duel_challenges c
      join profiles p on p.id = c.challenger_id
     where c.target_id = p_user_id and c.status = 'pending'
       and c.created_at > now() - interval '30 days'
    union all
    select case c.status when 'accepted' then 'duel_accepted' else 'duel_declined' end,
           c.resolved_at, p.username, 0, null::integer, null::timestamptz
      from duel_challenges c
      join profiles p on p.id = c.target_id
     where c.challenger_id = p_user_id and c.status in ('accepted', 'declined')
       and c.resolved_at > now() - interval '30 days'
    union all
    select 'trade_received', t.updated_at, p.username, t.proposer_coins,
           t.item_count, t.expires_at
      from trade_offers t
      join profiles p on p.id = t.proposer_id
     where t.recipient_id = p_user_id and t.status = 'pending'
       and t.updated_at > now() - interval '30 days'
    union all
    select 'trade_accepted', t.resolved_at, p.username, t.proposer_coins,
           t.item_count, t.expires_at
      from trade_offers t
      join profiles p on p.id = case when t.proposer_id = p_user_id then t.recipient_id else t.proposer_id end
     where p_user_id in (t.proposer_id, t.recipient_id) and t.status = 'accepted'
       and t.resolved_at > now() - interval '30 days'
    union all
    select 'trade_declined', t.resolved_at, p.username, t.proposer_coins,
           t.item_count, t.expires_at
      from trade_offers t
      join profiles p on p.id = t.recipient_id
     where t.proposer_id = p_user_id and t.status = 'declined'
       and t.resolved_at > now() - interval '30 days'
    union all
    select 'trade_expired', t.resolved_at, p.username, t.proposer_coins,
           t.item_count, t.expires_at
      from trade_offers t
      join profiles p on p.id = case when t.proposer_id = p_user_id then t.recipient_id else t.proposer_id end
     where p_user_id in (t.proposer_id, t.recipient_id) and t.status = 'expired'
       and t.resolved_at > now() - interval '30 days'
    union all
    select 'trade_failed', t.resolved_at, p.username, t.proposer_coins,
           t.item_count, t.expires_at
      from trade_offers t
      join profiles p on p.id = case when t.proposer_id = p_user_id then t.recipient_id else t.proposer_id end
     where p_user_id in (t.proposer_id, t.recipient_id) and t.status = 'failed'
       and t.resolved_at > now() - interval '30 days'
    union all
    select 'payout', pp.created_at,
           case pp.period when 'weekly' then 'Classement de la semaine' else 'Classement du mois' end || ' (#' || pp.rank || ')',
           pp.coins, null::integer, null::timestamptz
      from leaderboard_payouts pp
     where pp.user_id = p_user_id and pp.created_at > now() - interval '30 days'
  ), recent as (
    select kind, at, label, amount, item_count, expires_at
      from ev order by at desc limit 15
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', kind, 'at', at, 'label', label, 'amount', amount,
           'item_count', item_count, 'expires_at', expires_at, 'unread', at > v_seen
         ) order by at desc), '[]'::jsonb)
    into v_items from recent;

  return jsonb_build_object(
    'unread', (select count(*) from jsonb_array_elements(v_items) e where (e->>'unread')::boolean),
    'items', v_items);
end $$;

revoke all on function public.my_notifications(uuid) from public;
grant execute on function public.my_notifications(uuid) to app_user;

create or replace function private.push_duel_request() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_challenger text;
begin
  if new.status <> 'pending' then return new; end if;
  select username into v_challenger from profiles where id = new.challenger_id;
  perform private.push_enqueue(
    new.target_id, 'duel_request:' || new.id::text, 'duel_request', 'Demande de duel',
    format('%s vous défie en duel. Répondez depuis les duels organisés.', coalesce(v_challenger, 'Un pilote')),
    '/duel/organises', 'duel-request-' || new.id::text, 0);
  return new;
exception when others then return new;
end $$;

-- Demande reçue, y compris une contre-offre qui réutilise la même ligne.
create or replace function private.push_trade_received() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_sender text;
  v_key text;
begin
  if new.status <> 'pending' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'pending'
     and old.recipient_id = new.recipient_id and old.proposer_id = new.proposer_id then
    return new;
  end if;

  select username into v_sender from profiles where id = new.proposer_id;
  v_key := case when tg_op = 'INSERT' then new.id::text
                else new.id::text || ':' || to_char(new.updated_at at time zone 'UTC', 'YYYYMMDDHH24MISSUS') end;
  perform private.push_enqueue(
    new.recipient_id,
    'trade:' || v_key || ':received',
    'trade_received',
    'Nouvelle proposition d’échange',
    format('%s propose %s carte(s)%s. Répondez sous 24 h.', coalesce(v_sender, 'Un pilote'), new.item_count,
           case when new.proposer_coins > 0 then format(' et %s pièces', new.proposer_coins) else '' end),
    '/marketplace?espace=echanges', 'trade-' || new.id::text, new.proposer_coins);
  return new;
exception when others then return new;
end $$;

drop trigger if exists push_trade_received_insert on public.trade_offers;
create trigger push_trade_received_insert after insert on public.trade_offers
  for each row execute function private.push_trade_received();
drop trigger if exists push_trade_received_counter on public.trade_offers;
create trigger push_trade_received_counter after update of proposer_id, recipient_id on public.trade_offers
  for each row execute function private.push_trade_received();

-- Résultats d'échange : acceptation pour les deux joueurs, refus pour l'initiateur,
-- expiration ou échec pour les deux parties.
create or replace function private.push_trade_resolved() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_proposer text;
  v_recipient text;
  v_kind text;
  v_title text;
  v_body text;
  v_url constant text := '/marketplace?espace=echanges';
begin
  if old.status is distinct from 'pending' or new.status not in ('accepted', 'declined', 'expired', 'failed') then
    return new;
  end if;
  select username into v_proposer from profiles where id = new.proposer_id;
  select username into v_recipient from profiles where id = new.recipient_id;

  if new.status = 'accepted' then
    v_kind := 'trade_accepted'; v_title := 'Échange conclu';
    v_body := format('Votre échange avec %s est conclu : %s carte(s)%s.', coalesce(v_proposer, 'un pilote'),
      new.item_count, case when new.proposer_coins > 0 then format(' et %s pièces', new.proposer_coins) else '' end);
    perform private.push_enqueue(new.proposer_id, 'trade:' || new.id || ':accepted:proposer', v_kind, v_title, v_body, v_url, 'trade-' || new.id || ':proposer', new.proposer_coins);
    v_body := format('Votre échange avec %s est conclu : %s carte(s)%s.', coalesce(v_recipient, 'un pilote'),
      new.item_count, case when new.proposer_coins > 0 then format(' et %s pièces', new.proposer_coins) else '' end);
    perform private.push_enqueue(new.recipient_id, 'trade:' || new.id || ':accepted:recipient', v_kind, v_title, v_body, v_url, 'trade-' || new.id || ':recipient', new.proposer_coins);
  elsif new.status = 'declined' then
    perform private.push_enqueue(new.proposer_id, 'trade:' || new.id || ':declined', 'trade_declined', 'Échange refusé',
      format('%s a refusé votre proposition (%s carte(s)%s).', coalesce(v_recipient, 'Un pilote'), new.item_count,
        case when new.proposer_coins > 0 then format(' et %s pièces', new.proposer_coins) else '' end), v_url, 'trade-' || new.id, new.proposer_coins);
  elsif new.status = 'expired' then
    perform private.push_enqueue(new.proposer_id, 'trade:' || new.id || ':expired:proposer', 'trade_expired', 'Échange expiré',
      format('Votre échange avec %s a expiré (%s carte(s)%s).', coalesce(v_recipient, 'un pilote'), new.item_count,
        case when new.proposer_coins > 0 then format(' et %s pièces', new.proposer_coins) else '' end), v_url, 'trade-' || new.id, new.proposer_coins);
    perform private.push_enqueue(new.recipient_id, 'trade:' || new.id || ':expired:recipient', 'trade_expired', 'Échange expiré',
      format('La proposition de %s a expiré (%s carte(s)%s).', coalesce(v_proposer, 'un pilote'), new.item_count,
        case when new.proposer_coins > 0 then format(' et %s pièces', new.proposer_coins) else '' end), v_url, 'trade-' || new.id, new.proposer_coins);
  else
    perform private.push_enqueue(new.proposer_id, 'trade:' || new.id || ':failed:proposer', 'trade_failed', 'Échange impossible',
      format('Votre échange avec %s n’a pas pu aboutir.', coalesce(v_recipient, 'un pilote')), v_url, 'trade-' || new.id, new.proposer_coins);
    perform private.push_enqueue(new.recipient_id, 'trade:' || new.id || ':failed:recipient', 'trade_failed', 'Échange impossible',
      format('L’échange avec %s n’a pas pu aboutir.', coalesce(v_proposer, 'un pilote')), v_url, 'trade-' || new.id, new.proposer_coins);
  end if;
  return new;
exception when others then return new;
end $$;

drop trigger if exists push_trade_resolved on public.trade_offers;
create trigger push_trade_resolved after update of status on public.trade_offers
  for each row execute function private.push_trade_resolved();

-- Le challenger est informé de la réponse à sa demande.
create or replace function private.push_duel_resolved() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_target text;
begin
  if old.status <> 'pending' or new.status not in ('accepted', 'declined') then return new; end if;
  select username into v_target from profiles where id = new.target_id;
  if new.status = 'accepted' then
    perform private.push_enqueue(new.challenger_id, 'duel:' || new.id || ':accepted', 'duel_accepted', 'Défi accepté',
      format('%s a accepté votre défi. Le duel est terminé.', coalesce(v_target, 'Un pilote')),
      '/duel/organises', 'duel-request-' || new.id, 0);
  else
    perform private.push_enqueue(new.challenger_id, 'duel:' || new.id || ':declined', 'duel_declined', 'Défi refusé',
      format('%s a refusé votre défi.', coalesce(v_target, 'Un pilote')),
      '/duel/organises', 'duel-request-' || new.id, 0);
  end if;
  return new;
exception when others then return new;
end $$;

drop trigger if exists push_duel_resolved on public.duel_challenges;
create trigger push_duel_resolved after update of status on public.duel_challenges
  for each row execute function private.push_duel_resolved();
