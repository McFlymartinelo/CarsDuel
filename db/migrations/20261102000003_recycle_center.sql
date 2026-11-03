-- =============================================================================
-- 003 : Centre de recyclage (cubes de ferraille)
--
-- Remplace l'ancien recyclage direct contre des pièces :
--   * une carte mécanique (moteur, boîte, pneus) se dépose dans une benne ;
--   * la benne pèse les cartes (pneus = 4 kg forfaitaires) ;
--   * 10 kg = 1 cube de ferraille, arrondi à l'entier inférieur ;
--   * les cubes servent à échanger 1 moteur ou 1 boîte reconditionné (25 cubes).
--
-- Les cartes bonus ne peuvent jamais entrer dans la benne.
-- Les cartes déposées ne peuvent plus être équipées ni mises en vente.
--
-- Les annonces du marché conservent désormais un instantané du modèle
-- (nom, catégorie, template) afin que la suppression définitive d'une carte
-- recyclée ne casse ni l'historique des ventes ni les notifications.
-- =============================================================================

-- ---------- Nouvelles ressources / état de la benne --------------------------
alter table public.profiles
  add column scrap_cubes integer not null default 0 check (scrap_cubes >= 0);

comment on column public.profiles.scrap_cubes is
  'Solde de cubes de ferraille du joueur (ressource du centre de recyclage).';

alter table public.user_cards
  add column in_recycle_bin boolean not null default false;

comment on column public.user_cards.in_recycle_bin is
  'Carte déposée dans la benne du centre de recyclage : inutilisable en deck et en vente.';

create index idx_user_cards_recycle_bin
  on public.user_cards (owner_id)
  where in_recycle_bin;

create table public.scrap_cube_transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  amount     integer not null,
  reason     text not null,
  ref_id     uuid,
  created_at timestamptz not null default now()
);
create index idx_scrap_cube_tx_user
  on public.scrap_cube_transactions (user_id, created_at desc);

alter table public.scrap_cube_transactions enable row level security;
grant select on public.scrap_cube_transactions to app_user;
create policy scrap_cube_tx_select on public.scrap_cube_transactions for select to app_user
  using (user_id = (select public.current_uid()));

comment on table public.scrap_cube_transactions is
  'Journal des mouvements de cubes de ferraille (recyclage, échanges).';

-- ---------- Ancien recyclage : suppression -----------------------------------
drop function if exists public.recycle_card(uuid, uuid);

-- ---------- Aides internes ---------------------------------------------------
create or replace function private.adjust_scrap_cubes(
  p_user uuid, p_delta integer, p_reason text, p_ref uuid default null
) returns void
language plpgsql as $$
declare
  v_cubes integer;
begin
  if p_delta = 0 then return; end if;
  select scrap_cubes into v_cubes from public.profiles where id = p_user for update;
  if not found then raise exception 'profile_not_found'; end if;
  if v_cubes + p_delta < 0 then
    raise exception 'insufficient_scrap_cubes' using errcode = '23514';
  end if;
  update public.profiles set scrap_cubes = scrap_cubes + p_delta where id = p_user;
  insert into public.scrap_cube_transactions (user_id, amount, reason, ref_id)
  values (p_user, p_delta, p_reason, p_ref);
end $$;

-- Poids d'une carte dans la benne : poids réel pour moteur/boîte, 4 kg pour un pneu.
create or replace function private.recycle_card_weight(
  p_category public.card_category, p_weight_kg numeric
) returns numeric
language sql immutable as $$
  select case
    when p_category = 'pneus' then 4::numeric
    when p_category in ('moteur', 'boite') then coalesce(p_weight_kg, 0)
    else 0::numeric
  end
$$;

comment on function private.recycle_card_weight(public.card_category, numeric) is
  'Poids en kg d''une carte dans la benne : poids_kg réel (moteur/boîte) ou 4 kg (pneus).';

-- ---------- Benne : déposer / retirer ----------------------------------------
create or replace function public.recycle_bin_add(p_user uuid, p_card uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_card   public.user_cards%rowtype;
  v_cat    public.card_category;
  v_weight numeric;
begin
  perform private.assert_caller(p_user);

  select * into v_card
    from public.user_cards
   where id = p_card and owner_id = p_user
   for update;
  if not found then raise exception 'card_not_owned' using errcode = '42501'; end if;
  if v_card.is_listed then raise exception 'already_listed'; end if;
  if v_card.in_recycle_bin then raise exception 'card_already_in_recycle_bin'; end if;

  select category, weight_kg into v_cat, v_weight
    from public.card_templates where id = v_card.template_id;
  if v_cat not in ('moteur', 'boite', 'pneus') then raise exception 'card_not_recyclable'; end if;

  -- Une carte déposée quitte immédiatement les configurations.
  perform private.detach_card(p_card);
  update public.user_cards set in_recycle_bin = true where id = p_card;

  -- Conserve le défi quotidien historique « recycler une carte ».
  perform private.touch_progress(p_user, 'recycle_bonus');

  return jsonb_build_object(
    'card_id', p_card,
    'category', v_cat,
    'weight_kg', private.recycle_card_weight(v_cat, v_weight)
  );
end $$;

create or replace function public.recycle_bin_remove(p_user uuid, p_card uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_card public.user_cards%rowtype;
begin
  perform private.assert_caller(p_user);

  select * into v_card
    from public.user_cards
   where id = p_card and owner_id = p_user
   for update;
  if not found then raise exception 'card_not_owned' using errcode = '42501'; end if;
  if not v_card.in_recycle_bin then raise exception 'card_not_in_recycle_bin'; end if;

  update public.user_cards set in_recycle_bin = false where id = p_card;
  return jsonb_build_object('card_id', p_card);
end $$;

-- ---------- Benne : recyclage définitif --------------------------------------
create or replace function public.recycle_bin_process(p_user uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_card   record;
  v_id     uuid;
  v_ids    uuid[] := array[]::uuid[];
  v_count  integer := 0;
  v_weight numeric := 0;
  v_cubes  integer;
begin
  perform private.assert_caller(p_user);

  for v_card in
    select uc.id, t.category, t.weight_kg
      from public.user_cards uc
      join public.card_templates t on t.id = uc.template_id
     where uc.owner_id = p_user and uc.in_recycle_bin
     for update of uc
  loop
    v_ids := array_append(v_ids, v_card.id);
    v_count := v_count + 1;
    v_weight := v_weight + private.recycle_card_weight(v_card.category, v_card.weight_kg);
  end loop;

  if v_count = 0 then raise exception 'recycle_bin_empty'; end if;

  v_cubes := floor(v_weight / 10)::integer;
  if v_cubes < 1 then raise exception 'recycle_bin_too_light'; end if;

  foreach v_id in array v_ids loop
    perform private.detach_card(v_id);
  end loop;
  delete from public.user_cards where id = any(v_ids);

  perform private.adjust_scrap_cubes(p_user, v_cubes, 'recycle_bin');

  return jsonb_build_object('cards', v_count, 'weight_kg', v_weight, 'cubes', v_cubes);
end $$;

-- ---------- Échanges : 25 cubes = 1 moteur / boîte reconditionné -------------
create or replace function public.recycle_exchange(p_user uuid, p_category text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c_cost     constant integer := 25;
  v_cat      public.card_category;
  v_cubes    integer;
  v_template uuid;
  v_card     uuid;
begin
  perform private.assert_caller(p_user);
  if p_category is null or p_category not in ('moteur', 'boite') then raise exception 'invalid_category'; end if;
  v_cat := p_category::public.card_category;

  select scrap_cubes into v_cubes from public.profiles where id = p_user for update;
  if not found then raise exception 'profile_not_found'; end if;
  if v_cubes < c_cost then raise exception 'insufficient_scrap_cubes' using errcode = '23514'; end if;

  select id into v_template
    from public.card_templates
   where category = v_cat and is_active
     and private.can_use_template(restricted_to_username, p_user)
   order by -ln(1 - random()) / drop_weight
   limit 1;
  if v_template is null then raise exception 'catalog_empty'; end if;

  perform private.adjust_scrap_cubes(p_user, -c_cost, 'recycle_exchange', v_template);
  v_card := private.grant_card(p_user, v_template, 'recycle_exchange');

  return jsonb_build_object(
    'card_id', v_card,
    'category', v_cat,
    'cost', c_cost,
    'cubes_left', v_cubes - c_cost
  );
end $$;

revoke all on function public.recycle_bin_add(uuid, uuid)     from public;
revoke all on function public.recycle_bin_remove(uuid, uuid)  from public;
revoke all on function public.recycle_bin_process(uuid)       from public;
revoke all on function public.recycle_exchange(uuid, text)    from public;
grant execute on function public.recycle_bin_add(uuid, uuid)     to app_user;
grant execute on function public.recycle_bin_remove(uuid, uuid)  to app_user;
grant execute on function public.recycle_bin_process(uuid)       to app_user;
grant execute on function public.recycle_exchange(uuid, text)    to app_user;

-- ---------- Marché : instantané du modèle pour survivre à la suppression -----
alter table public.marketplace_listings
  add column card_template_id uuid references public.card_templates (id) on delete set null,
  add column card_name        text,
  add column card_category    public.card_category;

comment on column public.marketplace_listings.card_name is
  'Nom du modèle au moment de la vente, conservé après suppression de la carte recyclée.';
comment on column public.marketplace_listings.card_category is
  'Catégorie du modèle au moment de la vente, conservée après suppression de la carte recyclée.';
comment on column public.marketplace_listings.card_template_id is
  'Modèle de la carte vendue, conservé pour les prix de référence après suppression.';

update public.marketplace_listings l
   set card_template_id = uc.template_id,
       card_name = t.name,
       card_category = t.category
  from public.user_cards uc
  join public.card_templates t on t.id = uc.template_id
 where uc.id = l.card_id;

do $$
declare
  v_constraint text;
begin
  select conname into v_constraint
    from pg_constraint
   where conrelid = 'public.marketplace_listings'::regclass
     and contype = 'f'
     and conkey = array[
       (select attnum from pg_attribute
         where attrelid = 'public.marketplace_listings'::regclass and attname = 'card_id')
     ];
  if v_constraint is not null then
    execute format('alter table public.marketplace_listings drop constraint %I', v_constraint);
  end if;
end $$;
alter table public.marketplace_listings
  alter column card_id drop not null;
alter table public.marketplace_listings
  add constraint marketplace_listings_card_id_fkey
  foreign key (card_id) references public.user_cards (id) on delete set null;

-- Liste d'achat : la carte ne doit pas être dans la benne.
create or replace function public.create_listing(
  p_seller_id uuid, p_card_id uuid, p_price integer default null, p_accepts_offers boolean default false
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c_price_floor constant integer := 10;
  v_card user_cards%rowtype;
  v_name text;
  v_cat  public.card_category;
  v_id uuid;
begin
  perform private.assert_caller(p_seller_id);
  if p_price is null and not p_accepts_offers then raise exception 'price_or_offers_required'; end if;
  if p_price is not null and p_price < c_price_floor then raise exception 'price_too_low'; end if;

  select * into v_card from user_cards where id = p_card_id and owner_id = p_seller_id for update;
  if not found then raise exception 'card_not_owned' using errcode = '42501'; end if;
  if v_card.is_destroyed then raise exception 'card_destroyed'; end if;
  if v_card.is_listed    then raise exception 'already_listed'; end if;
  if v_card.in_recycle_bin then raise exception 'card_in_recycle_bin'; end if;

  select name, category into v_name, v_cat from card_templates where id = v_card.template_id;
  if v_cat is null then raise exception 'template_not_found'; end if;
  if v_cat = 'bonus' then raise exception 'bonus_not_sellable'; end if;
  if exists (
    select 1 from card_templates
     where id = v_card.template_id and restricted_to_username is not null
  ) then
    raise exception 'card_not_sellable';
  end if;

  perform private.detach_card(p_card_id);

  insert into marketplace_listings
    (seller_id, card_id, card_template_id, card_name, card_category, price, accepts_offers)
  values
    (p_seller_id, p_card_id, v_card.template_id, v_name, v_cat, p_price, p_accepts_offers)
  returning id into v_id;
  update user_cards set is_listed = true where id = p_card_id;
  return v_id;
end $$;

-- Historique : lecture du nom/catégorie conservés sur l'annonce.
create or replace function public.my_market_history(p_user_id uuid, p_limit integer default 15)
returns table (id uuid, role text, card_name text, category public.card_category,
               price integer, net integer, closed_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform private.assert_caller(p_user_id);
  return query
    select l.id,
           case when l.seller_id = p_user_id then 'sale' else 'purchase' end,
           l.card_name, l.card_category, l.sold_price, l.seller_net, l.closed_at
      from marketplace_listings l
     where l.status = 'sold' and (l.seller_id = p_user_id or l.buyer_id = p_user_id)
     order by l.closed_at desc
     limit least(greatest(p_limit, 1), 50);
end $$;

-- Prix de référence : le modèle conservé permet d'inclure les cartes recyclées.
create or replace view public.market_price_ref as
with recent as (
  select l.card_template_id as template_id, l.sold_price,
         row_number() over (partition by l.card_template_id order by l.closed_at desc) as rn
    from public.marketplace_listings l
   where l.status = 'sold'
     and l.card_template_id is not null
     and l.sold_price is not null
     and l.closed_at > now() - interval '60 days'
)
select template_id, round(avg(sold_price))::integer as avg_price, count(*)::integer as sales
  from recent where rn <= 10 group by template_id;

-- Notifications : le nom conservé sur l'annonce suffit.
create or replace function public.my_notifications(p_user_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_seen timestamptz;
  v_items jsonb;
begin
  perform private.assert_caller(p_user_id);
  select notifications_seen_at into v_seen from profiles where id = p_user_id;

  with ev as (
    select 'offer_received'::text as kind, o.created_at as at, l.card_name as label, o.amount as amount
      from marketplace_offers o
      join marketplace_listings l on l.id = o.listing_id
     where l.seller_id = p_user_id
       and o.status = 'pending'
       and o.created_at > now() - interval '30 days'
    union all
    select 'sale', l.closed_at, l.card_name, l.seller_net
      from marketplace_listings l
     where l.seller_id = p_user_id
       and l.status = 'sold'
       and l.closed_at > now() - interval '30 days'
    union all
    select case o.status when 'accepted' then 'offer_accepted' else 'offer_rejected' end,
           o.resolved_at, l.card_name, o.amount
      from marketplace_offers o
      join marketplace_listings l on l.id = o.listing_id
     where o.buyer_id = p_user_id
       and o.status in ('accepted', 'rejected')
       and o.resolved_at > now() - interval '30 days'
    union all
    select case d.result when 'attacker_win' then 'duel_lost' else 'duel_won' end,
           d.created_at, p.username, d.defender_coins
      from duels_history d
      join profiles p on p.id = d.attacker_id
     where d.defender_id = p_user_id
       and d.created_at > now() - interval '30 days'
    union all
    select 'duel_request', c.created_at, p.username, 0
      from duel_challenges c
      join profiles p on p.id = c.challenger_id
     where c.target_id = p_user_id
       and c.status = 'pending'
       and c.created_at > now() - interval '30 days'
    union all
    select 'payout', pp.created_at,
           case pp.period when 'weekly' then 'Classement de la semaine' else 'Classement du mois' end || ' (#' || pp.rank || ')',
           pp.coins
      from leaderboard_payouts pp
     where pp.user_id = p_user_id
       and pp.created_at > now() - interval '30 days'
  ), recent as (
    select kind, at, label, amount from ev order by at desc limit 15
  )
  select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'at', at, 'label', label, 'amount', amount,
                                               'unread', at > v_seen) order by at desc), '[]'::jsonb)
    into v_items from recent;

  return jsonb_build_object(
    'unread', (select count(*) from jsonb_array_elements(v_items) e where (e->>'unread')::boolean),
    'items', v_items);
end $$;

-- ---------- Deck : une carte de la benne n'est pas équipable -----------------
create or replace function private.validate_deck() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.engine_card_id is null
     and new.gearbox_card_id is null
     and new.tire_card_id is null then
    raise exception 'invalid_deck_card' using errcode = '23514',
      hint = 'Au moins un emplacement du deck doit être renseigné.';
  end if;

  if exists (
    select 1
    from (values (new.engine_card_id,  'moteur'::card_category),
                 (new.gearbox_card_id, 'boite'::card_category),
                 (new.tire_card_id,    'pneus'::card_category)) v (card_id, cat)
    where v.card_id is not null
      and not exists (
        select 1 from user_cards uc join card_templates t on t.id = uc.template_id
        where uc.id = v.card_id and uc.owner_id = new.owner_id
          and t.category = v.cat and not uc.is_listed and not uc.in_recycle_bin)
  ) then
    raise exception 'invalid_deck_card' using errcode = '23514',
      hint = 'Chaque carte doit appartenir au joueur, ne pas être en vente ni dans la benne et correspondre à son emplacement.';
  end if;
  return new;
end $$;
