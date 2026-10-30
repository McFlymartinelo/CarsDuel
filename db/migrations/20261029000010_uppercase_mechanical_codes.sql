-- =============================================================================
-- 010 : codes lisibles des pièces mécaniques
-- m_1a → M1A, b_5 → B5, f1_16 → F116 : majuscules, sans underscore.
-- Les pneus et les cartes bonus conservent leur code (tire_slick, bonus_…).
-- Les migrations 006 (b_51, f1_16) sont antérieures : leurs codes sont renommés
-- ici, et les catalogues (seed / catalog_*.sql) utilisent déjà le nouveau format.
-- =============================================================================

update public.card_templates
   set code = upper(replace(code, '_', ''))
 where category in ('moteur', 'boite')
   and code is distinct from upper(replace(code, '_', ''));
