alter table public.launch_opportunities
  add column if not exists opportunity_rank integer,
  add column if not exists ranking_basis text,
  add column if not exists ranking_algorithm_version text,
  add column if not exists evidence_completeness numeric(4, 2),
  add column if not exists caveats jsonb not null default '[]'::jsonb;

update public.launch_opportunities
set
  opportunity_rank = coalesce(opportunity_rank, provider_rank, 1),
  ranking_basis = coalesce(ranking_basis, case when provider_rank is null then 'stable_entity_id' else 'provider_rank' end),
  ranking_algorithm_version = coalesce(ranking_algorithm_version, 'phase3-v1'),
  evidence_completeness = coalesce(evidence_completeness, 0),
  caveats = coalesce(caveats, '[]'::jsonb)
where opportunity_rank is null
   or ranking_basis is null
   or ranking_algorithm_version is null
   or evidence_completeness is null;

alter table public.launch_opportunities
  alter column opportunity_rank set not null,
  alter column ranking_basis set not null,
  alter column ranking_algorithm_version set not null,
  alter column evidence_completeness set not null;

create table if not exists public.launch_activation_reports (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null,
  run_id uuid not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  schema_version text not null default 'phase3-v1',
  report jsonb not null default '{}'::jsonb,
  generation_mode text not null,
  model_provider text,
  model_id text,
  prompt_version text not null,
  generated_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (analysis_id, user_id) references public.launch_analyses (id, user_id) on delete cascade,
  foreign key (run_id, user_id) references public.launch_analysis_runs (id, user_id) on delete cascade
);

create index if not exists launch_opportunities_run_opportunity_rank_idx on public.launch_opportunities (run_id, opportunity_rank);
create index if not exists launch_activation_reports_user_created_idx on public.launch_activation_reports (user_id, created_at desc);

alter table public.launch_activation_reports enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['launch_activation_reports'] loop
    execute format('drop policy if exists %I_select_own on public.%I', table_name, table_name);
    execute format('create policy %I_select_own on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name, table_name);
    execute format('drop policy if exists %I_insert_own on public.%I', table_name, table_name);
    execute format('create policy %I_insert_own on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name, table_name);
    execute format('drop policy if exists %I_update_own on public.%I', table_name, table_name);
    execute format('create policy %I_update_own on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name, table_name);
    execute format('drop policy if exists %I_delete_own on public.%I', table_name, table_name);
    execute format('create policy %I_delete_own on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name, table_name);
  end loop;
end
$$;

revoke all on public.launch_activation_reports from public, anon;
grant select, insert, update, delete on public.launch_activation_reports to authenticated;
