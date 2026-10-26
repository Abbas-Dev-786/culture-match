# Phase 1 — Domain Foundation and Persistence

**Purpose:** Replace creator-campaign contracts with the focused market-entry domain while preserving the existing authentication, server boundaries, and reusable Qloo types.

**Depends on:** Phase 0 decisions and fixtures

**Exit condition:** The app can create, retrieve, and authorize a focused analysis with legal workflow transitions and tested database contracts.

## P1-01 — Update domain contracts

Update `lib/domain/types.ts` and validation schemas with explicit contracts for:

- `LaunchAnalysisBrief`.
- `TargetCity`.
- `OpportunityType`.
- `QlooFingerprint` and its layers.
- `OpportunityCandidate`.
- `ActivationBrief`.
- Evidence classes: user input, provider-reported, derived, and AI hypothesis.

Do not use `any` or an unbounded `Type` escape hatch. Keep provider payloads as `unknown` until they pass a provider schema.

The brief should contain only the focused inputs:

- Brand name.
- Product.
- City.
- Opportunity type.
- Cultural references.
- Launch intent.

## P1-02 — Define workflow state

Use a small state machine:

```text
queued
  -> resolving_inputs
  -> researching_market
  -> discovering_opportunities
  -> generating_brief
  -> completed
```

Every active state can transition to `failed`. Retry creates a new attempt without deleting the prior run. `completed` and `failed` are terminal for that attempt.

## P1-03 — Update persistence

Create or adapt tables for:

- `campaigns` or `launch_analyses`.
- `analysis_runs`.
- `culture_profiles`.
- `opportunity_candidates`.
- `activation_reports`.

Persist:

- User brief and validated configuration.
- Qloo request summaries without secrets.
- Normalized fingerprints and opportunities.
- Evidence references.
- Algorithm and prompt versions.
- Safe error codes and retry history.

Raw payloads remain optional, redacted, and retention-limited.

## P1-04 — Apply database security

- Enable RLS on exposed tables.
- Scope rows to the authenticated owner.
- Keep service-role access server-only.
- Test direct and unauthorized reads.
- Keep provider credentials out of JSON responses, logs, and client bundles.

## P1-05 — Update API skeleton

Adapt the existing campaign routes or create focused analysis routes. The API must:

- Validate the brief.
- Create an idempotent analysis run.
- Return safe status data.
- Return client-safe results only after completion.
- Support an explicit retry action.

## Tests and deliverables

- Domain schemas and fixtures.
- State-machine unit tests.
- Migration and RLS contract tests.
- API request/response schemas.
- Safe error serialization.
- Updated database types and serializers.

## Exit checklist

- [ ] Focused brief validation passes.
- [ ] Opportunity type is allowlisted.
- [ ] State transitions reject illegal changes.
- [ ] Retry attempts preserve history.
- [ ] RLS tests pass.
- [ ] No old creator-only field is required by the new MVP contract.
