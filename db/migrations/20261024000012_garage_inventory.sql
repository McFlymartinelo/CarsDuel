-- =============================================================================
-- 012 : garage = inventaire. Config unique côté duel, recyclage, kit de départ.
--
-- Recyclage (identique à recycleQuote dans src/lib/game.ts) :
--   pièces = arrondi(base × pourcentage restant / 100)
--   moteur 50, boîte 30, pneus 10.
--   Pneu : gomme restante (tire_wear).
--   Moteur / boîte : 100 − risque de casse actuel (R0 + runs × sensibilité), borné 0–100.
--   Une pièce neuve à 100 % rapporte donc exactement la base (50, 30 ou 10).
--
-- Vendre ou recycler une carte la retire des configs (user_decks) avant l'action.
-- Le kit de départ ne crée pas de config : 1 moteur commun, 1 boîte commune,
-- 5 bonus, 1 pneu actif de chaque type.
-- =============================================================================

create or replace function private.detach_card(p_card uuid) returns void
language plpgsql as $$
begin
  delete from public.user_decks
   where engine_card_id = p_card
      or gearbox_card_id = p_card
      or tire_card_id = p_card;
end $$;

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

  if v_cat = 'pneus' then
    v_base := 10;
    v_pct := coalesce(v_card.tire_wear, 0);
  elsif v_cat in ('moteur', 'boite') then
    v_base := case when v_cat = 'moteur' then 50 else 30 end;
    v_pct := greatest(0, least(100, 100 - (coalesce(v_r0, 0) + v_card.runs_count * coalesce(v_dr, 0))));
  else
    raise exception 'not_recyclable';
  end if;

  v_gain := round(v_base * v_pct / 100.0)::integer;
  perform private.detach_card(p_card);
  delete from public.user_cards where id = p_card;
  perform private.adjust_coins(p_user, v_gain, 'recycle', p_card);

  return jsonb_build_object('card_id', p_card, 'coins', v_gain, 'base', v_base, 'condition_pct', v_pct);
end $$;

revoke all on function public.recycle_card(uuid, uuid) from public;
grant execute on function public.recycle_card(uuid, uuid) to app_user;

-- Vendre retire la carte de la config au lieu de refuser.
create or replace function public.create_listing(
  p_seller_id uuid, p_card_id uuid, p_price integer default null, p_accepts_offers boolean default false
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c_price_floor constant integer := 1;
  v_card user_cards%rowtype;
  v_id uuid;
begin
  perform private.assert_caller(p_seller_id);
  if p_price is null and not p_accepts_offers then raise exception 'price_or_offers_required'; end if;
  if p_price is not null and p_price < c_price_floor then raise exception 'invalid_price'; end if;

  select * into v_card from user_cards where id = p_card_id and owner_id = p_seller_id for update;
  if not found then raise exception 'card_not_owned' using errcode = '42501'; end if;
  if v_card.is_destroyed then raise exception 'card_destroyed'; end if;
  if v_card.is_listed    then raise exception 'already_listed'; end if;

  perform private.detach_card(p_card_id);

  insert into marketplace_listings (seller_id, card_id, price, accepts_offers)
  values (p_seller_id, p_card_id, p_price, p_accepts_offers) returning id into v_id;
  update user_cards set is_listed = true where id = p_card_id;
  return v_id;
end $$;

create or replace function private.grant_starter_kit(p_user uuid) returns void
language plpgsql as $$
declare
  v_id    uuid;
  v_email text;
  v_type  public.tire_type;
  i       integer;
begin
  select lower(email) into v_email from public.users where id = p_user;
  if v_email is null
     or (select count(*) from public.users where lower(email) = v_email) <> 1 then
    return;
  end if;

  select id into v_id from public.card_templates
   where category = 'moteur' and rarity = 'commune' and is_active order by random() limit 1;
  if v_id is not null then perform private.grant_card(p_user, v_id, 'starter'); end if;

  select id into v_id from public.card_templates
   where category = 'boite' and rarity = 'commune' and is_active order by random() limit 1;
  if v_id is not null then perform private.grant_card(p_user, v_id, 'starter'); end if;

  for i in 1..5 loop
    perform private.grant_card(p_user, private.draw_bonus_template(), 'starter');
  end loop;

  for v_type in select unnest(enum_range(null::public.tire_type)) loop
    select id into v_id from public.card_templates
     where category = 'pneus' and tire_type = v_type and is_active
     order by random() limit 1;
    if v_id is not null then perform private.grant_card(p_user, v_id, 'starter'); end if;
  end loop;
end $$;
