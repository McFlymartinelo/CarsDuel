-- =============================================================================
-- 018 : prix de référence du marché + notifications dans l'app
-- - market_price_ref : moyenne des 10 dernières ventes (60 jours) par modèle de carte.
--   Vue (droits du propriétaire) : n'expose que des agrégats, jamais les ventes d'autrui.
-- - my_notifications : événements récents du joueur, calculés depuis les tables existantes
--   (aucune table de notifications à maintenir). "Lu" = antérieur à notifications_seen_at.
-- =============================================================================

alter table public.profiles add column notifications_seen_at timestamptz not null default now();

create view public.market_price_ref as
with recent as (
  select uc.template_id, l.sold_price,
         row_number() over (partition by uc.template_id order by l.closed_at desc) as rn
    from public.marketplace_listings l
    join public.user_cards uc on uc.id = l.card_id
   where l.status = 'sold' and l.sold_price is not null and l.closed_at > now() - interval '60 days'
)
select template_id, round(avg(sold_price))::integer as avg_price, count(*)::integer as sales
  from recent where rn <= 10 group by template_id;

grant select on public.market_price_ref to app_user;

-- Retourne {"unread": n, "items": [{kind, at, label, amount, unread}]} (15 derniers événements, 30 jours).
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
     where l.seller_id = p_user_id and o.status = 'pending'
    union all
    select 'sale', l.closed_at, t.name, l.seller_net
      from marketplace_listings l
      join user_cards uc on uc.id = l.card_id
      join card_templates t on t.id = uc.template_id
     where l.seller_id = p_user_id and l.status = 'sold'
    union all
    select case o.status when 'accepted' then 'offer_accepted' else 'offer_rejected' end,
           o.resolved_at, t.name, o.amount
      from marketplace_offers o
      join marketplace_listings l on l.id = o.listing_id
      join user_cards uc on uc.id = l.card_id
      join card_templates t on t.id = uc.template_id
     where o.buyer_id = p_user_id and o.status in ('accepted', 'rejected')
    union all
    select case d.result when 'attacker_win' then 'duel_lost' else 'duel_won' end,
           d.created_at, p.username, d.defender_coins
      from duels_history d
      join profiles p on p.id = d.attacker_id
     where d.defender_id = p_user_id
    union all
    select 'payout', pp.created_at,
           case pp.period when 'weekly' then 'Classement de la semaine' else 'Classement du mois' end || ' (#' || pp.rank || ')',
           pp.coins
      from leaderboard_payouts pp
     where pp.user_id = p_user_id
  ), recent as (
    select * from ev where at > now() - interval '30 days' order by at desc limit 15
  )
  select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'at', at, 'label', label, 'amount', amount,
                                               'unread', at > v_seen) order by at desc), '[]'::jsonb)
    into v_items from recent;

  return jsonb_build_object(
    'unread', (select count(*) from jsonb_array_elements(v_items) e where (e->>'unread')::boolean),
    'items', v_items);
end $$;

create or replace function public.mark_notifications_seen(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform private.assert_caller(p_user_id);
  update profiles set notifications_seen_at = now() where id = p_user_id;
end $$;

revoke all on function public.my_notifications(uuid), public.mark_notifications_seen(uuid) from public;
grant execute on function public.my_notifications(uuid), public.mark_notifications_seen(uuid) to app_user;
