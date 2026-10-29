-- Récompenses réclamables des défis du collectionneur.
create table public.collector_challenge_claims (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  challenge_key text not null,
  coins_awarded integer not null check (coins_awarded > 0),
  reward_template_id uuid references public.card_templates (id) on delete set null,
  claimed_at timestamptz not null default now(),
  unique (owner_id, challenge_key)
);

alter table public.collector_challenge_claims enable row level security;
grant select on public.collector_challenge_claims to app_user;
create policy collector_challenge_claims_select on public.collector_challenge_claims
  for select to app_user using (owner_id = (select public.current_uid()));

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
  v_owned integer;
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
    select count(*)::integer into v_total from public.card_templates t where t.category = 'bonus';
    select count(distinct t.id)::integer into v_owned
      from public.card_templates t
     where t.category = 'bonus'
       and exists (select 1 from public.user_cards uc where uc.owner_id = p_user_id and uc.template_id = t.id);
  elsif v_kind = 'rarity' then
    select count(*)::integer into v_total from public.card_templates t
     where t.category in ('moteur', 'boite') and t.rarity = v_required_rarity;
    select count(distinct t.id)::integer into v_owned from public.card_templates t
     where t.category in ('moteur', 'boite') and t.rarity = v_required_rarity
       and exists (select 1 from public.user_cards uc where uc.owner_id = p_user_id and uc.template_id = t.id);
  else
    select count(*)::integer into v_total from public.card_templates t
     where t.category = 'moteur'
       and (t.architecture ~* ('\m' || v_cylinders::text || '\s*cylindres?\M')
         or t.architecture ~* ('\m[VWH]' || v_cylinders::text || '\M'));
    select count(distinct t.id)::integer into v_owned from public.card_templates t
     where t.category = 'moteur'
       and (t.architecture ~* ('\m' || v_cylinders::text || '\s*cylindres?\M')
         or t.architecture ~* ('\m[VWH]' || v_cylinders::text || '\M'))
       and exists (select 1 from public.user_cards uc where uc.owner_id = p_user_id and uc.template_id = t.id);
  end if;

  if v_total = 0 then raise exception 'collector_challenge_unavailable'; end if;
  if v_owned < v_total then raise exception 'collector_challenge_not_done'; end if;

  if v_reward_rarity is not null then
    select t.id into v_template_id
      from public.card_templates t
     where t.is_active and t.category in ('moteur', 'boite') and t.rarity = v_reward_rarity
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

revoke all on function public.claim_collector_challenge(uuid, text) from public;
grant execute on function public.claim_collector_challenge(uuid, text) to app_user;
