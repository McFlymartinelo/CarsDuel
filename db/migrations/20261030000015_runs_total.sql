-- =============================================================================
-- 015 : compteur de runs à vie
--
-- runs_count reste le compteur d'USURE (risque de casse, remis à 0 par une
-- réparation, gelé par les cartes de révision). runs_total compte tous les
-- runs réellement courus par la carte, y compris celui qui la casse.
-- =============================================================================

alter table public.user_cards
  add column runs_total integer not null default 0 check (runs_total >= 0);

comment on column public.user_cards.runs_total is
  'Runs réellement courus par la carte (moteur / boîte), indépendamment de l''usure.';

-- Reprise : le meilleur des deux compteurs connus (usure et garantie).
update public.user_cards uc
   set runs_total = greatest(uc.runs_count, uc.warranty_used)
  from public.card_templates t
 where t.id = uc.template_id
   and t.category in ('moteur', 'boite');

-- Un duel = un run pour le moteur et la boîte de l'attaquant, même en cas de casse
-- (les deux fonctions de duel insèrent dans duels_history).
create or replace function private.track_card_runs() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.attacker_deck_id is not null then
    update public.user_cards uc
       set runs_total = runs_total + 1
      from public.user_decks d
     where d.id = new.attacker_deck_id
       and uc.id in (d.engine_card_id, d.gearbox_card_id);
  end if;
  return new;
end $$;

drop trigger if exists trg_track_card_runs on public.duels_history;
create trigger trg_track_card_runs
  after insert on public.duels_history
  for each row execute function private.track_card_runs();
