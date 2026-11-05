-- Moteurs et boîtes absents du fichier catalogue : désactivés (ils restent en inventaire).
-- Les pièces privées (restricted_to_username) ne sont jamais retirées ici.
-- Paramètre $1 : tableau des codes présents dans db/catalog/*.json.
update public.card_templates
   set is_active = false
 where category in ('moteur', 'boite')
   and restricted_to_username is null
   and not (code = any($1::text[]));
