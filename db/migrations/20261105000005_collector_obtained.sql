-- =============================================================================
-- 20261105-05 : historique d'obtention des cartes (badge « Déjà obtenue »)
--
-- Le coin du collectionneur doit garder le badge « Déjà obtenue » même quand la
-- carte quitte l'inventaire : dépôt en benne puis recyclage définitif,
-- destruction, vente sur la marketplace…
-- On conserve donc un historique (joueur, modèle) indépendant des cartes
-- possédées, alimenté à chaque acquisition.
-- =============================================================================

create table public.collector_obtained (
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  template_id  uuid not null references public.card_templates (id) on delete cascade,
  first_obtained_at timestamptz not null default now(),
  primary key (owner_id, template_id)
);

comment on table public.collector_obtained is
  'Modèles déjà obtenus par un joueur (badge « Déjà obtenue »), même s''ils ne sont plus possédés.';

alter table public.collector_obtained enable row level security;
grant select on public.collector_obtained to app_user;
create policy collector_obtained_select on public.collector_obtained
  for select to app_user using (owner_id = (select public.current_uid()));

-- Chaque carte possédée (création ou transfert) mémorise son modèle.
create or replace function private.remember_obtained_card() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.collector_obtained (owner_id, template_id)
  values (new.owner_id, new.template_id)
  on conflict (owner_id, template_id) do nothing;
  return new;
end $$;

create trigger trg_remember_obtained_card
  after insert or update of owner_id, template_id on public.user_cards
  for each row execute function private.remember_obtained_card();

-- Rattrapage : cartes encore en inventaire.
insert into public.collector_obtained (owner_id, template_id, first_obtained_at)
select owner_id, template_id, min(acquired_at)
  from public.user_cards
 group by owner_id, template_id
on conflict (owner_id, template_id) do nothing;

-- Rattrapage : ventes passées (le vendeur comme l'acheteur ont obtenu le modèle).
insert into public.collector_obtained (owner_id, template_id, first_obtained_at)
select user_id, card_template_id, min(at)
  from (
    select seller_id as user_id, card_template_id, closed_at as at
      from public.marketplace_listings
     where status = 'sold' and card_template_id is not null
    union all
    select buyer_id, card_template_id, closed_at
      from public.marketplace_listings
     where status = 'sold' and buyer_id is not null and card_template_id is not null
  ) sold
 group by user_id, card_template_id
on conflict (owner_id, template_id) do nothing;
