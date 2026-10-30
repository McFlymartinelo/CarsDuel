-- =============================================================================
-- 014 : prolongation de garantie — une seule fois, depuis l'inventaire
--
-- La prolongation ne concerne plus une pièce cassée : elle se fait sur une
-- carte intacte et encore couverte, une seule et unique fois par carte.
-- =============================================================================

alter table public.user_cards
  add column warranty_extended boolean not null default false;

comment on column public.user_cards.warranty_extended is
  'Vrai si la garantie constructeur de cette carte a déjà été prolongée (une seule fois).';

create or replace function public.extend_warranty(p_user uuid, p_card_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c_cost constant integer := 5;
  v_card public.user_cards%rowtype;
  v_cat  public.card_category;
  v_bonus uuid;
begin
  perform private.assert_caller(p_user);

  select * into v_card from public.user_cards where id = p_card_id and owner_id = p_user for update;
  if not found then raise exception 'card_not_owned' using errcode = '42501'; end if;

  select category into v_cat from public.card_templates where id = v_card.template_id;
  if v_cat not in ('moteur', 'boite') then raise exception 'warranty_not_applicable'; end if;
  if v_card.is_listed then raise exception 'card_is_listed'; end if;
  if v_card.is_destroyed then raise exception 'card_broken_no_extension'; end if;
  if v_card.warranty_extended then raise exception 'warranty_already_extended'; end if;
  if v_card.warranty_duels <= 0 or v_card.warranty_used >= v_card.warranty_duels then
    raise exception 'warranty_expired';
  end if;

  select uc.id into v_bonus
    from public.user_cards uc
    join public.card_templates t on t.id = uc.template_id
   where uc.owner_id = p_user
     and t.category = 'bonus' and t.bonus_effect = 'revision_complete'
     and not uc.is_destroyed and not uc.is_listed
   order by uc.acquired_at
   limit 1
   for update of uc;
  if v_bonus is null then raise exception 'bonus_revision_required'; end if;

  update public.user_cards set is_destroyed = true where id = v_bonus;
  perform private.adjust_coins(p_user, -c_cost, 'warranty_extension', v_card.id);
  update public.user_cards
     set warranty_duels = warranty_duels + 2,
         warranty_extended = true
   where id = v_card.id;

  return jsonb_build_object(
    'card_id', v_card.id,
    'warranty_duels', v_card.warranty_duels + 2,
    'bonus_card_id', v_bonus);
end $$;
