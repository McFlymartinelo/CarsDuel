-- =============================================================================
-- 006 : règles de jeu paramétrables (météo + pneus). Indispensable au duel :
-- vit en migration (et non dans seed.sql) pour exister dans tous les environnements.
-- =============================================================================

insert into public.weather_conditions (weather, label, engine_break_mod, gearbox_break_mod) values
  ('sunny_hot',  'Piste sèche et chaude',  2.0, 0.5),
  ('sunny_cool', 'Piste sèche et froide',  0.0, 0.0),
  ('rain_hot',   'Piste humide et chaude', 0.0, 0.0),
  ('rain_cool',  'Piste humide et froide', -1.0, 0.0)
on conflict (weather) do update set label = excluded.label;

-- (type, météo, bonus perf %, gomme perdue par run en points de %)
-- Piste mouillée : usure /2 pour tous les pneus sauf Pluie (nominale).
insert into public.tire_weather_modifiers (tire_type, weather, perf_bonus_pct, wear_pct) values
  ('slick',      'sunny_hot',   20,  10.0), ('semi_slick', 'sunny_hot',   12,   8.0),
  ('sport',      'sunny_hot',    5,   5.0), ('route',      'sunny_hot',    0,   3.0),
  ('pluie',      'sunny_hot',  -30,  14.0),
  ('slick',      'sunny_cool',  10,  10.0), ('semi_slick', 'sunny_cool',   7,   8.0),
  ('sport',      'sunny_cool',   3,   5.0), ('route',      'sunny_cool',   0,   3.0),
  ('pluie',      'sunny_cool', -20,  10.5),
  ('pluie',      'rain_hot',    25,   7.0), ('route',      'rain_hot',     0,   1.5),
  ('sport',      'rain_hot',   -15,   2.5), ('semi_slick', 'rain_hot',   -35,   4.0),
  ('slick',      'rain_hot',   -60,   5.0),
  ('pluie',      'rain_cool',   20,   7.0), ('route',      'rain_cool',    0,   1.5),
  ('sport',      'rain_cool',  -20,   2.5), ('semi_slick', 'rain_cool',  -45,   4.0),
  ('slick',      'rain_cool',  -70,   5.0)
on conflict (tire_type, weather) do nothing;
