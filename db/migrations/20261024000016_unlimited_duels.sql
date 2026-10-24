-- =============================================================================
-- 016 : duels sans plafond d'attaques et sans filtre de niveau
--
-- Le fantôme est tiré au hasard dans un échantillon d'au plus 160 decks
-- éligibles (même pivot que 011, sans bandes ±25 % / ±50 %).
-- Le plafond de récompenses de défense (5 / jour, Europe/Paris) est inchangé.
-- =============================================================================

drop function if exists public.attack_status(uuid);
drop function if exists private.attack_cap();
drop function if exists private.pick_opponent(uuid, numeric);

create or replace function private.pick_opponent(p_attacker uuid)
returns table (
  deck_id  uuid,
  owner_id uuid,
  e_power  integer,
  e_weight numeric,
  g_weight numeric,
  g_shift  integer,
  t_gum    numeric,
  t_type   public.tire_type
)
language plpgsql as $$
declare
  c_sample constant integer := 80;
  v_pivot uuid := gen_random_uuid();
begin
  return query
  with sample as (
    (
      select d.id as deck_id, d.owner_id,
             te.power_hp as e_power, te.weight_kg as e_weight,
             tg.weight_kg as g_weight, tg.shift_time_ms as g_shift,
             ct.tire_wear as t_gum, tt.tire_type as t_type
        from public.user_decks d
        join public.user_cards ce on ce.id = d.engine_card_id  join public.card_templates te on te.id = ce.template_id
        join public.user_cards cg on cg.id = d.gearbox_card_id join public.card_templates tg on tg.id = cg.template_id
        join public.user_cards ct on ct.id = d.tire_card_id    join public.card_templates tt on tt.id = ct.template_id
       where d.id >= v_pivot
         and d.owner_id <> p_attacker
         and not ce.is_destroyed and not cg.is_destroyed and not ct.is_destroyed
         and not ce.is_listed and not cg.is_listed and not ct.is_listed
       order by d.id
       limit c_sample
    )
    union all
    (
      select d.id, d.owner_id,
             te.power_hp, te.weight_kg,
             tg.weight_kg, tg.shift_time_ms,
             ct.tire_wear, tt.tire_type
        from public.user_decks d
        join public.user_cards ce on ce.id = d.engine_card_id  join public.card_templates te on te.id = ce.template_id
        join public.user_cards cg on cg.id = d.gearbox_card_id join public.card_templates tg on tg.id = cg.template_id
        join public.user_cards ct on ct.id = d.tire_card_id    join public.card_templates tt on tt.id = ct.template_id
       where d.id < v_pivot
         and d.owner_id <> p_attacker
         and not ce.is_destroyed and not cg.is_destroyed and not ct.is_destroyed
         and not ce.is_listed and not cg.is_listed and not ct.is_listed
       order by d.id
       limit c_sample
    )
  )
  select s.deck_id, s.owner_id, s.e_power, s.e_weight, s.g_weight, s.g_shift, s.t_gum, s.t_type
    from sample s
   order by random()
   limit 1;
  if found then return; end if;

  return query
  select d.id, d.owner_id, te.power_hp, te.weight_kg, tg.weight_kg, tg.shift_time_ms, ct.tire_wear, tt.tire_type
    from public.user_decks d
    join public.user_cards ce on ce.id = d.engine_card_id  join public.card_templates te on te.id = ce.template_id
    join public.user_cards cg on cg.id = d.gearbox_card_id join public.card_templates tg on tg.id = cg.template_id
    join public.user_cards ct on ct.id = d.tire_card_id    join public.card_templates tt on tt.id = ct.template_id
   where d.id >= v_pivot
     and d.owner_id <> p_attacker
     and not ce.is_destroyed and not cg.is_destroyed and not ct.is_destroyed
     and not ce.is_listed and not cg.is_listed and not ct.is_listed
   order by d.id
   limit 1;
  if found then return; end if;

  return query
  select d.id, d.owner_id, te.power_hp, te.weight_kg, tg.weight_kg, tg.shift_time_ms, ct.tire_wear, tt.tire_type
    from public.user_decks d
    join public.user_cards ce on ce.id = d.engine_card_id  join public.card_templates te on te.id = ce.template_id
    join public.user_cards cg on cg.id = d.gearbox_card_id join public.card_templates tg on tg.id = cg.template_id
    join public.user_cards ct on ct.id = d.tire_card_id    join public.card_templates tt on tt.id = ct.template_id
   where d.id < v_pivot
     and d.owner_id <> p_attacker
     and not ce.is_destroyed and not cg.is_destroyed and not ct.is_destroyed
     and not ce.is_listed and not cg.is_listed and not ct.is_listed
   order by d.id
   limit 1;
end $$;

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
  select * into g from private.pick_opponent(p_attacker_id);
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
