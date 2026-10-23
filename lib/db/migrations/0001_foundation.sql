create extension if not exists "pgcrypto";

do $$
begin
  create type public.campaign_status as enum (
    'queued',
    'researching_culture',
    'searching_creators',
    'scoring',
    'generating_report',
    'completed',
    'failed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.run_status as enum ('queued', 'running', 'completed', 'failed', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.workflow_stage as enum (
    'queued',
    'researching_culture',
    'searching_creators',
    'scoring',
    'generating_report'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  brand_name text not null,
  product_category text not null,
  objective text not null,
  market_country text not null,
  market_region text,
  market_city text,
  market_scope text not null check (market_scope in ('country', 'region', 'city')),
  cultural_references text[] not null default '{}',
  preferred_languages text[] not null default '{}',
  min_followers bigint,
  max_followers bigint,
  max_budget numeric(14, 2),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  creator_limit integer not null check (creator_limit between 1 and 100),
  status public.campaign_status not null default 'queued',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint campaigns_market_scope_values check (
    (market_scope = 'country' and market_region is null and market_city is null)
    or (market_scope = 'region' and market_region is not null)
    or (market_scope = 'city' and market_city is not null)
  ),
  constraint campaigns_follower_bounds check (
    min_followers is null or min_followers >= 0
  ),
  constraint campaigns_max_followers_valid check (
    max_followers is null or max_followers > 0
  ),
  constraint campaigns_follower_order check (
    min_followers is null or max_followers is null or min_followers <= max_followers
  ),
  constraint campaigns_budget_valid check (max_budget is null or max_budget > 0),
  unique (id, user_id)
);

create table if not exists public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt integer not null default 1 check (attempt > 0),
  idempotency_key text not null unique,
  status public.run_status not null default 'queued',
  stage public.workflow_stage not null default 'queued',
  provider_run_id text,
  provider_dataset_id text,
  score_algorithm_version text not null default 'phase1-v1',
  error_code text,
  error_message text,
  queued_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (campaign_id, user_id) references public.campaigns (id, user_id) on delete cascade,
  unique (campaign_id, attempt),
  unique (id, user_id)
);

create table if not exists public.culture_profiles (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  analysis_run_id uuid not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  market_country text not null,
  signals jsonb not null default '[]'::jsonb,
  provider_summary jsonb not null default '{}'::jsonb,
  raw_payload jsonb,
  observed_at timestamptz,
  raw_payload_expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (campaign_id, user_id) references public.campaigns (id, user_id) on delete cascade,
  foreign key (analysis_run_id, user_id) references public.analysis_runs (id, user_id) on delete cascade
);

create table if not exists public.creator_candidates (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  analysis_run_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  provider_creator_id text not null,
  name text not null,
  platform text not null,
  username text,
  profile_url text,
  bio text,
  followers bigint,
  engagement_rate numeric(8, 4),
  is_verified boolean,
  location_unverified boolean,
  provider_match_score numeric(8, 4),
  evidence jsonb not null default '[]'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  raw_payload jsonb,
  raw_payload_expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (campaign_id, user_id) references public.campaigns (id, user_id) on delete cascade,
  foreign key (analysis_run_id, user_id) references public.analysis_runs (id, user_id) on delete cascade,
  unique (analysis_run_id, provider, provider_creator_id),
  check (followers is null or followers >= 0),
  check (engagement_rate is null or engagement_rate >= 0),
  check (provider_match_score is null or provider_match_score between 0 and 1),
  unique (id, user_id)
);

create table if not exists public.creator_matches (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  analysis_run_id uuid not null,
  creator_candidate_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  rank integer not null check (rank > 0),
  campaign_fit_score numeric(8, 4),
  score_components jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  report_summary text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (campaign_id, user_id) references public.campaigns (id, user_id) on delete cascade,
  foreign key (analysis_run_id, user_id) references public.analysis_runs (id, user_id) on delete cascade,
  foreign key (creator_candidate_id, user_id) references public.creator_candidates (id, user_id) on delete cascade,
  unique (analysis_run_id, creator_candidate_id),
  check (campaign_fit_score is null or campaign_fit_score between 0 and 100)
);

create index if not exists campaigns_user_created_idx
  on public.campaigns (user_id, created_at desc);
create index if not exists campaigns_user_status_idx
  on public.campaigns (user_id, status);
create index if not exists analysis_runs_campaign_created_idx
  on public.analysis_runs (campaign_id, created_at desc);
create index if not exists analysis_runs_user_status_idx
  on public.analysis_runs (user_id, status);
create index if not exists analysis_runs_provider_run_idx
  on public.analysis_runs (provider_run_id)
  where provider_run_id is not null;
create index if not exists creator_candidates_run_idx
  on public.creator_candidates (analysis_run_id, created_at);
create index if not exists creator_matches_run_rank_idx
  on public.creator_matches (analysis_run_id, rank);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

drop trigger if exists analysis_runs_set_updated_at on public.analysis_runs;
create trigger analysis_runs_set_updated_at
before update on public.analysis_runs
for each row execute function public.set_updated_at();

drop trigger if exists culture_profiles_set_updated_at on public.culture_profiles;
create trigger culture_profiles_set_updated_at
before update on public.culture_profiles
for each row execute function public.set_updated_at();

drop trigger if exists creator_candidates_set_updated_at on public.creator_candidates;
create trigger creator_candidates_set_updated_at
before update on public.creator_candidates
for each row execute function public.set_updated_at();

drop trigger if exists creator_matches_set_updated_at on public.creator_matches;
create trigger creator_matches_set_updated_at
before update on public.creator_matches
for each row execute function public.set_updated_at();

alter table public.campaigns enable row level security;
alter table public.analysis_runs enable row level security;
alter table public.culture_profiles enable row level security;
alter table public.creator_candidates enable row level security;
alter table public.creator_matches enable row level security;

drop policy if exists campaigns_select_own on public.campaigns;
create policy campaigns_select_own on public.campaigns
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists campaigns_insert_own on public.campaigns;
create policy campaigns_insert_own on public.campaigns
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists campaigns_update_own on public.campaigns;
create policy campaigns_update_own on public.campaigns
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists campaigns_delete_own on public.campaigns;
create policy campaigns_delete_own on public.campaigns
for delete to authenticated
using ((select auth.uid()) = user_id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'analysis_runs',
    'culture_profiles',
    'creator_candidates',
    'creator_matches'
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

revoke all on public.campaigns, public.analysis_runs, public.culture_profiles,
  public.creator_candidates, public.creator_matches from public, anon;
grant select, insert, update, delete on public.campaigns, public.analysis_runs,
  public.culture_profiles, public.creator_candidates, public.creator_matches to authenticated;
