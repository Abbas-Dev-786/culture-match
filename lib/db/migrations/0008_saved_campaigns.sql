alter table public.campaigns
  add column if not exists is_saved boolean not null default false;

create index if not exists campaigns_user_saved_updated_idx
  on public.campaigns (user_id, is_saved, updated_at desc);
