# AI Classification Performance V2 — rollout

## Baseline (2026-11-05)
- Orchestrator execution 2599: 11m 17.6s, completed with zero opportunities.
- Collector 2600: 11m 10s, of which AI Intent Classifier consumed 652.8 seconds.
- OpenAI Chat Model called 29 times; slowest request lasted 607.2 seconds.
- Freelancer: 30 evaluated, 30 rejected; Google recovery correctly failed with 429 and 24-hour cooldown.
- Neither a timed-out model nor an API error should be labeled a buyer-quality rejection.

## n8n draft configuration
Workflow: `Opportunity Collector V1` (`lY5Xpce2mg5ABsy1`).
- Chat Model (same `gpt-5.6-luna`, same existing OpenAI credential): `options.timeout = 30000`, `options.maxRetries = 0`.
- AI Intent Classifier: `options.batching = {batchSize:3,delayBetweenBatches:0}`, `onError = continueRegularOutput`, `retryOnFail = false`.
- Attach Intent Classification: missing, errored, or malformed AI response => `ai_classification_status=unavailable`, `gate_pass=false`, `gate_reason=ai_classification_unavailable`.
- Build Source Rejected Event: transient `ai_classification_unavailable` produces a `classification_error` event, never `rejected`. All other rejection rules unchanged.
- Source strategy view subtracts `classification_error` from total `evaluated` so temporary model failures do not lower apparent qualification rate.

## Evidence and limitations
- Manual n8n mock `74DdBqTYLM8tGvpB` execution `2607` passed. It ran the **actual** Attach Intent Classification and Build Source Rejected Event scripts against a simulated model timeout; produced `classification_error`, no external requests.
- The database migration `ai_classification_performance_v2` has been applied. Existing source strategy view read was successful after migration, with baseline count still 340 evaluated/43 qualified/297 rejected for Freelancer.
- The draft is **not a proven production speed-up**. A live run may still be slow due to 29+ serial/batched model calls, extraction parsing, rate limits, or account/model-level behavior; max execution duration is not guaranteed.
- A model timeout is a technical failure. Do not retry an entire run blindly or reclassify failed items as rejected; future follow-up should make transient failures retryable with a controlled queue.
- Model remains unchanged: no evidence-based accuracy comparison with an alternative model is available.
- This migration is idempotent when rerun after merge but should be reviewed for role/view grants and security invoker behavior.
- Production SerpApi recovery and Freelancer acquisition logic must remain unchanged.

## Verification before publish
1. PR review and GitHub checks pass.
2. n8n draft remains distinct from the previously published active version `477d7702-cd35-4f95-a4bf-7840826d7fdd`.
3. Reconfirm classifier timeout=30000, retries=0, batchSize=3; test malformed output => technical error.
4. Publish the reviewed draft, verify new `activeVersionId`, and keep old active version for rollback.
5. When user authorizes the next Find Opportunities run, inspect total duration, AI timeout count, qualified/rejected/technical error split, and source quota. Do not run expensive API tests merely to exercise timeouts.
6. If classification errors are frequent, revert model timeout upward or use an asynchronous retry queue after verifying model latency, not by raising high-confidence opportunity scores.

## Rollback
Republish workflow version `477d7702-cd35-4f95-a4bf-7840826d7fdd` if model errors or missing opportunities spike. Leave the already deployed database enum/view migration: it preserves all existing event types and current view columns.
