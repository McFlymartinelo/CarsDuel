-- =============================================================================
-- 006 : pack F1 privé (moteur f1_16 + boîte b_51) réservé à alexmartinelo
--
-- La restriction est portée par le pseudo (insensible à la casse) plutôt que par
-- un uuid : les cartes peuvent ainsi être posées avant la création du compte, et
-- restent invisibles pour tout le monde en attendant.
--
-- Un trigger sur profiles offre automatiquement les cartes restreintes au compte
-- correspondant, à sa création comme en cas de renommage.
-- =============================================================================

alter table public.card_templates
  add column restricted_to_username text;

alter table public.card_templates
  add constraint ck_card_templates_restricted_username
  check (restricted_to_username is null
         or restricted_to_username = lower(restricted_to_username));

comment on column public.card_templates.restricted_to_username is
  'Pseudo (minuscules) du seul joueur autorisé à voir, tirer, acheter et utiliser cette carte. NULL = catalogue public.';

create index idx_card_templates_restricted
  on public.card_templates (restricted_to_username)
  where restricted_to_username is not null;

-- ---------- Visibilité -------------------------------------------------------
-- Les lectures passent par app_user : la RLS masque les cartes privées aux autres.
drop policy ref_select on public.card_templates;
create policy ref_select on public.card_templates for select to app_user
  using (
    restricted_to_username is null
    or restricted_to_username = (
      select lower(p.username)
        from public.profiles p
       where p.id = (select public.current_uid())
    )
  );

-- ---------- Garde-fou des RPC SECURITY DEFINER (qui contournent la RLS) ------
create or replace function private.can_use_template(p_restricted_to text, p_user uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select p_restricted_to is null
      or exists (
        select 1 from public.profiles
         where id = p_user and lower(username) = p_restricted_to
      )
$$;

create or replace function private.grant_card(p_user uuid, p_template uuid, p_source text) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.user_cards (owner_id, template_id, tire_wear, source)
  select p_user, t.id, case when t.category = 'pneus' then 100 end, p_source
  from public.card_templates t
  where t.id = p_template
    and private.can_use_template(t.restricted_to_username, p_user)
  returning id into v_id;
  if v_id is null then raise exception 'template_not_found'; end if;
  return v_id;
end $$;

create or replace function private.draw_mechanical_template() returns uuid
language plpgsql as $$
declare
  v_rank integer := array_position(enum_range(null::public.card_rarity), private.roll_rarity());
  v_id   uuid;
begin
  select id into v_id
  from public.card_templates
  where category in ('moteur', 'boite') and is_active
    and private.can_use_template(restricted_to_username, public.current_uid())
  order by abs(array_position(enum_range(null::public.card_rarity), rarity) - v_rank),
           -ln(1 - random()) / drop_weight          -- tirage pondéré (exponentielle)
  limit 1;
  if v_id is null then raise exception 'catalog_empty' using hint = 'Aucun moteur/boîte actif dans card_templates.'; end if;
  return v_id;
end $$;

create or replace function public.claim_weekly_pull(p_user_id uuid, p_category text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_week date := private.paris_week_start();
  v_last date;
  v_rank integer := array_position(enum_range(null::public.card_rarity), private.roll_rarity());
  v_template uuid;
  v_id uuid;
begin
  perform private.assert_caller(p_user_id);
  if p_category not in ('moteur', 'boite') then
    raise exception 'invalid_category';
  end if;

  select last_weekly_pull into v_last from profiles where id = p_user_id for update;
  if not found then raise exception 'profile_not_found'; end if;
  if v_last = v_week then raise exception 'weekly_already_claimed' using errcode = '23505'; end if;

  select id into v_template
    from card_templates
   where category = p_category::public.card_category and is_active
     and private.can_use_template(restricted_to_username, p_user_id)
   order by abs(array_position(enum_range(null::public.card_rarity), rarity) - v_rank),
            -ln(1 - random()) / drop_weight
   limit 1;
  if v_template is null then raise exception 'catalog_empty'; end if;

  v_id := private.grant_card(p_user_id, v_template, 'weekly_pull');
  update profiles set last_weekly_pull = v_week where id = p_user_id;
  return jsonb_build_object('week_start', v_week, 'card_ids', to_jsonb(array[v_id]));
end $$;

create or replace function public.buy_shop_item(p_buyer_id uuid, p_catalog_id uuid)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_item shop_catalog%rowtype;
  v_card uuid;
begin
  perform private.assert_caller(p_buyer_id);
  select * into v_item from shop_catalog where id = p_catalog_id and is_active for update;
  if not found then raise exception 'item_not_found' using errcode = 'P0002'; end if;
  if v_item.stock is not null and v_item.stock <= 0 then raise exception 'out_of_stock'; end if;
  if not exists (
    select 1 from card_templates
     where id = v_item.template_id
       and private.can_use_template(restricted_to_username, p_buyer_id)
  ) then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;

  perform private.adjust_coins(p_buyer_id, -v_item.price, 'shop_purchase', v_item.id);
  if v_item.stock is not null then update shop_catalog set stock = stock - 1 where id = v_item.id; end if;
  v_card := private.grant_card(p_buyer_id, v_item.template_id, 'shop');
  return v_card;
end $$;

-- Une carte privée ne doit jamais partir sur le marché : elle resterait
-- achetable par un autre joueur via une RPC SECURITY DEFINER.
create or replace function public.create_listing(
  p_seller_id uuid, p_card_id uuid, p_price integer default null, p_accepts_offers boolean default false
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c_price_floor constant integer := 1;
  v_card user_cards%rowtype;
  v_cat  public.card_category;
  v_id uuid;
begin
  perform private.assert_caller(p_seller_id);
  if p_price is null and not p_accepts_offers then raise exception 'price_or_offers_required'; end if;
  if p_price is not null and p_price < c_price_floor then raise exception 'invalid_price'; end if;

  select * into v_card from user_cards where id = p_card_id and owner_id = p_seller_id for update;
  if not found then raise exception 'card_not_owned' using errcode = '42501'; end if;
  if v_card.is_destroyed then raise exception 'card_destroyed'; end if;
  if v_card.is_listed    then raise exception 'already_listed'; end if;

  select category into v_cat from card_templates where id = v_card.template_id;
  if v_cat = 'bonus' then raise exception 'bonus_not_sellable'; end if;
  if exists (
    select 1 from card_templates
     where id = v_card.template_id and restricted_to_username is not null
  ) then
    raise exception 'card_not_sellable';
  end if;

  perform private.detach_card(p_card_id);

  insert into marketplace_listings (seller_id, card_id, price, accepts_offers)
  values (p_seller_id, p_card_id, p_price, p_accepts_offers) returning id into v_id;
  update user_cards set is_listed = true where id = p_card_id;
  return v_id;
end $$;

-- ---------- Distribution automatique ----------------------------------------
create or replace function private.grant_restricted_cards(p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_template uuid;
begin
  for v_template in
    select t.id
      from public.card_templates t
      join public.profiles p on p.id = p_user
     where t.is_active
       and t.restricted_to_username is not null
       and t.restricted_to_username = lower(p.username)
  loop
    if not exists (
      select 1 from public.user_cards
       where owner_id = p_user and template_id = v_template
    ) then
      perform private.grant_card(p_user, v_template, 'admin');
    end if;
  end loop;
end $$;

create or replace function private.grant_restricted_cards_on_profile() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform private.grant_restricted_cards(new.id);
  return new;
end $$;

drop trigger if exists trg_grant_restricted_cards on public.profiles;
create trigger trg_grant_restricted_cards
  after insert or update of username on public.profiles
  for each row execute function private.grant_restricted_cards_on_profile();

-- ---------- Les deux cartes secrètes ----------------------------------------
insert into public.card_templates
  (code, category, name, description, rarity, architecture, power_hp, weight_kg,
   base_break_risk, wear_sensitivity, restricted_to_username)
values
  ('f1_16', 'moteur', '1.6 Turbo Hybrid F1Team', '1.6 Turbo Hybrid (Ferrari F1)',
   'legendaire', '6 cylindres', 1555, 25, 0.001, 0.001, 'alexmartinelo')
on conflict (code) do update set
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  rarity = excluded.rarity,
  architecture = excluded.architecture,
  power_hp = excluded.power_hp,
  weight_kg = excluded.weight_kg,
  base_break_risk = excluded.base_break_risk,
  wear_sensitivity = excluded.wear_sensitivity,
  restricted_to_username = excluded.restricted_to_username,
  is_active = true;

insert into public.card_templates
  (code, category, name, description, rarity, gearbox_type, shift_time_ms, weight_kg,
   base_break_risk, wear_sensitivity, restricted_to_username)
values
  ('b_51', 'boite', 'Séquentielle 8 Rapports F1Team Éclair', 'Boîte séquentielle F1 (Ferrari F1Team)',
   'legendaire', 'sequentielle', 5, 12, 0.001, 0.001, 'alexmartinelo')
on conflict (code) do update set
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  rarity = excluded.rarity,
  gearbox_type = excluded.gearbox_type,
  shift_time_ms = excluded.shift_time_ms,
  weight_kg = excluded.weight_kg,
  base_break_risk = excluded.base_break_risk,
  wear_sensitivity = excluded.wear_sensitivity,
  restricted_to_username = excluded.restricted_to_username,
  is_active = true;

-- Compte déjà existant : reçoit le pack immédiatement.
select private.grant_restricted_cards(p.id)
  from public.profiles p
 where lower(p.username) = 'alexmartinelo';
