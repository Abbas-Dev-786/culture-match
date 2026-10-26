do $$
begin
  create type public.launch_analysis_status as enum (
    'queued',
    'resolving_inputs',
    'researching_market',
    'discovering_opportunities',
    'completed',
    'failed'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.launch_run_status as enum ('queued', 'running', 'completed', 'failed');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.launch_workflow_stage as enum (
    'queued',
    'resolving_inputs',
    'researching_market',
    'discovering_opportunities'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.launch_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  brand_name text not null,
  product text not null,
  country text not null,
  city text not null,
  opportunity_type text not null,
  cultural_references text[] not null default '{}',
  launch_intent text not null,
  status public.launch_analysis_status not null default 'queued',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  constraint launch_analyses_references_count check (
    cardinality(cultural_references) between 2 and 5
  )
);

create table if not exists public.launch_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt integer not null default 1 check (attempt > 0),
  idempotency_key text not null unique,
  status public.launch_run_status not null default 'queued',
  stage public.launch_workflow_stage not null default 'queued',
  error_code text,
  error_message text,
  queued_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (analysis_id, user_id)
    references public.launch_analyses (id, user_id) on delete cascade,
  unique (analysis_id, attempt),
  unique (id, user_id)
);

create table if not exists public.launch_cultural_profiles (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null,
  run_id uuid not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  fingerprint jsonb not null default '{}'::jsonb,
  provider_summary jsonb not null default '{}'::jsonb,
  raw_payload jsonb,
  observed_at timestamptz,
  raw_payload_expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (analysis_id, user_id)
    references public.launch_analyses (id, user_id) on delete cascade,
  foreign key (run_id, user_id)
    references public.launch_analysis_runs (id, user_id) on delete cascade
);

create table if not exists public.launch_opportunities (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null,
  run_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'qloo',
  entity_id text not null,
  name text not null,
  types text[] not null default '{}',
  provider_rank integer,
  affinity numeric(12, 8),
  popularity numeric(12, 8),
  related_signal_ids text[] not null default '{}',
  evidence jsonb not null default '[]'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (analysis_id, user_id)
    references public.launch_analyses (id, user_id) on delete cascade,
  foreign key (run_id, user_id)
    references public.launch_analysis_runs (id, user_id) on delete cascade,
  unique (run_id, provider, entity_id),
  check (provider_rank is null or provider_rank > 0),
  check (affinity is null or affinity >= 0),
  check (popularity is null or popularity >= 0)
);

create index if not exists launch_analyses_user_created_idx
  on public.launch_analyses (user_id, created_at desc);
create index if not exists launch_analyses_user_status_idx
  on public.launch_analyses (user_id, status);
create index if not exists launch_analysis_runs_analysis_created_idx
  on public.launch_analysis_runs (analysis_id, created_at desc);
create index if not exists launch_analysis_runs_user_status_idx
  on public.launch_analysis_runs (user_id, status);
create index if not exists launch_opportunities_run_rank_idx
  on public.launch_opportunities (run_id, provider_rank nulls last, created_at);
create index if not exists launch_opportunities_user_idx
  on public.launch_opportunities (user_id, created_at desc);

drop trigger if exists launch_analyses_set_updated_at on public.launch_analyses;
create trigger launch_analyses_set_updated_at
before update on public.launch_analyses
for each row execute function public.set_updated_at();

drop trigger if exists launch_analysis_runs_set_updated_at on public.launch_analysis_runs;
create trigger launch_analysis_runs_set_updated_at
before update on public.launch_analysis_runs
for each row execute function public.set_updated_at();

drop trigger if exists launch_cultural_profiles_set_updated_at on public.launch_cultural_profiles;
create trigger launch_cultural_profiles_set_updated_at
before update on public.launch_cultural_profiles
for each row execute function public.set_updated_at();

drop trigger if exists launch_opportunities_set_updated_at on public.launch_opportunities;
create trigger launch_opportunities_set_updated_at
before update on public.launch_opportunities
for each row execute function public.set_updated_at();

alter table public.launch_analyses enable row level security;
alter table public.launch_analysis_runs enable row level security;
alter table public.launch_cultural_profiles enable row level security;
alter table public.launch_opportunities enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'launch_analyses',
    'launch_analysis_runs',
    'launch_cultural_profiles',
    'launch_opportunities'
  ] loop
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

revoke all on public.launch_analyses, public.launch_analysis_runs,
  public.launch_cultural_profiles, public.launch_opportunities from public, anon;
grant select, insert, update, delete on public.launch_analyses,
  public.launch_analysis_runs, public.launch_cultural_profiles,
  public.launch_opportunities to authenticated;
