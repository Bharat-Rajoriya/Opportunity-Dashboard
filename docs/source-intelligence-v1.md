# Source Intelligence V1

Source Intelligence measures acquisition quality before downstream research and outreach.

## Candidate lifecycle

The Opportunity Collector records lightweight events in `source_candidate_events`:

- `evaluated` — candidate entered the qualification pipeline
- `rejected` — candidate failed the basic pre-filter or Quality v2 gate
- `qualified` — candidate passed Quality v2 and received a preliminary score
- `duplicate` — qualified candidate already existed in the workspace
- `created` — qualified candidate became a new opportunity

The event table intentionally does not store full candidate text or provider credentials. It stores only the source, run identifiers, candidate key, qualification metadata and score needed for acquisition analytics.

## Dashboard metrics

Search Settings shows a 30-day scorecard for each source:

- Evaluated candidates
- Qualified candidates and qualification rate
- Newly created opportunities
- Duplicate candidates and duplicate rate
- Average preliminary score for qualified candidates

The dashboard reads these events through workspace-scoped RLS. Frontend clients have no insert policy; event writes come from the server-side Opportunity Collector.

## Interpretation

Qualification rate answers: “How often does this source produce something worth considering?”

Duplicate rate answers: “How much of this source's qualified volume is repeated rather than net-new?”

Average preliminary score answers: “How strong are the qualified candidates before research?”

These metrics should guide source volume decisions, but V1 does not automatically increase or decrease source limits. Automated source allocation should be a later phase after enough production history exists.
