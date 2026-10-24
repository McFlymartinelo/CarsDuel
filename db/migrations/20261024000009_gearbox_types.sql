-- Types présents dans le catalogue réel et absents de l'enum d'origine.
-- Les nouvelles valeurs ne sont pas utilisées dans cette transaction (limite PostgreSQL).
alter type public.gearbox_type add value if not exists 'convertisseur';
alter type public.gearbox_type add value if not exists 'variation_continue';
alter type public.gearbox_type add value if not exists 'multi_embrayages';
alter type public.gearbox_type add value if not exists 'dct_sequentielle';
