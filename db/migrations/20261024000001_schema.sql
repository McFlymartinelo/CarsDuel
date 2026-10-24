-- =============================================================================
-- CarsDuel — 001 : schéma (types, tables, index, triggers)
-- PostgreSQL pur (>= 14), aucune dépendance à Supabase.
-- Toute écriture sensible passe par des RPC SECURITY DEFINER (cf. 004/005).
-- Fuseau métier : 'Europe/Paris' (reset quotidien, classements).
-- =============================================================================

-- Rôle applicatif : l'app se connecte avec le rôle propriétaire puis fait
-- `SET LOCAL ROLE app_user` dans chaque transaction => la RLS s'applique réellement.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin;
  end if;
end $$;
grant app_user to current_user;

create schema if not exists private;                       -- helpers internes, inaccessibles à app_user
revoke all on schema private from public, app_user;

-- ---------- Types ------------------------------------------------------------
create type public.card_category  as enum ('moteur', 'boite', 'pneus', 'bonus');
create type public.card_rarity    as enum ('commune', 'rare', 'tres_rare', 'epique', 'legendaire'); -- ordre = rang
create type public.gearbox_type   as enum ('manuelle', 'sequentielle', 'double_embrayage', 'robotisee');
create type public.tire_type      as enum ('route', 'sport', 'pluie', 'semi_slick', 'slick');
create type public.weather_type   as enum ('sunny_hot', 'sunny_cool', 'rain_hot', 'rain_cool');
create type public.bonus_effect   as enum (
  'revision_express',        -- pas d'usure moteur ce run
  'vidange_boite',           -- pas d'usure boîte ce run
  'revision_complete',       -- pas d'usure moteur ET boîte
  'huile_moteur_competition',-- risque casse moteur x0.5
  'huile_boite_competition', -- risque casse boîte x0.5
  'assistance_plateau'       -- casse => pièce conservée
);
create type public.duel_result    as enum ('attacker_win', 'defender_win');
create type public.listing_status as enum ('active', 'sold', 'cancelled');
create type public.offer_status   as enum ('pending', 'accepted', 'rejected', 'withdrawn', 'refunded');

-- ---------- Comptes & sessions (auth maison : e-mail + mot de passe) --------
-- Tables lues/écrites uniquement par le serveur Next.js (rôle propriétaire), jamais par app_user.
create table public.users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);
create unique index users_email_key on public.users (lower(email));

create table public.sessions (
  token_hash text primary key,                              -- SHA-256 du jeton du cookie
  user_id    uuid not null references public.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index idx_sessions_user on public.sessions (user_id);

-- ---------- Profils ----------------------------------------------------------
create table public.profiles (
  id              uuid primary key references public.users (id) on delete cascade,
  username        text not null unique check (username ~ '^[A-Za-z0-9_.-]{3,24}$'),
  coins           integer not null default 0 check (coins >= 0),
  xp_total        bigint  not null default 0 check (xp_total >= 0),
  last_daily_pull date,                                    -- jour calendaire Paris du dernier tirage
  settings        jsonb   not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

-- ---------- Règles de jeu paramétrables (données de référence, cf. 006) -----
create table public.weather_conditions (
  weather            public.weather_type primary key,
  label              text not null,
  engine_break_mod   numeric(4,2) not null,   -- Mod_meteo_casse moteur (points de %)
  gearbox_break_mod  numeric(4,2) not null    -- Mod_meteo_casse boîte (points de %)
);

create table public.tire_weather_modifiers (
  tire_type      public.tire_type    not null,
  weather        public.weather_type not null,
  perf_bonus_pct numeric(5,1) not null,       -- Bonus_meteo_pneu
  wear_pct       numeric(4,1) not null check (wear_pct > 0),  -- gomme perdue par run
  primary key (tire_type, weather)
);

-- ---------- Catalogue de cartes ---------------------------------------------
create table public.card_templates (
  id              uuid primary key default gen_random_uuid(),
  code            text unique,                              -- identifiant stable (seed / import)
  category        public.card_category not null,
  name            text not null,
  description     text,
  image_url       text,
  rarity          public.card_rarity,                       -- moteur/boîte uniquement
  is_active       boolean not null default true,
  drop_weight     numeric not null default 1 check (drop_weight > 0), -- pondération intra-rareté
  weight_kg       numeric(7,2),                             -- moteur / boîte
  base_break_risk numeric(5,2),                             -- R0 (%)
  wear_sensitivity numeric(5,3),                            -- delta_R (% par run)
  -- moteur
  architecture    text,
  power_hp        integer,
  -- boîte
  gearbox_type    public.gearbox_type,
  shift_time_ms   integer,
  -- pneus
  tire_type       public.tire_type,
  tire_base_wear  numeric(4,1),                             -- % de gomme par run (nominal)
  -- bonus
  bonus_effect    public.bonus_effect,
  created_at      timestamptz not null default now(),

  constraint ck_moteur check (category <> 'moteur' or (
    rarity is not null and architecture is not null and power_hp > 0 and weight_kg > 0
    and base_break_risk between 0 and 100 and wear_sensitivity >= 0
    and gearbox_type is null and shift_time_ms is null and tire_type is null
    and tire_base_wear is null and bonus_effect is null)),
  constraint ck_boite check (category <> 'boite' or (
    rarity is not null and gearbox_type is not null and shift_time_ms >= 0 and weight_kg > 0
    and base_break_risk between 0 and 100 and wear_sensitivity >= 0
    and architecture is null and power_hp is null and tire_type is null
    and tire_base_wear is null and bonus_effect is null)),
  constraint ck_pneus check (category <> 'pneus' or (
    tire_type is not null and tire_base_wear > 0 and rarity is null
    and weight_kg is null and base_break_risk is null and wear_sensitivity is null
    and architecture is null and power_hp is null and gearbox_type is null
    and shift_time_ms is null and bonus_effect is null)),
  constraint ck_bonus check (category <> 'bonus' or (
    bonus_effect is not null and rarity is null
    and weight_kg is null and base_break_risk is null and wear_sensitivity is null
    and architecture is null and power_hp is null and gearbox_type is null
    and shift_time_ms is null and tire_type is null and tire_base_wear is null))
);
create index idx_card_templates_draw on public.card_templates (category, rarity) where is_active;

-- ---------- Instances possédées ---------------------------------------------
create table public.user_cards (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  template_id  uuid not null references public.card_templates (id) on delete restrict,
  runs_count   integer not null default 0 check (runs_count >= 0),
  tire_wear    numeric(5,2) check (tire_wear between 0 and 100),   -- gomme RESTANTE (100 → 0), pneus uniquement
  is_destroyed boolean not null default false,
  is_listed    boolean not null default false,                      -- séquestre marketplace
  source       text not null default 'unknown',                     -- daily_pull | shop | market | admin
  acquired_at  timestamptz not null default now()
);
create index idx_user_cards_owner    on public.user_cards (owner_id) where not is_destroyed;
create index idx_user_cards_template on public.user_cards (template_id);

-- ---------- Decks (exactement 3 cartes, jamais de bonus) --------------------
create table public.user_decks (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  name            text not null default 'Deck' check (char_length(name) between 1 and 40),
  engine_card_id  uuid not null references public.user_cards (id) on delete restrict,
  gearbox_card_id uuid not null references public.user_cards (id) on delete restrict,
  tire_card_id    uuid not null references public.user_cards (id) on delete restrict,
  created_at      timestamptz not null default now()
);
create index idx_user_decks_owner on public.user_decks (owner_id);

create or replace function private.validate_deck() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1
    from (values (new.engine_card_id, 'moteur'::card_category),
                 (new.gearbox_card_id, 'boite'::card_category),
                 (new.tire_card_id,    'pneus'::card_category)) v (card_id, cat)
    where not exists (
      select 1 from user_cards uc join card_templates t on t.id = uc.template_id
      where uc.id = v.card_id and uc.owner_id = new.owner_id
        and t.category = v.cat and not uc.is_listed)
  ) then
    raise exception 'invalid_deck_card' using errcode = '23514',
      hint = 'Chaque carte doit appartenir au joueur, ne pas être en vente et correspondre à son emplacement.';
  end if;
  return new;
end $$;

create trigger trg_validate_deck
  before insert or update on public.user_decks
  for each row execute function private.validate_deck();

-- ---------- Historique des duels --------------------------------------------
create table public.duels_history (
  id                 uuid primary key default gen_random_uuid(),
  attacker_id        uuid not null references public.profiles (id) on delete cascade,
  defender_id        uuid not null references public.profiles (id) on delete cascade,
  attacker_deck_id   uuid references public.user_decks (id) on delete set null,
  defender_deck_id   uuid references public.user_decks (id) on delete set null,
  weather            public.weather_type not null,
  bonus_effect       public.bonus_effect,
  engine_break_prob  numeric(7,3),
  engine_break_roll  numeric(7,3),
  gearbox_break_prob numeric(7,3),
  gearbox_break_roll numeric(7,3),
  broken_part        public.card_category,                  -- 'moteur' | 'boite' | NULL
  part_saved         boolean not null default false,        -- Assistance plateau
  attacker_sp        numeric(10,4),                         -- NULL si casse
  defender_sp        numeric(10,4) not null,
  result             public.duel_result not null,
  attacker_coins     integer not null,
  attacker_xp        integer not null,
  defender_coins     integer not null default 0,
  defender_xp        integer not null default 0,
  defender_rewarded  boolean not null default false,        -- dans le plafond de 5/jour
  snapshot           jsonb not null default '{}'::jsonb,    -- stats des 2 decks au moment du duel
  created_at         timestamptz not null default now(),
  check (attacker_id <> defender_id)
);
create index idx_duels_attacker on public.duels_history (attacker_id, created_at desc);
create index idx_duels_defender on public.duels_history (defender_id, created_at desc);
create index idx_duels_defender_rewarded on public.duels_history (defender_id, created_at) where defender_rewarded;

-- ---------- XP historisée (classements) & journal des pièces ---------------
create table public.xp_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  amount     integer not null check (amount > 0),
  source     text not null check (source in ('attack', 'defense')),
  duel_id    uuid references public.duels_history (id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_xp_events_period on public.xp_events (created_at, user_id) include (amount);

create table public.coin_transactions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  amount     integer not null check (amount <> 0),
  reason     text not null,
  ref_id     uuid,
  created_at timestamptz not null default now()
);
create index idx_coin_tx_user on public.coin_transactions (user_id, created_at desc);

-- ---------- Boutique officielle (structure prête, catalogue vide) -----------
create table public.shop_vendors (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.shop_catalog (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references public.shop_vendors (id) on delete cascade,
  template_id uuid not null references public.card_templates (id) on delete cascade,
  price       integer not null check (price >= 0),
  stock       integer check (stock >= 0),                  -- NULL = illimité
  is_active   boolean not null default true,
  unique (vendor_id, template_id)
);

-- ---------- Marketplace -----------------------------------------------------
create table public.marketplace_listings (
  id             uuid primary key default gen_random_uuid(),
  seller_id      uuid not null references public.profiles (id) on delete cascade,
  card_id        uuid not null references public.user_cards (id) on delete restrict,
  price          integer check (price >= 0),               -- NULL = offres uniquement ; aucun plancher/plafond
  accepts_offers boolean not null default false,
  status         public.listing_status not null default 'active',
  buyer_id       uuid references public.profiles (id) on delete set null,
  sold_price     integer,
  tax_amount     integer,
  seller_net     integer,
  created_at     timestamptz not null default now(),
  closed_at      timestamptz,
  check (price is not null or accepts_offers)
);
create unique index uq_listing_active_card on public.marketplace_listings (card_id) where status = 'active';
create index idx_listings_active on public.marketplace_listings (created_at desc) where status = 'active';
create index idx_listings_seller on public.marketplace_listings (seller_id);

create table public.marketplace_offers (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.marketplace_listings (id) on delete cascade,
  buyer_id    uuid not null references public.profiles (id) on delete cascade,
  amount      integer not null check (amount > 0),         -- pièces en séquestre tant que 'pending'
  status      public.offer_status not null default 'pending',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index uq_offer_pending on public.marketplace_offers (listing_id, buyer_id) where status = 'pending';
create index idx_offers_listing on public.marketplace_offers (listing_id) where status = 'pending';
create index idx_offers_buyer   on public.marketplace_offers (buyer_id);
