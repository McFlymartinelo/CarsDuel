-- Catalogue boîtes (export Google Sheets). Régénéré par scripts/build-gearbox-catalog.mjs.
-- La référence réelle est stockée dans description.
-- Vendeur Neuf = Oui alimente le magasin de pièces neuves au prix indiqué. Stock NULL = illimité.
-- Toute boîte absente de cet export est désactivée (y compris les 6 boîtes du seed de test).
insert into public.card_templates
  (code, category, name, description, rarity, gearbox_type, shift_time_ms, weight_kg, base_break_risk, wear_sensitivity)
values
  ('B1', 'boite', 'Manuelle 4 Rapports Vintage', 'Boîte 4 vitesses ancienne (R5 / 205)', 'commune', 'manuelle', 550, 28, 0.1, 0.05),
  ('B2', 'boite', 'Manuelle 5 Rapports Tringlerie Légère', 'Boîte MA5 (Peugeot / Citroën TU)', 'commune', 'manuelle', 480, 32, 0.4, 0.2),
  ('B3', 'boite', 'Manuelle 5 Rapports Éco Guidage Flou', 'Boîte JB3 / JC5 (Renault)', 'commune', 'manuelle', 450, 34, 0.2, 0.1),
  ('B4', 'boite', 'Manuelle 5 Rapports Compacte', 'Boîte 02T (Polo / Fabia / Ibiza)', 'commune', 'manuelle', 420, 35, 0.2, 0.1),
  ('B5', 'boite', 'Manuelle 5 Rapports Moderne Citadine', 'BVM5 moderne (Clio 5 / Yaris / C3)', 'commune', 'manuelle', 400, 33, 0.2, 0.1),
  ('B6', 'boite', 'Manuelle 6 Rapports Routière Éco', 'BVM6 moderne (BlueHDi / EcoBoost)', 'commune', 'manuelle', 420, 44, 0.3, 0.15),
  ('B7', 'boite', 'Manuelle 6 Rapports Roulements Fragiles', 'Boîte M32 (Opel / Fiat / Alfa)', 'commune', 'manuelle', 400, 46, 4, 1.8),
  ('B8', 'boite', 'Manuelle 6 Rapports Synchros Faibles', 'Boîte PK6 (Laguna 2 / Trafic)', 'commune', 'manuelle', 430, 52, 3.5, 1.5),
  ('B9', 'boite', 'Automatique 4 Rapports Hydraulique Vintage', 'Boîte AL4 / DP0 (Électrovannes fragiles)', 'commune', 'convertisseur', 700, 68, 3, 1.2),
  ('B10', 'boite', 'Automatique 5 Rapports Étoile Robuste', 'Boîte 722.6 / 5G-Tronic', 'commune', 'convertisseur', 550, 78, 0.2, 0.1),
  ('B11', 'boite', 'Robotisée Mono-Embrayage Citadine Lente', 'Sensodrive / Dualogic', 'commune', 'robotisee', 650, 36, 2.5, 1),
  ('B12', 'boite', 'Robotisée 6 Rapports Balancement Prononcé', 'BMP6 / ETG6', 'commune', 'robotisee', 750, 48, 3.2, 1.3),
  ('B13', 'boite', 'Variation Continue Élastique', 'Boîte CVT (Multitronic / Lineartronic)', 'commune', 'variation_continue', 600, 62, 1, 0.4),
  ('B14', 'boite', 'Double Embrayage 7 Rapports Carter Sec', 'DSG7 DQ200 (Embrayages à sec)', 'commune', 'double_embrayage', 180, 72, 4.5, 1.9),
  ('B15', 'boite', 'Double Embrayage 6 Rapports Compacte', 'EDC 6 DC4 (Getrag à sec - Clio 4)', 'commune', 'double_embrayage', 200, 76, 2.8, 1.1),
  ('B16', 'boite', 'Manuelle 6 Rapports Sport Française', 'Boîte TL4 (Clio 3 RS)', 'rare', 'manuelle', 330, 43, 0.5, 0.2),
  ('B17', 'boite', 'Manuelle 6 Rapports Robuste Fonte/Alu', 'Boîte 02M / 02Q (Golf GTI / TDI)', 'rare', 'manuelle', 340, 49, 0.4, 0.2),
  ('B18', 'boite', 'Manuelle 6 Rapports Verrouillage Franc', 'Getrag 6 vitesses (Mini Cooper S / 130i)', 'rare', 'manuelle', 310, 45, 0.3, 0.15),
  ('B19', 'boite', 'Manuelle 6 Rapports Japonaise Débattement Court', 'BVM6 Honda (Civic Type R EP3 / FN2)', 'rare', 'manuelle', 280, 41, 0.2, 0.1),
  ('B20', 'boite', 'Manuelle 6 Rapports Roadster Guidage Direct', 'BVM6 SkyActiv (Mazda MX-5 ND)', 'rare', 'manuelle', 250, 39, 0.3, 0.15),
  ('B21', 'boite', 'Automatique 6 Rapports Convertisseur Rapide', 'ZF 6HP (BMW E90 / Audi A6)', 'rare', 'convertisseur', 380, 76, 0.5, 0.2),
  ('B22', 'boite', 'Automatique 8 Rapports Transversale Moderne', 'Aisin EAT8 / 8G-Tronic transversale', 'rare', 'convertisseur', 260, 79, 0.4, 0.2),
  ('B23', 'boite', 'Double Embrayage 6 Rapports Première Génération', 'DSG6 DQ250 (Golf 5 R32 / GTI)', 'rare', 'double_embrayage', 150, 82, 1.2, 0.5),
  ('B24', 'boite', 'Double Embrayage 7 Rapports Bain d''Huile Éco', 'DSG7 DQ381 (Golf 8 / Formentor)', 'rare', 'double_embrayage', 130, 79, 0.8, 0.35),
  ('B25', 'boite', 'Double Embrayage 6 Rapports Sport Français', 'EDC 6 DW6 (Clio 4 RS)', 'rare', 'double_embrayage', 140, 81, 1.5, 0.6),
  ('B26', 'boite', 'Double Embrayage 7 Rapports Routier Étoilé', '7G-DCT (Mercedes Classe A W176)', 'rare', 'double_embrayage', 140, 83, 1.1, 0.45),
  ('B27', 'boite', 'Double Embrayage 7 Rapports Humide', 'Getrag 7DCT300 (Alpine A110)', 'rare', 'double_embrayage', 120, 68, 1, 0.4),
  ('B28', 'boite', 'Manuelle 6 Rapports Renforcée DGL Intégré', 'Boîte PK4 avec DGL (Mégane 3 RS)', 'tres_rare', 'manuelle', 310, 48, 0.6, 0.25),
  ('B29', 'boite', 'Manuelle 6 Rapports Précision Horlogère', 'BVM6 Honda S2000', 'tres_rare', 'manuelle', 230, 42, 0.3, 0.1),
  ('B30', 'boite', 'Manuelle 6 Rapports Gros Couple Américain', 'Tremec T56 / TR-6060 (Corvette / Viper)', 'tres_rare', 'manuelle', 320, 58, 0.5, 0.2),
  ('B31', 'boite', 'Manuelle 6 Rapports Sportive Moderne', 'BVM6 Honda (Type R FL5 / GR Yaris)', 'tres_rare', 'manuelle', 260, 45, 0.4, 0.15),
  ('B32', 'boite', 'Robotisée 6 Rapports Compétition Hydraulique', 'SMG II (BMW M3 E46)', 'tres_rare', 'robotisee', 80, 55, 4.2, 1.8),
  ('B33', 'boite', 'Robotisée 6 Rapports Italienne Brutale', 'E-Gear (Gallardo) / F1 (Ferrari 360/F430)', 'tres_rare', 'robotisee', 100, 58, 4.5, 1.9),
  ('B34', 'boite', 'Automatique 8 Rapports Sportive Ultime', 'ZF 8HP70 / 8HP76 (BMW M2/M3/M4 G80)', 'tres_rare', 'convertisseur', 150, 85, 0.5, 0.2),
  ('B35', 'boite', 'Double Embrayage 7 Rapports Très Gros Couple', 'DSG7 DQ500 (Audi RS3 / TT RS)', 'tres_rare', 'double_embrayage', 90, 94, 0.9, 0.4),
  ('B36', 'boite', 'Double Embrayage 7 Rapports Longitudinale', 'S-Tronic DL501 (Audi S4 / S5 / RS5)', 'tres_rare', 'double_embrayage', 95, 115, 1.2, 0.5),
  ('B37', 'boite', 'Automatique 9 Rapports Convertisseur Multi-Disques', 'AMG Speedshift MCT 9G (E63 AMG)', 'tres_rare', 'convertisseur', 160, 88, 0.7, 0.3),
  ('B38', 'boite', 'Double Embrayage 7 Rapports Transaxle Sport', 'Getrag 7DCL750 (458 / AMG GT)', 'epique', 'double_embrayage', 70, 118, 0.9, 0.35),
  ('B39', 'boite', 'Double Embrayage 7 Rapports Référence Piste', 'PDK 7 rapports (Porsche 991 GT3)', 'epique', 'double_embrayage', 60, 115, 0.6, 0.25),
  ('B40', 'boite', 'Double Embrayage 8 Rapports Longitudinale Moderne', 'PDK 8 rapports (Porsche 992)', 'epique', 'double_embrayage', 50, 125, 0.7, 0.3),
  ('B41', 'boite', 'Double Embrayage 7 Rapports Bi-Arbre Forgé', 'BorgWarner GR6 (Nissan GT-R R35)', 'epique', 'double_embrayage', 65, 122, 1.4, 0.6),
  ('B42', 'boite', 'Double Embrayage 8 Rapports Transaxle Américaine', 'Tremec TR-9080 DCT (Corvette C8)', 'epique', 'double_embrayage', 60, 108, 1.2, 0.5),
  ('B43', 'boite', 'Robotisée 6 Rapports Superfast Clavier F1', 'F1 Superfast 2 (430 Scuderia / 599 GTO)', 'epique', 'robotisee', 60, 62, 4.8, 2),
  ('B44', 'boite', 'Robotisée 7 Rapports Barres Indépendantes', 'ISR 7 vitesses (Lamborghini Aventador)', 'epique', 'robotisee', 50, 70, 4.2, 1.8),
  ('B45', 'boite', 'Séquentielle Compétition Client Crabots 6', 'Sadev ST82-14 / Xtrac TCR', 'epique', 'sequentielle', 40, 42, 3.5, 1.5),
  ('B46', 'boite', 'Double Embrayage 7 Rapports Piste Rapprochée', 'PDK Sport 7 rapports (992 GT3 RS)', 'legendaire', 'double_embrayage', 40, 112, 0.8, 0.35),
  ('B47', 'boite', 'Double Embrayage 7 Rapports Couple Titanesque', 'Ricardo 7 DCT (Veyron / Chiron)', 'legendaire', 'double_embrayage', 80, 135, 1.2, 0.5),
  ('B48', 'boite', 'Séquentielle Proto Endurance Coupure Éclair', 'Xtrac P1059 / Hewland LMP (Le Mans)', 'legendaire', 'sequentielle', 30, 38, 4.5, 1.9),
  ('B49', 'boite', 'Multi-Embrayages 9 Rapports Vitesse Lumière', 'LST (Koenigsegg Jesko)', 'legendaire', 'multi_embrayages', 20, 90, 2.5, 1),
  ('B50', 'boite', 'Double Embrayage Formule 1 Carbone Intégré', 'Transmission F1 Seamless Shift', 'legendaire', 'dct_sequentielle', 15, 35, 5.5, 2.4)
on conflict (code) do update set
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  rarity = excluded.rarity,
  gearbox_type = excluded.gearbox_type,
  shift_time_ms = excluded.shift_time_ms,
  weight_kg = excluded.weight_kg,
  base_break_risk = excluded.base_break_risk,
  wear_sensitivity = excluded.wear_sensitivity,
  is_active = true;

update public.card_templates
set is_active = false
where category = 'boite'
  and restricted_to_username is null
  and code not in ('B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19', 'B20', 'B21', 'B22', 'B23', 'B24', 'B25', 'B26', 'B27', 'B28', 'B29', 'B30', 'B31', 'B32', 'B33', 'B34', 'B35', 'B36', 'B37', 'B38', 'B39', 'B40', 'B41', 'B42', 'B43', 'B44', 'B45', 'B46', 'B47', 'B48', 'B49', 'B50');

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
