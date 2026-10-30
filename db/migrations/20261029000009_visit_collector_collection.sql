-- =============================================================================
-- 009 : consulter la collection publique d'un autre pilote
-- Renvoie les modèles possédés par le joueur ciblé, sans exposer ses cartes
-- privées (visibilité calculée pour l'appelant).
-- =============================================================================

create or replace function public.collector_collection(p_user_id uuid, p_username text)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_target_id uuid;
  v_username text;
  v_cards jsonb;
begin
  perform private.assert_caller(p_user_id);

  select p.id, p.username
    into v_target_id, v_username
    from public.profiles p
   where lower(p.username) = lower(btrim(p_username));

  if v_target_id is null then
    raise exception 'user_not_found';
  end if;

  select coalesce(
           jsonb_agg(
             jsonb_build_object('card_templates', to_jsonb(t))
             order by t.category, t.code nulls last, t.name
           ),
           '[]'::jsonb
         )
    into v_cards
    from public.card_templates t
   where exists (
           select 1
             from public.user_cards uc
            where uc.owner_id = v_target_id
              and uc.template_id = t.id
         )
     and private.can_use_template(t.restricted_to_username, p_user_id);

  return jsonb_build_object('username', v_username, 'cards', v_cards);
end $$;

grant execute on function public.collector_collection(uuid, text) to app_user;
