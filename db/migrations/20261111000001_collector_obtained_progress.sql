-- =============================================================================
-- 20261111-01 : les défis du collectionneur suivent l'historique d'obtention
--
-- Le badge « Déjà obtenue » s'appuie déjà sur collector_obtained. La progression
-- des défis, elle, ne regardait que les cartes encore dans l'inventaire : une
-- pièce obtenue puis vendue, recyclée, détruite ou consommée retombait à zéro.
-- On aligne les deux : un modèle obtenu reste compté pour la collection.
--
-- La collection publique d'un pilote suit la même règle, pour rester cohérente
-- avec les badges affichés sur sa propre collection.
-- =============================================================================

create or replace function public.claim_collector_challenge(p_user_id uuid, p_challenge text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_kind text;
  v_required_rarity public.card_rarity;
  v_reward_rarity public.card_rarity;
  v_cylinders integer;
  v_coins integer;
  v_total integer;
  v_collected integer;
  v_claim_id uuid;
  v_template_id uuid;
  v_user_card_id uuid;
begin
  perform private.assert_caller(p_user_id);
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then raise exception 'profile_not_found'; end if;
  if exists (
    select 1 from public.collector_challenge_claims
     where owner_id = p_user_id and challenge_key = p_challenge
  ) then
    raise exception 'collector_challenge_already_claimed';
  end if;

  case p_challenge
    when 'toolbox' then v_kind := 'bonus'; v_coins := 50;
    when 'foundations' then v_kind := 'rarity'; v_required_rarity := 'commune'; v_reward_rarity := 'rare'; v_coins := 150;
    when 'track_prep' then v_kind := 'rarity'; v_required_rarity := 'rare'; v_reward_rarity := 'tres_rare'; v_coins := 400;
    when 'watchmaking' then v_kind := 'rarity'; v_required_rarity := 'tres_rare'; v_reward_rarity := 'epique'; v_coins := 1000;
    when 'factory_team' then v_kind := 'rarity'; v_required_rarity := 'epique'; v_reward_rarity := 'legendaire'; v_coins := 2500;
    when 'pantheon' then v_kind := 'rarity'; v_required_rarity := 'legendaire'; v_coins := 6000;
    when 'engine_2' then v_kind := 'engine'; v_cylinders := 2; v_coins := 100;
    when 'engine_3' then v_kind := 'engine'; v_cylinders := 3; v_coins := 200;
    when 'engine_4' then v_kind := 'engine'; v_cylinders := 4; v_coins := 400;
    when 'engine_5' then v_kind := 'engine'; v_cylinders := 5; v_coins := 500;
    when 'engine_6' then v_kind := 'engine'; v_cylinders := 6; v_coins := 750;
    when 'engine_8' then v_kind := 'engine'; v_cylinders := 8; v_coins := 1200;
    when 'engine_10' then v_kind := 'engine'; v_cylinders := 10; v_coins := 1800;
    when 'engine_12' then v_kind := 'engine'; v_cylinders := 12; v_coins := 2800;
    when 'engine_16' then v_kind := 'engine'; v_cylinders := 16; v_coins := 4500;
    else raise exception 'collector_challenge_unknown';
  end case;

  if v_kind = 'bonus' then
    select count(*)::integer into v_total
      from public.card_templates t
     where t.category = 'bonus'
       and private.can_use_template(t.restricted_to_username, p_user_id);
    select count(distinct t.id)::integer into v_collected
      from public.card_templates t
     where t.category = 'bonus'
       and private.can_use_template(t.restricted_to_username, p_user_id)
       and exists (
         select 1 from public.collector_obtained co
          where co.owner_id = p_user_id and co.template_id = t.id
       );
  elsif v_kind = 'rarity' then
    select count(*)::integer into v_total from public.card_templates t
     where t.category in ('moteur', 'boite') and t.rarity = v_required_rarity
       and private.can_use_template(t.restricted_to_username, p_user_id);
    select count(distinct t.id)::integer into v_collected from public.card_templates t
     where t.category in ('moteur', 'boite') and t.rarity = v_required_rarity
       and private.can_use_template(t.restricted_to_username, p_user_id)
       and exists (
         select 1 from public.collector_obtained co
          where co.owner_id = p_user_id and co.template_id = t.id
       );
  else
    select count(*)::integer into v_total from public.card_templates t
     where t.category = 'moteur'
       and private.can_use_template(t.restricted_to_username, p_user_id)
       and (t.architecture ~* ('\m' || v_cylinders::text || '\s*cylindres?\M')
         or t.architecture ~* ('\m[VWH]' || v_cylinders::text || '\M'));
    select count(distinct t.id)::integer into v_collected from public.card_templates t
     where t.category = 'moteur'
       and private.can_use_template(t.restricted_to_username, p_user_id)
       and (t.architecture ~* ('\m' || v_cylinders::text || '\s*cylindres?\M')
         or t.architecture ~* ('\m[VWH]' || v_cylinders::text || '\M'))
       and exists (
         select 1 from public.collector_obtained co
          where co.owner_id = p_user_id and co.template_id = t.id
       );
  end if;

  if v_total = 0 then raise exception 'collector_challenge_unavailable'; end if;
  if v_collected < v_total then raise exception 'collector_challenge_not_done'; end if;

  if v_reward_rarity is not null then
    select t.id into v_template_id
      from public.card_templates t
     where t.is_active and t.category in ('moteur', 'boite') and t.rarity = v_reward_rarity
       and private.can_use_template(t.restricted_to_username, p_user_id)
     order by random() limit 1;
    if v_template_id is null then raise exception 'catalog_empty'; end if;
  end if;

  insert into public.collector_challenge_claims (owner_id, challenge_key, coins_awarded, reward_template_id)
  values (p_user_id, p_challenge, v_coins, v_template_id)
  on conflict (owner_id, challenge_key) do nothing
  returning id into v_claim_id;
  if v_claim_id is null then raise exception 'collector_challenge_already_claimed'; end if;

  perform private.adjust_coins(p_user_id, v_coins, 'collector_challenge', v_claim_id);
  if v_template_id is not null then
    v_user_card_id := private.grant_card(p_user_id, v_template_id, 'collector_challenge');
  end if;

  return jsonb_build_object(
    'challenge_key', p_challenge,
    'coins', v_coins,
    'card_id', v_user_card_id,
    'card_template_id', v_template_id
  );
end $$;

-- Collection publique : afficher les modèles obtenus, pas seulement ceux encore
-- en inventaire. Les cartes privées restent filtrées pour l'appelant.
create or replace function public.collector_collection(p_user_id uuid, p_username text)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_target_id uuid;
  v_username text;
  v_cards jsonb;
begin
  perform private.assert_caller(p_user_id);

  select p.id, p.username
    into v_target_id, v_username
    from public.profiles p
   where lower(p.username) = lower(btrim(p_username));

  if v_target_id is null then
    raise exception 'user_not_found';
  end if;

  select coalesce(
           jsonb_agg(
             jsonb_build_object('card_templates', to_jsonb(t))
             order by t.category, t.code nulls last, t.name
           ),
           '[]'::jsonb
         )
    into v_cards
    from public.card_templates t
   where exists (
           select 1
             from public.collector_obtained co
            where co.owner_id = v_target_id
              and co.template_id = t.id
         )
     and private.can_use_template(t.restricted_to_username, p_user_id);

  return jsonb_build_object('username', v_username, 'cards', v_cards);
end $$;

-- Rattrapage : acquisitions dont le modèle reste traçable dans un journal,
-- même si la carte a quitté l'inventaire avant la création de l'historique.
-- On rejoint card_templates pour ignorer les références devenues orphelines.
insert into public.collector_obtained (owner_id, template_id, first_obtained_at)
select src.user_id, src.template_id, min(src.at)
  from (
    -- Échanges au centre de recyclage : ref_id = modèle tiré.
    select user_id, ref_id as template_id, created_at as at
      from public.scrap_cube_transactions
     where reason = 'recycle_exchange' and ref_id is not null
    union all
    -- Cartes offertes en récompense des défis du collectionneur.
    select owner_id, reward_template_id, claimed_at
      from public.collector_challenge_claims
     where reward_template_id is not null
    union all
    -- Achats boutique : ref_id = ligne de catalogue, qui porte le modèle.
    select ct.user_id, sc.template_id, ct.created_at
      from public.coin_transactions ct
      join public.shop_catalog sc on sc.id = ct.ref_id
     where ct.reason = 'shop_purchase'
  ) src
  join public.card_templates t on t.id = src.template_id
 group by src.user_id, src.template_id
on conflict (owner_id, template_id) do nothing;
