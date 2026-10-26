-- Allow the player to choose the mechanical card category for the weekly pull.
create or replace function public.claim_weekly_pull(p_user_id uuid, p_category text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_week date := private.paris_week_start();
  v_last date;
  v_rank integer := array_position(enum_range(null::public.card_rarity), private.roll_rarity());
  v_template uuid;
  v_id uuid;
begin
  perform private.assert_caller(p_user_id);
  if p_category not in ('moteur', 'boite') then
    raise exception 'invalid_category';
  end if;

  select last_weekly_pull into v_last from profiles where id = p_user_id for update;
  if not found then raise exception 'profile_not_found'; end if;
  if v_last = v_week then raise exception 'weekly_already_claimed' using errcode = '23505'; end if;

  select id into v_template
    from card_templates
   where category = p_category and is_active
   order by abs(array_position(enum_range(null::public.card_rarity), rarity) - v_rank),
            -ln(1 - random()) / drop_weight
   limit 1;
  if v_template is null then raise exception 'catalog_empty'; end if;

  v_id := private.grant_card(p_user_id, v_template, 'weekly_pull');
  update profiles set last_weekly_pull = v_week where id = p_user_id;
  return jsonb_build_object('week_start', v_week, 'card_ids', to_jsonb(array[v_id]));
end $$;

revoke all on function public.claim_weekly_pull(uuid, text) from public;
grant execute on function public.claim_weekly_pull(uuid, text) to app_user;
