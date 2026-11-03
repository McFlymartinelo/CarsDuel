-- =============================================================================
-- 002 : Banc d'essai (Dyno Challenge)
--
-- Laboratoire d'optimisation quotidien : un défi et une météo sont tirés au
-- hasard chaque jour à minuit UTC, à la première lecture du jour. Tous les
-- joueurs partagent le même tirage pendant 24 h.
--
-- Le passage au banc ne consomme ni usure de pneus, ni run moteur/boîte, ni
-- garantie : aucun risque de casse, aucune contrepartie cachée. Seules les
-- contraintes du défi du jour sont vérifiées.
--
-- Récompenses : bronze 20, argent 50, or 100 pièces, une fois par jour et par
-- médaille, avec versement en cascade des paliers inférieurs non réclamés.
-- Seul le meilleur SP final de la journée est conservé par joueur.
--
-- Catalogue source : db/banc_configs.json.
-- =============================================================================

-- ---------- Défis ------------------------------------------------------------
create table public.dyno_configs (
  id                text primary key,
  name              text not null,
  description       text not null,
  constraint_list   jsonb not null default '[]'::jsonb,
  medal_bronze_sp   integer not null check (medal_bronze_sp > 0),
  medal_silver_sp   integer not null check (medal_silver_sp > 0),
  medal_gold_sp     integer not null check (medal_gold_sp > 0),
  sort_order        integer not null default 0,
  check (medal_bronze_sp < medal_silver_sp and medal_silver_sp < medal_gold_sp)
);

comment on table public.dyno_configs is
  'Catalogue des défis du Banc d''essai (contraintes simples et accessibles).';

insert into public.dyno_configs
  (id, name, description, constraint_list, medal_bronze_sp, medal_silver_sp, medal_gold_sp, sort_order)
values
  ('dyno_free_run', 'Banc d''Essai Libre',
   'Aucune contrainte. Trouvez la meilleure synergie pour la météo du jour.',
   '[]'::jsonb, 120, 190, 270, 1),
  ('dyno_tire_route', 'Spécification Pneus Route',
   'Pneus Route obligatoires.',
   '[{"type":"tire_type","value":"Route"}]'::jsonb, 90, 135, 180, 2),
  ('dyno_tire_sport', 'Spécification Pneus Sport',
   'Pneus Sport obligatoires.',
   '[{"type":"tire_type","value":"Sport"}]'::jsonb, 100, 150, 210, 3),
  ('dyno_tire_pluie', 'Spécification Pneus Pluie',
   'Pneus Pluie obligatoires.',
   '[{"type":"tire_type","value":"Pluie"}]'::jsonb, 95, 145, 200, 4),
  ('dyno_max_power_120', 'Défi Petites Cylindrées',
   'Puissance moteur limitée à 120 ch maximum.',
   '[{"type":"max_power_hp","value":120}]'::jsonb, 80, 105, 130, 5),
  ('dyno_max_power_200', 'Défi Moins de 200 Chevaux',
   'Puissance moteur limitée à 200 ch maximum.',
   '[{"type":"max_power_hp","value":200}]'::jsonb, 95, 135, 175, 6),
  ('dyno_max_weight_total', 'Chasse au Poids Global',
   'Poids total (moteur + boîte) limité à 190 kg maximum.',
   '[{"type":"max_weight_total_kg","value":190}]'::jsonb, 105, 150, 205, 7),
  ('dyno_max_engine_weight', 'Moteur Compact',
   'Poids du moteur seul limité à 130 kg maximum.',
   '[{"type":"max_engine_weight_kg","value":130}]'::jsonb, 95, 140, 190, 8),
  ('dyno_max_gearbox_weight', 'Boîte Poids Plume',
   'Poids de la boîte seule limité à 45 kg maximum.',
   '[{"type":"max_gearbox_weight_kg","value":45}]'::jsonb, 95, 140, 190, 9),
  ('dyno_manual_shift', 'Boîte Mécanique Traditionnelle',
   'Boîte de vitesses avec temps de passage de 250 ms ou plus.',
   '[{"type":"min_shift_time_ms","value":250}]'::jsonb, 100, 155, 215, 10),
  ('dyno_combo_sport_shift150', 'Tourisme Sportif',
   'Pneus Sport obligatoires ET boîte avec temps de passage de 150 ms ou plus.',
   '[{"type":"tire_type","value":"Sport"},{"type":"min_shift_time_ms","value":150}]'::jsonb, 100, 150, 205, 11),
  ('dyno_combo_route_power150', 'Citadine Quotidienne',
   'Pneus Route obligatoires ET puissance moteur limitée à 150 ch maximum.',
   '[{"type":"tire_type","value":"Route"},{"type":"max_power_hp","value":150}]'::jsonb, 85, 115, 145, 12),
  ('dyno_combo_pluie_shift200', 'Pluie & Boîte Standard',
   'Pneus Pluie obligatoires ET boîte avec temps de passage de 200 ms ou plus.',
   '[{"type":"tire_type","value":"Pluie"},{"type":"min_shift_time_ms","value":200}]'::jsonb, 95, 140, 190, 13),
  ('dyno_combo_power160_weight180', 'Équilibre Poids / Puissance',
   'Puissance limitée à 160 ch max ET poids total (moteur + boîte) limité à 180 kg max.',
   '[{"type":"max_power_hp","value":160},{"type":"max_weight_total_kg","value":180}]'::jsonb, 90, 125, 160, 14),
  ('dyno_combo_engweight120_sport', 'Agilité & Gomme Sport',
   'Poids moteur limité à 120 kg max ET pneus Sport obligatoires.',
   '[{"type":"max_engine_weight_kg","value":120},{"type":"tire_type","value":"Sport"}]'::jsonb, 95, 135, 175, 15),
  ('dyno_combo_boxweight45_manual', 'Transmission Épurée',
   'Poids de boîte limité à 45 kg max ET temps de passage de 250 ms ou plus.',
   '[{"type":"max_gearbox_weight_kg","value":45},{"type":"min_shift_time_ms","value":250}]'::jsonb, 95, 140, 190, 16);

-- ---------- Tirage du jour ---------------------------------------------------
create table public.dyno_daily (
  day         date primary key,
  config_id   text not null references public.dyno_configs (id) on delete restrict,
  weather     public.weather_type not null,
  created_at  timestamptz not null default now()
);

comment on table public.dyno_daily is
  'Défi et météo du Banc d''essai tirés au hasard pour chaque jour calendaire UTC.';

-- ---------- Tentatives -------------------------------------------------------
create table public.dyno_attempts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  day             date not null,
  config_id       text not null references public.dyno_configs (id) on delete restrict,
  weather         public.weather_type not null,
  deck_id         uuid references public.user_decks (id) on delete set null,
  sp_final        numeric(10,4) not null,
  score_meca      numeric(10,4) not null,
  tire_type       text not null,
  tire_gum        numeric(5,2) not null,
  tire_bonus_pct  numeric(5,1) not null,
  tire_malus      integer not null,
  tire_mod        numeric(6,4) not null,
  engine_name     text not null,
  gearbox_name    text not null,
  tire_name       text not null,
  coins_medals    integer not null default 0 check (coins_medals >= 0),
  medals_earned   text[] not null default '{}',
  created_at      timestamptz not null default now()
);
create index idx_dyno_attempts_user_day on public.dyno_attempts (user_id, day, created_at desc);
create index idx_dyno_attempts_day on public.dyno_attempts (day);

-- ---------- Meilleur SP de la journée ---------------------------------------
create table public.dyno_daily_bests (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  day         date not null,
  best_sp     numeric(10,4) not null check (best_sp >= 0),
  attempt_id  uuid references public.dyno_attempts (id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, day)
);

comment on table public.dyno_daily_bests is
  'Meilleur SP final personnel du joueur sur le Banc d''essai, jour par jour.';

-- ---------- Récompenses quotidiennes ----------------------------------------
create table public.dyno_daily_claims (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  day         date not null,
  kind        text not null check (kind in ('bronze', 'silver', 'gold')),
  coins       integer not null check (coins >= 0),
  claimed_at  timestamptz not null default now(),
  primary key (user_id, day, kind)
);
create index idx_dyno_claims_day on public.dyno_daily_claims (day);

-- ---------- RLS --------------------------------------------------------------
alter table public.dyno_configs       enable row level security;
alter table public.dyno_daily         enable row level security;
alter table public.dyno_attempts      enable row level security;
alter table public.dyno_daily_bests   enable row level security;
alter table public.dyno_daily_claims  enable row level security;

grant select on public.dyno_configs, public.dyno_daily to app_user;
grant select on public.dyno_attempts, public.dyno_daily_bests, public.dyno_daily_claims to app_user;

create policy dyno_configs_select on public.dyno_configs for select to app_user using (true);
create policy dyno_daily_select on public.dyno_daily for select to app_user using (true);
create policy dyno_attempts_select on public.dyno_attempts for select to app_user
  using (user_id = (select public.current_uid()));
create policy dyno_daily_bests_select on public.dyno_daily_bests for select to app_user
  using (user_id = (select public.current_uid()));
create policy dyno_daily_claims_select on public.dyno_daily_claims for select to app_user
  using (user_id = (select public.current_uid()));

-- ---------- Helpers ----------------------------------------------------------
create or replace function private.ensure_dyno_day()
returns public.dyno_daily
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_day      date := (now() at time zone 'UTC')::date;
  v_row      public.dyno_daily%rowtype;
  v_config   text;
  v_weather  public.weather_type;
begin
  select * into v_row from public.dyno_daily where day = v_day;
  if found then
    return v_row;
  end if;

  select id into v_config from public.dyno_configs order by random() limit 1;
  if v_config is null then
    raise exception 'dyno_no_config' using hint = 'Le catalogue des défis du banc est vide.';
  end if;
  v_weather := (enum_range(null::public.weather_type))[1 + floor(random() * 4)::int];

  insert into public.dyno_daily (day, config_id, weather)
  values (v_day, v_config, v_weather)
  on conflict (day) do nothing;

  select * into v_row from public.dyno_daily where day = v_day;
  return v_row;
end $$;

-- ---------- Lecture du défi du jour -----------------------------------------
create or replace function public.my_dyno_today(p_user uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_daily      public.dyno_daily%rowtype;
  v_config     public.dyno_configs%rowtype;
  v_best       public.dyno_daily_bests%rowtype;
  v_claimed    text[] := '{}';
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
     and day = v_daily.day;

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
    'attempts', v_attempts
  );
end $$;

-- ---------- Passage au banc --------------------------------------------------
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
        v_medals_coins := v_medals_coins + v_medal_coins;
        v_new_medals := array_append(v_new_medals, v_medal_key);
        v_claimed := array_append(v_claimed, v_medal_key);
      end if;
    end loop;
  end if;

  -- 8. Versement des pièces ---------------------------------------------------
  if v_medals_coins > 0 then
    perform private.adjust_coins(p_user_id, v_medals_coins, 'dyno_medal', v_attempt_id);
  end if;

  update public.dyno_attempts
     set coins_medals = v_medals_coins,
         medals_earned = v_new_medals
   where id = v_attempt_id;

  -- 9. Détails d'affichage ----------------------------------------------------
  select coalesce(array_agg(kind order by case kind
                        when 'bronze' then 1
                        when 'silver' then 2
                        else 3 end), '{}'::text[])
    into v_claimed
    from public.dyno_daily_claims
   where user_id = p_user_id
     and day = v_daily.day;

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
    'coins', v_medals_coins,
    'claimed', to_jsonb(v_claimed),
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
