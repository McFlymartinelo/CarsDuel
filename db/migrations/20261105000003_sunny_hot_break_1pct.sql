-- =============================================================================
-- 20261105-03 : piste sèche et chaude
--
-- Le risque de casse moteur lié à la surchauffe passe de 2,0 % à 1,0 %.
-- La valeur est lue par tous les modes (duel, CLM solo, Banc d'essai) via
-- public.weather_conditions : aucun autre changement n'est nécessaire.
-- =============================================================================

update public.weather_conditions
set engine_break_mod = 1.0
where weather = 'sunny_hot';
