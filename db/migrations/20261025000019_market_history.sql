-- =============================================================================
-- 019 : historique des ventes et achats du joueur
-- La carte vendue n'appartient plus au vendeur : la RLS de user_cards masquerait le nom.
-- La fonction relit donc le modèle de carte avec les droits du propriétaire, pour le seul appelant.
-- =============================================================================

create or replace function public.my_market_history(p_user_id uuid, p_limit integer default 15)
returns table (id uuid, role text, card_name text, category public.card_category,
               price integer, net integer, closed_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform private.assert_caller(p_user_id);
  return query
    select l.id,
           case when l.seller_id = p_user_id then 'sale' else 'purchase' end,
           t.name, t.category, l.sold_price, l.seller_net, l.closed_at
      from marketplace_listings l
      join user_cards uc on uc.id = l.card_id
      join card_templates t on t.id = uc.template_id
     where l.status = 'sold' and (l.seller_id = p_user_id or l.buyer_id = p_user_id)
     order by l.closed_at desc
     limit least(greatest(p_limit, 1), 50);
end $$;

revoke all on function public.my_market_history(uuid, integer) from public;
grant execute on function public.my_market_history(uuid, integer) to app_user;
