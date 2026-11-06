# Production validation: Qualification V3.1 / Research completeness

Verified master execution **2639** (2026-11-06): orchestrator 2m42s, collector 1m40s, final scoring and pitch generation completed successfully. 30 Freelancer candidates evaluated, 6 qualified, 4 created, 2 duplicates, 24 rejected, 0 classification errors. One fixed-price Elementor opportunity received a draft; two priced hourly opportunities stayed review-only.

## V3.1 hourly budget edge case
Created hourly opportunity 40805448 lacked an upper rate. Its stored `budget_review.required=false` despite `budget_review.unit=hour` and unverified total. It was fortunately classified `research`, but this is unsafe if scoring thresholds change. V3.1 correctly flags **every hourly listing** for review regardless of a published maximum, persists missing rate as `null` instead of zero, and only treats a fixed project total as verified when there is a positive maximum. Previous V3 fixed-price and language gates remain.

Verified n8n manual replay **2647** of the historical missing-rate project: review required, hourly maximum `null`, total-project budget not verified; zero model/provider calls. The collector draft is *not published*. The final scoring V3 review cap is already live and needs no modification.

## Research production validation
Newly created opportunities: 4/4 have `research_status=partial` and `research_confidence=0.7`. Execution **2644** of enrichment processed four opportunities, all went through `Can Research Company?` **false** -> `Partial Research`; the real SerpApi search node did not run. Reason: a prior HTTP 429 has a cooldown until 2026-11-06 11:43 UTC (17:13 IST). Do not bypass or reset cooldown or run paid tests to change this.

### Next risk to address separately
Research workflow `Q1MQ3Lx1C9ABAdjW` still uses `Record SerpApi Cooldown (Research)` as a direct write to `external_provider_circuits`. Replace it with service-role guarded RPC and lease-aware claim/completion BEFORE allowing the research path to resume, consistent with the collector. Do not publish changes merely to improve the 'partial' count. Company research is supplemental; incomplete buyer identity must not be guessed.

## Release
Review and merge this PR, then publish the current collector draft after checking it matches the two n8n snapshots. Verify active version and run one authorized Find Opportunities test (not another scheduled/manual all-workspaces trigger). Existing records remain unchanged; do not retroactively re-label without an audited migration. The .n8n.txt snapshots intentionally represent Code-node bodies, which allow top-level return inside n8n and are not standalone JS modules.
