-- Évite que deux semaines consécutives de Configs Constructeur aient le même
-- constructeur. Le tirage reste uniforme parmi les constructeurs éligibles.

create or replace function private.config_week_brand(p_week date) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_brand text;
  v_previous_brand text;
begin
  select brand into v_brand
    from public.config_brand_weeks
   where week_start = p_week;

  if v_brand is null then
    select brand into v_previous_brand
      from public.config_brand_weeks
     where week_start = p_week - 7;

    insert into public.config_brand_weeks (week_start, brand)
    select p_week, s.slug
      from (
        select b.slug
          from public.config_brands b
         where (v_previous_brand is null or b.slug <> v_previous_brand)
           and exists (
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

    select brand into v_brand
      from public.config_brand_weeks
     where week_start = p_week;
  end if;
  return v_brand;
end $$;

-- Le teaser de la semaine prochaine peut déjà avoir été persisté avec
-- l'ancien tirage. Le supprimer seulement s'il répète la semaine courante
-- permet à l'appel suivant de le tirer à nouveau sous la nouvelle règle.
delete from public.config_brand_weeks next_week
 using public.config_brand_weeks current_week
 where current_week.week_start = private.config_week_start()
   and next_week.week_start = current_week.week_start + 7
   and next_week.brand = current_week.brand;
