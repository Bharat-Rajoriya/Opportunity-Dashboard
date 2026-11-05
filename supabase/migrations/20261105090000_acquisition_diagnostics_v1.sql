-- Acquisition Diagnostics V1
-- Reporting only. No changes to collection, scoring, qualification or outreach.
-- Each event type is a stage observation, NOT a mutually exclusive candidate set.
-- Security-invoker views preserve the underlying source_candidate_events RLS rules.
create or replace view public.acquisition_run_funnel_v1
with (security_invoker = true)
as
select
  workspace_id,
  search_profile_id,
  master_execution_id,
  source,
  min(created_at) as first_event_at,
  max(created_at) as last_event_at,
  count(*) filter (where event_type = 'evaluated')::bigint as evaluated_events,
  count(*) filter (where event_type = 'rejected')::bigint as rejected_events,
  count(*) filter (where event_type = 'qualified')::bigint as qualified_events,
  count(*) filter (where event_type = 'created')::bigint as created_events,
  count(*) filter (where event_type = 'duplicate')::bigint as duplicate_events,
  count(*) filter (
    where event_type not in ('evaluated','rejected','qualified','created','duplicate')
       or event_type is null
  )::bigint as other_events,
  count(distinct candidate_key) filter (where candidate_key is not null)::bigint as distinct_candidate_keys,
  round(
    100.0 * count(*) filter (where event_type = 'qualified')
    / nullif(count(*) filter (where event_type = 'evaluated'),0), 1
  ) as qualification_event_ratio_pct,
  round(
    100.0 * count(*) filter (where event_type = 'created')
    / nullif(count(*) filter (where event_type = 'qualified'),0), 1
  ) as creation_event_ratio_pct
from public.source_candidate_events
where master_execution_id is not null
  and master_execution_id <> ''
group by workspace_id, search_profile_id, master_execution_id, source;

comment on view public.acquisition_run_funnel_v1 is
  'Per workspace, search profile, run and source: event-stage totals, NOT unique-candidate conversion rates. Empty/null ratios mean the denominator was zero.';

create or replace view public.acquisition_rejection_reasons_v1
with (security_invoker = true)
as
select
  workspace_id,
  search_profile_id,
  master_execution_id,
  source,
  coalesce(nullif(gate_reason,''), 'unspecified') as rejection_reason,
  count(*)::bigint as rejected_events,
  count(distinct candidate_key) filter (where candidate_key is not null)::bigint as distinct_candidate_keys,
  max(created_at) as last_rejected_at
from public.source_candidate_events
where event_type = 'rejected'
  and master_execution_id is not null
  and master_execution_id <> ''
group by workspace_id, search_profile_id, master_execution_id, source,
         coalesce(nullif(gate_reason,''), 'unspecified');

comment on view public.acquisition_rejection_reasons_v1 is
  'Rejected event counts by run and reason; underlying source_candidate_events RLS applies.';

-- Never expose diagnostic views to anonymous or unrestricted PUBLIC roles.
revoke all on public.acquisition_run_funnel_v1 from public, anon;
revoke all on public.acquisition_rejection_reasons_v1 from public, anon;
grant select on public.acquisition_run_funnel_v1 to authenticated;
grant select on public.acquisition_rejection_reasons_v1 to authenticated;
