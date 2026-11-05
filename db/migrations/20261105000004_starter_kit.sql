-- =============================================================================
-- 20261105-04 : kit de départ
--
-- Nouvelle composition : 2 moteurs communs, 2 boîtes communes, 5 bonus et
-- 5 pneus, tous tirés au hasard. Aucune configuration n'est montée.
-- =============================================================================

create or replace function private.grant_starter_kit(p_user uuid) returns void
language plpgsql as $$
declare
  v_id    uuid;
  v_email text;
  i       integer;
begin
  select lower(email) into v_email from public.users where id = p_user;
  if v_email is null
     or (select count(*) from public.users where lower(email) = v_email) <> 1 then
    return;
  end if;

  for i in 1..2 loop
    select id into v_id from public.card_templates
     where category = 'moteur' and rarity = 'commune' and is_active order by random() limit 1;
    if v_id is not null then perform private.grant_card(p_user, v_id, 'starter'); end if;
  end loop;

  for i in 1..2 loop
    select id into v_id from public.card_templates
     where category = 'boite' and rarity = 'commune' and is_active order by random() limit 1;
    if v_id is not null then perform private.grant_card(p_user, v_id, 'starter'); end if;
  end loop;

  for i in 1..5 loop
    perform private.grant_card(p_user, private.draw_bonus_template(), 'starter');
  end loop;

  for i in 1..5 loop
    select id into v_id from public.card_templates
     where category = 'pneus' and is_active order by random() limit 1;
    if v_id is not null then perform private.grant_card(p_user, v_id, 'starter'); end if;
  end loop;
end $$;
