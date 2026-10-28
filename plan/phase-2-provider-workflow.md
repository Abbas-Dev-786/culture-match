# Phase 2 — Provider Adapters and Analysis Workflow

**Purpose:** Connect the validated Qloo and Apify contracts to a resumable, observable analysis workflow.

**Depends on:** Phases 0 and 1

**Exit condition:** A campaign can execute Qloo research and an asynchronous Apify run, persist each stage, recover from transient errors, and expose progress through the application status endpoint.

## Build order

### P2-01 — Implement Qloo parsing against fixtures

Create:

- `lib/tools/qloo/client.ts`
- `lib/tools/qloo/resolve-entities.ts`
- `lib/tools/qloo/analyze-culture.ts`
- `lib/validation/provider-payloads.ts`

Make fixture tests pass before enabling live calls. Add explicit handling for unresolved references, empty signals, invalid parameters, rate limits, and schema mismatch.

### P2-02 — Implement Apify lifecycle against fixtures

Create:

- `lib/tools/apify/client.ts`
- `lib/tools/apify/search-creators.ts`
- `lib/tools/apify/get-run-results.ts`

First test start/status/dataset behavior with fixtures. Then enable the live actor behind the same interface. Persist the actor run ID before any wait or poll operation.

### P2-03 — Connect the workflow stages

Create `lib/workflow/run-campaign-analysis.ts` and connect the state machine to the provider adapters. Every stage must persist its result before advancing. A process restart must be able to resume from the last completed stage.

### P2-04 — Add retries, budgets, and idempotency

Create `lib/workflow/retry.ts` and a provider error classifier. Add per-provider timeout, retry, result-count, and cost limits. Guard actor-start with the analysis idempotency key.

### P2-05 — Add search-plan generation and fallback

Create the search-plan schema and model wrapper. Validate every generated filter against the Phase 0 actor field matrix. Add a deterministic fallback query that works without the model.

### P2-06 — Connect status and recovery

Update status/retry routes to read persisted state and create explicit retry attempts. Add a controlled development-only mechanism for advancing or polling a run without making the browser responsible for provider execution.

## 1. Implement the Qloo adapter

Create isolated modules for:

- Entity search and resolution.
- Location signal construction.
- Taste/Insights request construction.
- Response parsing.
- Evidence normalization.

Adapter rules:

- Use server-side `fetch` or the selected official client.
- Read base URL and API key from server-only environment variables.
- Construct only allowlisted paths and parameters.
- Validate `filter.type` combinations before sending requests.
- Persist request summaries without secrets.
- Preserve the raw response only under the retention policy.
- Return explicit unresolved and ambiguous results.
- Never silently replace a user reference with a low-confidence entity.

Implement safe error classes for:

- Authentication failure.
- Invalid parameter combination.
- Rate limit.
- Timeout/network failure.
- Empty result.
- Response-schema mismatch.

## 2. Implement the Apify adapter

Create isolated modules for:

- Actor input validation.
- Actor start.
- Run status retrieval.
- Default dataset retrieval.
- Dataset item validation and normalization.

Adapter rules:

- Start the actor only from the workflow, never from a browser poll.
- Persist actor run ID and dataset ID immediately after start.
- Use the actor schema discovered in Phase 0.
- Apply the server-enforced candidate limit and cost guard.
- Treat `SUCCEEDED`, `FAILED`, `ABORTED`, `TIMED-OUT`, and running states explicitly.
- Read dataset items only after successful completion.
- Preserve source fields needed for provenance, but apply raw-payload retention limits.
- Do not assume bio, language, audience geography, engagement, fees, or post content exists.

## 3. Build the workflow runner

Implement a bounded workflow with these stages:

1. Create or load the campaign/run.
2. Resolve brand and cultural references.
3. Execute validated Qloo research.
4. Store normalized culture signals.
5. Build and validate the broad creator-search plan without raw Qloo signal terms.
6. Start one broad Apify run using the idempotency key.
7. Advance status through internal polling, webhook, or the selected background mechanism.
8. Read and normalize dataset items.
9. Hand off to scoring.
10. Let the critic decide whether one bounded refinement search is justified, then generate the report only after scored results exist.

The workflow must be safe to resume after a process restart. Each stage should be idempotent or guarded by a persisted stage result.

## 4. Implement retries and timeouts

Retry only transient conditions:

- HTTP 429.
- Selected 5xx responses.
- Temporary network failures.
- Provider timeouts where repeating is safe.

Do not automatically retry:

- Invalid input.
- Authentication failures.
- Unsupported Qloo parameters.
- Actor schema validation failures.
- Permanent provider errors.

For every retry, record attempt count, delay class, provider error code, and safe message. Enforce a maximum retry count and total run budget.

## 5. Implement the search-plan boundary

For broad discovery and optional agent-selected refinement:

- Provide only normalized campaign data and verified Qloo signals.
- Restrict output to a schema containing query text and supported actor filters.
- Reject unsupported filters and URLs.
- Do not let the model alter credentials, headers, endpoints, limits, or database writes.
- Preserve campaign constraints and allow at most one additional refinement search.

The initial query uses explicit campaign constraints without Qloo-derived terms. Qloo signals may be translated into a refinement query only when the creator-search agent selects `add_cultural_signals` and `ENABLE_AGENTIC_CREATOR_REFINEMENT=true`. The selected signal IDs, query, result count, and critic decision must be persisted.

## 6. Implement application status and recovery

The status endpoint should read the database only and return:

- Campaign ID.
- Analysis run ID.
- Current status and stage.
- Human-readable stage message.
- Updated timestamp.
- Safe error object, if any.
- Retry availability.

It must not start a provider run or perform an unbounded provider poll.

On refresh or reconnect, the UI should resume from the persisted status. On failure, the user should be able to start a new attempt without erasing the previous record.

## Tests and fixtures

- Qloo success, no-result, invalid-parameter, rate-limit, and schema-mismatch fixtures.
- Apify start, running, success, failure, abort, timeout, and dataset fixtures.
- Duplicate analyze requests create one provider run.
- Restarting a workflow resumes from the last persisted stage.
- Retries stop at the configured limit.
- Browser status polling never invokes actor start.
- Provider secrets never appear in logs, serialized errors, or client responses.
- A model-generated action cannot introduce unsupported filters, URLs, signal IDs, or weakened campaign constraints.
- Broad discovery remains valid when agentic refinement is disabled.

## Deliverables

- Qloo adapter.
- Apify adapter.
- Workflow runner and stage transitions.
- Retry and timeout utilities.
- Broad search-plan schema, agent action schema, and bounded refinement plan.
- Status and retry endpoints.
- Integration fixtures and tests.

## Exit checklist

- [ ] One campaign can complete Qloo research.
- [ ] One Apify run is started and persisted.
- [ ] Dataset results are loaded only after success.
- [ ] Workflow status survives process/page interruption.
- [ ] Provider failures are classified and safely surfaced.
- [ ] Duplicate requests do not create duplicate jobs.
- [ ] Broad discovery starts with one Apify run and no Qloo query terms.
- [ ] Optional refinement is bounded to one run and preserves campaign constraints.
- [ ] Agent action, selected signal IDs, critic outcome, and tool results are persisted.
