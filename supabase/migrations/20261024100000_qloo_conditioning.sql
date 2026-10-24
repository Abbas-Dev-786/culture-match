alter table public.campaigns
  add column if not exists qloo_audience_ids text[] not null default '{}',
  add column if not exists qloo_audience_weight numeric(8, 2),
  add column if not exists qloo_age_range text,
  add column if not exists qloo_gender text;

alter table public.campaigns
  drop constraint if exists campaigns_qloo_audience_weight_check,
  drop constraint if exists campaigns_qloo_age_range_check,
  drop constraint if exists campaigns_qloo_gender_check;

alter table public.campaigns
  add constraint campaigns_qloo_audience_weight_check
    check (qloo_audience_weight is null or qloo_audience_weight > 0 and qloo_audience_weight <= 100),
  add constraint campaigns_qloo_age_range_check
    check (qloo_age_range is null or qloo_age_range in ('35_and_younger', '36_to_55', '55_and_older')),
  add constraint campaigns_qloo_gender_check
    check (qloo_gender is null or qloo_gender in ('male', 'female'));
