-- =============================================================================
-- 003 : unicité des pseudos insensible à la casse
-- profiles.username était unique en casse exacte, ce qui permettait « Alex »
-- et « alex » et rendait propose_duel ambigu (recherche lower(username)).
-- En cas de doublons, la migration échoue et ne renomme rien automatiquement.
--
-- Requête de résolution manuelle :
--   select lower(username), array_agg(username order by username)
--     from public.profiles
--    group by lower(username)
--   having count(*) > 1;
-- Renommer ensuite les comptes concernés, puis relancer les migrations.
-- =============================================================================

do $$
declare
  v_dupes text;
begin
  select string_agg(d.names, ' ; ' order by d.lower_name)
    into v_dupes
    from (
      select lower(username) as lower_name,
             string_agg(username, ', ' order by username) as names
        from public.profiles
       group by lower(username)
      having count(*) > 1
    ) d;

  if v_dupes is not null then
    raise exception
      'Doublons de pseudos insensibles à la casse : %. Corrigez-les manuellement avant de relancer les migrations (voir la requête de résolution en tête de 20261029000003_profiles_username_case_insensitive.sql).',
      v_dupes;
  end if;
end $$;

create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));
