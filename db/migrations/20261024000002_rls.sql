-- =============================================================================
-- 002 : privilèges + Row Level Security
-- Principe : le client LIT (selon RLS) ; toute ÉCRITURE de jeu passe par RPC.
-- Seules exceptions : username/settings du profil, et CRUD de ses propres decks.
-- =============================================================================

-- app_user ne reçoit rien par défaut : on accorde au compte-gouttes.
grant usage on schema public to app_user;
alter default privileges in schema public revoke all on tables    from app_user;
alter default privileges in schema public revoke all on functions from public, app_user;
revoke all on all tables    in schema public from app_user;
revoke all on all functions in schema public from public, app_user;

-- Identité de l'appelant : posée par l'app à chaque transaction (set_config('app.user_id', ..., true)).
create or replace function public.current_uid() returns uuid
language sql stable as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;
grant execute on function public.current_uid() to app_user;

alter table public.profiles               enable row level security;
alter table public.weather_conditions     enable row level security;
alter table public.tire_weather_modifiers enable row level security;
alter table public.card_templates         enable row level security;
alter table public.user_cards             enable row level security;
alter table public.user_decks             enable row level security;
alter table public.duels_history          enable row level security;
alter table public.xp_events              enable row level security;
alter table public.coin_transactions      enable row level security;
alter table public.shop_vendors           enable row level security;
alter table public.shop_catalog           enable row level security;
alter table public.marketplace_listings   enable row level security;
alter table public.marketplace_offers     enable row level security;

-- Profils : lecture de son propre profil ; seuls username/settings modifiables.
-- (Les autres joueurs sont visibles via la vue public_profiles, cf. 003.)
grant select on public.profiles to app_user;
grant update (username, settings) on public.profiles to app_user;
create policy profiles_select_own on public.profiles for select to app_user
  using (id = (select public.current_uid()));
create policy profiles_update_own on public.profiles for update to app_user
  using (id = (select public.current_uid())) with check (id = (select public.current_uid()));

-- Données de référence : lecture seule.
grant select on public.weather_conditions, public.tire_weather_modifiers,
                public.card_templates, public.shop_vendors, public.shop_catalog to app_user;
create policy ref_select on public.weather_conditions     for select to app_user using (true);
create policy ref_select on public.tire_weather_modifiers for select to app_user using (true);
create policy ref_select on public.card_templates         for select to app_user using (true);
create policy ref_select on public.shop_vendors           for select to app_user using (true);
create policy ref_select on public.shop_catalog           for select to app_user using (is_active);

-- Cartes : les siennes + celles exposées en vente (is_listed) pour inspection avant achat.
grant select on public.user_cards to app_user;
create policy user_cards_select on public.user_cards for select to app_user
  using (owner_id = (select public.current_uid()) or is_listed);

-- Decks : CRUD sur ses propres decks (cohérence des cartes garantie par trigger).
grant select, insert, update, delete on public.user_decks to app_user;
create policy decks_select on public.user_decks for select to app_user
  using (owner_id = (select public.current_uid()));
create policy decks_insert on public.user_decks for insert to app_user
  with check (owner_id = (select public.current_uid()));
create policy decks_update on public.user_decks for update to app_user
  using (owner_id = (select public.current_uid())) with check (owner_id = (select public.current_uid()));
create policy decks_delete on public.user_decks for delete to app_user
  using (owner_id = (select public.current_uid()));

-- Historique : attaquant ou défenseur uniquement.
grant select on public.duels_history to app_user;
create policy duels_select on public.duels_history for select to app_user
  using (attacker_id = (select public.current_uid()) or defender_id = (select public.current_uid()));

grant select on public.xp_events, public.coin_transactions to app_user;
create policy xp_select on public.xp_events for select to app_user
  using (user_id = (select public.current_uid()));
create policy coin_tx_select on public.coin_transactions for select to app_user
  using (user_id = (select public.current_uid()));

-- Marketplace : annonces visibles par tous (actives ou siennes) ; offres visibles par acheteur et vendeur.
grant select on public.marketplace_listings, public.marketplace_offers to app_user;
create policy listings_select on public.marketplace_listings for select to app_user
  using (status = 'active' or seller_id = (select public.current_uid()) or buyer_id = (select public.current_uid()));
create policy offers_select on public.marketplace_offers for select to app_user
  using (buyer_id = (select public.current_uid())
         or exists (select 1 from public.marketplace_listings l
                    where l.id = listing_id and l.seller_id = (select public.current_uid())));
