-- =============================================================================
-- 012 : marketplace — plancher de 10 pièces pour les annonces et les offres
-- Les contraintes CHECK sont ajoutées NOT VALID : elles s'appliquent aux
-- nouvelles lignes (et aux mises à jour) sans réécrire l'historique des ventes.
-- =============================================================================

-- 1. Clôturer les annonces actives sous le nouveau plancher et rembourser leurs offres.
do $$
declare l record;
begin
  for l in select id from public.marketplace_listings
            where status = 'active' and price < 10
            order by id for update loop
    perform private.refund_pending_offers(l.id);
    update public.marketplace_listings
       set status = 'cancelled', closed_at = now()
     where id = l.id;
    update public.user_cards uc
       set is_listed = false
      from public.marketplace_listings ml
     where ml.id = l.id and uc.id = ml.card_id;
  end loop;
end $$;

-- 2. Rembourser les offres encore en attente sous le nouveau plancher.
do $$
declare o record;
begin
  for o in select id, buyer_id, amount from public.marketplace_offers
            where status = 'pending' and amount < 10
            order by buyer_id for update loop
    perform private.adjust_coins(o.buyer_id, o.amount, 'offer_refund', o.id);
    update public.marketplace_offers
       set status = 'refunded', resolved_at = now()
     where id = o.id;
  end loop;
end $$;

-- 3. Contraintes de plancher (NULL = annonce « offres uniquement »).
alter table public.marketplace_listings drop constraint if exists marketplace_listings_price_check;
alter table public.marketplace_listings
  add constraint marketplace_listings_price_check
  check (price is null or price >= 10) not valid;

alter table public.marketplace_offers drop constraint if exists marketplace_offers_amount_check;
alter table public.marketplace_offers
  add constraint marketplace_offers_amount_check
  check (amount >= 10) not valid;

-- 4. Mise en vente : prix minimum 10 pièces.
create or replace function public.create_listing(
  p_seller_id uuid, p_card_id uuid, p_price integer default null, p_accepts_offers boolean default false
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c_price_floor constant integer := 10;
  v_card user_cards%rowtype;
  v_cat  public.card_category;
  v_id uuid;
begin
  perform private.assert_caller(p_seller_id);
  if p_price is null and not p_accepts_offers then raise exception 'price_or_offers_required'; end if;
  if p_price is not null and p_price < c_price_floor then raise exception 'price_too_low'; end if;

  select * into v_card from user_cards where id = p_card_id and owner_id = p_seller_id for update;
  if not found then raise exception 'card_not_owned' using errcode = '42501'; end if;
  if v_card.is_destroyed then raise exception 'card_destroyed'; end if;
  if v_card.is_listed    then raise exception 'already_listed'; end if;

  select category into v_cat from card_templates where id = v_card.template_id;
  if v_cat = 'bonus' then raise exception 'bonus_not_sellable'; end if;
  if exists (
    select 1 from card_templates
     where id = v_card.template_id and restricted_to_username is not null
  ) then
    raise exception 'card_not_sellable';
  end if;

  perform private.detach_card(p_card_id);

  insert into marketplace_listings (seller_id, card_id, price, accepts_offers)
  values (p_seller_id, p_card_id, p_price, p_accepts_offers) returning id into v_id;
  update user_cards set is_listed = true where id = p_card_id;
  return v_id;
end $$;

-- 5. Offres : montant minimum 10 pièces.
create or replace function public.make_offer(p_buyer_id uuid, p_listing_id uuid, p_amount integer)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c_offer_floor constant integer := 10;
  v_l marketplace_listings%rowtype;
  v_id uuid;
begin
  perform private.assert_caller(p_buyer_id);
  if p_amount is null or p_amount < c_offer_floor then raise exception 'offer_too_low'; end if;

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
