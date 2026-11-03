-- =============================================================================
-- Re-distribue le pack F1 privé (f1_16 + b_51) au compte autorisé.
--
-- Utile quand la migration 006 a déjà été appliquée mais que les cartes
-- manquent : compte créé après coup, cartes recyclées/supprimées, etc.
-- `db:migrate` ne rejoue jamais une migration déjà enregistrée : il faut donc
-- bien un nouveau fichier pour provoquer une nouvelle distribution.
--
-- Idempotent : si le joueur possède déjà une carte, aucune copie n'est ajoutée.
-- Pour un doublon volontaire, utiliser private.grant_card directement.
-- =============================================================================

-- Une carte cassée (is_destroyed) ou déposée à la benne ne compte plus comme
-- une copie utilisable : la migration en redonne une neuve.
create or replace function private.grant_restricted_cards(p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_template uuid;
begin
  for v_template in
    select t.id
      from public.card_templates t
      join public.profiles p on p.id = p_user
     where t.is_active
       and t.restricted_to_username is not null
       and t.restricted_to_username = lower(p.username)
  loop
    if not exists (
      select 1 from public.user_cards
       where owner_id = p_user
         and template_id = v_template
         and not is_destroyed
         and not in_recycle_bin
    ) then
      perform private.grant_card(p_user, v_template, 'admin');
    end if;
  end loop;
end $$;

update public.card_templates
   set is_active = true,
       restricted_to_username = 'alexmartinelo'
 where code in ('f1_16', 'b_51');

do $$
declare
  v_profile uuid;
begin
  for v_profile in
    select id from public.profiles where lower(username) = 'alexmartinelo'
  loop
    perform private.grant_restricted_cards(v_profile);
  end loop;
end $$;
