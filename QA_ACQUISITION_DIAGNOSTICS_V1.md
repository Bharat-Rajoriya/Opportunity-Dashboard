# Acquisition Diagnostics V1 — PR #37

## Purpose
Explain where acquired candidates stop progressing **without** changing discovery, qualification, scoring, filtering or outreach. The existing `public.source_candidate_events` table is the source of truth.

## What the migration adds
- `public.acquisition_run_funnel_v1`: one row per workspace / search profile / engine execution / source, containing evaluated, rejected, qualified, created, duplicate and other **event** counts.
- `public.acquisition_rejection_reasons_v1`: one row per workspace / search profile / execution / source / rejection reason.
- Views run with invoker security and inherit `source_candidate_events` row-level security (workspace ownership via `auth.uid()`). Only authenticated roles can SELECT the views; no anonymous access.

**Important:** Each candidate may emit more than one stage event. Do not add the columns together, interpret them as unique candidates, or call event ratios unique-lead conversion rates. Ratios can be NULL when the denominator is zero. The views do not determine whether a source request failed before candidates were emitted.

## Observed on production before implementation (2026-11-05)
The existing data showed 52 stored Freelancer opportunities and 16 stored Google opportunities (not necessarily all newly collected).
- Run `2562`, Freelancer: 30 evaluated, 22 rejected, 8 qualified, 6 created, 2 duplicates.
- Run `2571`, Freelancer: 30 evaluated, 22 rejected, 8 qualified, 0 created, 8 duplicates.
These are event counts and were obtained by read-only queries. No production schema or workflow was modified as part of the investigation.

## Post-migration SQL verification (run under an authenticated workspace owner)
```sql
select master_execution_id, source, evaluated_events, rejected_events,
       qualified_events, created_events, duplicate_events,
       qualification_event_ratio_pct
from public.acquisition_run_funnel_v1
order by last_event_at desc limit 20;

select master_execution_id, source, rejection_reason, rejected_events
from public.acquisition_rejection_reasons_v1
order by last_rejected_at desc limit 30;
```

## Release checklist
- [ ] Apply migration to a staging database; verify syntax on PostgreSQL 17.
- [ ] Verify authenticated workspace owner sees only their own workspace data.
- [ ] Verify an unrelated authenticated user cannot see another workspace's data.
- [ ] Verify anonymous requests cannot query either view.
- [ ] Verify run `2562` counts match the existing events (if staging has equivalent data).
- [ ] Confirm no n8n workflow, lead scoring threshold, source API quota, or outreach action changed.
- [ ] Deploy migration through the normal release process **after** PR review.

## Known diagnostic gaps — explicitly not claimed by V1
1. Runs that fail before emitting any candidate events are not visible in these views; correlate with n8n execution failure logs.
2. The current schema records stage events but does not guarantee each event category represents an exactly-once candidate transition.
3. Event history alone does not reveal API quota exhaustion, source request latency, or search-query fetch counts.
4. The frontend does not yet display these views. A subsequent PR can add an owner-facing diagnostics panel once access and event semantics are verified.

## Recommended next increments
1. Surface per-run and per-source stage counts in a protected operator diagnostics screen.
2. Add run-start/run-end/fetch-error telemetry to n8n with explicit API-error categories, without rewriting the candidate gate.
3. Only after observability improves, test acquisition changes against actual qualified-lead yield.
