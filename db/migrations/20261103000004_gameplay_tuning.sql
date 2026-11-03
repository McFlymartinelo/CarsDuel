-- =============================================================================
-- 20261103-04 : ajustements de jeu
--
-- 1. Le musée de la casse disparaît de l'interface : les cartes détruites
--    restent dans l'inventaire classique et peuvent désormais être vendues
--    sur la marketplace (et rachetées pour être recyclées).
-- 2. Les médailles du Contre-La-Montre passent à 20 / 50 / 100 pièces.
-- 3. Le Banc d'essai verse une prime de participation de 10 pièces au premier
--    passage du jour.
-- 4. Les médailles du Banc d'essai rejoignent celles du CLM dans la vitrine
--    de trophées (mêmes tuiles Or / Argent / Bronze).
-- =============================================================================

-- ---------- 1. Vitrine : médailles CLM + Banc d'essai ------------------------
alter table public.trophy_medals
  drop constraint if exists trophy_medals_kind_check;
alter table public.trophy_medals
  add constraint trophy_medals_kind_check check (
    kind in (
      'chrono_gold', 'chrono_silver', 'chrono_bronze',
      'dyno_gold', 'dyno_silver', 'dyno_bronze'
    )
  );

comment on table public.trophy_medals is
  'Médailles de contre-la-montre et de banc d''essai attribuées à un pilote.';

-- Reprise des médailles de banc déjà remportées avant cette migration.
insert into public.trophy_medals (user_id, kind, awarded_at)
select user_id, 'dyno_' || kind, claimed_at
  from public.dyno_daily_claims
 where kind in ('bronze', 'silver', 'gold');

-- ---------- 2. Prime de participation du Banc d'essai -----------------------
alter table public.dyno_daily_claims
  drop constraint if exists dyno_daily_claims_kind_check;
alter table public.dyno_daily_claims
  add constraint dyno_daily_claims_kind_check check (
    kind in ('participation', 'bronze', 'silver', 'gold')
  );

-- ---------- 3. Défi du Banc d'essai : état de la prime ----------------------
create or replace function public.my_dyno_today(p_user uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_daily      public.dyno_daily%rowtype;
  v_config     public.dyno_configs%rowtype;
  v_best       public.dyno_daily_bests%rowtype;
  v_claimed    text[] := '{}';
  v_participation boolean;
  v_attempts   integer;
begin
  perform private.assert_caller(p_user);

  select * into v_daily from private.ensure_dyno_day();
  select * into v_config from public.dyno_configs where id = v_daily.config_id;

  select * into v_best
    from public.dyno_daily_bests
   where user_id = p_user and day = v_daily.day;

  select coalesce(array_agg(kind order by case kind
                        when 'bronze' then 1
                        when 'silver' then 2
                        else 3 end), '{}'::text[])
    into v_claimed
    from public.dyno_daily_claims
   where user_id = p_user
     and day = v_daily.day
     and kind in ('bronze', 'silver', 'gold');

  select exists (
    select 1 from public.dyno_daily_claims
     where user_id = p_user and day = v_daily.day and kind = 'participation'
  ) into v_participation;

  select count(*) into v_attempts
    from public.dyno_attempts
   where user_id = p_user and day = v_daily.day;

  return jsonb_build_object(
    'day', v_daily.day,
    'weather', v_daily.weather,
    'config', jsonb_build_object(
      'id', v_config.id,
      'name', v_config.name,
      'description', v_config.description,
      'constraints', v_config.constraint_list,
      'medals_sp', jsonb_build_object(
        'bronze', v_config.medal_bronze_sp,
        'silver', v_config.medal_silver_sp,
        'gold', v_config.medal_gold_sp
      )
    ),
    'personal_best', case
      when v_best.user_id is null then null
      else jsonb_build_object(
        'sp', v_best.best_sp,
        'day', v_best.day,
        'updated_at', v_best.updated_at
      )
    end,
    'claimed', to_jsonb(v_claimed),
    'participation_claimed', v_participation,
    'attempts', v_attempts
  );
end $$;

-- ---------- 4. Passage au banc : prime + médailles de vitrine ---------------
create or replace function public.execute_dyno(
  p_user_id uuid,
  p_deck_id uuid
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_daily         public.dyno_daily%rowtype;
  v_config        public.dyno_configs%rowtype;
  v_deck          public.user_decks%rowtype;
  a               record;
  v_tire_bonus    numeric := 0;
  v_score_meca    numeric;
  v_tire_malus    integer;
  v_tire_mod      numeric;
  v_sp            numeric;
  v_prev_best     numeric;
  v_best          numeric;
  v_is_new_record boolean := false;
  v_medal_level   integer := 0;
  v_medal         text;
  v_medal_key     text;
  v_medal_coins   integer;
  v_medals_coins  integer := 0;
  v_participation integer := 0;
  v_participation_claimed boolean;
  v_claimed       text[] := '{}';
  v_new_medals    text[] := '{}';
  v_attempt_id    uuid := gen_random_uuid();
  v_constraint    jsonb;
  i               integer;
begin
  perform private.assert_caller(p_user_id);

  select * into v_daily from private.ensure_dyno_day();
  select * into v_config from public.dyno_configs where id = v_daily.config_id;

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

  select ce.is_destroyed as e_dead, ce.is_listed as e_listed, ce.owner_id as e_owner,
         te.name as e_name, te.power_hp as e_power, te.weight_kg as e_weight,
         cg.is_destroyed as g_dead, cg.is_listed as g_listed, cg.owner_id as g_owner,
         tg.name as g_name, tg.weight_kg as g_weight, tg.shift_time_ms as g_shift,
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
  if a.e_dead then raise exception 'engine_destroyed'; end if;
  if a.g_dead then raise exception 'gearbox_destroyed'; end if;
  if a.t_dead then raise exception 'tire_destroyed' using hint = 'Équipez un nouveau pneu.'; end if;
  if a.e_listed or a.g_listed or a.t_listed then raise exception 'card_listed'; end if;

  -- 2. Contraintes du défi ---------------------------------------------------
  for v_constraint in select value from jsonb_array_elements(v_config.constraint_list)
  loop
    case v_constraint->>'type'
      when 'tire_type' then
        if a.t_type::text is distinct from lower(v_constraint->>'value') then
          raise exception 'dyno_constraint_failed' using hint = 'Pneus imposés par le défi du jour.';
        end if;
      when 'max_power_hp' then
        if a.e_power > (v_constraint->>'value')::numeric then
          raise exception 'dyno_constraint_failed' using hint = 'Puissance maximale dépassée.';
        end if;
      when 'max_weight_total_kg' then
        if (a.e_weight + a.g_weight) > (v_constraint->>'value')::numeric then
          raise exception 'dyno_constraint_failed' using hint = 'Poids total maximum dépassé.';
        end if;
      when 'max_engine_weight_kg' then
        if a.e_weight > (v_constraint->>'value')::numeric then
          raise exception 'dyno_constraint_failed' using hint = 'Poids moteur maximum dépassé.';
        end if;
      when 'max_gearbox_weight_kg' then
        if a.g_weight > (v_constraint->>'value')::numeric then
          raise exception 'dyno_constraint_failed' using hint = 'Poids de boîte maximum dépassé.';
        end if;
      when 'min_shift_time_ms' then
        if a.g_shift < (v_constraint->>'value')::numeric then
          raise exception 'dyno_constraint_failed' using hint = 'Temps de passage minimum non atteint.';
        end if;
      else
        raise exception 'dyno_unknown_constraint';
    end case;
  end loop;

  -- 3. Contexte météo et score ----------------------------------------------
  select perf_bonus_pct
    into v_tire_bonus
    from public.tire_weather_modifiers
   where tire_type = a.t_type and weather = v_daily.weather;
  if not found then
    v_tire_bonus := 0;
  end if;

  v_score_meca := greatest(10,
    100 + a.e_power * 0.55 - (a.e_weight + a.g_weight) * 0.25 - a.g_shift * 0.05);
  v_tire_malus := case when a.t_gum >= 70 then 0 else floor((70 - a.t_gum) / 3.0) end;
  v_tire_mod := greatest(0.10, 1.0 + (v_tire_bonus - v_tire_malus) / 100.0);
  v_sp := round(private.compute_sp(
    a.e_power, a.e_weight + a.g_weight, a.g_shift, a.t_gum, v_tire_bonus), 4);

  -- 4. Sérialisation des récompenses du joueur -------------------------------
  perform 1 from public.profiles where id = p_user_id for update;

  -- 5. Journal de la tentative ------------------------------------------------
  insert into public.dyno_attempts (
    id, user_id, day, config_id, weather, deck_id,
    sp_final, score_meca, tire_type, tire_gum, tire_bonus_pct, tire_malus, tire_mod,
    engine_name, gearbox_name, tire_name)
  values (
    v_attempt_id, p_user_id, v_daily.day, v_config.id, v_daily.weather, v_deck.id,
    v_sp, round(v_score_meca, 4), a.t_type, a.t_gum, v_tire_bonus, v_tire_malus,
    round(v_tire_mod, 4), a.e_name, a.g_name, a.t_name);

  -- 6. Meilleur SP personnel de la journée -----------------------------------
  select best_sp into v_prev_best
    from public.dyno_daily_bests
   where user_id = p_user_id and day = v_daily.day;

  v_best := v_sp;
  if v_prev_best is null then
    insert into public.dyno_daily_bests (user_id, day, best_sp, attempt_id)
    values (p_user_id, v_daily.day, v_sp, v_attempt_id);
  elsif v_sp > v_prev_best then
    v_is_new_record := true;
    update public.dyno_daily_bests
       set best_sp = v_sp,
           attempt_id = v_attempt_id,
           updated_at = now()
     where user_id = p_user_id and day = v_daily.day;
  else
    v_best := v_prev_best;
  end if;

  -- 7. Médailles du jour (avec cascade) --------------------------------------
  if v_sp >= v_config.medal_gold_sp then
    v_medal_level := 3;
    v_medal := 'gold';
  elsif v_sp >= v_config.medal_silver_sp then
    v_medal_level := 2;
    v_medal := 'silver';
  elsif v_sp >= v_config.medal_bronze_sp then
    v_medal_level := 1;
    v_medal := 'bronze';
  end if;

  if v_medal_level > 0 then
    select coalesce(array_agg(kind), '{}'::text[])
      into v_claimed
      from public.dyno_daily_claims
     where user_id = p_user_id
       and day = v_daily.day
       and kind in ('bronze', 'silver', 'gold');

    for i in 1..v_medal_level loop
      v_medal_key := case i when 1 then 'bronze' when 2 then 'silver' else 'gold' end;
      if not (v_medal_key = any(v_claimed)) then
        v_medal_coins := case i when 1 then 20 when 2 then 50 else 100 end;
        insert into public.dyno_daily_claims (user_id, day, kind, coins)
        values (p_user_id, v_daily.day, v_medal_key, v_medal_coins);
        insert into public.trophy_medals (user_id, kind)
        values (p_user_id, 'dyno_' || v_medal_key);
        v_medals_coins := v_medals_coins + v_medal_coins;
        v_new_medals := array_append(v_new_medals, v_medal_key);
        v_claimed := array_append(v_claimed, v_medal_key);
      end if;
    end loop;
  end if;

  -- 8. Prime de participation du premier passage du jour ---------------------
  select exists (
    select 1 from public.dyno_daily_claims
     where user_id = p_user_id and day = v_daily.day and kind = 'participation'
  ) into v_participation_claimed;

  if not v_participation_claimed then
    insert into public.dyno_daily_claims (user_id, day, kind, coins)
    values (p_user_id, v_daily.day, 'participation', 10);
    v_participation := 10;
    v_participation_claimed := true;
  end if;

  -- 9. Versement des pièces ---------------------------------------------------
  if v_medals_coins > 0 then
    perform private.adjust_coins(p_user_id, v_medals_coins, 'dyno_medal', v_attempt_id);
  end if;
  if v_participation > 0 then
    perform private.adjust_coins(p_user_id, v_participation, 'dyno_participation', v_attempt_id);
  end if;

  update public.dyno_attempts
     set coins_medals = v_medals_coins,
         medals_earned = v_new_medals
   where id = v_attempt_id;

  -- 10. Détails d'affichage ---------------------------------------------------
  select coalesce(array_agg(kind order by case kind
                        when 'bronze' then 1
                        when 'silver' then 2
                        else 3 end), '{}'::text[])
    into v_claimed
    from public.dyno_daily_claims
   where user_id = p_user_id
     and day = v_daily.day
     and kind in ('bronze', 'silver', 'gold');

  return jsonb_build_object(
    'attempt_id', v_attempt_id,
    'day', v_daily.day,
    'weather', v_daily.weather,
    'config_id', v_config.id,
    'config_name', v_config.name,
    'sp_final', v_sp,
    'score_meca', round(v_score_meca, 4),
    'previous_best', v_prev_best,
    'personal_best', v_best,
    'is_new_record', v_is_new_record,
    'medal', v_medal,
    'new_medals', to_jsonb(v_new_medals),
    'medals_coins', v_medals_coins,
    'participation_coins', v_participation,
    'coins', v_medals_coins + v_participation,
    'claimed', to_jsonb(v_claimed),
    'participation_claimed', v_participation_claimed,
    'tire_type', a.t_type,
    'tire_gum', a.t_gum,
    'tire_bonus_pct', v_tire_bonus,
    'tire_malus', v_tire_malus,
    'tire_mod', round(v_tire_mod, 4),
    'engine_name', a.e_name,
    'gearbox_name', a.g_name,
    'tire_name', a.t_name,
    'power_hp', a.e_power,
    'engine_weight_kg', a.e_weight,
    'gearbox_weight_kg', a.g_weight,
    'shift_time_ms', a.g_shift
  );
end $$;

revoke all on function public.my_dyno_today(uuid) from public;
revoke all on function public.execute_dyno(uuid, uuid) from public;
grant execute on function public.my_dyno_today(uuid) to app_user;
grant execute on function public.execute_dyno(uuid, uuid) to app_user;

-- ---------- 5. CLM : nouvelles récompenses de médailles (20 / 50 / 100) -----
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
          v_medal_coins := case i when 1 then 20 when 2 then 50 else 100 end;
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

-- ---------- 6. Vitrine : les deux familles de médailles partagent les tuiles --
create or replace function public.my_trophy_stats(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp as $$
declare
  v_stats jsonb;
begin
  perform private.assert_caller(p_user);

  select jsonb_build_object(
    'attack_wins', (
      select count(*) from public.duels_history
       where attacker_id = p_user and result = 'attacker_win'
    ),
    'defense_wins', (
      select count(*) from public.duels_history
       where defender_id = p_user and result = 'defender_win'
    ),
    'attack_duels', (
      select count(*) from public.duels_history
       where attacker_id = p_user
    ),
    'weekly_firsts', (
      select count(*) from public.leaderboard_payouts
       where user_id = p_user and period = 'weekly' and rank = 1
    ),
    'monthly_firsts', (
      select count(*) from public.leaderboard_payouts
       where user_id = p_user and period = 'monthly' and rank = 1
    ),
    'chrono_gold', (
      select count(*) from public.trophy_medals
       where user_id = p_user and kind in ('chrono_gold', 'dyno_gold')
    ),
    'chrono_silver', (
      select count(*) from public.trophy_medals
       where user_id = p_user and kind in ('chrono_silver', 'dyno_silver')
    ),
    'chrono_bronze', (
      select count(*) from public.trophy_medals
       where user_id = p_user and kind in ('chrono_bronze', 'dyno_bronze')
    )
  ) into v_stats;

  return v_stats;
end $$;

revoke all on function public.my_trophy_stats(uuid) from public;
grant execute on function public.my_trophy_stats(uuid) to app_user;

-- ---------- 7. Marketplace : les cartes détruites sont vendables -------------
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
  if v_cat = 'bonus' then raise exception 'bonus_not_sellable'; end if;
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

-- ---------- 8. Textes : le musée de la casse n'existe plus -------------------
update public.card_templates
   set description = 'En cas d''échec au test de casse mécanique, le duel est perdu mais le composant cassé réintègre directement l''inventaire au lieu d''être détruit.'
 where bonus_effect = 'assistance_plateau';
