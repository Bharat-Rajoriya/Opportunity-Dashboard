# Qualification Quality V3 — price units, eligibility reasons, and safe review

## Findings from 2026-11-05 execution 2608/2609
- The run evaluated 30 Freelancer candidates and rejected 27 (3 qualified).
- 6 rejection events came from fixed-budget minimum checks (3 unique project IDs).
- 5 were language mismatches, but 3 also lacked a credible matching service. A provider eligibility reason previously masked an unsupported-service rejection.
- The example project 40804189 was **hourly** (USD 8–15/hour, 20 hours/week commitment); its hourly maximum was incorrectly compared against the user's INR 35,000 minimum **total project value** and rejected.
- Project 40804260 (USD 10–30 **fixed**) and 40804352 (INR 1,500–12,500 **fixed**) remain below the configured INR 35,000 service minimum.
- French language example 40804132 is hourly and plausibly service-matched, but still requires a language the provider does not list. Do not turn it into an eligible lead.

## Changes made in n8n drafts
Collector: `lY5Xpce2mg5ABsy1`
- `Attach Intent Classification`: detect hourly through marketplace `source_payload.type` or `project_type`. Do not compare **rate per hour** with **project minimum**; unknown total is flagged `budget_review_required=true` and `commercial_fit=hourly_rate_review_required`. Do not infer a project total from weekly hours without duration. Fixed budgets retain both existing minimum and scope-adjusted budget gates.
- Evaluate buyer/service fit *before* eligibility when selecting the rejection reason, without changing the eligibility rejection gate. Unsupported services show their actual cause.
- `Preliminary Opportunity Score`: for unverified hourly total, cap recommended action at `review` (not pitch or high_priority_pitch), and include the unit and warning in the commercial score breakdown.
- `Prepare Database Record`: persist `raw_payload.budget_review` with required/unit/fit/reason/recorded hourly maximum/currency/total_project_budget_verified.

Final Scoring: `gP9uaThwYFX0xnhB`
- `Calculate Final Score`: if `raw_payload.budget_review.required`, cap final recommendation at `review` (unless already `skip`). Existing pitch workflow selects only `pitch` actions; this prevents automatically drafting a pitch for unverified hourly totals.

Scripts in `n8n/qualification-v3/` are **exact node-code snapshots** of the two n8n drafts, NOT automatically deployed by merging this PR.

## Verification
- Manual workflow `tK6vE69SZqb8xcrX`, execution **2617**: five actual historical candidate fixtures replayed with their saved AI outputs, no AI or provider calls. One hourly service fit accepted with budget warning, four remained rejected, including low fixed budgets and a French-language mismatch.
- Manual workflow `PSUDhhErT47vOQK6`, execution **2618**: hourly candidate score 72 but recommendation `review`, zero API calls.
- Manual workflow `Lp0tRrOlTDUcpeFi`, execution **2619**: actual final-scoring code with mocked prior fit scores yielded recommendation `review`, no AI or provider calls.
- This does NOT demonstrate live qualification lift until a controlled discovery run after activation. It does not override users' explicit rejection rules or invent contract value.

## Publish / rollback
- Current published collector version must be verified before publishing its draft.
- Publish BOTH collector and Final Scoring drafts after PR review, then confirm active versions.
- Do not automatically run the scheduled or webhook discovery path just to test this release.
- If V3 unexpectedly admits irrelevant leads or creates unwanted auto-pitches, republish the two prior active versions independently. Keep source data unchanged.
- Hourly opportunities must show a commercial uncertainty warning in the dashboard before manual outreach; the raw payload is persisted, but frontend presentation has not been independently verified here.
