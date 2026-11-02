-- =============================================================================
-- 20261102-01 : Ajustement de l'aléa pilote en Contre-La-Montre
--
-- Le bruit de pilotage passe de ±0,150 s à ±0,750 s :
--   Aléa = random() * 1.500 - 0.750   →   [−0,750 s ; +0,750 s[
-- (random() est uniforme sur [0, 1[, comme Math.random() côté JS).
--
-- Seule la ligne de bruit change : le reste de execute_clm est repris à
-- l'identique depuis 20261030000018_clm_solo.sql. Les grants/revokes sont
-- conservés par CREATE OR REPLACE ; ils sont réappliqués par sécurité.
-- =============================================================================

create or replace function public.execute_clm(
  p_user_id uuid,
  p_deck_id uuid
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_daily         public.clm_daily%rowtype;
  v_circuit       public.clm_circuits%rowtype;
  v_deck          public.user_decks%rowtype;
  a               record;
  v_engine_mod    numeric := 0;
  v_gearbox_mod   numeric := 0;
  v_tire_bonus    numeric := 0;
  v_tire_wear     numeric := 0;
  v_p_e           numeric;
  v_p_g           numeric;
  v_roll_e        numeric;
  v_roll_g        numeric;
  v_broken        public.card_category;
  v_sp            numeric;
  v_lap           numeric;
  v_new_gum       numeric;
  v_prev_best     numeric;
  v_is_new_record boolean := false;
  v_medal_level   integer := 0;
  v_medal         text;
  v_medal_key     text;
  v_medal_coins   integer;
  v_medals_coins  integer := 0;
  v_participation integer := 0;
  v_claimed       text[] := '{}';
  v_new_medals    text[] := '{}';
  v_attempt_id    uuid := gen_random_uuid();
  v_score_meca    numeric;
  v_tire_malus    integer;
  v_tire_mod      numeric;
  v_participation_claimed boolean;
  i               integer;
begin
  perform private.assert_caller(p_user_id);

  select * into v_daily from private.ensure_clm_day();
  select * into v_circuit from public.clm_circuits where id = v_daily.circuit_id;

  -- 1. Configuration ---------------------------------------------------------
  select * into v_deck
    from public.user_decks
   where id = p_deck_id and owner_id = p_user_id;
  if not found then
    raise exception 'deck_not_found' using errcode = 'P0002';
  end if;
  if v_deck.engine_card_id is null
     or v_deck.gearbox_card_id is null
     or v_deck.tire_card_id is null then
    raise exception 'config_incomplete';
  end if;

  perform 1 from public.user_cards
   where id in (v_deck.engine_card_id, v_deck.gearbox_card_id, v_deck.tire_card_id)
   order by id for update;

  select ce.runs_count as e_runs,
         ce.is_destroyed as e_dead, ce.is_listed as e_listed, ce.owner_id as e_owner,
         te.name as e_name, te.power_hp as e_power, te.weight_kg as e_weight,
         te.base_break_risk as e_r0, te.wear_sensitivity as e_dr,
         cg.runs_count as g_runs,
         cg.is_destroyed as g_dead, cg.is_listed as g_listed, cg.owner_id as g_owner,
         tg.name as g_name, tg.weight_kg as g_weight, tg.shift_time_ms as g_shift,
         tg.base_break_risk as g_r0, tg.wear_sensitivity as g_dr,
         ct.tire_wear as t_gum, ct.is_destroyed as t_dead,
         ct.is_listed as t_listed, ct.owner_id as t_owner,
         tt.name as t_name, tt.tire_type as t_type
    into a
    from public.user_cards ce join public.card_templates te on te.id = ce.template_id,
         public.user_cards cg join public.card_templates tg on tg.id = cg.template_id,
         public.user_cards ct join public.card_templates tt on tt.id = ct.template_id
   where ce.id = v_deck.engine_card_id
     and cg.id = v_deck.gearbox_card_id
     and ct.id = v_deck.tire_card_id;

  if a.e_owner <> p_user_id or a.g_owner <> p_user_id or a.t_owner <> p_user_id then
    raise exception 'card_not_owned' using errcode = '42501';
  end if;
  if a.t_dead then raise exception 'tire_destroyed' using hint = 'Équipez un nouveau pneu.'; end if;
  if a.e_dead then raise exception 'engine_destroyed'; end if;
  if a.g_dead then raise exception 'gearbox_destroyed'; end if;
  if a.e_listed or a.g_listed or a.t_listed then raise exception 'card_listed'; end if;

  -- 2. Contexte météo --------------------------------------------------------
  select engine_break_mod, gearbox_break_mod
    into v_engine_mod, v_gearbox_mod
    from public.weather_conditions where weather = v_daily.weather;
  if not found then
    v_engine_mod := 0;
    v_gearbox_mod := 0;
  end if;

  select perf_bonus_pct, wear_pct
    into v_tire_bonus, v_tire_wear
    from public.tire_weather_modifiers
   where tire_type = a.t_type and weather = v_daily.weather;
  if not found then
    v_tire_bonus := 0;
    v_tire_wear := 0;
  end if;

  -- 3. Sérialisation des récompenses du joueur -------------------------------
  perform 1 from public.profiles where id = p_user_id for update;

  -- La garantie constructeur court à chaque tentative, même celle qui casse.
  update public.user_cards
     set warranty_used = warranty_used + 1
   where id in (v_deck.engine_card_id, v_deck.gearbox_card_id);

  -- 4. Casse mécanique (même formule que les duels) --------------------------
  v_p_e := greatest(0, a.e_r0 + a.e_runs * a.e_dr + v_engine_mod);
  v_roll_e := random() * 100;
  if v_p_e > 0 and v_roll_e <= v_p_e then
    v_broken := 'moteur';
  else
    v_p_g := greatest(0, a.g_r0 + a.g_runs * a.g_dr + v_gearbox_mod);
    v_roll_g := random() * 100;
    if v_p_g > 0 and v_roll_g <= v_p_g then
      v_broken := 'boite';
    end if;
  end if;

  v_new_gum := a.t_gum;

  if v_broken is not null then
    update public.user_cards
       set is_destroyed = true
     where id = case v_broken when 'moteur' then v_deck.engine_card_id
                               else v_deck.gearbox_card_id end;
    -- Aucune usure de pneu / compteur d'usure, mais le run a bien été couru.
    update public.user_cards
       set runs_total = runs_total + 1
     where id in (v_deck.engine_card_id, v_deck.gearbox_card_id);

    insert into public.clm_attempts (
      id, user_id, day, circuit_id, weather, deck_id,
      sp_final, lap_seconds, broken_part, tire_gum_before, tire_gum_after,
      engine_break_prob, gearbox_break_prob)
    values (
      v_attempt_id, p_user_id, v_daily.day, v_circuit.id, v_daily.weather, v_deck.id,
      null, null, v_broken, a.t_gum, v_new_gum, v_p_e, v_p_g);
  else
    -- 5. Score final et chrono ----------------------------------------------
    v_sp := round(private.compute_sp(
      a.e_power, a.e_weight + a.g_weight, a.g_shift, a.t_gum, v_tire_bonus), 4);

    v_lap := round(greatest(
      15.0,
      v_circuit.t_base
        - (v_sp / 10.0) * v_circuit.k_circuit
        + (random()::numeric * 1.500 - 0.750)
    ), 3);

    -- 6. Usure des pneus et compteurs de runs -------------------------------
    v_new_gum := greatest(0, a.t_gum - v_tire_wear);
    update public.user_cards
       set tire_wear = v_new_gum, is_destroyed = (v_new_gum <= 0)
     where id = v_deck.tire_card_id;
    update public.user_cards
       set runs_count = runs_count + 1, runs_total = runs_total + 1
     where id in (v_deck.engine_card_id, v_deck.gearbox_card_id);

    insert into public.clm_attempts (
      id, user_id, day, circuit_id, weather, deck_id,
      sp_final, lap_seconds, broken_part, tire_gum_before, tire_gum_after,
      engine_break_prob, gearbox_break_prob)
    values (
      v_attempt_id, p_user_id, v_daily.day, v_circuit.id, v_daily.weather, v_deck.id,
      v_sp, v_lap, null, a.t_gum, v_new_gum, v_p_e, v_p_g);

    -- 7. Personal Best ------------------------------------------------------
    select best_seconds into v_prev_best
      from public.clm_personal_bests
     where user_id = p_user_id and circuit_id = v_circuit.id;

    if v_prev_best is null or v_lap < v_prev_best then
      v_is_new_record := v_prev_best is not null;
      insert into public.clm_personal_bests
        (user_id, circuit_id, best_seconds, best_sp, attempt_id, achieved_on)
      values
        (p_user_id, v_circuit.id, v_lap, v_sp, v_attempt_id, v_daily.day)
      on conflict (user_id, circuit_id) do update
        set best_seconds = excluded.best_seconds,
            best_sp = excluded.best_sp,
            attempt_id = excluded.attempt_id,
            achieved_on = excluded.achieved_on,
            updated_at = now()
        where excluded.best_seconds < public.clm_personal_bests.best_seconds;
    end if;

    -- 8. Médailles du jour (avec cascade) -----------------------------------
    if v_sp >= 290 then
      v_medal_level := 3;
      v_medal := 'gold';
    elsif v_sp >= 200 then
      v_medal_level := 2;
      v_medal := 'silver';
    elsif v_sp >= 110 then
      v_medal_level := 1;
      v_medal := 'bronze';
    end if;

    if v_medal_level > 0 then
      select coalesce(array_agg(kind), '{}'::text[])
        into v_claimed
        from public.clm_daily_claims
       where user_id = p_user_id
         and day = v_daily.day
         and kind in ('bronze', 'silver', 'gold');

      for i in 1..v_medal_level loop
        v_medal_key := case i when 1 then 'bronze' when 2 then 'silver' else 'gold' end;
        if not (v_medal_key = any(v_claimed)) then
          v_medal_coins := case i when 1 then 30 when 2 then 70 else 150 end;
          insert into public.clm_daily_claims (user_id, day, kind, coins)
          values (p_user_id, v_daily.day, v_medal_key, v_medal_coins);
          insert into public.trophy_medals (user_id, kind)
          values (p_user_id, 'chrono_' || v_medal_key);
          v_medals_coins := v_medals_coins + v_medal_coins;
          v_new_medals := array_append(v_new_medals, v_medal_key);
          v_claimed := array_append(v_claimed, v_medal_key);
        end if;
      end loop;
    end if;

    -- 9. Prime du premier tour bouclé du jour -------------------------------
    select exists (
      select 1 from public.clm_daily_claims
       where user_id = p_user_id and day = v_daily.day and kind = 'participation'
    ) into v_participation_claimed;

    if not v_participation_claimed then
      insert into public.clm_daily_claims (user_id, day, kind, coins)
      values (p_user_id, v_daily.day, 'participation', 10);
      v_participation := 10;
    end if;
  end if;

  -- 10. Versement des pièces ------------------------------------------------
  if v_medals_coins > 0 then
    perform private.adjust_coins(p_user_id, v_medals_coins, 'clm_medal', v_attempt_id);
  end if;
  if v_participation > 0 then
    perform private.adjust_coins(p_user_id, v_participation, 'clm_participation', v_attempt_id);
  end if;

  -- 11. Journal de la tentative ---------------------------------------------
  update public.clm_attempts
     set coins_medals = v_medals_coins,
         coins_participation = v_participation,
         medals_earned = v_new_medals
   where id = v_attempt_id;

  -- 12. Détails d'affichage --------------------------------------------------
  v_score_meca := greatest(10,
    100 + a.e_power * 0.55 - (a.e_weight + a.g_weight) * 0.25 - a.g_shift * 0.05);
  v_tire_malus := case when a.t_gum >= 70 then 0 else floor((70 - a.t_gum) / 3.0) end;
  v_tire_mod := greatest(0.10, 1.0 + (v_tire_bonus - v_tire_malus) / 100.0);

  select coalesce(array_agg(kind order by case kind
                        when 'bronze' then 1
                        when 'silver' then 2
                        when 'gold' then 3
                        else 4 end), '{}'::text[])
    into v_claimed
    from public.clm_daily_claims
   where user_id = p_user_id
     and day = v_daily.day
     and kind in ('bronze', 'silver', 'gold');

  select exists (
    select 1 from public.clm_daily_claims
     where user_id = p_user_id and day = v_daily.day and kind = 'participation'
  ) into v_participation_claimed;

  return jsonb_build_object(
    'attempt_id', v_attempt_id,
    'day', v_daily.day,
    'weather', v_daily.weather,
    'circuit_id', v_circuit.id,
    'circuit_name', v_circuit.name,
    'broken_part', v_broken,
    'sp_final', v_sp,
    'lap_seconds', v_lap,
    'previous_best', v_prev_best,
    'personal_best', case
      when v_lap is null then null
      when v_prev_best is null or v_lap < v_prev_best then v_lap
      else v_prev_best
    end,
    'is_new_record', v_is_new_record,
    'medal', v_medal,
    'new_medals', to_jsonb(v_new_medals),
    'medals_coins', v_medals_coins,
    'participation_coins', v_participation,
    'coins', v_medals_coins + v_participation,
    'claimed', to_jsonb(v_claimed),
    'participation_claimed', v_participation_claimed,
    'tire_gum_before', a.t_gum,
    'tire_gum_after', v_new_gum,
    'tire_destroyed', v_new_gum <= 0,
    'engine_break_prob', v_p_e,
    'gearbox_break_prob', v_p_g,
    'score_meca', round(v_score_meca, 4),
    'tire_type', a.t_type,
    'tire_bonus_pct', v_tire_bonus,
    'tire_malus', v_tire_malus,
    'tire_mod', round(v_tire_mod, 4),
    'engine_name', a.e_name,
    'gearbox_name', a.g_name,
    'tire_name', a.t_name
  );
end $$;
revoke all on function public.execute_clm(uuid, uuid) from public;
grant execute on function public.execute_clm(uuid, uuid) to app_user;
