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
  target_demographics text not null,
  tone_guidelines text not null,
  budget_currency text not null,
  budget_amount numeric(12, 2) not null,
  start_date date not null,
  end_date date not null,
  status public.campaign_status not null default 'queued',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint campaigns_dates_check check (end_date >= start_date),
  constraint campaigns_budget_positive check (budget_amount > 0)
);

create table if not exists public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  user_id uuid not null,
  status public.run_status not null default 'queued',
  current_stage public.workflow_stage not null default 'queued',
  error_message text,
  raw_provider_payload jsonb,
  provider_run_id text,
  retry_count integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  foreign key (campaign_id, user_id) references public.campaigns (id, user_id) on delete cascade
);

create table if not exists public.culture_profiles (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  analysis_run_id uuid not null,
  user_id uuid not null,
  archetype text not null,
  core_traits jsonb not null default '[]'::jsonb,
  communication_style text not null,
  cultural_sensitivities jsonb not null default '[]'::jsonb,
  values jsonb not null default '[]'::jsonb,
  preferred_platforms jsonb not null default '[]'::jsonb,
  interests jsonb not null default '[]'::jsonb,
  summary text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  foreign key (campaign_id, user_id) references public.campaigns (id, user_id) on delete cascade,
  foreign key (analysis_run_id, user_id) references public.analysis_runs (id, user_id) on delete cascade,
  constraint culture_profiles_run_unique unique (analysis_run_id)
);

create table if not exists public.creator_candidates (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  analysis_run_id uuid not null,
  user_id uuid not null,
  provider text not null,
  provider_creator_id text not null,
  name text not null,
  handle text not null,
  platform text not null,
  profile_url text not null,
  bio text,
  avatar_url text,
  audience_size integer,
  match_reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  foreign key (campaign_id, user_id) references public.campaigns (id, user_id) on delete cascade,
  foreign key (analysis_run_id, user_id) references public.analysis_runs (id, user_id) on delete cascade,
  constraint creator_candidates_run_provider_unique unique (analysis_run_id, provider, provider_creator_id)
);

create table if not exists public.creator_matches (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  analysis_run_id uuid not null,
  creator_candidate_id uuid not null,
  user_id uuid not null,
  campaign_fit_score numeric(5, 2) not null,
  culture_fit_score numeric(5, 2) not null,
  brand_alignment_score numeric(5, 2) not null,
  confidence_score numeric(5, 2) not null,
  strengths jsonb not null default '[]'::jsonb,
  concerns jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  foreign key (campaign_id, user_id) references public.campaigns (id, user_id) on delete cascade,
  foreign key (analysis_run_id, user_id) references public.analysis_runs (id, user_id) on delete cascade,
  foreign key (creator_candidate_id, user_id) references public.creator_candidates (id, user_id) on delete cascade,
  constraint creator_matches_run_candidate_unique unique (analysis_run_id, creator_candidate_id),
  constraint creator_matches_campaign_fit_score_check check (campaign_fit_score between 0 and 100),
  constraint creator_matches_culture_fit_score_check check (culture_fit_score between 0 and 100),
  constraint creator_matches_brand_alignment_score_check check (brand_alignment_score between 0 and 100),
  constraint creator_matches_confidence_score_check check (confidence_score between 0 and 100)
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_campaigns_updated_at on public.campaigns;
create trigger set_campaigns_updated_at
before update on public.campaigns
for each row execute procedure public.set_updated_at();

drop trigger if exists set_analysis_runs_updated_at on public.analysis_runs;
create trigger set_analysis_runs_updated_at
before update on public.analysis_runs
for each row execute procedure public.set_updated_at();

drop trigger if exists set_culture_profiles_updated_at on public.culture_profiles;
create trigger set_culture_profiles_updated_at
before update on public.culture_profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists set_creator_candidates_updated_at on public.creator_candidates;
create trigger set_creator_candidates_updated_at
before update on public.creator_candidates
for each row execute procedure public.set_updated_at();

drop trigger if exists set_creator_matches_updated_at on public.creator_matches;
create trigger set_creator_matches_updated_at
before update on public.creator_matches
for each row execute procedure public.set_updated_at();

create index if not exists campaigns_user_id_idx on public.campaigns (user_id);
create index if not exists campaigns_user_status_idx on public.campaigns (user_id, status);
create index if not exists campaigns_id_user_id_idx on public.campaigns (id, user_id);

create index if not exists analysis_runs_user_id_idx on public.analysis_runs (user_id);
create index if not exists analysis_runs_campaign_id_idx on public.analysis_runs (campaign_id);
create index if not exists analysis_runs_id_user_id_idx on public.analysis_runs (id, user_id);
create index if not exists analysis_runs_status_idx on public.analysis_runs (status);
create index if not exists analysis_runs_provider_run_idx on public.analysis_runs (provider_run_id) where provider_run_id is not null;

create index if not exists culture_profiles_campaign_id_idx on public.culture_profiles (campaign_id);
create index if not exists culture_profiles_analysis_run_id_idx on public.culture_profiles (analysis_run_id);
create index if not exists culture_profiles_id_user_id_idx on public.culture_profiles (id, user_id);

create index if not exists creator_candidates_campaign_id_idx on public.creator_candidates (campaign_id);
create index if not exists creator_candidates_analysis_run_id_idx on public.creator_candidates (analysis_run_id);
create index if not exists creator_candidates_id_user_id_idx on public.creator_candidates (id, user_id);
create index if not exists creator_candidates_provider_creator_idx on public.creator_candidates (provider, provider_creator_id);

create index if not exists creator_matches_campaign_id_idx on public.creator_matches (campaign_id);
create index if not exists creator_matches_analysis_run_id_idx on public.creator_matches (analysis_run_id);
create index if not exists creator_matches_creator_candidate_id_idx on public.creator_matches (creator_candidate_id);
create index if not exists creator_matches_id_user_id_idx on public.creator_matches (id, user_id);
create index if not exists creator_matches_culture_fit_score_idx on public.creator_matches (culture_fit_score desc);

alter table public.campaigns enable row level security;
alter table public.analysis_runs enable row level security;
alter table public.culture_profiles enable row level security;
alter table public.creator_candidates enable row level security;
alter table public.creator_matches enable row level security;

create policy "authenticated_users_manage_own_campaigns"
on public.campaigns
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "authenticated_users_manage_own_analysis_runs"
on public.analysis_runs
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "authenticated_users_manage_own_culture_profiles"
on public.culture_profiles
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "authenticated_users_manage_own_creator_candidates"
on public.creator_candidates
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "authenticated_users_manage_own_creator_matches"
on public.creator_matches
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on public.campaigns from public, anon;
revoke all on public.analysis_runs from public, anon;
revoke all on public.culture_profiles from public, anon;
revoke all on public.creator_candidates from public, anon;
revoke all on public.creator_matches from public, anon;

grant select, insert, update, delete on public.campaigns to authenticated;
grant select, insert, update, delete on public.analysis_runs to authenticated;
grant select, insert, update, delete on public.culture_profiles to authenticated;
grant select, insert, update, delete on public.creator_candidates to authenticated;
grant select, insert, update, delete on public.creator_matches to authenticated;
