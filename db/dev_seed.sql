-- =============================================================================
-- Données de TEST uniquement (npm run db:dev-seed) : quelques moteurs/boîtes + boutique.
-- Les vraies données de catalogue restent à fournir par vos soins.
-- =============================================================================
insert into public.card_templates
  (code, category, name, rarity, architecture, power_hp, weight_kg, base_break_risk, wear_sensitivity) values
  ('m_atmo12',  'moteur', '1.2 Atmo',          'commune',    '3 cylindres',   75,  95, 1.0, 0.30),
  ('m_turbo16', 'moteur', '1.6 Turbo',         'commune',    '4 cylindres',  150, 120, 1.5, 0.35),
  ('m_turbo20', 'moteur', '2.0 Turbo',         'rare',       '4 cylindres',  250, 140, 2.0, 0.40),
  ('m_bi30',    'moteur', '3.0 Biturbo',       'tres_rare',  '6 cylindres',  400, 190, 3.0, 0.50),
  ('m_v8',      'moteur', '5.0 V8',            'epique',     'V8',           450, 210, 3.5, 0.55),
  ('m_v10',     'moteur', '5.2 V10',           'legendaire', 'V10',          600, 220, 4.0, 0.60)
on conflict (code) do nothing;

insert into public.card_templates
  (code, category, name, rarity, gearbox_type, shift_time_ms, weight_kg, base_break_risk, wear_sensitivity) values
  ('b_man5',  'boite', 'Manuelle 5',        'commune',    'manuelle',         350,  45, 0.8, 0.20),
  ('b_robo6', 'boite', 'Robotisée 6',       'commune',    'robotisee',        250,  55, 1.0, 0.25),
  ('b_seq6',  'boite', 'Séquentielle 6',    'rare',       'sequentielle',     120,  60, 1.5, 0.30),
  ('b_dct7',  'boite', 'Double embrayage 7','tres_rare',  'double_embrayage',  80,  70, 2.0, 0.35),
  ('b_dctc',  'boite', 'DCT Compétition',   'epique',     'double_embrayage',  40,  65, 2.5, 0.40),
  ('b_seqf1', 'boite', 'Séquentielle F1',   'legendaire', 'sequentielle',      20,  55, 3.0, 0.50)
on conflict (code) do nothing;

-- Boutique de test : mêmes prix pneus que le seed (pluie/route 70, sport 90, semi-slick 120, slick 150).
insert into public.shop_catalog (vendor_id, template_id, price)
select v.id, t.id, x.price
from public.shop_vendors v
join (values
  ('tire_pluie', 70),
  ('tire_route', 70),
  ('tire_sport', 90),
  ('tire_semi_slick', 120),
  ('tire_slick', 150)
) as x(code, price) on true
join public.card_templates t on t.code = x.code
where v.name = 'Magasin de pièces neuves'
on conflict (vendor_id, template_id) do update set price = excluded.price;
