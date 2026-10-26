do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select pg_constraint.conname
    from pg_constraint
    join pg_class
      on pg_class.oid = pg_constraint.conrelid
    join pg_namespace
      on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relname = 'creator_candidates'
      and pg_constraint.contype = 'u'
      and pg_get_constraintdef(pg_constraint.oid) =
        'UNIQUE (analysis_run_id, provider, provider_creator_id)'
  loop
    execute format(
      'alter table public.creator_candidates drop constraint %I',
      constraint_name
    );
  end loop;

  if not exists (
    select 1
    from pg_constraint
    join pg_class
      on pg_class.oid = pg_constraint.conrelid
    join pg_namespace
      on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relname = 'creator_candidates'
      and pg_constraint.conname = 'creator_candidates_run_provider_variant_key'
  ) then
    alter table public.creator_candidates
      add constraint creator_candidates_run_provider_variant_key
      unique (analysis_run_id, provider, provider_creator_id, search_variant);
  end if;
end
$$;
