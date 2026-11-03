-- =============================================================================
-- 20261103-05 : centre de recyclage — échanges à trois paliers
--
-- Remplace l'échange unique à 25 cubes par trois tirages :
--   * Standard  : 25 cubes  (70 / 20 / 7 / 2,5 / 0,5 %)
--   * Amélioré  : 50 cubes  (45 / 35 / 14 / 5 / 1 %)
--   * Prestige  : 100 cubes (15 / 45 / 25 / 12 / 3 %)
--
-- Le tirage porte sur une catégorie choisie (moteur ou boîte), applique la
-- table de rareté du palier, puis sélectionne un modèle actif de cette rareté
-- (pondéré par drop_weight). Si le catalogue ne contient aucune carte de la
-- rareté tirée, on retombe sur la rareté disponible la plus proche.
--
-- La carte est accordée neuve : 0 run et garantie constructeur complète.
-- =============================================================================

create or replace function public.recycle_exchange_tiered(
  p_user uuid,
  p_tier text,
  p_category text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_cost      integer;
  v_cat       public.card_category;
  v_cubes     integer;
  v_roll      numeric;
  v_rarity    public.card_rarity;
  v_rank      integer;
  v_template  uuid;
  v_actual    public.card_rarity;
  v_card      uuid;
begin
  perform private.assert_caller(p_user);

  if p_tier is null or p_tier not in ('standard', 'ameliore', 'prestige') then
    raise exception 'invalid_tier';
  end if;
  if p_category is null or p_category not in ('moteur', 'boite') then
    raise exception 'invalid_category';
  end if;
  v_cat := p_category::public.card_category;

  v_cost := case p_tier
    when 'standard' then 25
    when 'ameliore' then 50
    else 100
  end;

  select scrap_cubes into v_cubes
    from public.profiles
   where id = p_user
   for update;
  if not found then raise exception 'profile_not_found'; end if;
  if v_cubes < v_cost then
    raise exception 'insufficient_scrap_cubes' using errcode = '23514';
  end if;

  -- Table de rareté du palier (cumul en pourcentage).
  v_roll := random() * 100;
  v_rarity := case p_tier
    when 'standard' then case
      when v_roll < 70   then 'commune'
      when v_roll < 90   then 'rare'
      when v_roll < 97   then 'tres_rare'
      when v_roll < 99.5 then 'epique'
      else 'legendaire'
    end
    when 'ameliore' then case
      when v_roll < 45 then 'commune'
      when v_roll < 80 then 'rare'
      when v_roll < 94 then 'tres_rare'
      when v_roll < 99 then 'epique'
      else 'legendaire'
    end
    else case
      when v_roll < 15 then 'commune'
      when v_roll < 60 then 'rare'
      when v_roll < 85 then 'tres_rare'
      when v_roll < 97 then 'epique'
      else 'legendaire'
    end
  end;

  v_rank := array_position(enum_range(null::public.card_rarity), v_rarity);

  -- La rareté exacte passe en premier ; sinon la plus proche disponible.
  select id, rarity into v_template, v_actual
    from public.card_templates
   where category = v_cat
     and is_active
     and private.can_use_template(restricted_to_username, p_user)
   order by (rarity is distinct from v_rarity),
            abs(array_position(enum_range(null::public.card_rarity), rarity) - v_rank),
            -ln(1 - random()) / drop_weight
   limit 1;
  if v_template is null then raise exception 'catalog_empty'; end if;

  perform private.adjust_scrap_cubes(p_user, -v_cost, 'recycle_exchange', v_template);
  v_card := private.grant_card(p_user, v_template, 'recycle_exchange');

  return jsonb_build_object(
    'card_id', v_card,
    'category', v_cat,
    'tier', p_tier,
    'rarity', v_actual,
    'cost', v_cost,
    'cubes_left', v_cubes - v_cost
  );
end $$;

-- Compatibilité : l'ancien échange à 25 cubes devient le palier Standard.
create or replace function public.recycle_exchange(p_user uuid, p_category text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return public.recycle_exchange_tiered(p_user, 'standard', p_category);
end $$;

revoke all on function public.recycle_exchange_tiered(uuid, text, text) from public;
revoke all on function public.recycle_exchange(uuid, text) from public;
grant execute on function public.recycle_exchange_tiered(uuid, text, text) to app_user;
grant execute on function public.recycle_exchange(uuid, text) to app_user;

comment on function public.recycle_exchange_tiered(uuid, text, text) is
  'Échange de cubes de ferraille contre une carte neuve selon un palier (standard, ameliore, prestige) et une catégorie.';
