alter table public.business_profiles
  add column if not exists provider_country text,
  add column if not exists working_languages text[] not null default '{}'::text[];

update public.business_profiles
set working_languages = array[preferred_language]::text[]
where coalesce(array_length(working_languages, 1), 0) = 0
  and nullif(trim(coalesce(preferred_language, '')), '') is not null;

alter table public.opportunities
  add column if not exists project_language text,
  add column if not exists eligibility_match text,
  add column if not exists eligibility_restriction_type text,
  add column if not exists required_country text,
  add column if not exists required_language text,
  add column if not exists eligibility_reason text;
