-- =============================================================================
-- 20261108-02 : ordre des contrôles du dépôt dans la benne
--
-- Une carte Bonus ne doit jamais pouvoir entrer dans le centre de recyclage.
-- Le contrôle de catégorie passe désormais avant celui de mise en vente afin
-- qu'une carte Bonus listée sur la marketplace renvoie bien
-- « card_not_recyclable » (et non « already_listed »).
-- =============================================================================

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

  select category, weight_kg into v_cat, v_weight
    from public.card_templates where id = v_card.template_id;
  if v_cat not in ('moteur', 'boite', 'pneus') then raise exception 'card_not_recyclable'; end if;

  if v_card.is_listed then raise exception 'already_listed'; end if;
  if v_card.in_recycle_bin then raise exception 'card_already_in_recycle_bin'; end if;

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
