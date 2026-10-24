-- =============================================================================
-- 003 : vues publiques (classements calendaires Europe/Paris)
-- Les vues s'exécutent avec les droits de leur propriétaire (contourne la RLS de
-- xp_events/profiles) : elles n'exposent que username + XP agrégée.
-- Semaine : lundi 00:00:00 → dimanche 23:59:59 (borne haute exclusive = lundi suivant).
-- Mois    : 1er 00:00:00 → dernier jour 23:59:59.
-- Conversion locale → timestamptz faite APRÈS date_trunc : les changements d'heure
-- (CET/CEST) sont donc gérés correctement.
-- =============================================================================

create view public.public_profiles as
  select id, username, created_at from public.profiles;

create view public.leaderboard_weekly as
with bounds as (
  select date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris'                         as period_start,
         (date_trunc('week', now() at time zone 'Europe/Paris') + interval '1 week') at time zone 'Europe/Paris' as period_end
)
select p.id as user_id,
       p.username,
       sum(e.amount)::bigint                            as xp,
       rank() over (order by sum(e.amount) desc)        as rank,
       b.period_start,
       b.period_end
from bounds b
join public.xp_events e on e.created_at >= b.period_start and e.created_at < b.period_end
join public.profiles  p on p.id = e.user_id
group by p.id, p.username, b.period_start, b.period_end;

create view public.leaderboard_monthly as
with bounds as (
  select date_trunc('month', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris'                          as period_start,
         (date_trunc('month', now() at time zone 'Europe/Paris') + interval '1 month') at time zone 'Europe/Paris' as period_end
)
select p.id as user_id,
       p.username,
       sum(e.amount)::bigint                            as xp,
       rank() over (order by sum(e.amount) desc)        as rank,
       b.period_start,
       b.period_end
from bounds b
join public.xp_events e on e.created_at >= b.period_start and e.created_at < b.period_end
join public.profiles  p on p.id = e.user_id
group by p.id, p.username, b.period_start, b.period_end;

grant select on public.public_profiles, public.leaderboard_weekly, public.leaderboard_monthly to app_user;
