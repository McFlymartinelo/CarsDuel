-- =============================================================================
-- 004 : helpers privés + RPC execute_duel + claim_daily_pull
-- Toutes les RPC : SECURITY DEFINER, search_path figé, current_uid() vérifié.
-- =============================================================================

-- ---------- Helpers (schéma private, non appelables par les clients) --------

create or replace function private.assert_caller(p_user uuid) returns void
language plpgsql stable as $$
begin
  if public.current_uid() is null or public.current_uid() is distinct from p_user then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

-- Début (timestamptz) du jour calendaire courant à Paris.
create or replace function private.paris_day_start(p_ts timestamptz default now()) returns timestamptz
language sql stable as $$
  select date_trunc('day', p_ts at time zone 'Europe/Paris') at time zone 'Europe/Paris'
$$;

create or replace function private.adjust_coins(p_user uuid, p_delta integer, p_reason text, p_ref uuid default null)
returns void language plpgsql as $$
declare v_coins integer;
begin
  if p_delta = 0 then return; end if;
  select coins into v_coins from public.profiles where id = p_user for update;
  if not found then raise exception 'profile_not_found'; end if;
  if v_coins + p_delta < 0 then raise exception 'insufficient_funds' using errcode = '23514'; end if;
  update public.profiles set coins = coins + p_delta where id = p_user;
  insert into public.coin_transactions (user_id, amount, reason, ref_id) values (p_user, p_delta, p_reason, p_ref);
end $$;

create or replace function private.add_xp(p_user uuid, p_amount integer, p_source text, p_duel uuid)
returns void language plpgsql as $$
begin
  if p_amount <= 0 then return; end if;
  update public.profiles set xp_total = xp_total + p_amount where id = p_user;
  insert into public.xp_events (user_id, amount, source, duel_id) values (p_user, p_amount, p_source, p_duel);
end $$;

-- Crée une instance de carte (pneus neufs = 100 % de gomme).
create or replace function private.grant_card(p_user uuid, p_template uuid, p_source text) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.user_cards (owner_id, template_id, tire_wear, source)
  select p_user, t.id, case when t.category = 'pneus' then 100 end, p_source
  from public.card_templates t where t.id = p_template
  returning id into v_id;
  if v_id is null then raise exception 'template_not_found'; end if;
  return v_id;
end $$;

-- Score de performance (Phase 2) — formule unique partagée attaquant / fantôme.
create or replace function private.compute_sp(
  p_power numeric, p_weight_total numeric, p_shift_ms numeric, p_gum numeric, p_tire_bonus_pct numeric
) returns numeric language sql immutable as $$
  select greatest(10, 100 + p_power * 0.55 - p_weight_total * 0.25 - p_shift_ms * 0.05)
       * greatest(0.10, 1.0 + (p_tire_bonus_pct
           - case when p_gum >= 70 then 0 else floor((70 - p_gum) / 3.0) end) / 100.0)
$$;

-- Tirage de rareté : 70 / 20 / 7 / 2,5 / 0,5 %.
create or replace function private.roll_rarity() returns public.card_rarity
language plpgsql as $$
declare r numeric := random() * 100;
begin
  return case when r < 70   then 'commune'
              when r < 90   then 'rare'
              when r < 97   then 'tres_rare'
              when r < 99.5 then 'epique'
              else 'legendaire' end;
end $$;

-- Moteur ou boîte selon la rareté tirée. Si le catalogue n'a rien à cette rareté
-- (ex. catalogue vide / partiel), on retombe sur la rareté disponible la plus proche.
create or replace function private.draw_mechanical_template() returns uuid
language plpgsql as $$
declare
  v_rank integer := array_position(enum_range(null::public.card_rarity), private.roll_rarity());
  v_id   uuid;
begin
  select id into v_id
  from public.card_templates
  where category in ('moteur', 'boite') and is_active
  order by abs(array_position(enum_range(null::public.card_rarity), rarity) - v_rank),
           -ln(1 - random()) / drop_weight          -- tirage pondéré (exponentielle)
  limit 1;
  if v_id is null then raise exception 'catalog_empty' using hint = 'Aucun moteur/boîte actif dans card_templates.'; end if;
  return v_id;
end $$;

create or replace function private.draw_bonus_template() returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  select id into v_id from public.card_templates
  where category = 'bonus' and is_active order by random() limit 1;
  if v_id is null then raise exception 'catalog_empty' using hint = 'Aucune carte bonus active.'; end if;
  return v_id;
end $$;

-- =============================================================================
-- execute_duel(attacker_id, deck_id, bonus_user_card_id optionnel)
-- Hypothèses documentées (spec muette) :
--  * égalité de SP => le défenseur gagne ;
--  * casse en Phase 1 => fin immédiate : ni usure pneu ni incrément de runs ;
--  * le bonus est consommé dès le lancement (même en cas de casse) ;
--  * si aucun adversaire valide n'existe, le duel est refusé AVANT toute consommation.
-- =============================================================================
create or replace function public.execute_duel(
  p_attacker_id          uuid,
  p_deck_id              uuid,
  p_bonus_user_card_id   uuid default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c_defense_cap constant integer := 5;
  v_deck     public.user_decks%rowtype;
  a          record;   -- deck attaquant (cartes + stats)
  g          record;   -- deck fantôme
  w          public.weather_conditions%rowtype;
  v_amod     public.tire_weather_modifiers%rowtype;
  v_gmod     public.tire_weather_modifiers%rowtype;
  v_weather  public.weather_type;
  v_effect   public.bonus_effect;
  v_bonus_id uuid;
  v_p_e numeric; v_p_g numeric;
  v_roll_e numeric; v_roll_g numeric;
  v_broken   public.card_category;
  v_saved    boolean := false;
  v_a_sp numeric; v_g_sp numeric;
  v_a_wins   boolean;
  v_new_gum  numeric;
  v_duel_id  uuid := gen_random_uuid();
  v_a_coins integer; v_a_xp integer;
  v_d_coins integer := 0; v_d_xp integer := 0;
  v_rewarded boolean := false;
  v_cnt integer;
begin
  perform private.assert_caller(p_attacker_id);

  -- 1. Deck de l'attaquant ------------------------------------------------------
  select * into v_deck from user_decks where id = p_deck_id and owner_id = p_attacker_id;
  if not found then raise exception 'deck_not_found' using errcode = 'P0002'; end if;

  perform 1 from user_cards
   where id in (v_deck.engine_card_id, v_deck.gearbox_card_id, v_deck.tire_card_id)
   order by id for update;

  select ce.runs_count as e_runs, ce.is_destroyed as e_dead, ce.is_listed as e_listed, ce.owner_id as e_owner,
         te.power_hp as e_power, te.weight_kg as e_weight, te.base_break_risk as e_r0, te.wear_sensitivity as e_dr,
         cg.runs_count as g_runs, cg.is_destroyed as g_dead, cg.is_listed as g_listed, cg.owner_id as g_owner,
         tg.weight_kg as g_weight, tg.shift_time_ms as g_shift, tg.base_break_risk as g_r0, tg.wear_sensitivity as g_dr,
         ct.tire_wear as t_gum, ct.is_destroyed as t_dead, ct.is_listed as t_listed, ct.owner_id as t_owner,
         tt.tire_type as t_type
    into a
    from user_cards ce join card_templates te on te.id = ce.template_id,
         user_cards cg join card_templates tg on tg.id = cg.template_id,
         user_cards ct join card_templates tt on tt.id = ct.template_id
   where ce.id = v_deck.engine_card_id and cg.id = v_deck.gearbox_card_id and ct.id = v_deck.tire_card_id;

  if a.e_owner <> p_attacker_id or a.g_owner <> p_attacker_id or a.t_owner <> p_attacker_id then
    raise exception 'card_not_owned' using errcode = '42501'; end if;
  if a.t_dead then raise exception 'tire_destroyed' using hint = 'Équipez un nouveau pneu.'; end if;
  if a.e_dead then raise exception 'engine_destroyed'; end if;
  if a.g_dead then raise exception 'gearbox_destroyed'; end if;
  if a.e_listed or a.g_listed or a.t_listed then raise exception 'card_listed'; end if;

  -- 2. Fantôme (avant toute consommation) ---------------------------------------
  -- NB: ORDER BY random() suffit pour le MVP ; à remplacer par un échantillonnage si la table grossit.
  select d.id as deck_id, d.owner_id,
         te.power_hp as e_power, te.weight_kg as e_weight,
         tg.weight_kg as g_weight, tg.shift_time_ms as g_shift,
         ct.tire_wear as t_gum, tt.tire_type as t_type
    into g
    from user_decks d
    join user_cards ce on ce.id = d.engine_card_id  join card_templates te on te.id = ce.template_id
    join user_cards cg on cg.id = d.gearbox_card_id join card_templates tg on tg.id = cg.template_id
    join user_cards ct on ct.id = d.tire_card_id    join card_templates tt on tt.id = ct.template_id
   where d.owner_id <> p_attacker_id
     and not ce.is_destroyed and not cg.is_destroyed and not ct.is_destroyed
     and not ce.is_listed and not cg.is_listed and not ct.is_listed
   order by random() limit 1;
  if not found then raise exception 'no_opponent'; end if;

  -- Verrou des deux profils dans un ordre déterministe (anti-deadlock) ;
  -- sérialise aussi le comptage du plafond de défenses du fantôme.
  perform 1 from profiles where id in (p_attacker_id, g.owner_id) order by id for update;

  -- 3. Bonus (consommé au lancement) --------------------------------------------
  if p_bonus_user_card_id is not null then
    select uc.id, t.bonus_effect into v_bonus_id, v_effect
      from user_cards uc join card_templates t on t.id = uc.template_id
     where uc.id = p_bonus_user_card_id and uc.owner_id = p_attacker_id
       and t.category = 'bonus' and not uc.is_destroyed and not uc.is_listed
     for update of uc;
    if not found then raise exception 'invalid_bonus'; end if;
    update user_cards set is_destroyed = true where id = v_bonus_id;
  end if;

  -- 4. Météo (25 % chacune) -----------------------------------------------------
  v_weather := (enum_range(null::weather_type))[1 + floor(random() * 4)::int];
  select * into w     from weather_conditions     where weather = v_weather;
  select * into v_amod from tire_weather_modifiers where tire_type = a.t_type and weather = v_weather;
  select * into v_gmod from tire_weather_modifiers where tire_type = g.t_type and weather = v_weather;

  -- 5. Phase 1 : tests de casse (moteur puis boîte) -----------------------------
  --   P_casse = GREATEST(0, (R0 + runs * delta_R + Mod_meteo) * Mod_bonus)
  v_p_e := greatest(0, (a.e_r0 + a.e_runs * a.e_dr + w.engine_break_mod)
                       * case when v_effect = 'huile_moteur_competition' then 0.5 else 1 end);
  v_roll_e := random() * 100;
  if v_p_e > 0 and v_roll_e <= v_p_e then
    v_broken := 'moteur';
  else
    v_p_g := greatest(0, (a.g_r0 + a.g_runs * a.g_dr + w.gearbox_break_mod)
                         * case when v_effect = 'huile_boite_competition' then 0.5 else 1 end);
    v_roll_g := random() * 100;
    if v_p_g > 0 and v_roll_g <= v_p_g then v_broken := 'boite'; end if;
  end if;

  -- 6. Phase 2 : scores ---------------------------------------------------------
  v_g_sp := round(private.compute_sp(g.e_power, g.e_weight + g.g_weight, g.g_shift, g.t_gum, v_gmod.perf_bonus_pct), 4);

  if v_broken is not null then
    v_saved := coalesce(v_effect = 'assistance_plateau', false);
    if not v_saved then
      update user_cards set is_destroyed = true
       where id = case v_broken when 'moteur' then v_deck.engine_card_id else v_deck.gearbox_card_id end;
    end if;
    v_a_wins := false;                       -- fin immédiate, aucune usure
  else
    v_a_sp := round(private.compute_sp(a.e_power, a.e_weight + a.g_weight, a.g_shift, a.t_gum, v_amod.perf_bonus_pct), 4);
    v_a_wins := v_a_sp > v_g_sp;             -- égalité => défenseur

    -- 7. Usure post-duel --------------------------------------------------------
    v_new_gum := greatest(0, a.t_gum - v_amod.wear_pct);
    update user_cards set tire_wear = v_new_gum, is_destroyed = (v_new_gum <= 0)
     where id = v_deck.tire_card_id;
    if v_effect is null or v_effect not in ('revision_express', 'revision_complete') then
      update user_cards set runs_count = runs_count + 1 where id = v_deck.engine_card_id;
    end if;
    if v_effect is null or v_effect not in ('vidange_boite', 'revision_complete') then
      update user_cards set runs_count = runs_count + 1 where id = v_deck.gearbox_card_id;
    end if;
  end if;

  -- 8. Récompenses --------------------------------------------------------------
  if v_a_wins then v_a_coins := 10; v_a_xp := 10; else v_a_coins := 2; v_a_xp := 2; end if;

  select count(*) into v_cnt from duels_history
   where defender_id = g.owner_id and defender_rewarded and created_at >= private.paris_day_start();
  if v_cnt < c_defense_cap then
    v_rewarded := true;
    if v_a_wins then v_d_coins := 1; v_d_xp := 1; else v_d_coins := 4; v_d_xp := 4; end if;
  end if;

  insert into duels_history (
    id, attacker_id, defender_id, attacker_deck_id, defender_deck_id, weather, bonus_effect,
    engine_break_prob, engine_break_roll, gearbox_break_prob, gearbox_break_roll,
    broken_part, part_saved, attacker_sp, defender_sp, result,
    attacker_coins, attacker_xp, defender_coins, defender_xp, defender_rewarded, snapshot)
  values (
    v_duel_id, p_attacker_id, g.owner_id, v_deck.id, g.deck_id, v_weather, v_effect,
    v_p_e, v_roll_e, v_p_g, v_roll_g,
    v_broken, v_saved, v_a_sp, v_g_sp, case when v_a_wins then 'attacker_win' else 'defender_win' end::duel_result,
    v_a_coins, v_a_xp, v_d_coins, v_d_xp, v_rewarded,
    jsonb_build_object('attacker', to_jsonb(a), 'defender', to_jsonb(g)));

  perform private.adjust_coins(p_attacker_id, v_a_coins, 'duel_attack', v_duel_id);
  perform private.add_xp(p_attacker_id, v_a_xp, 'attack', v_duel_id);
  if v_rewarded then
    perform private.adjust_coins(g.owner_id, v_d_coins, 'duel_defense', v_duel_id);
    perform private.add_xp(g.owner_id, v_d_xp, 'defense', v_duel_id);
  end if;

  return jsonb_build_object(
    'duel_id', v_duel_id, 'weather', v_weather, 'result', case when v_a_wins then 'attacker_win' else 'defender_win' end,
    'broken_part', v_broken, 'part_saved', v_saved,
    'attacker_sp', v_a_sp, 'defender_sp', v_g_sp,
    'coins', v_a_coins, 'xp', v_a_xp,
    'tire_gum_after', v_new_gum, 'bonus', v_effect);
end $$;

-- =============================================================================
-- claim_daily_pull(user_id, choice_option) — 1 = mécanique (1 carte + 1 bonus), 2 = 5 bonus
-- Reset à minuit Europe/Paris : comparaison de dates calendaires Paris.
-- =============================================================================
create or replace function public.claim_daily_pull(p_user_id uuid, p_choice_option integer)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_last  date;
  v_ids   uuid[] := '{}';
  i integer;
begin
  perform private.assert_caller(p_user_id);
  if p_choice_option not in (1, 2) then raise exception 'invalid_option'; end if;

  select last_daily_pull into v_last from profiles where id = p_user_id for update;
  if not found then raise exception 'profile_not_found'; end if;
  if v_last = v_today then raise exception 'already_claimed' using errcode = '23505'; end if;

  if p_choice_option = 1 then
    v_ids := v_ids || private.grant_card(p_user_id, private.draw_mechanical_template(), 'daily_pull');
    v_ids := v_ids || private.grant_card(p_user_id, private.draw_bonus_template(),      'daily_pull');
  else
    for i in 1..5 loop
      v_ids := v_ids || private.grant_card(p_user_id, private.draw_bonus_template(), 'daily_pull');
    end loop;
  end if;

  update profiles set last_daily_pull = v_today where id = p_user_id;

  return jsonb_build_object('option', p_choice_option, 'claimed_on', v_today, 'card_ids', to_jsonb(v_ids));
end $$;

revoke all on function public.execute_duel(uuid, uuid, uuid)   from public;
revoke all on function public.claim_daily_pull(uuid, integer)  from public;
grant execute on function public.execute_duel(uuid, uuid, uuid)  to app_user;
grant execute on function public.claim_daily_pull(uuid, integer) to app_user;
