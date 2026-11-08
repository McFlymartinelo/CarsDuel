-- Secured reward claim for the emergency reconditioning workshop.
-- Eligibility is checked again under a profile lock so concurrent claims cannot
-- grant multiple usable parts of the same category.
create or replace function public.claim_reconditioned_part(p_user_id uuid, p_category public.card_category)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_template uuid;
  v_card uuid;
begin
  perform private.assert_caller(p_user_id);
  if p_category not in ('moteur', 'boite', 'pneus') then
    raise exception 'invalid_reconditioning_category';
  end if;

  perform 1 from public.profiles where id = p_user_id for update;
  if not found then raise exception 'profile_not_found'; end if;

  if exists (
    select 1 from public.user_cards uc
    join public.card_templates ct on ct.id = uc.template_id
    where uc.owner_id = p_user_id and ct.category = p_category
      and not uc.is_destroyed
      and (p_category <> 'pneus' or coalesce(uc.tire_wear, 0) > 0)
  ) then
    raise exception 'reconditioning_not_needed';
  end if;

  if p_category = 'pneus' then
    select id into v_template from public.card_templates
    where category = 'pneus' and tire_type = 'route' and is_active
    order by random() limit 1;
  else
    select id into v_template from public.card_templates
    where category = p_category and rarity = 'commune' and is_active
      and (restricted_to_username is null or restricted_to_username = (
        select lower(username) from public.profiles where id = p_user_id
      ))
    order by random() limit 1;
  end if;
  if v_template is null then raise exception 'catalog_empty'; end if;

  insert into public.user_cards(owner_id, template_id, tire_wear, source, warranty_duels, warranty_used)
  values (p_user_id, v_template,
          case when p_category = 'pneus' then 100 end,
          'reconditioned', 0, 0)
  returning id into v_card;

  return jsonb_build_object('card_id', v_card, 'category', p_category, 'template_id', v_template);
end;
$$;

revoke all on function public.claim_reconditioned_part(uuid, public.card_category) from public;
grant execute on function public.claim_reconditioned_part(uuid, public.card_category) to app_user;
