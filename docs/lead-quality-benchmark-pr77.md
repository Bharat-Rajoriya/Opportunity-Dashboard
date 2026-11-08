# PR #77 — Lead Quality Benchmark V1

## Scope and methodology

This is a **read-only, offline** QA tool, not a new AI classifier, a scoring
change, or a dashboard feature. It measures data completeness separately from
human-verified lead quality. AI scores, `source_result_type`, and source labels
are hypotheses, **not ground-truth buyer verification**.

### Baseline captured 2026-11-09 (live production)

| Source | Rows | Average score | Score ≥75 | Research complete | Missing publication date |
| --- | ---: | ---: | ---: | ---: | ---: |
| Freelancer | 96 | 63.7 | 20 | 3 | 0 |
| Google | 24 | 67.8 | 5 | 3 | 24 |
| Upwork | 1 | 64.0 | 0 | 0 | 1 |
| **All** | **121** | — | **25** | **6** | **25** |

Additional system-wide observations: 20 lack a recorded budget, 16 lack a
source-quality reason, 24 of the 25 leads scoring ≥75 have incomplete
research, and all 121 have a persisted service match and source URL. The
single Upwork-labeled opportunity does **not** prove a working Upwork API
collector. The audit did not verify source pages or buyer identities.

**Meaning:** this is evidence-completeness instrumentation, not a claim that
115 leads are bad or that scores are calibrated. No provider re-fetch was
performed and no user record was modified.

## Private export

An authorized operator can run this **read-only** SQL in Supabase SQL Editor.
Do not copy the resulting data into GitHub issues, commits, chat, or public
storage. This query deliberately excludes email, phone, raw descriptions,
client names, workspace IDs, and raw AI payloads.

```sql
select id, source, title, source_url, total_score, published_at,
       research_status, source_result_type, matched_service_id,
       budget_text, estimated_value_max
from public.opportunities
order by source, created_at desc;
```

Export the query results to a JSON array in a **local, untracked file** such as
`audit-private/opportunity-export.json`. If your export tool wraps the array
as `{"data":[...]}`, the CLI also accepts that form.

## Run locally (Node.js; no external packages)

```sh
node scripts/lead-quality-benchmark.mjs baseline audit-private/opportunity-export.json > audit-private/baseline.json
node scripts/lead-quality-benchmark.mjs sample audit-private/opportunity-export.json 4 > audit-private/review-sample.json
```

Sampling uses SHA-256 ordering over record IDs for repeatability, capped at
four records in every **source × score band**: high (≥75), medium (50–74.999),
low (<50), or unknown. With sparse strata it selects the available count.
This is a *stratified convenience sample*, not a population-random
statistical sample. It favors coverage across sources, not proportionality;
do not report the pooled precision as a population estimate.

Inspect the **original posting** for each sample where possible. Manually
review the evidence and edit the review JSON:

- `buyer_intent`: Is a real customer asking to hire a provider for a
  specific project, rather than promoting services or posting information?
- `service_fit`: Is at least one service actually capable of meeting the
  stated requirements (not just sharing keywords)?
- `source_authenticity`: Can the cited source actually be inspected and
  corroborated? A plausible URL alone is not enough.
- `freshness`: Is the request currently open or clearly current?
- `eligibility`: Can the workspace bid given country, language and role
  constraints?
- `commercial_fit`: Is the scope/budget realistically acceptable?
  Unknown budget must remain unknown, not "yes."

Every dimension is `yes`, `no` or `unknown`. Each row's final
`review_label` is `valid`, `invalid`, or `uncertain`.

A **valid** label requires `yes` for buyer intent, service fit, source
authenticity, freshness, and eligibility. An **invalid** label needs at least
one documented `no`. When evidence is missing, mark **uncertain**.
All decisive labels must include a 15+ character factual
`review_evidence` explanation. Keep observations concise, factual, and
free of copied private customer details.

```sh
node scripts/lead-quality-benchmark.mjs report audit-private/review-sample.json > audit-private/quality-report.json
npm run check
```

The report includes review coverage, counts of unresolved records,
precision among **decided** labels, conservative valid fraction (unresolved
counted in denominator), by-source and by-score-band breakdowns, and
per-dimension failure counts. A denominator below 20 decided labels is
explicitly flagged as directional-only. Do not compare scores to review
labels as if this report independently measured the whole 121-lead pool.

## Recommended acceptance gate before changing production ranking

1. Review at least 20 **decided** samples with cited original evidence,
   including Google and Freelancer and both high/medium score bands.
2. Record examples of false positives/negatives and disagreement separately.
   A false negative recall estimate needs a **rejected candidate** sampling
   frame; saved accepted opportunities alone cannot measure recall.
3. Review whether high scores with incomplete research and Google unknown
   publication dates are disproportionately false positives or merely
   lacking metadata. Do not automatically down-score without evidence.
4. Require a second reviewer for disputed cases when practicable.
5. Propose **separate** scoring/provider fixes only when supported by actual
   errors and an expected benefit.

## Safety and privacy

No database migration, frontend integration, n8n graph change, provider
API call, automatic outreach or paid LLM call. The CLI reads only local
JSON and prints to stdout; it does not send requests or update Supabase.
Do not commit private exports or human-review notes, which may contain
source URLs. Use the Git-ignore directory below.

## Remaining limitations

The current quality sample has not been manually adjudicated. Until then,
**there is no validated precision estimate**. Dates and source-research
status are metadata signals, not independent verification. The production
manual capture end-to-end validation remains outstanding.
