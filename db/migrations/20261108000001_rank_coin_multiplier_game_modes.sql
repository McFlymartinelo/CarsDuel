-- =============================================================================
-- 20261108-01 : multiplicateur de pièces du rang dans tous les modes de jeu
--
-- Le coefficient de rang (×1 à ×3, XP du mois calendaire Europe/Paris) ne
-- s'appliquait jusqu'ici qu'aux primes de classement. Il s'applique désormais
-- aussi aux récompenses en pièces gagnées en jouant : duels (aléatoire et
-- organisés, attaque comme défense), Contre-La-Montre, Banc d'essai et
-- Configs Constructeur. Le montant est arrondi à la pièce au moment du gain.
-- L'XP n'est jamais multipliée.
-- =============================================================================

-- XP du mois calendaire courant, même découpage que les classements.
create or replace function private.month_xp(p_user uuid)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(e.amount), 0)::bigint
    from public.xp_events e
   where e.user_id = p_user
     and e.created_at >= date_trunc('month', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris'
     and e.created_at <  (date_trunc('month', now() at time zone 'Europe/Paris') + interval '1 month') at time zone 'Europe/Paris'
$$;

revoke all on function private.month_xp(uuid) from public;

-- Récompense en pièces après application du multiplicateur de rang.
create or replace function private.ranked_coins(p_user uuid, p_coins integer)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select round(p_coins * public.rank_coefficient(private.month_xp(p_user)))::integer
$$;

revoke all on function private.ranked_coins(uuid, integer) from public;

-- Variante avec l'XP du mois déjà figée : le gain en cours ne modifie pas
-- son propre multiplicateur (Contre-La-Montre et Banc d'essai versent de l'XP
-- avant le calcul des pièces).
create or replace function private.coins_with_rank(p_month_xp bigint, p_coins integer)
returns integer
language sql
immutable
parallel safe
as $$
  select round(p_coins * public.rank_coefficient(p_month_xp))::integer
$$;

revoke all on function private.coins_with_rank(bigint, integer) from public;

-- ---------- Duel aléatoire ------------------------------------------------
create or replace function public.execute_duel(
  p_attacker_id          uuid,
  p_deck_id              uuid,
  p_bonus_user_card_id   uuid default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c_defense_cap constant integer := 5;
  v_deck     public.user_decks%rowtype;
  a          record;
  g          record;
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

  select * into v_deck from user_decks where id = p_deck_id and owner_id = p_attacker_id;
  if not found then raise exception 'deck_not_found' using errcode = 'P0002'; end if;
  if v_deck.engine_card_id is null or v_deck.gearbox_card_id is null or v_deck.tire_card_id is null then
    raise exception 'config_incomplete';
  end if;

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

  select * into g from private.pick_opponent(p_attacker_id);
  if not found then raise exception 'no_opponent'; end if;

  perform 1 from profiles where id in (p_attacker_id, g.owner_id) order by id for update;

  -- La garantie constructeur court à chaque duel, y compris celui qui casse la pièce.
  update user_cards
     set warranty_used = warranty_used + 1
   where id in (v_deck.engine_card_id, v_deck.gearbox_card_id);

  if p_bonus_user_card_id is not null then
    select uc.id, t.bonus_effect into v_bonus_id, v_effect
      from user_cards uc join card_templates t on t.id = uc.template_id
     where uc.id = p_bonus_user_card_id and uc.owner_id = p_attacker_id
       and t.category = 'bonus' and not uc.is_destroyed and not uc.is_listed
     for update of uc;
    if not found then raise exception 'invalid_bonus'; end if;
    update user_cards set is_destroyed = true where id = v_bonus_id;
  end if;

  v_weather := (enum_range(null::weather_type))[1 + floor(random() * 4)::int];
  select * into w      from weather_conditions     where weather = v_weather;
  select * into v_amod from tire_weather_modifiers where tire_type = a.t_type and weather = v_weather;
  select * into v_gmod from tire_weather_modifiers where tire_type = g.t_type and weather = v_weather;

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

  -- Type de pneu de l'adversaire (bonus météo), gomme considérée comme neuve.
  v_g_sp := round(private.compute_sp(g.e_power, g.e_weight + g.g_weight, g.g_shift, 100, v_gmod.perf_bonus_pct), 4);

  if v_broken is not null then
    v_saved := coalesce(v_effect = 'assistance_plateau', false);
    if not v_saved then
      update user_cards set is_destroyed = true
       where id = case v_broken when 'moteur' then v_deck.engine_card_id else v_deck.gearbox_card_id end;
    end if;
    v_a_wins := false;
  else
    v_a_sp := round(private.compute_sp(a.e_power, a.e_weight + a.g_weight, a.g_shift, a.t_gum, v_amod.perf_bonus_pct), 4);
    v_a_wins := v_a_sp > v_g_sp;

    v_new_gum := greatest(0, a.t_gum - v_amod.wear_pct);
    update user_cards set tire_wear = v_new_gum, is_destroyed = (v_new_gum <= 0)
     where id = v_deck.tire_card_id;
    if v_effect is null or v_effect not in ('revision_express', 'revision_complete') then
      update user_cards
         set runs_count = runs_count + 1,
             wins_count = wins_count + case when v_a_wins then 1 else 0 end
       where id = v_deck.engine_card_id;
    end if;
    if v_effect is null or v_effect not in ('vidange_boite', 'revision_complete') then
      update user_cards
         set runs_count = runs_count + 1,
             wins_count = wins_count + case when v_a_wins then 1 else 0 end
       where id = v_deck.gearbox_card_id;
    end if;
  end if;

  if v_a_wins then v_a_coins := 10; v_a_xp := 10; else v_a_coins := 2; v_a_xp := 2; end if;

  select count(*) into v_cnt from duels_history
   where defender_id = g.owner_id and defender_rewarded and created_at >= private.paris_day_start();
  if v_cnt < c_defense_cap then
    v_rewarded := true;
    if v_a_wins then v_d_coins := 1; v_d_xp := 1; else v_d_coins := 4; v_d_xp := 4; end if;
  end if;

  -- Multiplicateur de pièces du rang, figé sur l'XP du mois calendaire.
  v_a_coins := private.ranked_coins(p_attacker_id, v_a_coins);
  v_d_coins := private.ranked_coins(g.owner_id, v_d_coins);

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

  perform private.record_duel_progress(
    p_attacker_id, g.owner_id, v_duel_id, v_a_wins, v_effect is not null, a.t_gum, g.t_gum);

  return jsonb_build_object(
    'duel_id', v_duel_id, 'weather', v_weather, 'result', case when v_a_wins then 'attacker_win' else 'defender_win' end,
    'broken_part', v_broken, 'part_saved', v_saved,
    'attacker_sp', v_a_sp, 'defender_sp', v_g_sp,
    'coins', v_a_coins, 'xp', v_a_xp,
    'tire_gum_after', v_new_gum, 'bonus', v_effect);
end $$;

-- ---------- Duel organisé -------------------------------------------------
create or replace function public.accept_duel(p_user uuid, p_challenge uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_ch public.duel_challenges%rowtype;
  a record;
  g record;
  w public.weather_conditions%rowtype;
  v_amod public.tire_weather_modifiers%rowtype;
  v_gmod public.tire_weather_modifiers%rowtype;
  v_weather public.weather_type;
  v_p_e numeric; v_p_g numeric;
  v_roll_e numeric; v_roll_g numeric;
  v_broken public.card_category;
  v_a_sp numeric; v_g_sp numeric;
  v_a_wins boolean;
  v_forfeit boolean := false;
  v_new_gum numeric;
  v_duel_id uuid := gen_random_uuid();
  v_a_coins integer; v_a_xp integer;
  v_d_coins integer; v_d_xp integer;
  v_deck_id uuid;
  v_att_deck uuid;
  v_snap_att jsonb := '{}'::jsonb;
  v_att_gum numeric;
begin
  perform private.assert_caller(p_user);

  select * into v_ch from public.duel_challenges
   where id = p_challenge and target_id = p_user and status = 'pending'
   for update;
  if not found then raise exception 'challenge_not_found'; end if;

  perform 1 from public.profiles where id in (p_user, v_ch.challenger_id) order by id for update;

  -- Même deck que l'écran (le plus ancien). Incomplet : on refuse d'accepter.
  select d.id into v_deck_id
    from public.user_decks d
   where d.owner_id = p_user
   order by d.created_at
   limit 1;
  if not found then raise exception 'config_incomplete'; end if;

  select d.id as deck_id,
         d.engine_card_id as e_card, d.gearbox_card_id as g_card, d.tire_card_id as t_card,
         te.power_hp as e_power, te.weight_kg as e_weight,
         tg.weight_kg as g_weight, tg.shift_time_ms as g_shift,
         ct.tire_wear as t_gum, tt.tire_type as t_type
    into g
    from public.user_decks d
    join public.user_cards ce on ce.id = d.engine_card_id join public.card_templates te on te.id = ce.template_id
    join public.user_cards cg on cg.id = d.gearbox_card_id join public.card_templates tg on tg.id = cg.template_id
    join public.user_cards ct on ct.id = d.tire_card_id join public.card_templates tt on tt.id = ct.template_id
   where d.id = v_deck_id
     and not ce.is_destroyed and not cg.is_destroyed and not ct.is_destroyed
     and not ce.is_listed and not cg.is_listed and not ct.is_listed
     and ce.owner_id = p_user and cg.owner_id = p_user and ct.owner_id = p_user;
  if not found then raise exception 'config_incomplete'; end if;

  -- Config affichée du demandeur (deck le plus ancien). Incomplète => forfait.
  select d.id into v_att_deck
    from public.user_decks d
   where d.owner_id = v_ch.challenger_id
   order by d.created_at
   limit 1;
  if not found then
    v_forfeit := true;
  else
    select d.id as deck_id,
           ce.runs_count as e_runs, te.power_hp as e_power, te.weight_kg as e_weight,
           te.base_break_risk as e_r0, te.wear_sensitivity as e_dr,
           cg.runs_count as g_runs, tg.weight_kg as g_weight, tg.shift_time_ms as g_shift,
           tg.base_break_risk as g_r0, tg.wear_sensitivity as g_dr,
           ct.tire_wear as t_gum, tt.tire_type as t_type,
           d.engine_card_id as e_card, d.gearbox_card_id as g_card, d.tire_card_id as t_card
      into a
      from public.user_decks d
      join public.user_cards ce on ce.id = d.engine_card_id join public.card_templates te on te.id = ce.template_id
      join public.user_cards cg on cg.id = d.gearbox_card_id join public.card_templates tg on tg.id = cg.template_id
      join public.user_cards ct on ct.id = d.tire_card_id join public.card_templates tt on tt.id = ct.template_id
     where d.id = v_att_deck
       and not ce.is_destroyed and not cg.is_destroyed and not ct.is_destroyed
       and not ce.is_listed and not cg.is_listed and not ct.is_listed
       and ce.owner_id = v_ch.challenger_id and cg.owner_id = v_ch.challenger_id and ct.owner_id = v_ch.challenger_id;
    v_forfeit := not found;
  end if;

  v_weather := (enum_range(null::weather_type))[1 + floor(random() * 4)::int];
  select * into w from public.weather_conditions where weather = v_weather;

  if v_forfeit then
    v_a_wins := false;
    v_a_sp := null;
    v_g_sp := 0;
    v_a_coins := 2; v_a_xp := 2;
    v_d_coins := 10; v_d_xp := 10;
  else
    perform 1 from public.user_cards
     where id in (a.e_card, a.g_card, a.t_card, g.e_card, g.g_card, g.t_card)
     order by id for update;

    -- La garantie constructeur court à chaque duel, y compris celui qui casse la pièce.
    update public.user_cards
       set warranty_used = warranty_used + 1
     where id in (a.e_card, a.g_card);

    select * into v_amod from public.tire_weather_modifiers where tire_type = a.t_type and weather = v_weather;
    select * into v_gmod from public.tire_weather_modifiers where tire_type = g.t_type and weather = v_weather;

    v_p_e := greatest(0, (a.e_r0 + a.e_runs * a.e_dr + w.engine_break_mod));
    v_roll_e := random() * 100;
    if v_p_e > 0 and v_roll_e <= v_p_e then
      v_broken := 'moteur';
    else
      v_p_g := greatest(0, (a.g_r0 + a.g_runs * a.g_dr + w.gearbox_break_mod));
      v_roll_g := random() * 100;
      if v_p_g > 0 and v_roll_g <= v_p_g then v_broken := 'boite'; end if;
    end if;

    -- Défenseur : bonus météo du pneu choisi, sans malus d'usure.
    v_g_sp := round(private.compute_sp(g.e_power, g.e_weight + g.g_weight, g.g_shift, 100, v_gmod.perf_bonus_pct), 4);

    if v_broken is not null then
      update public.user_cards set is_destroyed = true
       where id = case v_broken when 'moteur' then a.e_card else a.g_card end;
      v_a_wins := false;
    else
      v_a_sp := round(private.compute_sp(a.e_power, a.e_weight + a.g_weight, a.g_shift, a.t_gum, v_amod.perf_bonus_pct), 4);
      v_a_wins := v_a_sp > v_g_sp;
      v_new_gum := greatest(0, a.t_gum - v_amod.wear_pct);
      update public.user_cards set tire_wear = v_new_gum, is_destroyed = (v_new_gum <= 0) where id = a.t_card;
      update public.user_cards
         set runs_count = runs_count + 1,
             wins_count = wins_count + case when v_a_wins then 1 else 0 end
       where id = a.e_card;
      update public.user_cards
         set runs_count = runs_count + 1,
             wins_count = wins_count + case when v_a_wins then 1 else 0 end
       where id = a.g_card;
    end if;

    if v_a_wins then
      v_a_coins := 10; v_a_xp := 10; v_d_coins := 2; v_d_xp := 2;
    else
      v_a_coins := 2; v_a_xp := 2; v_d_coins := 10; v_d_xp := 10;
    end if;
    v_att_deck := a.deck_id;
    v_att_gum := a.t_gum;
    v_snap_att := jsonb_build_object(
      'e_power', a.e_power, 'e_weight', a.e_weight, 'g_weight', a.g_weight, 'g_shift', a.g_shift,
      't_gum', a.t_gum, 't_type', a.t_type);
  end if;

  -- Multiplicateur de pièces du rang, figé sur l'XP du mois calendaire.
  v_a_coins := private.ranked_coins(v_ch.challenger_id, v_a_coins);
  v_d_coins := private.ranked_coins(p_user, v_d_coins);

  insert into public.duels_history (
    id, attacker_id, defender_id, attacker_deck_id, defender_deck_id, weather,
    engine_break_prob, engine_break_roll, gearbox_break_prob, gearbox_break_roll,
    broken_part, part_saved, attacker_sp, defender_sp, result,
    attacker_coins, attacker_xp, defender_coins, defender_xp, defender_rewarded, snapshot)
  values (
    v_duel_id, v_ch.challenger_id, p_user,
    case when v_forfeit then null else v_att_deck end, v_deck_id, v_weather,
    v_p_e, v_roll_e, v_p_g, v_roll_g,
    v_broken, false, v_a_sp, coalesce(v_g_sp, 0),
    case when v_a_wins then 'attacker_win' else 'defender_win' end::duel_result,
    v_a_coins, v_a_xp, v_d_coins, v_d_xp, true,
    jsonb_build_object(
      'arranged', true,
      'forfeit', v_forfeit,
      'attacker', v_snap_att,
      'defender', jsonb_build_object(
        'e_power', g.e_power, 'e_weight', g.e_weight, 'g_weight', g.g_weight, 'g_shift', g.g_shift,
        't_gum', g.t_gum, 't_type', g.t_type)
    ));

  perform private.adjust_coins(v_ch.challenger_id, v_a_coins, 'duel_attack', v_duel_id);
  perform private.add_xp(v_ch.challenger_id, v_a_xp, 'attack', v_duel_id);
  perform private.adjust_coins(p_user, v_d_coins, 'duel_attack', v_duel_id);
  perform private.add_xp(p_user, v_d_xp, 'attack', v_duel_id);

  update public.duel_challenges
     set status = 'accepted', resolved_at = now(), duel_id = v_duel_id
   where id = v_ch.id;

  perform private.record_duel_progress(
    v_ch.challenger_id, p_user, v_duel_id, v_a_wins, false,
    v_att_gum,
    g.t_gum);

  return jsonb_build_object(
    'duel_id', v_duel_id,
    'forfeit', v_forfeit,
    'weather', v_weather,
    'result', case when v_a_wins then 'attacker_win' else 'defender_win' end,
    'broken_part', v_broken,
    'part_saved', false,
    'attacker_sp', v_a_sp,
    'defender_sp', coalesce(v_g_sp, 0),
    'coins', v_d_coins,
    'xp', v_d_xp,
    'tire_gum_after', v_new_gum,
    'bonus', null,
    'opponent', (select username from public.profiles where id = v_ch.challenger_id));
end $$;

-- ---------- Contre-La-Montre ----------------------------------------------
create or replace function public.execute_clm(
  p_user_id uuid,
  p_deck_id uuid,
  p_bonus_user_card_id uuid default null
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
  v_effect        public.bonus_effect;
  v_bonus_id      uuid;
  v_saved         boolean := false;
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
  v_month_xp      bigint;
  v_xp_gained     integer := 0;
begin
  perform private.assert_caller(p_user_id);
  -- Rang figé avant le gain : l'XP versée par cette tentative ne gonfle pas
  -- son propre multiplicateur.
  v_month_xp := private.month_xp(p_user_id);

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

  -- Carte bonus : consommée au lancement, même effet qu'en duel.
  if p_bonus_user_card_id is not null then
    select uc.id, t.bonus_effect into v_bonus_id, v_effect
      from public.user_cards uc join public.card_templates t on t.id = uc.template_id
     where uc.id = p_bonus_user_card_id and uc.owner_id = p_user_id
       and t.category = 'bonus' and not uc.is_destroyed and not uc.is_listed
     for update of uc;
    if not found then raise exception 'invalid_bonus'; end if;
    update public.user_cards set is_destroyed = true where id = v_bonus_id;
  end if;

  -- La garantie constructeur court à chaque tentative, même celle qui casse.
  update public.user_cards
     set warranty_used = warranty_used + 1
   where id in (v_deck.engine_card_id, v_deck.gearbox_card_id);

  -- 4. Casse mécanique (même formule que les duels) --------------------------
  v_p_e := greatest(0, (a.e_r0 + a.e_runs * a.e_dr + v_engine_mod)
                       * case when v_effect = 'huile_moteur_competition' then 0.5 else 1 end);
  v_roll_e := random() * 100;
  if v_p_e > 0 and v_roll_e <= v_p_e then
    v_broken := 'moteur';
  else
    v_p_g := greatest(0, (a.g_r0 + a.g_runs * a.g_dr + v_gearbox_mod)
                         * case when v_effect = 'huile_boite_competition' then 0.5 else 1 end);
    v_roll_g := random() * 100;
    if v_p_g > 0 and v_roll_g <= v_p_g then
      v_broken := 'boite';
    end if;
  end if;

  v_new_gum := a.t_gum;

  if v_broken is not null then
    v_saved := coalesce(v_effect = 'assistance_plateau', false);
    if not v_saved then
      update public.user_cards
         set is_destroyed = true
       where id = case v_broken when 'moteur' then v_deck.engine_card_id
                                else v_deck.gearbox_card_id end;
    end if;
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
       set runs_total = runs_total + 1,
           runs_count = runs_count + case when v_effect in ('revision_express', 'revision_complete') then 0 else 1 end
     where id = v_deck.engine_card_id;
    update public.user_cards
       set runs_total = runs_total + 1,
           runs_count = runs_count + case when v_effect in ('vidange_boite', 'revision_complete') then 0 else 1 end
     where id = v_deck.gearbox_card_id;

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

  -- 10. Versement des pièces, multipliées par le rang -----------------------
  -- L'XP versée par les claims reste calée sur les montants de base.
  v_xp_gained := v_medals_coins + v_participation;
  v_medals_coins := private.coins_with_rank(v_month_xp, v_medals_coins);
  v_participation := private.coins_with_rank(v_month_xp, v_participation);
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
    'part_saved', v_saved,
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
    'xp_gained', v_xp_gained,
    'rank_multiplier', round(public.rank_coefficient(v_month_xp), 2),
    'claimed', to_jsonb(v_claimed),
    'participation_claimed', v_participation_claimed,
    'bonus', v_effect,
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

-- ---------- Banc d'essai --------------------------------------------------
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
  v_month_xp      bigint;
  v_xp_gained     integer := 0;
begin
  perform private.assert_caller(p_user_id);
  -- Rang figé avant le gain : l'XP versée par ce passage ne gonfle pas
  -- son propre multiplicateur.
  v_month_xp := private.month_xp(p_user_id);

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

  -- 9. Versement des pièces, multipliées par le rang -------------------------
  -- L'XP versée par les claims reste calée sur les montants de base.
  v_xp_gained := v_medals_coins + v_participation;
  v_medals_coins := private.coins_with_rank(v_month_xp, v_medals_coins);
  v_participation := private.coins_with_rank(v_month_xp, v_participation);
  if v_medals_coins > 0 then
    perform private.adjust_coins(p_user_id, v_medals_coins, 'dyno_medal', v_attempt_id);
  end if;
  if v_participation > 0 then
    perform private.adjust_coins(p_user_id, v_participation, 'dyno_participation', v_attempt_id);
  end if;

  -- Défi quotidien « Séance d'essais » : le passage est comptabilisé.
  perform private.add_progress(p_user_id, '{"dyno":1}'::jsonb);

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
    'xp_gained', v_xp_gained,
    'rank_multiplier', round(public.rank_coefficient(v_month_xp), 2),
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

-- ---------- Configs Constructeur ------------------------------------------
create or replace function public.config_challenge_status(p_user uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_week date := private.config_week_start();
  v_brand text;
  v_next_brand text;
  v_found integer := 0;
  v_total integer := 0;
  v_eq record;
  v_challenge jsonb := null;
  v_next jsonb := null;
  v_equipped jsonb := null;
  v_history jsonb := '[]'::jsonb;
begin
  perform private.assert_caller(p_user);

  v_brand := private.config_week_brand(v_week);
  v_next_brand := private.config_week_brand(v_week + 7);

  if v_brand is not null then
    select jsonb_build_object('slug', b.slug, 'label', b.label, 'riddle', b.riddle)
      into v_challenge
      from public.config_brands b where b.slug = v_brand;
    v_total := private.config_pair_total(v_brand, p_user);
    select count(*)::integer into v_found
      from public.config_pair_claims
     where owner_id = p_user and week_start = v_week and brand = v_brand;
    select coalesce(jsonb_agg(
             jsonb_build_object('engine', e.code, 'gearbox', g.code) order by c.validated_at desc
           ), '[]'::jsonb)
      into v_history
      from public.config_pair_claims c
      join public.card_templates e on e.id = c.engine_template_id
      join public.card_templates g on g.id = c.gearbox_template_id
     where c.owner_id = p_user and c.week_start = v_week and c.brand = v_brand;
  end if;

  if v_next_brand is not null then
    select jsonb_build_object('riddle', b.riddle) into v_next
      from public.config_brands b where b.slug = v_next_brand;
  end if;

  select te.code as engine_code, te.name as engine_name, ce.is_destroyed as engine_dead, ce.is_listed as engine_listed,
         tg.code as gearbox_code, tg.name as gearbox_name, cg.is_destroyed as gearbox_dead, cg.is_listed as gearbox_listed
    into v_eq
    from public.user_decks d
    join public.user_cards ce on ce.id = d.engine_card_id
    join public.card_templates te on te.id = ce.template_id
    join public.user_cards cg on cg.id = d.gearbox_card_id
    join public.card_templates tg on tg.id = cg.template_id
   where d.owner_id = p_user
   order by d.created_at
   limit 1;
  if found then
    v_equipped := jsonb_build_object(
      'engine', jsonb_build_object('code', v_eq.engine_code, 'name', v_eq.engine_name,
                                   'ok', not (v_eq.engine_dead or v_eq.engine_listed)),
      'gearbox', jsonb_build_object('code', v_eq.gearbox_code, 'name', v_eq.gearbox_name,
                                    'ok', not (v_eq.gearbox_dead or v_eq.gearbox_listed)));
  end if;

  return jsonb_build_object(
    'week_start', v_week,
    'ends_at', (v_week + 7)::timestamp at time zone 'UTC',
    'reward', jsonb_build_object('coins', private.ranked_coins(p_user, 20), 'xp', 20),
    'challenge', v_challenge,
    'next', v_next,
    'found', v_found,
    'total', v_total,
    'equipped', v_equipped,
    'history', v_history);
end $$;

create or replace function public.validate_config_pair(p_user uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c_coins constant integer := 20;
  c_xp    constant integer := 20;
  v_week  date := private.config_week_start();
  v_brand text;
  v_deck  public.user_decks%rowtype;
  p       record;
  v_e_ok  boolean;
  v_g_ok  boolean;
  v_found integer;
  v_total integer;
  v_claim_id uuid;
  v_coins integer;
  v_status text;
begin
  perform private.assert_caller(p_user);
  perform 1 from public.profiles where id = p_user for update;
  if not found then raise exception 'profile_not_found'; end if;

  v_brand := private.config_week_brand(v_week);
  if v_brand is null then raise exception 'config_challenge_unavailable'; end if;

  select * into v_deck from public.user_decks
   where owner_id = p_user order by created_at limit 1;
  if not found then raise exception 'config_incomplete'; end if;

  select ce.is_destroyed as e_dead, ce.is_listed as e_listed, te.id as e_tpl, te.code as e_code, te.manufacturers as e_makers,
         cg.is_destroyed as g_dead, cg.is_listed as g_listed, tg.id as g_tpl, tg.code as g_code, tg.manufacturers as g_makers
    into p
    from public.user_cards ce
    join public.card_templates te on te.id = ce.template_id,
         public.user_cards cg
    join public.card_templates tg on tg.id = cg.template_id
   where ce.id = v_deck.engine_card_id and ce.owner_id = p_user
     and cg.id = v_deck.gearbox_card_id and cg.owner_id = p_user;
  if not found then raise exception 'config_incomplete'; end if;

  if p.e_dead then raise exception 'engine_destroyed'; end if;
  if p.g_dead then raise exception 'gearbox_destroyed'; end if;
  if p.e_listed or p.g_listed then raise exception 'card_listed'; end if;

  v_e_ok := v_brand = any (p.e_makers);
  v_g_ok := v_brand = any (p.g_makers);

  select count(*)::integer into v_found from public.config_pair_claims
   where owner_id = p_user and week_start = v_week and brand = v_brand;
  v_total := private.config_pair_total(v_brand, p_user);

  v_coins := private.ranked_coins(p_user, c_coins);

  if not (v_e_ok and v_g_ok) then
    v_status := 'mismatch';
  elsif exists (
    select 1 from public.config_pair_claims
     where owner_id = p_user and week_start = v_week
       and engine_template_id = p.e_tpl and gearbox_template_id = p.g_tpl
  ) then
    v_status := 'duplicate';
  else
    insert into public.config_pair_claims (
      owner_id, week_start, brand, engine_template_id, gearbox_template_id, coins_awarded, xp_awarded)
    values (p_user, v_week, v_brand, p.e_tpl, p.g_tpl, v_coins, c_xp)
    returning id into v_claim_id;
    perform private.adjust_coins(p_user, v_coins, 'config_pair', v_claim_id);
    perform private.add_xp(p_user, c_xp, 'config', null);
    v_found := v_found + 1;
    v_status := 'validated';
  end if;

  return jsonb_build_object(
    'status', v_status,
    'engine_code', p.e_code,
    'gearbox_code', p.g_code,
    'engine_ok', v_e_ok,
    'gearbox_ok', v_g_ok,
    'coins', case when v_status = 'validated' then v_coins else 0 end,
    'xp', case when v_status = 'validated' then c_xp else 0 end,
    'found', v_found,
    'total', v_total);
end $$;

-- ---------- Droits d'exécution ----------------------------------------------
revoke all on function public.execute_duel(uuid, uuid, uuid) from public;
revoke all on function public.accept_duel(uuid, uuid) from public;
revoke all on function public.execute_clm(uuid, uuid, uuid) from public;
revoke all on function public.execute_dyno(uuid, uuid) from public;
revoke all on function public.config_challenge_status(uuid) from public;
revoke all on function public.validate_config_pair(uuid) from public;
grant execute on function public.execute_duel(uuid, uuid, uuid) to app_user;
grant execute on function public.accept_duel(uuid, uuid) to app_user;
grant execute on function public.execute_clm(uuid, uuid, uuid) to app_user;
grant execute on function public.execute_dyno(uuid, uuid) to app_user;
grant execute on function public.config_challenge_status(uuid) to app_user;
grant execute on function public.validate_config_pair(uuid) to app_user;
