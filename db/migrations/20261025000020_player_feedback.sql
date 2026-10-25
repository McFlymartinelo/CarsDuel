-- =============================================================================
-- 020 : retours joueur
-- - Le SP du défenseur tient compte du type de pneus (météo), pas de l'usure.
-- - Duels organisés (demande, acceptation, forfait si la config du demandeur
--   est incomplète). Les deux joueurs touchent la récompense d'un attaquant.
-- - Défis quotidiens : 3 par jour (Paris), 5 pièces à la récupération.
-- - Notification « Demande de duel ».
-- =============================================================================

-- ---------- Défis quotidiens -------------------------------------------------
create table public.daily_quests (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  day      date not null,
  second   text not null,
  third    text not null,
  progress jsonb not null default '{}'::jsonb,
  claimed  text[] not null default '{}',
  primary key (user_id, day)
);

alter table public.daily_quests enable row level security;
grant select on public.daily_quests to app_user;
create policy daily_quests_select on public.daily_quests for select to app_user
  using (user_id = (select public.current_uid()));

create or replace function private.quest_pair(p_user uuid, p_day date)
returns text[]
language plpgsql stable as $$
declare
  pool text[] := array[
    'inventaire','boutique','recycle_bonus','duel','duels_2','duels_3',
    'attaque','defense','bonus','bonus_2','pneus_90','leaderboard',
    'marketplace','matin','nuit','rebond','win_attaque','win_defense'
  ];
  n int := array_length(pool, 1);
  a int;
  b int;
begin
  a := (abs(hashtext(p_user::text || p_day::text || ':a')::bigint) % n) + 1;
  b := (abs(hashtext(p_user::text || p_day::text || ':b')::bigint) % (n - 1)) + 1;
  if b >= a then b := b + 1; end if;
  return array[pool[a], pool[b]];
end $$;

create or replace function private.ensure_daily_quests(p_user uuid)
returns public.daily_quests
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_day date := (now() at time zone 'Europe/Paris')::date;
  v_pair text[];
  v_row public.daily_quests%rowtype;
begin
  v_pair := private.quest_pair(p_user, v_day);
  insert into public.daily_quests (user_id, day, second, third)
  values (p_user, v_day, v_pair[1], v_pair[2])
  on conflict (user_id, day) do nothing;

  select * into v_row from public.daily_quests where user_id = p_user and day = v_day for update;
  return v_row;
end $$;

create or replace function private.touch_progress(p_user uuid, p_key text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_row public.daily_quests%rowtype;
begin
  if p_key not in ('connect','inventaire','boutique','marketplace','leaderboard','recycle_bonus') then
    return;
  end if;
  v_row := private.ensure_daily_quests(p_user);
  if coalesce((v_row.progress->>p_key)::int, 0) >= 1 then return; end if;
  update public.daily_quests
     set progress = jsonb_set(progress, array[p_key], '1'::jsonb)
   where user_id = p_user and day = v_row.day;
end $$;

create or replace function private.add_progress(p_user uuid, p_patch jsonb)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_row public.daily_quests%rowtype;
  v_prog jsonb;
  k text;
begin
  v_row := private.ensure_daily_quests(p_user);
  v_prog := v_row.progress;
  for k in select jsonb_object_keys(p_patch) loop
    v_prog := jsonb_set(v_prog, array[k], to_jsonb(coalesce((v_prog->>k)::int, 0) + (p_patch->>k)::int), true);
  end loop;
  update public.daily_quests set progress = v_prog where user_id = p_user and day = v_row.day;
end $$;

create or replace function private.quest_done(p_progress jsonb, p_quest text)
returns boolean
language sql immutable as $$
  select case p_quest
    when 'pointage' then coalesce((p_progress->>'connect')::int, 0) >= 1
    when 'inventaire' then coalesce((p_progress->>'inventaire')::int, 0) >= 1
    when 'boutique' then coalesce((p_progress->>'boutique')::int, 0) >= 1
    when 'recycle_bonus' then coalesce((p_progress->>'recycle_bonus')::int, 0) >= 1
    when 'duel' then coalesce((p_progress->>'duels')::int, 0) >= 1
    when 'duels_2' then coalesce((p_progress->>'duels')::int, 0) >= 2
    when 'duels_3' then coalesce((p_progress->>'duels')::int, 0) >= 3
    when 'attaque' then coalesce((p_progress->>'attacks')::int, 0) >= 1
    when 'defense' then coalesce((p_progress->>'defenses')::int, 0) >= 1
    when 'bonus' then coalesce((p_progress->>'bonus_duels')::int, 0) >= 1
    when 'bonus_2' then coalesce((p_progress->>'bonus_duels')::int, 0) >= 2
    when 'pneus_90' then coalesce((p_progress->>'tire90')::int, 0) >= 1
    when 'leaderboard' then coalesce((p_progress->>'leaderboard')::int, 0) >= 1
    when 'marketplace' then coalesce((p_progress->>'marketplace')::int, 0) >= 1
    when 'matin' then coalesce((p_progress->>'morning')::int, 0) >= 1
    when 'nuit' then coalesce((p_progress->>'night')::int, 0) >= 1
    when 'rebond' then coalesce((p_progress->>'rebound')::int, 0) >= 1
    when 'win_attaque' then coalesce((p_progress->>'attack_wins')::int, 0) >= 1
    when 'win_defense' then coalesce((p_progress->>'defense_wins')::int, 0) >= 1
    else false
  end
$$;

create or replace function private.record_duel_progress(
  p_attacker uuid,
  p_defender uuid,
  p_duel uuid,
  p_attacker_wins boolean,
  p_bonus boolean,
  p_attacker_gum numeric,
  p_defender_gum numeric
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_hour int;
  v_rebound boolean := false;
  v_att jsonb := '{"duels":1,"attacks":1}'::jsonb;
  v_def jsonb := '{"duels":1,"defenses":1}'::jsonb;
begin
  select extract(hour from now() at time zone 'Europe/Paris')::int into v_hour;

  select
    (prev.attacker_id = p_attacker and prev.result = 'defender_win')
    or (prev.defender_id = p_attacker and prev.result = 'attacker_win')
    into v_rebound
  from (
    select attacker_id, defender_id, result
      from public.duels_history
     where (attacker_id = p_attacker or defender_id = p_attacker) and id <> p_duel
     order by created_at desc
     limit 1
  ) prev;

  if p_bonus then v_att := v_att || '{"bonus_duels":1}'::jsonb; end if;
  if p_attacker_gum is not null and p_attacker_gum >= 90 then v_att := v_att || '{"tire90":1}'::jsonb; end if;
  if p_attacker_wins then v_att := v_att || '{"attack_wins":1}'::jsonb; end if;
  if v_hour < 12 then v_att := v_att || '{"morning":1}'::jsonb; end if;
  if v_hour >= 20 then v_att := v_att || '{"night":1}'::jsonb; end if;
  if coalesce(v_rebound, false) then v_att := v_att || '{"rebound":1}'::jsonb; end if;

  if p_defender_gum is not null and p_defender_gum >= 90 then v_def := v_def || '{"tire90":1}'::jsonb; end if;
  if not p_attacker_wins then v_def := v_def || '{"defense_wins":1}'::jsonb; end if;

  perform private.add_progress(p_attacker, v_att);
  perform private.add_progress(p_defender, v_def);
end $$;

create or replace function public.touch_quest(p_user uuid, p_key text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform private.assert_caller(p_user);
  perform private.touch_progress(p_user, p_key);
end $$;

create or replace function public.my_daily_quests(p_user uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_row public.daily_quests%rowtype;
begin
  perform private.assert_caller(p_user);
  perform private.touch_progress(p_user, 'connect');
  v_row := private.ensure_daily_quests(p_user);
  return jsonb_build_object(
    'second', v_row.second,
    'third', v_row.third,
    'progress', v_row.progress,
    'claimed', to_jsonb(v_row.claimed)
  );
end $$;

create or replace function public.claim_daily_quest(p_user uuid, p_quest text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_row public.daily_quests%rowtype;
begin
  perform private.assert_caller(p_user);
  if p_quest is null or p_quest not in (
    'pointage','inventaire','boutique','recycle_bonus','duel','duels_2','duels_3',
    'attaque','defense','bonus','bonus_2','pneus_90','leaderboard','marketplace',
    'matin','nuit','rebond','win_attaque','win_defense'
  ) then
    raise exception 'quest_unknown';
  end if;
  perform private.touch_progress(p_user, 'connect');
  v_row := private.ensure_daily_quests(p_user);
  if p_quest <> 'pointage' and p_quest <> v_row.second and p_quest <> v_row.third then
    raise exception 'quest_unknown';
  end if;
  if p_quest = any(v_row.claimed) then raise exception 'quest_already_claimed'; end if;
  if not private.quest_done(v_row.progress, p_quest) then raise exception 'quest_not_done'; end if;

  update public.daily_quests
     set claimed = claimed || p_quest
   where user_id = p_user and day = v_row.day;
  perform private.adjust_coins(p_user, 5, 'daily_quest', null);

  return jsonb_build_object('quest', p_quest, 'coins', 5);
end $$;

-- ---------- Duels organisés --------------------------------------------------
create table public.duel_challenges (
  id            uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.profiles (id) on delete cascade,
  target_id     uuid not null references public.profiles (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  duel_id       uuid references public.duels_history (id) on delete set null,
  check (challenger_id <> target_id)
);
create index idx_duel_challenges_pending on public.duel_challenges (target_id, created_at desc) where status = 'pending';

alter table public.duel_challenges enable row level security;
grant select on public.duel_challenges to app_user;
create policy duel_challenges_select on public.duel_challenges for select to app_user
  using (challenger_id = (select public.current_uid()) or target_id = (select public.current_uid()));

create or replace function public.propose_duel(p_user uuid, p_username text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_name text := btrim(coalesce(p_username, ''));
  v_target uuid;
  v_id uuid;
begin
  perform private.assert_caller(p_user);
  if v_name = '' then raise exception 'user_not_found'; end if;

  select id into v_target
    from public.profiles
   where lower(username) = lower(v_name)
   order by (username = v_name) desc
   limit 1;
  if not found then raise exception 'user_not_found'; end if;
  if v_target = p_user then raise exception 'cannot_challenge_self'; end if;

  if exists (
    select 1 from public.duel_challenges
     where status = 'pending'
       and ((challenger_id = p_user and target_id = v_target) or (challenger_id = v_target and target_id = p_user))
  ) then
    raise exception 'challenge_pending';
  end if;

  insert into public.duel_challenges (challenger_id, target_id)
  values (p_user, v_target)
  returning id into v_id;

  return jsonb_build_object('challenge_id', v_id, 'username', (select username from public.profiles where id = v_target));
end $$;

create or replace function public.decline_duel(p_user uuid, p_challenge uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_n int;
begin
  perform private.assert_caller(p_user);
  update public.duel_challenges
     set status = 'declined', resolved_at = now()
   where id = p_challenge and target_id = p_user and status = 'pending';
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'challenge_not_found'; end if;
end $$;

create or replace function public.cancel_duel(p_user uuid, p_challenge uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_n int;
begin
  perform private.assert_caller(p_user);
  update public.duel_challenges
     set status = 'cancelled', resolved_at = now()
   where id = p_challenge and challenger_id = p_user and status = 'pending';
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'challenge_not_found'; end if;
end $$;

-- Accepte le défi avec les configs du moment.
-- Config du demandeur incomplète : victoire du défié, sans casse.
-- Les deux touchent la grille d'un attaquant (10/10 ou 2/2), sans plafond de défense.
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
      update public.user_cards set runs_count = runs_count + 1 where id = a.e_card;
      update public.user_cards set runs_count = runs_count + 1 where id = a.g_card;
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

-- ---------- Fantôme : pneus pris en compte, usure ignorée -------------------
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
      update user_cards set runs_count = runs_count + 1 where id = v_deck.engine_card_id;
    end if;
    if v_effect is null or v_effect not in ('vidange_boite', 'revision_complete') then
      update user_cards set runs_count = runs_count + 1 where id = v_deck.gearbox_card_id;
    end if;
  end if;

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

  perform private.record_duel_progress(
    p_attacker_id, g.owner_id, v_duel_id, v_a_wins, v_effect is not null, a.t_gum, g.t_gum);

  return jsonb_build_object(
    'duel_id', v_duel_id, 'weather', v_weather, 'result', case when v_a_wins then 'attacker_win' else 'defender_win' end,
    'broken_part', v_broken, 'part_saved', v_saved,
    'attacker_sp', v_a_sp, 'defender_sp', v_g_sp,
    'coins', v_a_coins, 'xp', v_a_xp,
    'tire_gum_after', v_new_gum, 'bonus', v_effect);
end $$;

-- Recyclage d'une carte bonus : compte pour le défi du jour.
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
  if v_card.is_listed then raise exception 'already_listed'; end if;

  select category, base_break_risk, wear_sensitivity
    into v_cat, v_r0, v_dr
    from public.card_templates where id = v_card.template_id;

  if v_card.is_destroyed then
    if v_cat not in ('moteur', 'boite', 'pneus') then raise exception 'card_destroyed'; end if;
    v_base := 1;
    v_pct := 0;
    v_gain := 1;
  elsif v_cat = 'bonus' then
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
  if v_cat = 'bonus' and not v_card.is_destroyed then
    perform private.touch_progress(p_user, 'recycle_bonus');
  end if;

  return jsonb_build_object('card_id', p_card, 'coins', v_gain, 'base', v_base, 'condition_pct', v_pct);
end $$;

-- Notification de demande de duel, en plus des événements déjà calculés.
create or replace function public.my_notifications(p_user_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_seen timestamptz;
  v_items jsonb;
begin
  perform private.assert_caller(p_user_id);
  select notifications_seen_at into v_seen from profiles where id = p_user_id;

  with ev as (
    select 'offer_received'::text as kind, o.created_at as at, t.name as label, o.amount as amount
      from marketplace_offers o
      join marketplace_listings l on l.id = o.listing_id
      join user_cards uc on uc.id = l.card_id
      join card_templates t on t.id = uc.template_id
     where l.seller_id = p_user_id and o.status = 'pending'
    union all
    select 'sale', l.closed_at, t.name, l.seller_net
      from marketplace_listings l
      join user_cards uc on uc.id = l.card_id
      join card_templates t on t.id = uc.template_id
     where l.seller_id = p_user_id and l.status = 'sold'
    union all
    select case o.status when 'accepted' then 'offer_accepted' else 'offer_rejected' end,
           o.resolved_at, t.name, o.amount
      from marketplace_offers o
      join marketplace_listings l on l.id = o.listing_id
      join user_cards uc on uc.id = l.card_id
      join card_templates t on t.id = uc.template_id
     where o.buyer_id = p_user_id and o.status in ('accepted', 'rejected')
    union all
    select case d.result when 'attacker_win' then 'duel_lost' else 'duel_won' end,
           d.created_at, p.username, d.defender_coins
      from duels_history d
      join profiles p on p.id = d.attacker_id
     where d.defender_id = p_user_id
    union all
    select 'duel_request', c.created_at, p.username, 0
      from duel_challenges c
      join profiles p on p.id = c.challenger_id
     where c.target_id = p_user_id and c.status = 'pending'
    union all
    select 'payout', pp.created_at,
           case pp.period when 'weekly' then 'Classement de la semaine' else 'Classement du mois' end || ' (#' || pp.rank || ')',
           pp.coins
      from leaderboard_payouts pp
     where pp.user_id = p_user_id
  ), recent as (
    select * from ev where at > now() - interval '30 days' order by at desc limit 15
  )
  select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'at', at, 'label', label, 'amount', amount,
                                               'unread', at > v_seen) order by at desc), '[]'::jsonb)
    into v_items from recent;

  return jsonb_build_object(
    'unread', (select count(*) from jsonb_array_elements(v_items) e where (e->>'unread')::boolean),
    'items', v_items);
end $$;

revoke all on function public.touch_quest(uuid, text) from public;
revoke all on function public.my_daily_quests(uuid) from public;
revoke all on function public.claim_daily_quest(uuid, text) from public;
revoke all on function public.propose_duel(uuid, text) from public;
revoke all on function public.decline_duel(uuid, uuid) from public;
revoke all on function public.cancel_duel(uuid, uuid) from public;
revoke all on function public.accept_duel(uuid, uuid) from public;
grant execute on function public.touch_quest(uuid, text) to app_user;
grant execute on function public.my_daily_quests(uuid) to app_user;
grant execute on function public.claim_daily_quest(uuid, text) to app_user;
grant execute on function public.propose_duel(uuid, text) to app_user;
grant execute on function public.decline_duel(uuid, uuid) to app_user;
grant execute on function public.cancel_duel(uuid, uuid) to app_user;
grant execute on function public.accept_duel(uuid, uuid) to app_user;
