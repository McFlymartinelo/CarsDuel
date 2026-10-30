-- =============================================================================
-- 008 : grille des rangs et coefficient de primes de classement
-- Rookie 0 XP (×1) · Amateur 120 (×1,5) · Pro 300 (×2) · Élite 600 (×2,5)
-- · Légende 890 (×3).
-- Le coefficient suit l'XP du mois calendaire où la période se termine et
-- s'applique aux primes hebdomadaires et mensuelles, arrondies à la pièce.
-- Grille miroir côté app : RANKS / rankMultiplierLabel dans src/lib/game.ts.
-- =============================================================================

create or replace function public.rank_coefficient(p_month_xp bigint)
returns numeric
language sql
immutable
parallel safe
as $$
  select case
    when coalesce(p_month_xp, 0) >= 890 then 3.0
    when p_month_xp >= 600 then 2.5
    when p_month_xp >= 300 then 2.0
    when p_month_xp >= 120 then 1.5
    else 1.0
  end::numeric
$$;

revoke all on function public.rank_coefficient(bigint) from public;
grant execute on function public.rank_coefficient(bigint) to app_user;

-- Prime de base, sans coefficient (compatibilité et calcul interne).
create or replace function public.leaderboard_prize(p_period text, p_rank integer, p_players integer)
returns integer
language sql
immutable
parallel safe
as $$
  select case
    when p_period not in ('weekly', 'monthly') or p_rank is null or p_players is null or p_players < 1 or p_rank < 1 then 0
    when p_rank = 1 then case when p_period = 'weekly' then 50 else 250 end
    when p_rank = 2 then case when p_period = 'weekly' then 40 else 200 end
    when p_rank = 3 then case when p_period = 'weekly' then 30 else 150 end
    when p_rank > 3 and p_rank <= ceil(p_players * 5 / 100.0) then case when p_period = 'weekly' then 10 else 50 end
    else 0
  end
$$;

-- Prime effective : base × coefficient de rang (XP du mois).
create or replace function public.leaderboard_prize(p_period text, p_rank integer, p_players integer, p_month_xp bigint)
returns integer
language sql
immutable
parallel safe
as $$
  select round(
    public.leaderboard_prize(p_period, p_rank, p_players) * public.rank_coefficient(p_month_xp)
  )::integer
$$;

revoke all on function public.leaderboard_prize(text, integer, integer, bigint) from public;
grant execute on function public.leaderboard_prize(text, integer, integer, bigint) to app_user;

create or replace view public.leaderboard_weekly as
with bounds as (
  select date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris' as period_start,
         (date_trunc('week', now() at time zone 'Europe/Paris') + interval '1 week') at time zone 'Europe/Paris' as period_end
),
month_bounds as (
  select date_trunc('month', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris' as month_start,
         (date_trunc('month', now() at time zone 'Europe/Paris') + interval '1 month') at time zone 'Europe/Paris' as month_end
),
scored as (
  select p.id as user_id,
         p.username,
         sum(e.amount)::bigint as xp,
         b.period_start,
         b.period_end
    from bounds b
    join public.xp_events e on e.created_at >= b.period_start and e.created_at < b.period_end
    join public.profiles p on p.id = e.user_id
   group by p.id, p.username, b.period_start, b.period_end
),
month_xp as (
  select e.user_id, sum(e.amount)::bigint as xp
    from month_bounds b
    join public.xp_events e on e.created_at >= b.month_start and e.created_at < b.month_end
   group by e.user_id
),
ranked as (
  select s.user_id, s.username, s.xp, s.period_start, s.period_end,
         rank() over (order by s.xp desc) as rank,
         count(*) over () as player_count,
         coalesce(m.xp, 0) as month_xp
    from scored s
    left join month_xp m on m.user_id = s.user_id
)
select user_id, username, xp, rank, period_start, period_end, player_count,
       public.leaderboard_prize('weekly', rank::integer, player_count::integer, month_xp) as prize
  from ranked;

create or replace view public.leaderboard_monthly as
with bounds as (
  select date_trunc('month', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris' as period_start,
         (date_trunc('month', now() at time zone 'Europe/Paris') + interval '1 month') at time zone 'Europe/Paris' as period_end
),
month_bounds as (
  select date_trunc('month', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris' as month_start,
         (date_trunc('month', now() at time zone 'Europe/Paris') + interval '1 month') at time zone 'Europe/Paris' as month_end
),
scored as (
  select p.id as user_id,
         p.username,
         sum(e.amount)::bigint as xp,
         b.period_start,
         b.period_end
    from bounds b
    join public.xp_events e on e.created_at >= b.period_start and e.created_at < b.period_end
    join public.profiles p on p.id = e.user_id
   group by p.id, p.username, b.period_start, b.period_end
),
month_xp as (
  select e.user_id, sum(e.amount)::bigint as xp
    from month_bounds b
    join public.xp_events e on e.created_at >= b.month_start and e.created_at < b.month_end
   group by e.user_id
),
ranked as (
  select s.user_id, s.username, s.xp, s.period_start, s.period_end,
         rank() over (order by s.xp desc) as rank,
         count(*) over () as player_count,
         coalesce(m.xp, 0) as month_xp
    from scored s
    left join month_xp m on m.user_id = s.user_id
)
select user_id, username, xp, rank, period_start, period_end, player_count,
       public.leaderboard_prize('monthly', rank::integer, player_count::integer, month_xp) as prize
  from ranked;

create or replace function public.settle_leaderboard_rewards()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_from timestamptz;
  v_paid integer := 0;
  v_row record;
begin
  perform pg_advisory_xact_lock(hashtext('carsduel_leaderboard_rewards'));

  select value into v_from from public.app_meta where key = 'leaderboard_rewards_from';
  if v_from is null then
    v_from := now();
  end if;

  drop table if exists pg_temp.due_periods;
  drop table if exists pg_temp.due_payouts;

  create temp table due_periods on commit drop as
  select kind, period_start, period_end
    from (
      select 'weekly'::text as kind,
             gs at time zone 'Europe/Paris' as period_start,
             (gs + interval '1 week') at time zone 'Europe/Paris' as period_end
        from generate_series(
          date_trunc('week', v_from at time zone 'Europe/Paris'),
          date_trunc('week', now() at time zone 'Europe/Paris'),
          interval '1 week'
        ) gs
      union all
      select 'monthly'::text,
             gs at time zone 'Europe/Paris',
             (gs + interval '1 month') at time zone 'Europe/Paris'
        from generate_series(
          date_trunc('month', v_from at time zone 'Europe/Paris'),
          date_trunc('month', now() at time zone 'Europe/Paris'),
          interval '1 month'
        ) gs
    ) periods
   where period_end <= now()
     and period_end > v_from
     and not exists (
       select 1 from public.leaderboard_settlements s
        where s.period = periods.kind and s.period_start = periods.period_start
     );

  -- Le coefficient de rang se lit sur l'XP du mois calendaire où la période
  -- se termine (le dernier instant de la période, pour éviter le mois suivant).
  create temp table due_payouts on commit drop as
  select d.kind, d.period_start, q.user_id, q.xp, q.rnk, q.players, q.coins
    from due_periods d
    join lateral (
      select s.user_id, s.xp, s.rnk, s.players,
             public.leaderboard_prize(d.kind, s.rnk::integer, s.players::integer, m.month_xp) as coins
        from (
          select e.user_id,
                 sum(e.amount)::bigint as xp,
                 rank() over (order by sum(e.amount) desc) as rnk,
                 count(*) over () as players
            from public.xp_events e
           where e.created_at >= d.period_start
             and e.created_at < d.period_end
           group by e.user_id
        ) s
        join lateral (
          select coalesce(sum(e.amount), 0)::bigint as month_xp
            from public.xp_events e
           where e.user_id = s.user_id
             and e.created_at >= date_trunc('month', (d.period_end - interval '1 second') at time zone 'Europe/Paris') at time zone 'Europe/Paris'
             and e.created_at <  (date_trunc('month', (d.period_end - interval '1 second') at time zone 'Europe/Paris') + interval '1 month') at time zone 'Europe/Paris'
        ) m on true
    ) q on true
   where q.coins > 0;

  -- Même ordre de verrou que les duels (id croissant), même si plusieurs périodes sont dues.
  for v_row in
    select * from due_payouts order by user_id, period_start, kind
  loop
    insert into public.leaderboard_payouts (period, period_start, user_id, rank, xp, coins)
    values (v_row.kind, v_row.period_start, v_row.user_id, v_row.rnk::integer, v_row.xp, v_row.coins);
    perform private.adjust_coins(
      v_row.user_id,
      v_row.coins,
      case when v_row.kind = 'weekly' then 'leaderboard_weekly' else 'leaderboard_monthly' end,
      null);
    v_paid := v_paid + 1;
  end loop;

  insert into public.leaderboard_settlements (period, period_start, period_end, player_count, paid_coins)
  select d.kind, d.period_start, d.period_end,
         coalesce(max(p.players), 0)::integer,
         coalesce(sum(p.coins), 0)::integer
    from due_periods d
    left join due_payouts p on p.kind = d.kind and p.period_start = d.period_start
   group by d.kind, d.period_start, d.period_end;

  return v_paid;
end $$;
