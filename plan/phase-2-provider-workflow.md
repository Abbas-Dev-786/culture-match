# Phase 2 — Qloo Research and Opportunity Workflow

**Purpose:** Connect the validated Qloo contract to a resumable workflow that produces a market fingerprint and opportunity candidates.

**Depends on:** Phases 0 and 1

**Exit condition:** A focused analysis can resolve inputs, persist layered Qloo research, discover opportunities, and recover safely after interruption.

## P2-01 — Harden the Qloo adapter

Update the Qloo adapter behind a single interface for:

- Entity search.
- Tag search.
- Location resolution.
- Insights requests.
- Entity comparison.
- Optional heatmaps.

The adapter must:

- Use server-only configuration.
- Allowlist endpoints and parameters.
- Validate request combinations before sending them.
- Parse responses with Zod schemas.
- Return explicit ambiguous, unresolved, empty, and schema-error states.
- Persist sanitized request summaries and provider provenance.

Verify the active API parameter names against Phase 0 fixtures. Do not silently preserve a parameter from the old creator workflow if the live contract differs.

## P2-02 — Build the cultural fingerprint

For a validated brief, run these layers where supported:

1. Market: city-only signals.
2. Brand: brand signals within the city.
3. Product: product/tag signals within the city.
4. Reference: selected cultural references within the city.
5. Combined: weighted brand, product, and reference signals.

Store IDs, names, types, affinity/rank values, source groups, operators, weights, query scope, and evidence references.

## P2-03 — Discover opportunities

Use the selected opportunity type to request Qloo results from the combined signal set. Enforce:

- One opportunity type per run.
- A server-side result limit.
- The validated city scope.
- No arbitrary free-text entity types.

Normalize each returned entity into `OpportunityCandidate`. Deduplicate by Qloo entity ID.

## P2-04 — Orchestrate the workflow

Implement stages:

1. Resolve inputs.
2. Research market.
3. Discover opportunities.
4. Generate activation brief.
5. Complete.

Persist stage output before advancing. A process restart must resume from the last completed stage. Browser polling reads application state only; it never calls Qloo directly and never starts duplicate work.

## P2-05 — Add retries and budgets

Retry only transient network, timeout, rate-limit, and selected 5xx errors. Do not retry invalid parameters, authentication failures, or schema mismatches automatically.

Configure:

- Request timeout.
- Maximum attempts.
- Maximum Qloo requests per analysis.
- Result limit.
- Overall analysis timeout.

## Tests and fixtures

- Entity and tag success, ambiguous, unresolved, and empty fixtures.
- Each fingerprint layer fixture.
- Opportunity success and unsupported-type fixtures.
- Heatmap and comparison fixtures, if enabled.
- Retry and timeout tests.
- Duplicate analysis-start tests.
- Restart/resume tests.
- Provider secrets absent from logs and responses.

## Deliverables

- Qloo adapter and schemas.
- Fingerprint builder.
- Opportunity discovery workflow.
- Retry and timeout utilities.
- Status and retry endpoints.
- Updated provider fixtures.

## Exit checklist

- [ ] A run produces a persisted fingerprint.
- [ ] A run produces normalized opportunities for the validated type.
- [ ] Every stage is resumable.
- [ ] Empty and partial provider results remain visible.
- [ ] No Apify job is required for the core path.
