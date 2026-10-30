-- =============================================================================
-- 017 : vitrine de trophées
--
-- Agrège les compteurs affichés dans le garage. Les titres de meilleur pilote
-- sont lus dans les primes de classement déjà versées (une clôture = un titre).
-- Les médailles de contre-la-montre sont stockées dans trophy_medals ; le mode
-- de course correspondant les alimentera au moment de sa mise en service.
-- =============================================================================

create table public.trophy_medals (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('chrono_gold', 'chrono_silver', 'chrono_bronze')),
  awarded_at  timestamptz not null default now()
);
create index idx_trophy_medals_user on public.trophy_medals (user_id, kind);

comment on table public.trophy_medals is
  'Médailles de contre-la-montre (or, argent, bronze) attribuées à un pilote.';

alter table public.trophy_medals enable row level security;
grant select on public.trophy_medals to app_user;
create policy trophy_medals_select on public.trophy_medals for select to app_user
  using (user_id = (select public.current_uid()));

create or replace function public.my_trophy_stats(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp as $$
declare
  v_stats jsonb;
begin
  perform private.assert_caller(p_user);

  select jsonb_build_object(
    'attack_wins', (
      select count(*) from public.duels_history
       where attacker_id = p_user and result = 'attacker_win'
    ),
    'defense_wins', (
      select count(*) from public.duels_history
       where defender_id = p_user and result = 'defender_win'
    ),
    'attack_duels', (
      select count(*) from public.duels_history
       where attacker_id = p_user
    ),
    'weekly_firsts', (
      select count(*) from public.leaderboard_payouts
       where user_id = p_user and period = 'weekly' and rank = 1
    ),
    'monthly_firsts', (
      select count(*) from public.leaderboard_payouts
       where user_id = p_user and period = 'monthly' and rank = 1
    ),
    'chrono_gold', (
      select count(*) from public.trophy_medals
       where user_id = p_user and kind = 'chrono_gold'
    ),
    'chrono_silver', (
      select count(*) from public.trophy_medals
       where user_id = p_user and kind = 'chrono_silver'
    ),
    'chrono_bronze', (
      select count(*) from public.trophy_medals
       where user_id = p_user and kind = 'chrono_bronze'
    )
  ) into v_stats;

  return v_stats;
end $$;

revoke all on function public.my_trophy_stats(uuid) from public;
grant execute on function public.my_trophy_stats(uuid) to app_user;
