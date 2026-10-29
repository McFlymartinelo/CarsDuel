-- =============================================================================
-- 004 : index pour le garage et la collection
-- qCards lit toutes les cartes du joueur, cartes détruites incluses, triées par
-- acquired_at desc. idx_user_cards_owner est partiel (where not is_destroyed) :
-- il ne peut pas servir cette requête, d'où cet index complet.
-- L'index partiel existant est conservé pour les requêtes filtrant les cartes
-- disponibles.
-- =============================================================================

create index if not exists idx_user_cards_owner_acquired
  on public.user_cards (owner_id, acquired_at desc);

-- exists (...) dans loadCollectorCollection : owner_id + template_id.
create index if not exists idx_user_cards_owner_template
  on public.user_cards (owner_id, template_id);
