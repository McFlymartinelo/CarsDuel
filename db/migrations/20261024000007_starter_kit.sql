-- =============================================================================
-- 007 : kit de démarrage (optionnel, appelé par l'app à l'inscription si STARTER_KIT=1)
-- Sans pneus au départ, un nouveau joueur ne peut ni créer de deck ni gagner de pièces
-- (le tirage quotidien ne donne ni pneus, et la boutique est vide).
-- Donne : 1 Pneu Route neuf, 1 moteur commune et 1 boîte commune (si le catalogue en contient).
-- =============================================================================
create or replace function private.grant_starter_kit(p_user uuid) returns void
language plpgsql as $$
declare v_id uuid;
begin
  select id into v_id from public.card_templates where category = 'pneus' and tire_type = 'route' and is_active limit 1;
  if v_id is not null then perform private.grant_card(p_user, v_id, 'starter'); end if;

  select id into v_id from public.card_templates
   where category = 'moteur' and rarity = 'commune' and is_active order by random() limit 1;
  if v_id is not null then perform private.grant_card(p_user, v_id, 'starter'); end if;

  select id into v_id from public.card_templates
   where category = 'boite' and rarity = 'commune' and is_active order by random() limit 1;
  if v_id is not null then perform private.grant_card(p_user, v_id, 'starter'); end if;
end $$;
