-- =============================================================================
-- Seed minimal : pneus, bonus, vendeur.
-- Les moteurs réels sont dans catalog_engines.sql, les boîtes dans catalog_gearboxes.sql.
-- db:seed applique les deux juste après ce fichier.
-- =============================================================================

insert into public.shop_vendors (name) values ('Magasin de pièces neuves')
on conflict (name) do nothing;

insert into public.card_templates (code, category, name, description, tire_type, tire_base_wear) values
  ('tire_route',      'pneus', 'Pneu Route',       'Polyvalent. ~33-34 duels.',                    'route',      3),
  ('tire_sport',      'pneus', 'Pneu Sport',       'Compromis performance/durabilité. ~20 duels.', 'sport',      5),
  ('tire_pluie',      'pneus', 'Pneu Pluie',       'Gomme sculptée, évacuation d''eau. ~14 duels.','pluie',      7),
  ('tire_semi_slick', 'pneus', 'Pneu Semi-slicks', 'Grip sec élevé. ~12-13 duels.',                'semi_slick', 8),
  ('tire_slick',      'pneus', 'Pneu Slicks',      'Grip piste absolu. ~10 duels.',                'slick',      10)
on conflict (code) do nothing;

insert into public.shop_catalog (vendor_id, template_id, price, is_active)
select v.id, t.id, x.price, true
from (values
  ('tire_pluie', 70),
  ('tire_route', 70),
  ('tire_sport', 90),
  ('tire_semi_slick', 120),
  ('tire_slick', 150)
) as x(code, price)
join public.card_templates t on t.code = x.code
join public.shop_vendors v on v.name = 'Magasin de pièces neuves'
on conflict (vendor_id, template_id) do update set
  price = excluded.price,
  is_active = true;

insert into public.card_templates (code, category, name, description, bonus_effect) values
  ('bonus_revision_express',  'bonus', 'Révision express',             'Pas d''usure du run sur le moteur.',               'revision_express'),
  ('bonus_vidange_boite',     'bonus', 'Vidange de boîte',             'Pas d''usure du run sur la boîte.',                'vidange_boite'),
  ('bonus_revision_complete', 'bonus', 'Révision complète',            'Pas d''usure du run sur le moteur et la boîte.',   'revision_complete'),
  ('bonus_huile_moteur',      'bonus', 'Huile moteur de compétition',  'Risque de casse moteur divisé par 2 sur ce run.',  'huile_moteur_competition'),
  ('bonus_huile_boite',       'bonus', 'Huile de boîte compétition',   'Risque de casse boîte divisé par 2 sur ce run.',   'huile_boite_competition'),
  ('bonus_assistance',        'bonus', 'Assistance plateau',           'En cas de casse, la pièce n''est pas détruite.',   'assistance_plateau')
on conflict (code) do nothing;

update public.weather_conditions set label = case weather
  when 'sunny_hot'  then 'Piste sèche et chaude'
  when 'sunny_cool' then 'Piste sèche et froide'
  when 'rain_hot'   then 'Piste humide et chaude'
  when 'rain_cool'  then 'Piste humide et froide'
end
where weather in ('sunny_hot', 'sunny_cool', 'rain_hot', 'rain_cool');
