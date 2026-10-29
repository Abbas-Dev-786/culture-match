# LLM, Agent, and Tooling Implementation Goals

## Implementation status

All phases in this document are implemented in the live workflow. The model
search planner uses a bounded AI SDK `ToolLoopAgent`, every tool boundary uses
schema validation, provider requests are metered, enrichment is concurrent and
partially persisted, and the campaign UI exposes the resulting provenance and
usage. Validation currently passes with 78 tests, typecheck, lint, and a
production build.

## Objective

Use LLMs, agents, Qloo, Apify, and application tools as one validated workflow while preserving deterministic scoring, evidence integrity, campaign constraints, and predictable provider usage.

The existing Qloo campaign-to-market-to-creator matching logic is the foundation for this work. These goals improve the intelligence, orchestration, observability, and budget layers around it.

## Non-goals

- Do not replace deterministic creator scoring with model-generated scores.
- Do not allow models to access credentials, raw database clients, or unrestricted provider APIs.
- Do not weaken campaign constraints to satisfy a model-generated plan.
- Do not add feature flags for product behavior.
- Do not make model output authoritative over persisted provider evidence.

## Goals

### 1. Integrate model-generated creator search planning

- Call the existing model search-plan generator after Qloo campaign research.
- Use the model plan for Qloo-guided creator discovery.
- Keep baseline discovery deterministic and broad.
- Validate every model plan against the campaign and actor schemas.
- Reject URLs, unsupported filters, weakened constraints, and invalid result limits.
- Fall back automatically to the deterministic Qloo-guided plan when model planning is unavailable or invalid.
- Persist the plan source, selected Qloo signal IDs, query, and fallback reason.

### 2. Establish a central agent-tool execution contract

- Represent agent actions with strict input and output schemas.
- Validate every action before execution.
- Route provider work through named tools instead of scattered direct calls.
- Define tool ownership, provider, timeout, retry, idempotency, approval, and evidence behavior.
- Return normalized structured tool results to agents.
- Persist every executed action and its result summary.

### 3. Use AI SDK tool calling where it improves decisions

- Allow the cultural research agent to request bounded Qloo research actions.
- Allow the creator-search agent to inspect evidence, request enrichment, and propose one refinement.
- Keep the application responsible for executing tools and enforcing policy.
- Keep evidence-grounded reports structured and evidence constrained.
- Use deterministic fallback behavior when model credentials or model output are unavailable.

### 4. Make autonomy and provider budgets accurate

Track these separately:

- Agent actions
- Model calls
- Provider operations
- Actual external HTTP requests

Budget accounting must include creator enrichment, person validation, creator-to-campaign comparison, Qloo research, Apify searches, retries, and refinements without double-counting idempotent work.

Persist usage before and after each operation and stop safely with an actionable status when a budget is exhausted.

### 5. Make provider execution bounded and resilient

- Enrich the complete campaign creator result set up to the product limit.
- Use bounded concurrency for Qloo creator enrichment.
- Coalesce duplicate Qloo requests.
- Isolate individual creator/provider failures.
- Persist partial enrichment progress.
- Retry only retryable provider failures.
- Preserve completed evidence when later operations fail.

### 6. Make agent decisions auditable

Persist:

- Agent and model identity
- Decision mode
- Input summary
- Selected action
- Tool name
- Validated tool input
- Result summary
- Evidence counts
- Rejected actions
- Fallback reasons
- Approval state
- Budget usage

The audit trail must explain why a decision was made without exposing secrets or unsafe raw provider payloads.

### 7. Make the UX accurately reflect intelligence usage

Show users:

- Whether a search plan was model-generated or deterministic.
- Which Qloo signals influenced discovery.
- Which tools executed.
- Creator enrichment coverage.
- Provider and model usage.
- Refinement decisions and reasons.
- Fallback reasons.
- Creator-level Qloo evidence.

The UI must not claim model or Qloo behavior that did not actually occur.

### 8. Add regression and orchestration coverage

Test:

- Valid and invalid model search plans.
- Constraint preservation.
- Deterministic fallback.
- Tool input/output validation.
- Approval and idempotency behavior.
- Actual model and provider budget accounting.
- Retry and partial-failure behavior.
- Persisted agent traces.
- Two distinct initial discovery plans.
- Existing Qloo matching, scoring, persistence, and production build behavior.

## Execution order

1. Integrate and persist model-generated search plans.
2. Add the central tool-execution contract.
3. Route cultural research actions through the tool contract.
4. Route creator-search actions through the tool contract.
5. Implement accurate model/provider/request accounting.
6. Add bounded concurrency and partial enrichment persistence.
7. Persist complete agent traces and usage summaries.
8. Update the UX audit and usage display.
9. Add orchestration tests and run the complete validation suite.

## Completion criteria

This work is complete when:

- The model search-plan generator is used by the live campaign workflow.
- Every model-selected action executes through a validated tool boundary.
- Deterministic fallbacks work without feature flags.
- Budgets reflect actual work and cannot be bypassed by nested provider calls.
- Agent decisions and tool results are persisted and visible in the campaign audit trail.
- All campaign constraints remain enforced.
- Existing Qloo matching behavior remains passing and deterministic.
- Tests, typecheck, lint, and production build all pass.

## Delivered phase map

- Phase 1: model search planning is integrated after Qloo research and before
  the two initial Apify searches.
- Phase 2: `lib/agent/tool-execution.ts` provides the typed tool boundary, and
  the model planner executes through an AI SDK tool.
- Phase 3: research and creator-search agents retain bounded action selection;
  provider execution is isolated behind typed Qloo and Apify clients.
- Phase 4: request-level usage is recorded for Qloo, Apify, and model actions.
- Phase 5: Qloo enrichment runs with bounded concurrency, per-creator failure
  isolation, duplicate-content caching, and partial candidate persistence.
- Phase 6: persisted summaries and UX show plan source, Qloo signals, agent
  traces, fallback state, and actual provider-request usage.
- Phase 7: regression coverage and production validation are passing.
