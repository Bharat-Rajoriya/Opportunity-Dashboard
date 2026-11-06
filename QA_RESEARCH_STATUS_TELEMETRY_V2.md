# Research Status & Provider Telemetry V2

## Root cause
Execution #2651 reported healthy while 3/3 newly created opportunities were only partially enriched. The research stage #2656 did not invoke SerpApi Account 2: the shared provider circuit had been put back into 429 cooldown by the collector, and each listing lacked enough buyer/company evidence for verifiable company research. A plain `partial` label obscured both causes.

## New persisted field
`public.opportunities.research_detail_reason` is nullable and accepts only a sanitized enum:
- `company_identity_unverified`: source lacks a verifiable buyer/company identity, so an external company lookup was not attempted.
- `provider_cooldown`: a verified research target was deferred by the shared SerpApi cooldown.
- `provider_recovery_denied`: recovery claim was not authorized.
- `provider_error`: attempted external research failed.
- `source_only`: external research not attempted or not completed for an otherwise eligible target.
- `web_research_completed`: external web lookup and enrichment step completed; NOT a guarantee that all business details were verified.

Existing `research_status` remains pending/partial/complete/failed for scoring compatibility. No keys, lease tokens, HTTP response bodies, or privileged circuit rows are returned to browser clients.

## Backend
- Opportunity Enrichment V1 (`Q1MQ3Lx1C9ABAdjW`) now writes a reason in `Partial Research` or `Attach Full Research`, via `Update Opportunity Research` field mapping.
- Prioritize actual provider errors and unverified buyer identities. When a company is researchable, use cooldown/denied probe reason. Do not run another paid search for status reporting.
- Database migration `research_status_reason_v2` was applied; repository migration included for reproducibility.

## Frontend
- Main Opportunities list, outreach queue, and approved outreach fetch `research_detail_reason`.
- Opportunity cards and the detail drawer show concise, factual reasons.
- Historical null reasons use the label “Source-only research” and explicitly indicate that the specific reason was not recorded. No historical bulk backfill or invented classification.

## Validation
- Manual n8n mock workflow `tEo5qRkpXEqEwzen`, execution **#2659** passed: anonymous listing -> `company_identity_unverified`; verified company under cooldown -> `provider_cooldown`. Zero provider, AI, or database calls.
- Regression tests cover every supported reason and the legacy fallback.
- The research workflow is **draft only** until PR review and merge.
- During live validation, verify that new records persist reasons and frontend displays them. Older partial rows stay neutral unless explicitly reprocessed. No need to bypass SerpApi cooldown.

## Limitations / next iteration
- Source-only research can still produce a high `prospect_context_confidence` for the source *summary*. It is not proof of verified company identity.
- A global provider status widget would require a separate, role-restricted summary RPC or view, not direct client reads from `external_provider_circuits`.
- Does not automatically retry old partial records or create new web research when company identity is missing.
