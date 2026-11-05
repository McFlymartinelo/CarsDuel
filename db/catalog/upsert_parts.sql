-- =============================================================================
-- Catalogue moteurs et boîtes (db/catalog/moteurs.json + boites.json).
-- Paramètre $1 : tableau JSON des pièces. Lancé par scripts/db.mjs (seed).
-- Les identifiants existants sont conservés : les cartes déjà possédées
-- restent liées à leur modèle.
-- =============================================================================
insert into public.card_templates as t (
  code, category, name, description, image_url, rarity, is_active, drop_weight, weight_kg,
  base_break_risk, wear_sensitivity, architecture, power_hp, gearbox_type, shift_time_ms,
  restricted_to_username, garantie, manufacturers)
select p.code, p.category::public.card_category, p.name, p.description, p.image_url,
       p.rarity::public.card_rarity, p.is_active, p.drop_weight, p.weight_kg,
       p.base_break_risk, p.wear_sensitivity, p.architecture, p.power_hp,
       p.gearbox_type::public.gearbox_type, p.shift_time_ms,
       p.restricted_to_username, p.garantie, p.manufacturers
  from jsonb_to_recordset($1::jsonb) as p (
    code text, category text, name text, description text, image_url text, rarity text,
    is_active boolean, drop_weight numeric, weight_kg numeric, base_break_risk numeric,
    wear_sensitivity numeric, architecture text, power_hp integer, gearbox_type text,
    shift_time_ms integer, restricted_to_username text, garantie integer, manufacturers text[])
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
  restricted_to_username = excluded.restricted_to_username,
  garantie = excluded.garantie,
  manufacturers = excluded.manufacturers;
