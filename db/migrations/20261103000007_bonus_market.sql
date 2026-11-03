-- 007 : les cartes bonus se vendent sur la marketplace. Le recyclage reste interdit.
-- create_listings met en vente plusieurs exemplaires d'un coup (une annonce par carte, dans une seule transaction).

-- ---------- 1. create_listing : plus de refus pour les bonus ----------------
create or replace function public.create_listing(
  p_seller_id uuid, p_card_id uuid, p_price integer default null, p_accepts_offers boolean default false
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c_price_floor constant integer := 10;
  v_card user_cards%rowtype;
  v_name text;
  v_cat  public.card_category;
  v_id uuid;
begin
  perform private.assert_caller(p_seller_id);
  if p_price is null and not p_accepts_offers then raise exception 'price_or_offers_required'; end if;
  if p_price is not null and p_price < c_price_floor then raise exception 'price_too_low'; end if;

  select * into v_card from user_cards where id = p_card_id and owner_id = p_seller_id for update;
  if not found then raise exception 'card_not_owned' using errcode = '42501'; end if;
  -- Une carte détruite reste vendable : elle peut être rachetée pour compléter
  -- une collection ou alimenter le centre de recyclage.
  if v_card.is_listed    then raise exception 'already_listed'; end if;
  if v_card.in_recycle_bin then raise exception 'card_in_recycle_bin'; end if;

  select name, category into v_name, v_cat from card_templates where id = v_card.template_id;
  if v_cat is null then raise exception 'template_not_found'; end if;
  if exists (
    select 1 from card_templates
     where id = v_card.template_id and restricted_to_username is not null
  ) then
    raise exception 'card_not_sellable';
  end if;

  perform private.detach_card(p_card_id);

  insert into marketplace_listings
    (seller_id, card_id, card_template_id, card_name, card_category, price, accepts_offers)
  values
    (p_seller_id, p_card_id, v_card.template_id, v_name, v_cat, p_price, p_accepts_offers)
  returning id into v_id;
  update user_cards set is_listed = true where id = p_card_id;
  return v_id;
end $$;

revoke all on function public.create_listing(uuid, uuid, integer, boolean) from public;
grant execute on function public.create_listing(uuid, uuid, integer, boolean) to app_user;

-- ---------- 2. create_listings : mise en vente de plusieurs exemplaires ----
create or replace function public.create_listings(
  p_seller_id uuid, p_card_ids uuid[], p_price integer default null, p_accepts_offers boolean default false
) returns uuid[]
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_card_id uuid;
  v_ids uuid[] := '{}';
begin
  perform private.assert_caller(p_seller_id);
  if p_card_ids is null or cardinality(p_card_ids) = 0 then raise exception 'invalid_quantity'; end if;

  foreach v_card_id in array p_card_ids loop
    v_ids := v_ids || public.create_listing(p_seller_id, v_card_id, p_price, p_accepts_offers);
  end loop;
  return v_ids;
end $$;

revoke all on function public.create_listings(uuid, uuid[], integer, boolean) from public;
grant execute on function public.create_listings(uuid, uuid[], integer, boolean) to app_user;
