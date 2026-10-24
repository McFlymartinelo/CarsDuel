-- =============================================================================
-- 017 : un moteur cassé, une boîte cassée ou un pneu mort se recycle pour 1 pièce.
-- =============================================================================

create or replace function public.recycle_card(p_user uuid, p_card uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_card public.user_cards%rowtype;
  v_cat  public.card_category;
  v_r0   numeric;
  v_dr   numeric;
  v_base integer;
  v_pct  numeric;
  v_gain integer;
begin
  perform private.assert_caller(p_user);

  select * into v_card from public.user_cards where id = p_card and owner_id = p_user for update;
  if not found then raise exception 'card_not_owned' using errcode = '42501'; end if;
  if v_card.is_listed then raise exception 'already_listed'; end if;

  select category, base_break_risk, wear_sensitivity
    into v_cat, v_r0, v_dr
    from public.card_templates where id = v_card.template_id;

  if v_card.is_destroyed then
    if v_cat not in ('moteur', 'boite', 'pneus') then raise exception 'card_destroyed'; end if;
    v_base := 1;
    v_pct := 0;
    v_gain := 1;
  elsif v_cat = 'bonus' then
    v_base := 1;
    v_pct := 100;
    v_gain := 1;
  elsif v_cat = 'pneus' then
    v_base := 10;
    v_pct := coalesce(v_card.tire_wear, 0);
    v_gain := round(v_base * v_pct / 100.0)::integer;
  elsif v_cat in ('moteur', 'boite') then
    v_base := case when v_cat = 'moteur' then 50 else 30 end;
    v_pct := greatest(0, least(100, 100 - (coalesce(v_r0, 0) + v_card.runs_count * coalesce(v_dr, 0))));
    v_gain := round(v_base * v_pct / 100.0)::integer;
  else
    raise exception 'not_recyclable';
  end if;

  perform private.detach_card(p_card);
  delete from public.user_cards where id = p_card;
  perform private.adjust_coins(p_user, v_gain, 'recycle', p_card);

  return jsonb_build_object('card_id', p_card, 'coins', v_gain, 'base', v_base, 'condition_pct', v_pct);
end $$;
