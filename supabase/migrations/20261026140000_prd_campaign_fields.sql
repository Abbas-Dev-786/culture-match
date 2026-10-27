alter table public.campaigns
  add column if not exists product_description text not null default '';

alter table public.campaigns
  add column if not exists min_budget numeric(14,2);

alter table public.campaigns
  drop constraint if exists campaigns_min_budget_check;
alter table public.campaigns
  add constraint campaigns_min_budget_check
  check (min_budget is null or min_budget > 0);

alter table public.campaigns
  drop constraint if exists campaigns_budget_range_check;
alter table public.campaigns
  add constraint campaigns_budget_range_check
  check (min_budget is null or max_budget is null or min_budget <= max_budget);

alter table public.campaigns
  drop constraint if exists campaigns_qloo_age_range_check;
alter table public.campaigns
  add constraint campaigns_qloo_age_range_check
  check (qloo_age_range is null or qloo_age_range in ('25_to_34', '35_and_younger', '36_to_55', '55_and_older'));
