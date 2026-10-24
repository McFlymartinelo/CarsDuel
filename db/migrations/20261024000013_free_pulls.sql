-- =============================================================================
-- 013 : tirages gratuits
--   quotidien  : 3 cartes bonus (une fois par jour calendaire Europe/Paris)
--   hebdomadaire : 1 moteur ou 1 boîte, rareté 70/20/7/2,5/0,5 %
--                  (une fois par semaine ISO, lundi 00:00 Europe/Paris)
-- L'ancien argument de claim_daily_pull (choix 1 ou 2) disparaît.
-- =============================================================================

alter table public.profiles
  add column last_weekly_pull date;

comment on column public.profiles.last_weekly_pull is
  'Lundi (Europe/Paris) de la semaine ISO du dernier tirage hebdomadaire.';

create or replace function private.paris_week_start(p_ts timestamptz default now()) returns date
language sql stable as $$
  select date_trunc('week', p_ts at time zone 'Europe/Paris')::date
$$;

drop function public.claim_daily_pull(uuid, integer);

create or replace function public.claim_daily_pull(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_last  date;
  v_ids   uuid[] := '{}';
  i integer;
begin
  perform private.assert_caller(p_user_id);

  select last_daily_pull into v_last from profiles where id = p_user_id for update;
  if not found then raise exception 'profile_not_found'; end if;
  if v_last = v_today then raise exception 'already_claimed' using errcode = '23505'; end if;

  for i in 1..3 loop
    v_ids := v_ids || private.grant_card(p_user_id, private.draw_bonus_template(), 'daily_pull');
  end loop;

  update profiles set last_daily_pull = v_today where id = p_user_id;
  return jsonb_build_object('claimed_on', v_today, 'card_ids', to_jsonb(v_ids));
end $$;

create or replace function public.claim_weekly_pull(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_week date := private.paris_week_start();
  v_last date;
  v_id   uuid;
begin
  perform private.assert_caller(p_user_id);

  select last_weekly_pull into v_last from profiles where id = p_user_id for update;
  if not found then raise exception 'profile_not_found'; end if;
  if v_last = v_week then raise exception 'weekly_already_claimed' using errcode = '23505'; end if;

  v_id := private.grant_card(p_user_id, private.draw_mechanical_template(), 'weekly_pull');
  update profiles set last_weekly_pull = v_week where id = p_user_id;
  return jsonb_build_object('week_start', v_week, 'card_ids', to_jsonb(array[v_id]));
end $$;

revoke all on function public.claim_daily_pull(uuid)  from public;
revoke all on function public.claim_weekly_pull(uuid) from public;
grant execute on function public.claim_daily_pull(uuid)  to app_user;
grant execute on function public.claim_weekly_pull(uuid) to app_user;
