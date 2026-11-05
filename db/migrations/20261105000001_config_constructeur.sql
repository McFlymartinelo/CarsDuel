-- =============================================================================
-- 20261105-01 : Configs Constructeur (défi hebdomadaire de constructeur)
--
-- - card_templates.manufacturers : constructeurs d'un moteur ou d'une boîte
--   (slugs, plusieurs possibles). Le catalogue lui-même est chargé par
--   db/catalog/*.json (db:seed), pas par cette migration.
-- - config_brands : les 26 défis (énigme affichée, libellé du constructeur).
-- - config_brand_weeks : constructeur du défi de chaque semaine (lundi 00:00 UTC),
--   tiré une seule fois, au premier besoin, parmi les constructeurs ayant au
--   moins une paire moteur + boîte publique (sans cela, le défi serait injouable).
-- - config_pair_claims : paires (moteur, boîte) validées, une récompense par
--   paire et par semaine.
-- =============================================================================

-- ---------- Constructeurs des pièces -----------------------------------------
alter table public.card_templates
  add column manufacturers text[] not null default '{}';

comment on column public.card_templates.manufacturers is
  'Constructeurs (slugs) auxquels appartient le moteur ou la boîte. Vide = hors défi Configs Constructeur.';

create index idx_card_templates_manufacturers on public.card_templates using gin (manufacturers);

-- ---------- Défis (26 constructeurs) ----------------------------------------
create table public.config_brands (
  slug   text primary key check (slug ~ '^[a-z][a-z0-9_]*$'),
  label  text not null,
  riddle text not null
);

comment on table public.config_brands is
  'Défis Configs Constructeur : slug du constructeur, libellé réel et énigme affichée au joueur.';

insert into public.config_brands (slug, label, riddle) values
  ('renault',     'Renault',        'La marque au losange'),
  ('alpine',      'Alpine',         'L''artisan de Dieppe'),
  ('peugeot',     'Peugeot',        'La marque au lion'),
  ('citroen',     'Citroën',        'Les chevrons'),
  ('volkswagen',  'Volkswagen',     'La voiture du peuple'),
  ('audi',        'Audi',           'Les quatre anneaux'),
  ('seat',        'Seat',           'L''Ibère sportive'),
  ('skoda',       'Škoda',          'L''esprit Simply Clever'),
  ('cupra',       'Cupra',          'L''étincelle cuivrée'),
  ('bmw',         'BMW',            'Le constructeur bavarois'),
  ('mercedes',    'Mercedes-Benz',  'La marque à l''étoile'),
  ('porsche',     'Porsche',        'La firme de Stuttgart'),
  ('ferrari',     'Ferrari',        'Le cheval cabré'),
  ('lamborghini', 'Lamborghini',    'Le taureau en furie'),
  ('alfa_romeo',  'Alfa Romeo',     'Le trèfle à quatre feuilles'),
  ('fiat',        'Fiat',           'Le géant du Lingotto'),
  ('abarth',      'Abarth',         'Le scorpion de Turin'),
  ('ford',        'Ford',           'Le cheval sauvage'),
  ('honda',       'Honda',          'Le motoriste de Tokyo'),
  ('toyota',      'Toyota',         'Le géant d''Aichi'),
  ('nissan',      'Nissan',         'Les monstres de Yokohama'),
  ('mazda',       'Mazda',          'Le sorcier du rotatif'),
  ('subaru',      'Subaru',         'Les six étoiles des Pléiades'),
  ('chevrolet',   'Chevrolet',      'Le nœud papillon de Détroit'),
  ('dodge',       'Dodge',          'Le bélier d''Auburn Hills'),
  ('bugatti',     'Bugatti',        'Les pur-sang de Molsheim')
on conflict (slug) do update set
  label = excluded.label,
  riddle = excluded.riddle;

-- ---------- Rotation hebdomadaire --------------------------------------------
create table public.config_brand_weeks (
  week_start date primary key,
  brand      text not null references public.config_brands (slug),
  drawn_at   timestamptz not null default now()
);

-- Accès uniquement par les fonctions SECURITY DEFINER ci-dessous.

-- ---------- Paires validées --------------------------------------------------
create table public.config_pair_claims (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references public.profiles (id) on delete cascade,
  week_start          date not null,
  brand               text not null references public.config_brands (slug),
  engine_template_id  uuid not null references public.card_templates (id) on delete cascade,
  gearbox_template_id uuid not null references public.card_templates (id) on delete cascade,
  coins_awarded       integer not null check (coins_awarded > 0),
  xp_awarded          integer not null check (xp_awarded > 0),
  validated_at        timestamptz not null default now(),
  unique (owner_id, week_start, engine_template_id, gearbox_template_id)
);
create index idx_config_pair_claims_week on public.config_pair_claims (owner_id, week_start);

alter table public.config_pair_claims enable row level security;
grant select on public.config_pair_claims to app_user;
create policy config_pair_claims_select on public.config_pair_claims
  for select to app_user using (owner_id = (select public.current_uid()));

-- XP : nouvelle source pour les paires validées.
alter table public.xp_events
  drop constraint if exists xp_events_source_check;
alter table public.xp_events
  add constraint xp_events_source_check check (source in ('attack', 'defense', 'clm', 'dyno', 'config'));

-- ---------- Helpers privés ---------------------------------------------------
-- Lundi 00:00 UTC de la semaine contenant p_ts.
create or replace function private.config_week_start(p_ts timestamptz default now()) returns date
language sql stable as $$
  select (date_trunc('week', p_ts at time zone 'UTC'))::date
$$;

-- Tire le constructeur de la semaine une seule fois, parmi les défis ayant une paire publique.
create or replace function private.config_week_brand(p_week date) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_brand text;
begin
  select brand into v_brand from public.config_brand_weeks where week_start = p_week;
  if v_brand is null then
    insert into public.config_brand_weeks (week_start, brand)
    select p_week, s.slug
      from (
        select b.slug
          from public.config_brands b
         where exists (
                 select 1
                   from public.card_templates e, public.card_templates g
                  where e.category = 'moteur' and g.category = 'boite'
                    and e.is_active and g.is_active
                    and e.restricted_to_username is null
                    and g.restricted_to_username is null
                    and b.slug = any (e.manufacturers)
                    and b.slug = any (g.manufacturers)
               )
         order by random()
         limit 1
      ) s
    on conflict (week_start) do nothing;

    select brand into v_brand from public.config_brand_weeks where week_start = p_week;
  end if;
  return v_brand;
end $$;

-- Total théorique : moteurs × boîtes actifs du constructeur, visibles par le joueur.
create or replace function private.config_pair_total(p_brand text, p_user uuid) returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select (
           select count(*) from public.card_templates t
            where t.category = 'moteur' and t.is_active and p_brand = any (t.manufacturers)
              and private.can_use_template(t.restricted_to_username, p_user)
         ) * (
           select count(*) from public.card_templates t
            where t.category = 'boite' and t.is_active and p_brand = any (t.manufacturers)
              and private.can_use_template(t.restricted_to_username, p_user)
         )
$$;

-- ---------- RPC --------------------------------------------------------------
-- État du mode : défi de la semaine, teaser, progression, configuration équipée et historique.
create or replace function public.config_challenge_status(p_user uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_week date := private.config_week_start();
  v_brand text;
  v_next_brand text;
  v_found integer := 0;
  v_total integer := 0;
  v_eq record;
  v_challenge jsonb := null;
  v_next jsonb := null;
  v_equipped jsonb := null;
  v_history jsonb := '[]'::jsonb;
begin
  perform private.assert_caller(p_user);

  v_brand := private.config_week_brand(v_week);
  v_next_brand := private.config_week_brand(v_week + 7);

  if v_brand is not null then
    select jsonb_build_object('slug', b.slug, 'label', b.label, 'riddle', b.riddle)
      into v_challenge
      from public.config_brands b where b.slug = v_brand;
    v_total := private.config_pair_total(v_brand, p_user);
    select count(*)::integer into v_found
      from public.config_pair_claims
     where owner_id = p_user and week_start = v_week and brand = v_brand;
    select coalesce(jsonb_agg(
             jsonb_build_object('engine', e.code, 'gearbox', g.code) order by c.validated_at desc
           ), '[]'::jsonb)
      into v_history
      from public.config_pair_claims c
      join public.card_templates e on e.id = c.engine_template_id
      join public.card_templates g on g.id = c.gearbox_template_id
     where c.owner_id = p_user and c.week_start = v_week and c.brand = v_brand;
  end if;

  if v_next_brand is not null then
    select jsonb_build_object('riddle', b.riddle) into v_next
      from public.config_brands b where b.slug = v_next_brand;
  end if;

  select te.code as engine_code, te.name as engine_name, ce.is_destroyed as engine_dead, ce.is_listed as engine_listed,
         tg.code as gearbox_code, tg.name as gearbox_name, cg.is_destroyed as gearbox_dead, cg.is_listed as gearbox_listed
    into v_eq
    from public.user_decks d
    join public.user_cards ce on ce.id = d.engine_card_id
    join public.card_templates te on te.id = ce.template_id
    join public.user_cards cg on cg.id = d.gearbox_card_id
    join public.card_templates tg on tg.id = cg.template_id
   where d.owner_id = p_user
   order by d.created_at
   limit 1;
  if found then
    v_equipped := jsonb_build_object(
      'engine', jsonb_build_object('code', v_eq.engine_code, 'name', v_eq.engine_name,
                                   'ok', not (v_eq.engine_dead or v_eq.engine_listed)),
      'gearbox', jsonb_build_object('code', v_eq.gearbox_code, 'name', v_eq.gearbox_name,
                                    'ok', not (v_eq.gearbox_dead or v_eq.gearbox_listed)));
  end if;

  return jsonb_build_object(
    'week_start', v_week,
    'ends_at', (v_week + 7)::timestamp at time zone 'UTC',
    'reward', jsonb_build_object('coins', 20, 'xp', 20),
    'challenge', v_challenge,
    'next', v_next,
    'found', v_found,
    'total', v_total,
    'equipped', v_equipped,
    'history', v_history);
end $$;

-- Valide la paire moteur + boîte équipée (deck le plus ancien) contre le défi de la semaine.
-- Un constructeur absent de l'une des deux pièces, ou une paire déjà validée, ne lève pas
-- d'erreur : le statut le dit à l'UI.
create or replace function public.validate_config_pair(p_user uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c_coins constant integer := 20;
  c_xp    constant integer := 20;
  v_week  date := private.config_week_start();
  v_brand text;
  v_deck  public.user_decks%rowtype;
  p       record;
  v_e_ok  boolean;
  v_g_ok  boolean;
  v_found integer;
  v_total integer;
  v_claim_id uuid;
  v_status text;
begin
  perform private.assert_caller(p_user);
  perform 1 from public.profiles where id = p_user for update;
  if not found then raise exception 'profile_not_found'; end if;

  v_brand := private.config_week_brand(v_week);
  if v_brand is null then raise exception 'config_challenge_unavailable'; end if;

  select * into v_deck from public.user_decks
   where owner_id = p_user order by created_at limit 1;
  if not found then raise exception 'config_incomplete'; end if;

  select ce.is_destroyed as e_dead, ce.is_listed as e_listed, te.id as e_tpl, te.code as e_code, te.manufacturers as e_makers,
         cg.is_destroyed as g_dead, cg.is_listed as g_listed, tg.id as g_tpl, tg.code as g_code, tg.manufacturers as g_makers
    into p
    from public.user_cards ce
    join public.card_templates te on te.id = ce.template_id,
         public.user_cards cg
    join public.card_templates tg on tg.id = cg.template_id
   where ce.id = v_deck.engine_card_id and ce.owner_id = p_user
     and cg.id = v_deck.gearbox_card_id and cg.owner_id = p_user;
  if not found then raise exception 'config_incomplete'; end if;

  if p.e_dead then raise exception 'engine_destroyed'; end if;
  if p.g_dead then raise exception 'gearbox_destroyed'; end if;
  if p.e_listed or p.g_listed then raise exception 'card_listed'; end if;

  v_e_ok := v_brand = any (p.e_makers);
  v_g_ok := v_brand = any (p.g_makers);

  select count(*)::integer into v_found from public.config_pair_claims
   where owner_id = p_user and week_start = v_week and brand = v_brand;
  v_total := private.config_pair_total(v_brand, p_user);

  if not (v_e_ok and v_g_ok) then
    v_status := 'mismatch';
  elsif exists (
    select 1 from public.config_pair_claims
     where owner_id = p_user and week_start = v_week
       and engine_template_id = p.e_tpl and gearbox_template_id = p.g_tpl
  ) then
    v_status := 'duplicate';
  else
    insert into public.config_pair_claims (
      owner_id, week_start, brand, engine_template_id, gearbox_template_id, coins_awarded, xp_awarded)
    values (p_user, v_week, v_brand, p.e_tpl, p.g_tpl, c_coins, c_xp)
    returning id into v_claim_id;
    perform private.adjust_coins(p_user, c_coins, 'config_pair', v_claim_id);
    perform private.add_xp(p_user, c_xp, 'config', null);
    v_found := v_found + 1;
    v_status := 'validated';
  end if;

  return jsonb_build_object(
    'status', v_status,
    'engine_code', p.e_code,
    'gearbox_code', p.g_code,
    'engine_ok', v_e_ok,
    'gearbox_ok', v_g_ok,
    'coins', case when v_status = 'validated' then c_coins else 0 end,
    'xp', case when v_status = 'validated' then c_xp else 0 end,
    'found', v_found,
    'total', v_total);
end $$;

-- ---------- Droits d'exécution ----------------------------------------------
revoke all on function public.config_challenge_status(uuid) from public;
revoke all on function public.validate_config_pair(uuid) from public;
grant execute on function public.config_challenge_status(uuid) to app_user;
grant execute on function public.validate_config_pair(uuid) to app_user;
