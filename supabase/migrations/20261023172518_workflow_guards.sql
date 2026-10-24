alter table public.analysis_runs
  add column if not exists provider_start_claim_token text,
  add column if not exists provider_start_claimed_until timestamptz;

create index if not exists analysis_runs_provider_start_claim_idx
  on public.analysis_runs (provider_start_claimed_until)
  where provider_run_id is null;

create index if not exists analysis_runs_campaign_user_fk_idx
  on public.analysis_runs (campaign_id, user_id);

create index if not exists culture_profiles_campaign_user_fk_idx
  on public.culture_profiles (campaign_id, user_id);
create index if not exists culture_profiles_run_user_fk_idx
  on public.culture_profiles (analysis_run_id, user_id);
create index if not exists culture_profiles_user_fk_idx
  on public.culture_profiles (user_id);

create index if not exists creator_candidates_campaign_user_fk_idx
  on public.creator_candidates (campaign_id, user_id);
create index if not exists creator_candidates_run_user_fk_idx
  on public.creator_candidates (analysis_run_id, user_id);
create index if not exists creator_candidates_user_fk_idx
  on public.creator_candidates (user_id);

create index if not exists creator_matches_campaign_user_fk_idx
  on public.creator_matches (campaign_id, user_id);
create index if not exists creator_matches_run_user_fk_idx
  on public.creator_matches (analysis_run_id, user_id);
create index if not exists creator_matches_candidate_user_fk_idx
  on public.creator_matches (creator_candidate_id, user_id);
create index if not exists creator_matches_user_fk_idx
  on public.creator_matches (user_id);
