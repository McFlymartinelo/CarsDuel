-- =============================================================================
-- 014 : les cartes bonus ne se vendent pas. Recyclage fixe : 1 pièce.
-- Les annonces bonus encore actives sont annulées et les offres remboursées.
-- =============================================================================

create or replace function public.recycle_card(p_user uuid, p_card uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_card public.user_cards%rowtype;
  v_cat  public.card_category;
  v_r0   numeric;
  v_dr   numeric;
  v_base integer;
  v_pct  numeric;
  v_gain integer;
begin
  perform private.assert_caller(p_user);

  select * into v_card from public.user_cards where id = p_card and owner_id = p_user for update;
  if not found then raise exception 'card_not_owned' using errcode = '42501'; end if;
  if v_card.is_destroyed then raise exception 'card_destroyed'; end if;
  if v_card.is_listed then raise exception 'already_listed'; end if;

  select category, base_break_risk, wear_sensitivity
    into v_cat, v_r0, v_dr
    from public.card_templates where id = v_card.template_id;

  if v_cat = 'bonus' then
    v_base := 1;
    v_pct := 100;
    v_gain := 1;
  elsif v_cat = 'pneus' then
    v_base := 10;
    v_pct := coalesce(v_card.tire_wear, 0);
    v_gain := round(v_base * v_pct / 100.0)::integer;
  elsif v_cat in ('moteur', 'boite') then
    v_base := case when v_cat = 'moteur' then 50 else 30 end;
    v_pct := greatest(0, least(100, 100 - (coalesce(v_r0, 0) + v_card.runs_count * coalesce(v_dr, 0))));
    v_gain := round(v_base * v_pct / 100.0)::integer;
  else
    raise exception 'not_recyclable';
  end if;

  perform private.detach_card(p_card);
  delete from public.user_cards where id = p_card;
  perform private.adjust_coins(p_user, v_gain, 'recycle', p_card);

  return jsonb_build_object('card_id', p_card, 'coins', v_gain, 'base', v_base, 'condition_pct', v_pct);
end $$;

create or replace function public.create_listing(
  p_seller_id uuid, p_card_id uuid, p_price integer default null, p_accepts_offers boolean default false
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c_price_floor constant integer := 1;
  v_card user_cards%rowtype;
  v_cat  public.card_category;
  v_id uuid;
begin
  perform private.assert_caller(p_seller_id);
  if p_price is null and not p_accepts_offers then raise exception 'price_or_offers_required'; end if;
  if p_price is not null and p_price < c_price_floor then raise exception 'invalid_price'; end if;

  select * into v_card from user_cards where id = p_card_id and owner_id = p_seller_id for update;
  if not found then raise exception 'card_not_owned' using errcode = '42501'; end if;
  if v_card.is_destroyed then raise exception 'card_destroyed'; end if;
  if v_card.is_listed    then raise exception 'already_listed'; end if;

  select category into v_cat from card_templates where id = v_card.template_id;
  if v_cat = 'bonus' then raise exception 'bonus_not_sellable'; end if;

  perform private.detach_card(p_card_id);

  insert into marketplace_listings (seller_id, card_id, price, accepts_offers)
  values (p_seller_id, p_card_id, p_price, p_accepts_offers) returning id into v_id;
  update user_cards set is_listed = true where id = p_card_id;
  return v_id;
end $$;

do $$
declare v_l public.marketplace_listings%rowtype;
begin
  for v_l in
    select l.*
      from public.marketplace_listings l
      join public.user_cards uc on uc.id = l.card_id
      join public.card_templates t on t.id = uc.template_id
     where l.status = 'active' and t.category = 'bonus'
     order by l.id
     for update of l
  loop
    perform private.refund_pending_offers(v_l.id);
    update public.user_cards set is_listed = false where id = v_l.card_id;
    update public.marketplace_listings set status = 'cancelled', closed_at = now() where id = v_l.id;
  end loop;
end $$;
