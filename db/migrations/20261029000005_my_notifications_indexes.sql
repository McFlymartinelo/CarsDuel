-- =============================================================================
-- 005 : my_notifications — filtrage avant union et index dédiés
-- L'ancienne version unionnait tout l'historique puis filtrait les 30 derniers
-- jours. Chaque branche applique désormais sa propre coupure temporelle, ce qui
-- permet au planificateur d'utiliser les index ci-dessous.
-- =============================================================================

create index if not exists idx_offers_buyer_status_resolved
  on public.marketplace_offers (buyer_id, status, resolved_at desc);

create index if not exists idx_listings_seller_status_closed
  on public.marketplace_listings (seller_id, status, closed_at desc);

create index if not exists idx_payouts_user_created
  on public.leaderboard_payouts (user_id, created_at desc);

-- duels_history.defender_id est déjà couvert par idx_duels_defender
-- (defender_id, created_at desc).
-- duel_challenges.target_id est déjà couvert par idx_duel_challenges_pending
-- (target_id, created_at desc) where status = 'pending'.

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
    select 'offer_received'::text as kind, o.created_at as at, t.name as label, o.amount as amount
      from marketplace_offers o
      join marketplace_listings l on l.id = o.listing_id
      join user_cards uc on uc.id = l.card_id
      join card_templates t on t.id = uc.template_id
     where l.seller_id = p_user_id
       and o.status = 'pending'
       and o.created_at > now() - interval '30 days'
    union all
    select 'sale', l.closed_at, t.name, l.seller_net
      from marketplace_listings l
      join user_cards uc on uc.id = l.card_id
      join card_templates t on t.id = uc.template_id
     where l.seller_id = p_user_id
       and l.status = 'sold'
       and l.closed_at > now() - interval '30 days'
    union all
    select case o.status when 'accepted' then 'offer_accepted' else 'offer_rejected' end,
           o.resolved_at, t.name, o.amount
      from marketplace_offers o
      join marketplace_listings l on l.id = o.listing_id
      join user_cards uc on uc.id = l.card_id
      join card_templates t on t.id = uc.template_id
     where o.buyer_id = p_user_id
       and o.status in ('accepted', 'rejected')
       and o.resolved_at > now() - interval '30 days'
    union all
    select case d.result when 'attacker_win' then 'duel_lost' else 'duel_won' end,
           d.created_at, p.username, d.defender_coins
      from duels_history d
      join profiles p on p.id = d.attacker_id
     where d.defender_id = p_user_id
       and d.created_at > now() - interval '30 days'
    union all
    select 'duel_request', c.created_at, p.username, 0
      from duel_challenges c
      join profiles p on p.id = c.challenger_id
     where c.target_id = p_user_id
       and c.status = 'pending'
       and c.created_at > now() - interval '30 days'
    union all
    select 'payout', pp.created_at,
           case pp.period when 'weekly' then 'Classement de la semaine' else 'Classement du mois' end || ' (#' || pp.rank || ')',
           pp.coins
      from leaderboard_payouts pp
     where pp.user_id = p_user_id
       and pp.created_at > now() - interval '30 days'
  ), recent as (
    select kind, at, label, amount from ev order by at desc limit 15
  )
  select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'at', at, 'label', label, 'amount', amount,
                                               'unread', at > v_seen) order by at desc), '[]'::jsonb)
    into v_items from recent;

  return jsonb_build_object(
    'unread', (select count(*) from jsonb_array_elements(v_items) e where (e->>'unread')::boolean),
    'items', v_items);
end $$;

revoke all on function public.my_notifications(uuid) from public;
grant execute on function public.my_notifications(uuid) to app_user;
