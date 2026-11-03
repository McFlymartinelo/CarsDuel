-- =============================================================================
-- 20261103000002 : n'alimenter l'outbox que pour les joueurs abonnés
-- Évite de créer un événement pour chaque joueur qui n'a jamais activé le push.
-- (La version de la migration 001 est équivalente pour une installation neuve ;
-- cette migration met à jour les bases où 001 a déjà été appliquée.)
-- =============================================================================

create or replace function private.push_enqueue(
  p_user_id   uuid,
  p_event_key text,
  p_kind      text,
  p_title     text,
  p_body      text,
  p_url       text,
  p_tag       text,
  p_amount    integer default 0
) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.push_outbox (user_id, event_key, kind, title, body, url, tag, amount)
  select p_user_id, p_event_key, p_kind, p_title, p_body, p_url, p_tag, p_amount
   where p_user_id is not null
     and exists (
       select 1 from public.push_subscriptions s where s.user_id = p_user_id
     )
  on conflict (event_key) do nothing;
$$;
