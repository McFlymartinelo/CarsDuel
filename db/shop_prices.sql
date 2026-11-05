-- =============================================================================
-- Boutique officielle : prix des moteurs et boîtes vendus neufs.
-- Reprend les prix de l'ancien export Google Sheets (Vendeur neuf = Oui).
-- Ne touche jamais aux cartes : le catalogue est chargé par db/catalog/*.
-- Appliqué par db:seed après le catalogue.
-- =============================================================================

insert into public.shop_catalog (vendor_id, template_id, price, is_active)
select v.id, t.id, x.price, true
from (values
  ('M3A', 360),
  ('M3C', 405),
  ('M16A', 450),
  ('M16B', 480),
  ('M19A', 525),
  ('M19B', 570),
  ('M19C', 600),
  ('M20B', 660),
  ('M20D', 720),
  ('M23', 1050),
  ('M24C', 1140),
  ('M28B', 1260),
  ('M28C', 1380),
  ('M37A', 1470),
  ('M37B', 1590),
  ('M38B', 1860),
  ('M45B', 2250),
  ('M45C', 2370),
  ('M47A', 2580),
  ('M47C', 2760),
  ('M47D', 2880),
  ('M49A', 2940),
  ('M49C', 3060),
  ('M56A', 3300),
  ('M56B', 3540),
  ('M59A', 3900),
  ('M64C', 4800),
  ('M67B', 5100),
  ('M69B', 5550),
  ('M69C', 5850),
  ('M71A', 6150),
  ('M71B', 6300),
  ('M72A', 6450),
  ('M72B', 6750),
  ('M72C', 7050),
  ('M73B', 7200),
  ('M73C', 7350),
  ('M74C', 7800),
  ('M74D', 8400),
  ('M86B', 12600),
  ('M88B', 14700),
  ('M89C', 18000)
) as x(code, price)
join public.card_templates t on t.code = x.code
join public.shop_vendors v on v.name = 'Magasin de pièces neuves'
on conflict (vendor_id, template_id) do update set
  price = excluded.price,
  is_active = true;

update public.shop_catalog sc
set is_active = false
from public.card_templates t
where sc.template_id = t.id
  and t.category = 'moteur'
  and t.restricted_to_username is null
  and t.code not in ('M3A', 'M3C', 'M16A', 'M16B', 'M19A', 'M19B', 'M19C', 'M20B', 'M20D', 'M23', 'M24C', 'M28B', 'M28C', 'M37A', 'M37B', 'M38B', 'M45B', 'M45C', 'M47A', 'M47C', 'M47D', 'M49A', 'M49C', 'M56A', 'M56B', 'M59A', 'M64C', 'M67B', 'M69B', 'M69C', 'M71A', 'M71B', 'M72A', 'M72B', 'M72C', 'M73B', 'M73C', 'M74C', 'M74D', 'M86B', 'M88B', 'M89C');

insert into public.shop_catalog (vendor_id, template_id, price, is_active)
select v.id, t.id, x.price, true
from (values
  ('B5', 210),
  ('B6', 270),
  ('B20', 540),
  ('B22', 660),
  ('B24', 840),
  ('B27', 960),
  ('B31', 1350),
  ('B34', 1650),
  ('B35', 1740),
  ('B37', 2040),
  ('B40', 3300),
  ('B42', 4050),
  ('B45', 4500),
  ('B46', 7500),
  ('B49', 10500)
) as x(code, price)
join public.card_templates t on t.code = x.code
join public.shop_vendors v on v.name = 'Magasin de pièces neuves'
on conflict (vendor_id, template_id) do update set
  price = excluded.price,
  is_active = true;

update public.shop_catalog sc
set is_active = false
from public.card_templates t
where sc.template_id = t.id
  and t.category = 'boite'
  and t.restricted_to_username is null
  and t.code not in ('B5', 'B6', 'B20', 'B22', 'B24', 'B27', 'B31', 'B34', 'B35', 'B37', 'B40', 'B42', 'B45', 'B46', 'B49');

-- Une offre dont la pièce est désactivée n'est plus vendable.
update public.shop_catalog sc
set is_active = false
from public.card_templates t
where sc.template_id = t.id
  and not t.is_active
  and sc.is_active;
