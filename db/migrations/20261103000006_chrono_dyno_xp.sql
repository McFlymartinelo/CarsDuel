-- =============================================================================
-- 20261103-06 : XP du Contre-La-Montre et du Banc d'essai
--
-- Chaque pièce versée par un claim (médaille ou prime de participation) rapporte
-- autant d'XP. Le déclencheur suit les insertions dans les journaux de claims,
-- sans toucher aux fonctions execute_clm / execute_dyno.
-- =============================================================================

alter table public.xp_events
  drop constraint if exists xp_events_source_check;
alter table public.xp_events
  add constraint xp_events_source_check check (source in ('attack', 'defense', 'clm', 'dyno'));

create or replace function private.claim_coins_to_xp() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform private.add_xp(new.user_id, new.coins, tg_argv[0], null);
  return new;
end $$;

drop trigger if exists trg_clm_claim_xp on public.clm_daily_claims;
create trigger trg_clm_claim_xp
  after insert on public.clm_daily_claims
  for each row execute function private.claim_coins_to_xp('clm');

drop trigger if exists trg_dyno_claim_xp on public.dyno_daily_claims;
create trigger trg_dyno_claim_xp
  after insert on public.dyno_daily_claims
  for each row execute function private.claim_coins_to_xp('dyno');
