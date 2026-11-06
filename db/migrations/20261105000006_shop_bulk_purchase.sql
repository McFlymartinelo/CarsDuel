-- 006 : achat de plusieurs exemplaires d'un même article dans la boutique.
--
-- Le prix total est calculé en base (jamais envoyé par le formulaire), le stock
-- et les pièces sont contrôlés une seule fois, puis toutes les cartes sont
-- créées dans la même transaction : tout réussit ou rien n'est débité.
-- L'ancienne signature à deux arguments reste disponible (quantité = 1).

create or replace function public.buy_shop_item(
  p_buyer_id uuid, p_catalog_id uuid, p_quantity integer
) returns uuid[]
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c_max_quantity constant integer := 999;
  v_item  public.shop_catalog%rowtype;
  v_total bigint;
  v_cards uuid[] := '{}';
begin
  perform private.assert_caller(p_buyer_id);
  if p_quantity is null or p_quantity < 1 or p_quantity > c_max_quantity then
    raise exception 'invalid_quantity';
  end if;

  select * into v_item from public.shop_catalog where id = p_catalog_id and is_active for update;
  if not found then raise exception 'item_not_found' using errcode = 'P0002'; end if;
  if v_item.stock is not null and v_item.stock < p_quantity then
    raise exception 'insufficient_stock';
  end if;
  if not exists (
    select 1 from public.card_templates
     where id = v_item.template_id
       and private.can_use_template(restricted_to_username, p_buyer_id)
  ) then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;

  v_total := v_item.price::bigint * p_quantity;
  if v_total > 2147483647 then raise exception 'invalid_quantity'; end if;

  perform private.adjust_coins(p_buyer_id, (-v_total)::integer, 'shop_purchase', v_item.id);
  if v_item.stock is not null then
    update public.shop_catalog set stock = stock - p_quantity where id = v_item.id;
  end if;

  with created as (
    insert into public.user_cards (owner_id, template_id, tire_wear, source)
    select p_buyer_id, t.id, case when t.category = 'pneus' then 100 end, 'shop'
      from public.card_templates t
      cross join generate_series(1, p_quantity)
     where t.id = v_item.template_id
    returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into v_cards from created;

  return v_cards;
end $$;

-- Ancienne signature conservée pour les appels existants.
create or replace function public.buy_shop_item(p_buyer_id uuid, p_catalog_id uuid)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_cards uuid[];
begin
  perform private.assert_caller(p_buyer_id);
  v_cards := public.buy_shop_item(p_buyer_id, p_catalog_id, 1);
  return v_cards[1];
end $$;

revoke all on function public.buy_shop_item(uuid, uuid, integer) from public;
revoke all on function public.buy_shop_item(uuid, uuid) from public;
grant execute on function public.buy_shop_item(uuid, uuid, integer) to app_user;
grant execute on function public.buy_shop_item(uuid, uuid) to app_user;
