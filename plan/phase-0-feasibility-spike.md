# Phase 0 — Feasibility Spike and Decisions

**Purpose:** Remove provider and deployment uncertainty before building the product surface.

**Depends on:** None

**Exit condition:** One real Qloo response and one real Apify response are captured, validated, normalized, and linked to a selected India-focused demo market without fabricating fields.

## Build order

Complete these tasks in order. Each task produces an artifact consumed by the next task.

### P0-01 — Create the spike workspace

Create:

- `lib/phase-0/fixtures/qloo/`
- `lib/phase-0/fixtures/apify/`
- `lib/phase-0/provider-field-matrix.md`
- `lib/phase-0/decision-log.md`
- `lib/phase-0/markets.ts` or an equivalent validated-market configuration.

Add redaction rules before saving any provider response. Never commit API keys, authorization headers, private campaign data, or unrestricted raw payloads.

### P0-02 — Lock the first campaign brief

Write one representative brief for the India-focused demo. Include the exact country, optional region/city, category, objective, cultural references, preferred language, creator limit, and budget constraints. Record which fields are user input versus provider evidence.

### P0-03 — Run the Qloo spike

Implement the smallest server-side script or test harness that:

1. Resolves the selected references.
2. Records ambiguous/unresolved matches.
3. Executes one validated location/taste request.
4. Saves a sanitized request summary and response fixture.
5. Prints a field inventory and parse result.

Do not build the application adapter until the request and response shape are recorded.

### P0-04 — Run the Apify spike

Implement the smallest server-side script or test harness that:

1. Validates the actor input.
2. Starts one bounded actor run.
3. Records run and dataset IDs.
4. Observes status transitions.
5. Reads the default dataset after success.
6. Saves sanitized input, run metadata, and representative items.

### P0-05 — Produce the decision record

Document the selected market, provider contracts, field availability, runtime, model, Supabase access mode, candidate limit, cost ceiling, and known limitations. The decision record is the formal input to Phase 1.

## Outcomes

- A selected first market and product category.
- A tested Qloo request contract and sanitized fixture.
- A tested Influship actor input/output contract and sanitized fixture.
- A decision on model provider, AI SDK version, hosting runtime, and workflow execution.
- A short list of fields that can genuinely be scored.
- A list of fields that must remain unavailable or unverified.

## 1. Select the first demo scenario

Record the following in a small configuration document or fixture:

- Country.
- Region/state, if applicable.
- City or market scope.
- Product/category.
- Campaign objective.
- One or more cultural references.
- Preferred language, if known.
- Creator-size constraints.
- Candidate limit, initially 10–20.

The selected market is a demonstration choice, not a permanent geographic restriction. The domain model must remain capable of representing any country, region, or city supported by later validation.

## 2. Validate Qloo

### Tasks

1. Confirm the active hackathon base URL and API key process.
2. Test entity search for the product/category and cultural references.
3. Record ambiguous, unresolved, and successfully resolved entities.
4. Test one location-aware Taste Analysis request for the selected market.
5. Confirm the exact `filter.type` and compatible filter/signal parameters.
6. Record response fields, labels, IDs, scores, and documented score semantics.
7. Capture request parameters without secrets and redact the response fixture as needed.
8. Classify each returned field as directly sourced, normalized, or derived.

### Required Qloo evidence

- Request URL/path and method.
- Authentication method, stored only as configuration metadata.
- Parameter compatibility notes.
- Example entity IDs and display labels.
- Example location signal and returned tags/entities.
- Empty-result and invalid-parameter behavior.
- Rate-limit and transient-error behavior if observable.

### Do not proceed if

- The selected market/category produces no usable signals.
- The request requires undocumented parameter combinations.
- The response cannot be parsed into stable evidence references.

## 3. Validate Apify/Influship

### Tasks

1. Fetch or inspect the current actor input schema.
2. Run the actor with the smallest useful result limit.
3. Record the exact input accepted by the actor.
4. Capture the run ID, dataset ID, status transitions, and terminal behavior.
5. Read the default dataset after successful completion.
6. Record every returned property that may be used by the product.
7. Measure approximate latency, result count, and cost under the demo account.
8. Test at least one failed or invalid-input path if safely possible.

### Required Apify evidence

- Actor ID.
- Valid input schema and supported filters.
- Run status values encountered.
- Dataset retrieval method.
- Stable creator identifier or profile URL behavior.
- Follower, engagement, content, language, geography, verification, and fee fields only if actually returned.
- Provider limitations and retention requirements.

### Field decision table

For every proposed normalized field, record one of:

- **Supported:** returned consistently and safe to display.
- **Conditional:** returned only for some candidates; display with availability state.
- **Derived:** computed from provider data; label as derived.
- **Unavailable:** not returned; do not score or claim it.

## 4. Decide the workflow runtime

Choose one implementation path:

- Initial request creates a run, then a bounded server-side worker polls Apify.
- Apify webhook advances the workflow after completion.
- A scheduled or durable workflow service advances the state machine.

The browser must only poll the application status endpoint. It must never start provider jobs or poll Apify directly.

Document the maximum execution window, retry behavior, timeout behavior, and recovery path.

## 5. Decide the model layer

- Select one model provider.
- Pin the AI SDK and provider versions.
- Confirm the current tool definition and structured-output APIs.
- Decide whether the model is needed for search-plan generation, campaign concepts, or both.
- Set a per-run token/call budget.
- Define the evidence-only prompt contract and prompt-injection handling.

The deterministic matching engine must remain usable if the model is unavailable.

## 6. Decide Supabase mode

- Confirm whether the demo has authentication.
- If authentication exists, choose the ownership field and owner-scoped policies.
- If authentication does not exist, keep provider calls and campaign writes server-side or use a private schema.
- Enable RLS for every table in an exposed schema.
- Decide which tables, if any, are exposed through the Data API and verify grants separately from RLS.
- Keep service-role credentials server-only.
- Pin package versions and commit the lockfile.

## Deliverables

- `lib/phase-0/fixtures/qloo/` sanitized request/response fixtures.
- `lib/phase-0/fixtures/apify/` sanitized actor input/run/dataset fixtures.
- `lib/phase-0/markets.ts` or equivalent validated-market configuration.
- `lib/phase-0/provider-field-matrix.md`.
- Runtime and model decision record.
- Updated environment-variable checklist.
- `lib/phase-0/decision-log.md`.

## Acceptance checklist

- [x] First market and category are selected.
- [x] Qloo entity resolution succeeds for at least one input.
- [x] Qloo location/taste request succeeds with documented parameters.
- [x] Apify actor accepts the selected input.
- [x] Apify run reaches a terminal state and dataset items are readable.
- [x] At least one creator can be normalized without guessed fields.
- [x] Score components are limited to fields supported by fixtures.
- [x] Workflow runtime and model provider are selected.
- [x] Supabase access model, RLS, and secret boundaries are documented.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Qloo has no useful signal for the chosen market | Change the tested market/category before UI work. |
| Apify lacks language, audience geography, or content fields | Remove those claims and mark components unavailable. |
| Actor cost or latency is too high | Reduce candidate count, add limits, and keep a fixture-backed demo fallback. |
| Model provider is unavailable | Keep search planning and scoring deterministic; make model concepts optional. |
| Provider schemas change | Store fixtures, isolate adapters, and validate payloads at the boundary. |
