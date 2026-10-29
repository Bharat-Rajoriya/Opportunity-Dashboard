alter table public.search_profiles
  add column if not exists enabled_sources text[] not null
    default array['google']::text[],
  add column if not exists source_preferences jsonb not null
    default '{}'::jsonb;

update public.search_profiles
set enabled_sources = array['google']::text[]
where enabled_sources is null
   or cardinality(enabled_sources) = 0;
