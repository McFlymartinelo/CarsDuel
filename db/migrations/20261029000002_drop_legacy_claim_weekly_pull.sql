-- =============================================================================
-- 002 : supprime l'ancienne surcharge claim_weekly_pull(uuid)
-- La migration 20261026000014 a introduit claim_weekly_pull(uuid, text) sans
-- retirer la signature historique créée par la migration 013. Les deux étaient
-- exécutables par app_user ; seule la version avec catégorie doit subsister.
-- =============================================================================

drop function if exists public.claim_weekly_pull(uuid);

-- La signature à deux arguments reste la seule exposée à app_user.
revoke all on function public.claim_weekly_pull(uuid, text) from public;
grant execute on function public.claim_weekly_pull(uuid, text) to app_user;
