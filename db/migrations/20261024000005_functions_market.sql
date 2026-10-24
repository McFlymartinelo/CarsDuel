-- =============================================================================
-- 005 : marketplace (séquestre carte + pièces), boutique officielle
-- Ordre de verrouillage constant : listing -> offre -> profils (par id) -> cartes.
-- Taxe vendeur : Gain_net = FLOOR(prix * 0.90).
-- Les pièces d'une offre sont débitées à l'offre (séquestre) et remboursées
-- si l'offre est retirée/refusée ou si l'annonce se clôt.
-- =============================================================================

-- Rembourse et clôt toutes les offres 'pending' d'une annonce (sauf éventuellement une).
create or replace function private.refund_pending_offers(p_listing uuid, p_except uuid default null)
returns void language plpgsql as $$
declare o record;
begin
  for o in select id, buyer_id, amount from public.marketplace_offers
            where listing_id = p_listing and status = 'pending' and id is distinct from p_except
            order by buyer_id for update loop
    perform private.adjust_coins(o.buyer_id, o.amount, 'offer_refund', o.id);
    update public.marketplace_offers set status = 'refunded', resolved_at = now() where id = o.id;
  end loop;
end $$;

-- Finalise une vente : débit acheteur (sauf si déjà en séquestre), crédit vendeur net, transfert de propriété.
create or replace function private.settle_sale(
  p_listing public.marketplace_listings, p_buyer uuid, p_price integer, p_prepaid boolean, p_except_offer uuid default null
) returns jsonb language plpgsql as $$
declare
  v_net  integer := floor(p_price * 0.90)::integer;
  v_tax  integer := p_price - floor(p_price * 0.90)::integer;
begin
  perform 1 from public.profiles where id in (p_listing.seller_id, p_buyer) order by id for update;

  if not p_prepaid then
    perform private.adjust_coins(p_buyer, -p_price, 'market_purchase', p_listing.id);
  end if;
  perform private.adjust_coins(p_listing.seller_id, v_net, 'market_sale', p_listing.id);

  update public.user_cards set owner_id = p_buyer, is_listed = false where id = p_listing.card_id;
  update public.marketplace_listings
     set status = 'sold', buyer_id = p_buyer, sold_price = p_price,
         tax_amount = v_tax, seller_net = v_net, closed_at = now()
   where id = p_listing.id;
  perform private.refund_pending_offers(p_listing.id, p_except_offer);

  return jsonb_build_object('listing_id', p_listing.id, 'card_id', p_listing.card_id,
                            'price', p_price, 'tax', v_tax, 'seller_net', v_net);
end $$;

-- ---------- Mise en vente ----------------------------------------------------
create or replace function public.create_listing(
  p_seller_id uuid, p_card_id uuid, p_price integer default null, p_accepts_offers boolean default false
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_card user_cards%rowtype;
  v_id uuid;
begin
  perform private.assert_caller(p_seller_id);
  if p_price is null and not p_accepts_offers then raise exception 'price_or_offers_required'; end if;
  if p_price < 0 then raise exception 'invalid_price'; end if;     -- aucun plancher/plafond au-delà de >= 0

  select * into v_card from user_cards where id = p_card_id and owner_id = p_seller_id for update;
  if not found then raise exception 'card_not_owned' using errcode = '42501'; end if;
  if v_card.is_destroyed then raise exception 'card_destroyed'; end if;
  if v_card.is_listed    then raise exception 'already_listed'; end if;
  if exists (select 1 from user_decks
              where p_card_id in (engine_card_id, gearbox_card_id, tire_card_id)) then
    raise exception 'card_in_deck' using hint = 'Retirez la carte de vos decks avant de la vendre.';
  end if;

  insert into marketplace_listings (seller_id, card_id, price, accepts_offers)
  values (p_seller_id, p_card_id, p_price, p_accepts_offers) returning id into v_id;
  update user_cards set is_listed = true where id = p_card_id;
  return v_id;
end $$;

create or replace function public.cancel_listing(p_seller_id uuid, p_listing_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_l marketplace_listings%rowtype;
begin
  perform private.assert_caller(p_seller_id);
  select * into v_l from marketplace_listings where id = p_listing_id and seller_id = p_seller_id for update;
  if not found then raise exception 'listing_not_found' using errcode = 'P0002'; end if;
  if v_l.status <> 'active' then raise exception 'listing_closed'; end if;

  perform private.refund_pending_offers(v_l.id);
  update user_cards set is_listed = false where id = v_l.card_id;
  update marketplace_listings set status = 'cancelled', closed_at = now() where id = v_l.id;
end $$;

-- ---------- Achat direct -----------------------------------------------------
create or replace function public.buy_marketplace_item(p_buyer_id uuid, p_listing_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_l marketplace_listings%rowtype;
begin
  perform private.assert_caller(p_buyer_id);
  select * into v_l from marketplace_listings where id = p_listing_id for update;
  if not found then raise exception 'listing_not_found' using errcode = 'P0002'; end if;
  if v_l.status <> 'active'        then raise exception 'listing_closed'; end if;
  if v_l.price is null             then raise exception 'offers_only'; end if;
  if v_l.seller_id = p_buyer_id    then raise exception 'cannot_buy_own_listing'; end if;

  return private.settle_sale(v_l, p_buyer_id, v_l.price, false);   -- 'insufficient_funds' annule tout
end $$;

-- ---------- Offres -----------------------------------------------------------
create or replace function public.make_offer(p_buyer_id uuid, p_listing_id uuid, p_amount integer)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_l marketplace_listings%rowtype;
  v_id uuid;
begin
  perform private.assert_caller(p_buyer_id);
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;

  select * into v_l from marketplace_listings where id = p_listing_id for update;
  if not found then raise exception 'listing_not_found' using errcode = 'P0002'; end if;
  if v_l.status <> 'active'     then raise exception 'listing_closed'; end if;
  if not v_l.accepts_offers     then raise exception 'offers_disabled'; end if;
  if v_l.seller_id = p_buyer_id then raise exception 'cannot_offer_own_listing'; end if;
  if exists (select 1 from marketplace_offers
              where listing_id = v_l.id and buyer_id = p_buyer_id and status = 'pending') then
    raise exception 'offer_already_pending' using hint = 'Retirez votre offre avant d''en faire une nouvelle.';
  end if;

  insert into marketplace_offers (listing_id, buyer_id, amount)
  values (v_l.id, p_buyer_id, p_amount) returning id into v_id;
  perform private.adjust_coins(p_buyer_id, -p_amount, 'offer_escrow', v_id);   -- séquestre
  return v_id;
end $$;

create or replace function public.withdraw_offer(p_buyer_id uuid, p_offer_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_listing uuid;
  v_o marketplace_offers%rowtype;
begin
  perform private.assert_caller(p_buyer_id);
  select listing_id into v_listing from marketplace_offers where id = p_offer_id and buyer_id = p_buyer_id;
  if not found then raise exception 'offer_not_found' using errcode = 'P0002'; end if;

  perform 1 from marketplace_listings where id = v_listing for update;      -- listing d'abord
  select * into v_o from marketplace_offers where id = p_offer_id for update;
  if v_o.status <> 'pending' then raise exception 'offer_not_pending'; end if;

  perform private.adjust_coins(v_o.buyer_id, v_o.amount, 'offer_refund', v_o.id);
  update marketplace_offers set status = 'withdrawn', resolved_at = now() where id = v_o.id;
end $$;

create or replace function public.respond_offer(p_seller_id uuid, p_offer_id uuid, p_accept boolean)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_listing uuid;
  v_l marketplace_listings%rowtype;
  v_o marketplace_offers%rowtype;
  v_res jsonb;
begin
  perform private.assert_caller(p_seller_id);
  select listing_id into v_listing from marketplace_offers where id = p_offer_id;
  if not found then raise exception 'offer_not_found' using errcode = 'P0002'; end if;

  select * into v_l from marketplace_listings where id = v_listing and seller_id = p_seller_id for update;
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_l.status <> 'active' then raise exception 'listing_closed'; end if;

  select * into v_o from marketplace_offers where id = p_offer_id for update;
  if v_o.status <> 'pending' then raise exception 'offer_not_pending'; end if;

  if p_accept then
    update marketplace_offers set status = 'accepted', resolved_at = now() where id = v_o.id;
    v_res := private.settle_sale(v_l, v_o.buyer_id, v_o.amount, true, v_o.id);  -- pièces déjà en séquestre
  else
    perform private.adjust_coins(v_o.buyer_id, v_o.amount, 'offer_refund', v_o.id);
    update marketplace_offers set status = 'rejected', resolved_at = now() where id = v_o.id;
    v_res := jsonb_build_object('offer_id', v_o.id, 'status', 'rejected');
  end if;
  return v_res;
end $$;

-- ---------- Boutique officielle ("Magasin de pièces neuves") ----------------
create or replace function public.buy_shop_item(p_buyer_id uuid, p_catalog_id uuid)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_item shop_catalog%rowtype;
  v_card uuid;
begin
  perform private.assert_caller(p_buyer_id);
  select * into v_item from shop_catalog where id = p_catalog_id and is_active for update;
  if not found then raise exception 'item_not_found' using errcode = 'P0002'; end if;
  if v_item.stock is not null and v_item.stock <= 0 then raise exception 'out_of_stock'; end if;

  perform private.adjust_coins(p_buyer_id, -v_item.price, 'shop_purchase', v_item.id);
  if v_item.stock is not null then update shop_catalog set stock = stock - 1 where id = v_item.id; end if;
  v_card := private.grant_card(p_buyer_id, v_item.template_id, 'shop');
  return v_card;
end $$;

-- ---------- Droits d'exécution ----------------------------------------------
revoke all on function public.create_listing(uuid, uuid, integer, boolean) from public;
revoke all on function public.cancel_listing(uuid, uuid)                   from public;
revoke all on function public.buy_marketplace_item(uuid, uuid)             from public;
revoke all on function public.make_offer(uuid, uuid, integer)              from public;
revoke all on function public.withdraw_offer(uuid, uuid)                   from public;
revoke all on function public.respond_offer(uuid, uuid, boolean)           from public;
revoke all on function public.buy_shop_item(uuid, uuid)                    from public;
grant execute on function public.create_listing(uuid, uuid, integer, boolean) to app_user;
grant execute on function public.cancel_listing(uuid, uuid)                   to app_user;
grant execute on function public.buy_marketplace_item(uuid, uuid)             to app_user;
grant execute on function public.make_offer(uuid, uuid, integer)              to app_user;
grant execute on function public.withdraw_offer(uuid, uuid)                   to app_user;
grant execute on function public.respond_offer(uuid, uuid, boolean)           to app_user;
grant execute on function public.buy_shop_item(uuid, uuid)                    to app_user;
