# Google Acquisition Quality V3 — controlled search improvements

## Evidence
The first verified SerpApi Account 2 Google recovery probe (master execution **2677**, collector **2678**) returned 7 results for the generated query `our WordPress website needs a secure backup disaster recovery and update process`. The seven were all rejected as `ai_not_opportunity`; example results were backup tutorials, recovery guides, plugin instructions and editorial advice, not actual hiring requests. The API and recovery lease both succeeded. An additional 15 Freelancer candidates were evaluated in the same run; no new opportunities were created.

## Root cause
Search profile query suggestions are full first-person descriptions of a desired website service. A broad Google search for those descriptions retrieves instructional content that repeats the problem statement; AI classification is then correctly rejecting this material. This is a search acquisition issue, not an invitation to weaken qualification or lower minimum intent.

## Draft n8n change
Collector workflow `lY5Xpce2mg5ABsy1`:
- `Google Source Enabled` derives `google_search_query` using recognized service and scope terms from the configured query, plus hiring-intent search expressions. Example: `"WordPress" "backup recovery" ("looking for" OR "need a developer" OR "hire a freelancer" OR "seeking a developer") -tutorial -guide -course -certification`.
- Retains the user's original `search_query` for source analytics, query cursor and downstream provenance. Never overwrites or persists AI-generated fake buyer evidence in the candidate.
- Explicit `site:` queries remain unchanged. When no supported service/topic is recognized, preserve the original rather than hallucinate a new one.
- `Google search` queries `google_search_query || search_query`.
- `Basic Pre-Filter` rejects only explicit editorial guide/tutorial headings without evidence of a real buyer, logging `editorial_not_buyer_request`; other candidates still go to unchanged AI and service/business gates.
- Account 2 recovery lease, cooldown and guarded first-probe rule unchanged; source traffic strategy retains its low-volume multiplier.

## Testing
Manual n8n mock execution **#2685** completed with two assertions:
1. Original backup and WooCommerce statements convert to buyer-intent phrases, explicit `site:` query passes through unchanged.
2. Two editorial examples are rejected; two buyer-demand examples pass.
All without SerpApi, AI or DB API calls. Repository regression tests repeat transformations and ensure single-probe recovery enforcement.

## Deployment/measurement
- Draft changes are **not activated** by merging this PR. Publish the reviewed collector draft after CI and merge.
- Run one authorized workspace-scoped Find Opportunities query using the dashboard. Compare Google `evaluated`, pre-filter editorial rejections, AI buyer classification rate, `qualified`, and `created` against the 7-evaluated/0-qualified baseline. Never treat a zero-result search as proof of higher quality.
- Existing Google 30-day quality-adjusted source pacing can keep traffic at its minimum. Do not raise query volume until a credible improvement in lead yield is measured.
- Risks: narrower hiring-intent expressions can miss opportunities phrased unusually, and Google ranking can vary. Monitor precision and coverage before adding more exclusions.
