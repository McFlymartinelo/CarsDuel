-- =============================================================================
-- 013 : garantie constructeur (moteurs et boîtes)
--
-- - card_templates.garantie : nombre de duels couverts (valeur de l'export JSON).
-- - user_cards.warranty_duels : garantie de l'instance (prolongeable par +2).
-- - user_cards.warranty_used  : duels réellement courus sous garantie, jamais
--   remis à zéro par une réparation (la garantie continue son cours).
--
-- Une pièce cassée reste au Musée de la casse et le duel est perdu. Si
-- warranty_used <= warranty_duels, elle peut être réparée gratuitement :
-- elle redevient utilisable et son risque de casse repart de R0.
-- =============================================================================

-- ---------- Colonnes ---------------------------------------------------------
alter table public.card_templates
  add column garantie integer not null default 0 check (garantie >= 0);

comment on column public.card_templates.garantie is
  'Nombre de duels couverts par la garantie constructeur (moteur / boîte).';

alter table public.user_cards
  add column warranty_duels integer not null default 0 check (warranty_duels >= 0),
  add column warranty_used  integer not null default 0 check (warranty_used >= 0);

comment on column public.user_cards.warranty_duels is
  'Garantie constructeur de cette instance, en duels (prolongeable de 2).';
comment on column public.user_cards.warranty_used is
  'Duels courus sous garantie ; non remis à zéro par une réparation.';

-- ---------- Catalogue (export JSON moteurs + boîtes) -------------------------
-- Cartes du JSON absentes du catalogue local (2 cartes privées + 12 anciennes cartes inactives).
insert into public.card_templates
  (code, category, name, description, image_url, rarity, is_active, drop_weight,
   weight_kg, base_break_risk, wear_sensitivity, architecture, power_hp,
   gearbox_type, shift_time_ms, tire_type, tire_base_wear, bonus_effect,
   restricted_to_username, garantie)
values
  ('F116', 'moteur', '1.6 Turbo Hybrid F1Team', '1.6 Turbo Hybrid (Ferrari F1)', null, 'legendaire', true, 1, 25, 0, 0.001, '6 cylindres', 1555, null, null, null, null, null, 'alexmartinelo', 2),
  ('MATMO12', 'moteur', '1.2 Atmo', null, null, 'commune', false, 1, 95, 1, 0.3, '3 cylindres', 75, null, null, null, null, null, null, 2),
  ('MBI30', 'moteur', '3.0 Biturbo', null, null, 'tres_rare', false, 1, 190, 3, 0.5, '6 cylindres', 400, null, null, null, null, null, null, 2),
  ('MTURBO16', 'moteur', '1.6 Turbo', null, null, 'commune', false, 1, 120, 1.5, 0.35, '4 cylindres', 150, null, null, null, null, null, null, 2),
  ('MTURBO20', 'moteur', '2.0 Turbo', null, null, 'rare', false, 1, 140, 2, 0.4, '4 cylindres', 250, null, null, null, null, null, null, 2),
  ('MV10', 'moteur', '5.2 V10', null, null, 'legendaire', false, 1, 220, 4, 0.6, 'V10', 600, null, null, null, null, null, null, 2),
  ('MV8', 'moteur', '5.0 V8', null, null, 'epique', false, 1, 210, 3.5, 0.55, 'V8', 450, null, null, null, null, null, null, 2),
  ('B51', 'boite', 'Séquentielle 8 Rapports F1Team Éclair', 'Boîte séquentielle F1 (Ferrari F1Team)', null, 'legendaire', true, 1, 12, 0, 0.001, null, null, 'sequentielle', 5, null, null, null, 'alexmartinelo', 2),
  ('BDCT7', 'boite', 'Double embrayage 7', null, null, 'tres_rare', false, 1, 70, 2, 0.35, null, null, 'double_embrayage', 80, null, null, null, null, 2),
  ('BDCTC', 'boite', 'DCT Compétition', null, null, 'epique', false, 1, 65, 2.5, 0.4, null, null, 'double_embrayage', 40, null, null, null, null, 2),
  ('BMAN5', 'boite', 'Manuelle 5', null, null, 'commune', false, 1, 45, 0.8, 0.2, null, null, 'manuelle', 350, null, null, null, null, 2),
  ('BROBO6', 'boite', 'Robotisée 6', null, null, 'commune', false, 1, 55, 1, 0.25, null, null, 'robotisee', 250, null, null, null, null, 2),
  ('BSEQ6', 'boite', 'Séquentielle 6', null, null, 'rare', false, 1, 60, 1.5, 0.3, null, null, 'sequentielle', 120, null, null, null, null, 2),
  ('BSEQF1', 'boite', 'Séquentielle F1', null, null, 'legendaire', false, 1, 55, 3, 0.5, null, null, 'sequentielle', 20, null, null, null, null, 2)
on conflict (code) do update set
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  image_url = excluded.image_url,
  rarity = excluded.rarity,
  is_active = excluded.is_active,
  drop_weight = excluded.drop_weight,
  weight_kg = excluded.weight_kg,
  base_break_risk = excluded.base_break_risk,
  wear_sensitivity = excluded.wear_sensitivity,
  architecture = excluded.architecture,
  power_hp = excluded.power_hp,
  gearbox_type = excluded.gearbox_type,
  shift_time_ms = excluded.shift_time_ms,
  tire_type = excluded.tire_type,
  tire_base_wear = excluded.tire_base_wear,
  bonus_effect = excluded.bonus_effect,
  restricted_to_username = excluded.restricted_to_username,
  garantie = excluded.garantie;

-- Garantie constructeur de chaque moteur / boîte (export JSON).
update public.card_templates t
   set garantie = v.garantie
  from (values
  ('M1A', 2),
  ('M1B', 2),
  ('M2A', 8),
  ('M2B', 8),
  ('M3A', 3),
  ('M3B', 8),
  ('M3C', 10),
  ('M4A', 8),
  ('M4B', 8),
  ('M4C', 8),
  ('M5A', 2),
  ('M5B', 2),
  ('M6A', 8),
  ('M6B', 8),
  ('M7A', 2),
  ('M7B', 2),
  ('M7C', 2),
  ('M8A', 2),
  ('M8B', 2),
  ('M9A', 2),
  ('M9B', 2),
  ('M9C', 2),
  ('M10A', 8),
  ('M10B', 8),
  ('M11', 2),
  ('M12A', 2),
  ('M12B', 2),
  ('M12C', 2),
  ('M12D', 2),
  ('M13A', 2),
  ('M13B', 2),
  ('M13C', 2),
  ('M13D', 2),
  ('M14A', 2),
  ('M14B', 2),
  ('M15A', 8),
  ('M15B', 8),
  ('M16A', 2),
  ('M16B', 2),
  ('M17A', 2),
  ('M17B', 2),
  ('M18A', 2),
  ('M18B', 2),
  ('M18C', 2),
  ('M19A', 2),
  ('M19B', 2),
  ('M19C', 2),
  ('M19D', 2),
  ('M20A', 8),
  ('M20B', 8),
  ('M20C', 8),
  ('M20D', 8),
  ('M20E', 8),
  ('M21A', 8),
  ('M21B', 8),
  ('M22A', 8),
  ('M22B', 8),
  ('M22C', 8),
  ('M23', 6),
  ('M24A', 2),
  ('M24B', 2),
  ('M24C', 8),
  ('M24D', 2),
  ('M25A', 2),
  ('M25B', 2),
  ('M25C', 2),
  ('M26A', 3),
  ('M26B', 6),
  ('M26C', 6),
  ('M27A', 3),
  ('M27B', 3),
  ('M28A', 2),
  ('M28B', 2),
  ('M28C', 2),
  ('M28D', 2),
  ('M29A', 2),
  ('M29B', 2),
  ('M29C', 2),
  ('M30A', 2),
  ('M30B', 2),
  ('M30C', 2),
  ('M30D', 2),
  ('M31A', 8),
  ('M31B', 8),
  ('M32A', 2),
  ('M32B', 2),
  ('M32C', 2),
  ('M33A', 8),
  ('M33B', 2),
  ('M33C', 2),
  ('M33D', 2),
  ('M34A', 2),
  ('M34B', 2),
  ('M34C', 2),
  ('M34D', 2),
  ('M35A', 2),
  ('M35B', 2),
  ('M35C', 2),
  ('M36A', 2),
  ('M36B', 2),
  ('M36C', 2),
  ('M37A', 8),
  ('M37B', 8),
  ('M37C', 8),
  ('M38A', 3),
  ('M38B', 3),
  ('M39A', 2),
  ('M39B', 2),
  ('M39C', 2),
  ('M39D', 2),
  ('M40A', 2),
  ('M40B', 2),
  ('M40C', 2),
  ('M41A', 6),
  ('M41B', 6),
  ('M42A', 3),
  ('M42B', 3),
  ('M42C', 3),
  ('M43A', 2),
  ('M43B', 2),
  ('M44A', 2),
  ('M44B', 2),
  ('M45A', 10),
  ('M45B', 10),
  ('M45C', 10),
  ('M46A', 2),
  ('M46B', 2),
  ('M46C', 2),
  ('M47A', 2),
  ('M47B', 2),
  ('M47C', 2),
  ('M47D', 2),
  ('M48A', 5),
  ('M48B', 5),
  ('M49A', 3),
  ('M49B', 3),
  ('M49C', 3),
  ('M50A', 3),
  ('M50B', 3),
  ('M51A', 2),
  ('M51B', 2),
  ('M51C', 2),
  ('M52A', 2),
  ('M52B', 2),
  ('M52C', 2),
  ('M53A', 3),
  ('M53B', 3),
  ('M53C', 3),
  ('M53D', 3),
  ('M54A', 2),
  ('M54B', 2),
  ('M55A', 2),
  ('M55B', 2),
  ('M56A', 2),
  ('M56B', 2),
  ('M57', 2),
  ('M58A', 2),
  ('M58B', 2),
  ('M59A', 2),
  ('M59B', 2),
  ('M60A', 2),
  ('M60B', 2),
  ('M61A', 6),
  ('M61B', 6),
  ('M62A', 3),
  ('M62B', 3),
  ('M62C', 3),
  ('M63A', 10),
  ('M63B', 10),
  ('M64A', 2),
  ('M64B', 2),
  ('M64C', 2),
  ('M65A', 3),
  ('M65B', 3),
  ('M66A', 2),
  ('M66B', 2),
  ('M67A', 2),
  ('M67B', 2),
  ('M68A', 2),
  ('M68B', 2),
  ('M69A', 2),
  ('M69B', 2),
  ('M69C', 2),
  ('M70A', 2),
  ('M70B', 2),
  ('M70C', 2),
  ('M71A', 2),
  ('M71B', 2),
  ('M72A', 2),
  ('M72B', 2),
  ('M72C', 2),
  ('M73A', 2),
  ('M73B', 2),
  ('M73C', 2),
  ('M74A', 2),
  ('M74B', 2),
  ('M74C', 2),
  ('M74D', 2),
  ('M75A', 3),
  ('M75B', 3),
  ('M75C', 3),
  ('M75D', 3),
  ('M76A', 3),
  ('M76B', 3),
  ('M77', 2),
  ('M78A', 10),
  ('M78B', 10),
  ('M79', 2),
  ('M80A', 3),
  ('M80B', 3),
  ('M81', 2),
  ('M82A', 3),
  ('M82B', 3),
  ('M83A', 3),
  ('M83B', 3),
  ('M83C', 3),
  ('M84', 6),
  ('M85A', 3),
  ('M85B', 3),
  ('M86A', 3),
  ('M86B', 3),
  ('M86C', 3),
  ('M87A', 2),
  ('M87B', 2),
  ('M87C', 2),
  ('M88A', 3),
  ('M88B', 3),
  ('M88C', 3),
  ('M89A', 3),
  ('M89B', 3),
  ('M89C', 3),
  ('M90A', 4),
  ('M90B', 4),
  ('M90C', 4),
  ('M90D', 4),
  ('F116', 2),
  ('MATMO12', 2),
  ('MBI30', 2),
  ('MTURBO16', 2),
  ('MTURBO20', 2),
  ('MV10', 2),
  ('MV8', 2),
  ('B1', 2),
  ('B2', 8),
  ('B3', 2),
  ('B4', 2),
  ('B5', 2),
  ('B6', 8),
  ('B7', 2),
  ('B8', 2),
  ('B9', 8),
  ('B10', 2),
  ('B11', 8),
  ('B12', 8),
  ('B13', 3),
  ('B14', 2),
  ('B15', 2),
  ('B16', 2),
  ('B17', 2),
  ('B18', 2),
  ('B19', 3),
  ('B20', 6),
  ('B21', 2),
  ('B22', 8),
  ('B23', 2),
  ('B24', 2),
  ('B25', 2),
  ('B26', 2),
  ('B27', 3),
  ('B28', 2),
  ('B29', 3),
  ('B30', 3),
  ('B31', 3),
  ('B32', 2),
  ('B33', 3),
  ('B34', 2),
  ('B35', 2),
  ('B36', 2),
  ('B37', 2),
  ('B38', 3),
  ('B39', 2),
  ('B40', 2),
  ('B41', 3),
  ('B42', 3),
  ('B43', 3),
  ('B44', 3),
  ('B45', 2),
  ('B46', 2),
  ('B47', 4),
  ('B48', 2),
  ('B49', 2),
  ('B50', 2),
  ('B51', 2),
  ('BDCT7', 2),
  ('BDCTC', 2),
  ('BMAN5', 2),
  ('BROBO6', 2),
  ('BSEQ6', 2),
  ('BSEQF1', 2)
  ) as v(code, garantie)
 where t.code = v.code;

-- Cartes existantes : la garantie entre en vigueur avec cette migration
-- (aucun duel passé n'est imputé rétroactivement).
update public.user_cards uc
   set warranty_duels = coalesce(t.garantie, 0),
       warranty_used = 0
  from public.card_templates t
 where t.id = uc.template_id;

-- ---------- Création d'une carte : garantie initiale ------------------------
create or replace function private.grant_card(p_user uuid, p_template uuid, p_source text) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.user_cards (owner_id, template_id, tire_wear, source, warranty_duels)
  select p_user, t.id, case when t.category = 'pneus' then 100 end, p_source, coalesce(t.garantie, 0)
  from public.card_templates t
  where t.id = p_template
    and private.can_use_template(t.restricted_to_username, p_user)
  returning id into v_id;
  if v_id is null then raise exception 'template_not_found'; end if;
  return v_id;
end $$;

-- ---------- Duel : la garantie court à chaque participation -----------------
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

-- ---------- Duel organisé : même règle de garantie --------------------------
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

-- ---------- Réparation sous garantie constructeur ---------------------------
create or replace function public.repair_card(p_user uuid, p_card_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_card public.user_cards%rowtype;
  v_cat  public.card_category;
begin
  perform private.assert_caller(p_user);

  select * into v_card from public.user_cards where id = p_card_id and owner_id = p_user for update;
  if not found then raise exception 'card_not_owned' using errcode = '42501'; end if;

  select category into v_cat from public.card_templates where id = v_card.template_id;
  if v_cat not in ('moteur', 'boite') then raise exception 'warranty_not_applicable'; end if;
  if not v_card.is_destroyed then raise exception 'card_not_broken'; end if;
  if v_card.warranty_duels <= 0 or v_card.warranty_used > v_card.warranty_duels then
    raise exception 'warranty_expired';
  end if;

  -- Risque de casse initial : runs_count repart de zéro. La garantie, elle, continue.
  update public.user_cards
     set is_destroyed = false, runs_count = 0
   where id = v_card.id;

  return jsonb_build_object(
    'card_id', v_card.id,
    'warranty_used', v_card.warranty_used,
    'warranty_duels', v_card.warranty_duels);
end $$;

-- ---------- Prolongation : +2 duels contre une Révision complète + 5 pièces --
create or replace function public.extend_warranty(p_user uuid, p_card_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c_cost constant integer := 5;
  v_card public.user_cards%rowtype;
  v_cat  public.card_category;
  v_bonus uuid;
begin
  perform private.assert_caller(p_user);

  select * into v_card from public.user_cards where id = p_card_id and owner_id = p_user for update;
  if not found then raise exception 'card_not_owned' using errcode = '42501'; end if;

  select category into v_cat from public.card_templates where id = v_card.template_id;
  if v_cat not in ('moteur', 'boite') then raise exception 'warranty_not_applicable'; end if;
  if not v_card.is_destroyed then raise exception 'card_not_broken'; end if;
  if v_card.warranty_duels <= 0 or v_card.warranty_used > v_card.warranty_duels then
    raise exception 'warranty_expired';
  end if;

  select uc.id into v_bonus
    from public.user_cards uc
    join public.card_templates t on t.id = uc.template_id
   where uc.owner_id = p_user
     and t.category = 'bonus' and t.bonus_effect = 'revision_complete'
     and not uc.is_destroyed and not uc.is_listed
   order by uc.acquired_at
   limit 1
   for update of uc;
  if v_bonus is null then raise exception 'bonus_revision_required'; end if;

  update public.user_cards set is_destroyed = true where id = v_bonus;
  perform private.adjust_coins(p_user, -c_cost, 'warranty_extension', v_card.id);
  update public.user_cards set warranty_duels = warranty_duels + 2 where id = v_card.id;

  return jsonb_build_object(
    'card_id', v_card.id,
    'warranty_duels', v_card.warranty_duels + 2,
    'bonus_card_id', v_bonus);
end $$;

-- ---------- Droits d'exécution ----------------------------------------------
revoke all on function public.repair_card(uuid, uuid) from public;
revoke all on function public.extend_warranty(uuid, uuid) from public;
grant execute on function public.repair_card(uuid, uuid) to app_user;
grant execute on function public.extend_warranty(uuid, uuid) to app_user;
