# PR #78 — Lead Quality Validation & Findings

## Intent

This is an **evidence triage and validation workflow**, not a production
scoring change. It uses the human-review rubric from PR #77 and adds
deterministic prioritization of suspicious or incomplete source evidence.
It does not claim that an AI score is proof of buyer authenticity.

### Read-only production findings (9 Nov 2026)

| Evidence / source | Count |
| --- | ---: |
| Total stored opportunities | 121 |
| Freelancer | 96 |
| Google discovery | 24 |
| Upwork-labeled | 1 |
| Total scores ≥75 | 25 |
| High-scoring, research not complete | 24 |
| Records with research complete | 6 |
| Google records without recorded publication date | 24 / 24 |
| Google records with unknown/missing source type | 16 / 24 |
| Google records with no source-quality reason | 16 / 24 |
| Google records with a non-HTTPS absolute source URL | 1 |

**Concrete cases requiring manual inspection (NOT automatic rejection):**

- A Google result scored **86** has source_url beginning
  `/goto?url=...`. That is a relative redirect token, not an independently
  usable original source link. The application should not treat this as
  independently source-verified.
- A Google result scored **84**, titled **LOOKING FOR WHITE-LABEL PARTNERSHIP!**,
  could be a provider seeking a partner rather than a buyer seeking a service.
  Inspect the original post before judging; the title alone is insufficient.
- Some similar Freelancer URLs appear across **different workspaces**.
  Cross-workspace repetition is expected and is not evidence of a
  same-workspace duplicate bug. No deduplication policy changes are justified.
- Original social/marketplace pages were not consistently accessible to our
  available public browsing tools. No sampled record is labeled valid or
  invalid without original-post review.

The findings are metadata checks, **not measured false-positive rates**.
Google result pages do not provide reliable posted-at metadata in all cases.
The saved Upwork source label does not prove a direct Upwork API integration.

## Run locally

Use the same authorized read-only export process from
`docs/lead-quality-benchmark-pr77.md`, but include
`source_quality_reason` in the export:

```sql
select id, source, title, source_url, total_score,
       published_at, research_status, source_result_type,
       matched_service_id, budget_text, estimated_value_max,
       source_quality_reason
from public.opportunities
order by source, created_at desc;
```

Store the exported JSON only in the gitignored
`audit-private/opportunity-export.json`. Do not commit private exports,
contact data, or reviewer notes.

```sh
node scripts/lead-quality-validation.mjs findings audit-private/opportunity-export.json > audit-private/validation-findings.json
node scripts/lead-quality-validation.mjs queue audit-private/opportunity-export.json 6 > audit-private/validation-queue.json
```

The queue combines deterministic source × score-band sampling (six records
per existing stratum) with up to 25 critical anomalies: malformed/relative
source URLs or promotional-sounding titles. This *oversamples* anomalies,
so raw reviewed precision cannot be generalized to the whole database.

Every record begins `review_label: "uncertain"` and all review dimensions
as `unknown`. A high score or promotional phrase never changes the
verdict automatically. The additional
`reviewer_source_access`, `reviewer_checked_at` and
`reviewer_evidence_url` fields can hold manual observations.

## Human source-review protocol

1. Open the **original public source** (not just its snippet). If inaccessible,
   keep `source_authenticity: unknown` and `review_label: uncertain`.
2. Verify it is a genuine buyer seeking services, not a service advertisement,
   staff recruitment only, template page, or informational article.
3. Check actual business/service match, eligibility, provider/source status,
   and project freshness. Unknowns stay unknown; do not infer publication
   time from the data collection timestamp.
4. Record concise evidence for any definitive `valid` or `invalid` verdict
   using the PR #77 six dimensions. Never paste private contact information.
5. Run the already-shipped PR #77 report:
   ```sh
   node scripts/lead-quality-benchmark.mjs report audit-private/validation-queue.json > audit-private/adjudicated-report.json
   ```
6. Use decided labels to identify reproducible false positives. Independently
   review *rejected candidates* before making claims about recall.

This work has **not** yet supplied enough verified human decisions to
calculate reliable precision. Do not promise an improved score or acquisition
quality on the strength of these flags.

## Acceptance criteria

- Automated tests and full `npm run check` pass.
- No Supabase schema changes, writes, Edge deployment, new n8n workflows,
  paid AI calls, outreach, or UI features.
- The relative-link high scorer appears in the priority review queue.
- No lead is automatically declared valid or invalid.
- Evidence deficiencies are logged separately from actual reviewed failures.
- If at least 20 decisive, evidence-backed reviews become available, assess
  whether a narrow **separate** correction to source URL normalization or
  classification would address the measured failure mode.

## What should follow

Only after source review: prioritize a focused source-link normalization fix
if the relative redirect is reproducible in the acquisition pipeline, or
classifier accuracy fixes if the suspected promotional posts are confirmed
false positives. Avoid broad scoring changes without verified labels.
