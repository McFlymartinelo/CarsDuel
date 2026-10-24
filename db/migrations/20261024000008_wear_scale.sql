-- ΔR du catalogue réel descend à 0,0005 %/run. numeric(5,3) arrondirait
-- cette valeur à 0,001. numeric(6,4) conserve quatre décimales (max 99,9999).
alter table public.card_templates
  alter column wear_sensitivity type numeric(6,4);
