alter table public.analysis_runs
  add column if not exists baseline_provider_run_id text,
  add column if not exists baseline_provider_dataset_id text;

create index if not exists analysis_runs_baseline_provider_run_idx
  on public.analysis_runs (baseline_provider_run_id)
  where baseline_provider_run_id is not null;

alter table public.creator_candidates
  add column if not exists search_variant text not null default 'culture_informed';

alter table public.creator_candidates
  add constraint creator_candidates_search_variant_check
  check (search_variant in ('baseline', 'culture_informed'));

alter table public.creator_candidates
  drop constraint if exists creator_candidates_analysis_run_id_provider_provider_creator_id_key;

alter table public.creator_candidates
  add constraint creator_candidates_run_provider_variant_key
  unique (analysis_run_id, provider, provider_creator_id, search_variant);

create index if not exists creator_candidates_run_variant_idx
  on public.creator_candidates (analysis_run_id, search_variant, created_at);

alter table public.creator_matches
  add column if not exists score_algorithm_version text not null default 'phase3-v1',
  add column if not exists evidence_completeness numeric(8, 4) not null default 0,
  add column if not exists caveats jsonb not null default '[]'::jsonb,
  add column if not exists campaign_concept jsonb,
  add column if not exists comparison_metadata jsonb not null default '{}'::jsonb;

alter table public.creator_matches
  drop constraint if exists creator_matches_campaign_fit_score_check;
alter table public.creator_matches
  add constraint creator_matches_campaign_fit_score_check
  check (campaign_fit_score is null or campaign_fit_score between 0 and 100);

alter table public.creator_matches
  add constraint creator_matches_evidence_completeness_check
  check (evidence_completeness between 0 and 1);
