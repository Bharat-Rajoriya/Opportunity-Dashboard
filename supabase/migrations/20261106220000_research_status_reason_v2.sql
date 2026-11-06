-- Research Status & Provider Telemetry V2
-- Keep legacy research_status values unchanged for downstream scoring.
alter table public.opportunities
  add column if not exists research_detail_reason text;

alter table public.opportunities
  drop constraint if exists opportunities_research_detail_reason_check;

alter table public.opportunities
  add constraint opportunities_research_detail_reason_check
  check (research_detail_reason is null or research_detail_reason in (
    'company_identity_unverified',
    'provider_cooldown',
    'provider_recovery_denied',
    'provider_error',
    'source_only',
    'web_research_completed'
  ));

comment on column public.opportunities.research_detail_reason is
  'Sanitized research outcome explanation; never contains credentials, lease tokens, or raw provider payloads.';
