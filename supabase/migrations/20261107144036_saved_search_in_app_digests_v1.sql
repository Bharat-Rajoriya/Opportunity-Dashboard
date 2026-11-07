-- Applied to Supabase as migration 20261107144036.
-- Preferences affect on-demand in-app digest views ONLY.
-- No provider search, email notification, scheduled job, or webhook is created.
alter table public.saved_opportunity_searches
 add column if not exists in_app_digest_frequency text not null default 'off'
   check (in_app_digest_frequency in ('off','daily','weekly')),
 add column if not exists digest_started_at timestamptz,
 add column if not exists last_reviewed_at timestamptz;
create index if not exists saved_opportunity_searches_digest_enabled
 on public.saved_opportunity_searches(workspace_id,in_app_digest_frequency)
 where in_app_digest_frequency <> 'off';
