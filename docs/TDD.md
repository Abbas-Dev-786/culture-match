# CultureMatch
## Technical Design Document

**Version:** 2.0
**Status:** Pivoted MVP design
**Architecture:** Next.js + TypeScript + AI SDK + Qloo + Supabase Postgres

> **Design principle:** Qloo is the structured intelligence layer; the application orchestrates a bounded, resumable workflow and uses the model only for evidence-grounded strategic synthesis.

## 1. Technical goals

1. Support one focused beauty/wellness market-entry decision per analysis.
2. Keep Qloo requests and response parsing behind a typed provider adapter.
3. Persist market fingerprints, opportunity candidates, evidence, and limitations.
4. Make ranking reproducible from stored Qloo inputs and algorithm versions.
5. Keep AI output constrained to an activation brief generated from selected evidence.
6. Treat empty results, ambiguity, provider failures, and missing metadata as first-class states.

## 2. Proposed stack

| Layer | Choice | Boundary |
|---|---|---|
| Web application | Next.js App Router + React + TypeScript | UI and server routes in one deployable app |
| UI | Existing Tailwind/shadcn component system | Client consumes application contracts only |
| Agent layer | AI SDK + Zod structured output | Brief synthesis only; no unrestricted tools |
| Cultural intelligence | Qloo API | Entity/tag resolution, Insights, comparison, optional heatmaps |
| Persistence | Supabase Postgres | Owner-scoped analyses, runs, fingerprints, opportunities, reports |
| Testing | Existing TypeScript test setup plus browser smoke tests | Unit, contract, integration, and acceptance coverage |

Apify, vector databases, Redis, and multi-agent orchestration are not required for this MVP.

## 3. System architecture

```text
Focused launch brief
  -> Qloo entity/tag resolution
  -> location-conditioned cultural fingerprint
  -> one opportunity-type discovery query
  -> normalized opportunities and evidence
  -> deterministic ranking
  -> evidence-grounded activation brief
  -> client-safe report
```

### Components

- **Focused form:** collects brand, product, city, opportunity type, references, and launch intent.
- **Analysis API:** validates input, creates an idempotent run, and returns safe status.
- **Workflow runner:** advances persisted stages and owns retries, timeouts, and recovery.
- **Qloo adapter:** resolves entities/tags, builds validated Insights requests, parses responses, and records provenance.
- **Fingerprint builder:** stores market, brand, product, reference, and combined layers.
- **Opportunity normalizer:** maps Qloo entities into stable application records.
- **Ranking engine:** uses documented Qloo rank/affinity and versioned derived context where necessary.
- **Brief generator:** creates a schema-validated activation brief from a selected evidence bundle.
- **Results UI:** renders provider signals, opportunities, evidence, caveats, hypotheses, and optional visualizations.

## 4. Workflow state machine

Persistent stages:

- `queued`
- `resolving_inputs`
- `researching_market`
- `discovering_opportunities`
- `generating_brief`
- `completed`
- `failed`

Each stage persists its output before the next stage begins. Browser polling reads the application database only. A retry creates a new attempt and preserves prior results.

## 5. Qloo integration design

The adapter should expose typed methods for:

- `searchEntities`.
- `searchTags`.
- `getInsights`.
- `compareInsights`.
- `getHeatmap`.

The active API contract must be verified through Phase 0 fixtures. Do not assume that parameter names or response fields from a previous environment remain valid.

Every request summary stores:

- Endpoint and method.
- Filter type.
- Location scope.
- Signal IDs and weights.
- Operator.
- Result limit.
- Explainability setting.
- Observed timestamp.

Never store API keys or authorization headers in the summary.

## 6. Domain contracts

The internal contracts should include:

```ts
interface LaunchAnalysisBrief {
  brandName: string
  product: string
  city: string
  opportunityType: string
  culturalReferences: string[]
  launchIntent: string
}

interface OpportunityCandidate {
  provider: "qloo"
  entityId: string
  name: string
  types: string[]
  providerRank?: number
  affinity?: number
  relatedSignals: string[]
  evidence: EvidenceRef[]
  missingFields: string[]
}
```

Actual application types must be stricter and must not use `any` or an unbounded type escape hatch. Provider payloads remain `unknown` until schema validation succeeds.

## 7. Ranking and evidence

Ranking precedence:

1. Provider rank when documented.
2. Provider affinity when documented.
3. Versioned derived score using validated signal overlap and evidence coverage.

If Qloo semantics are not documented for a response, display the returned value as provider data without transforming it into a fabricated score.

Evidence states:

- `user_input`
- `provider_reported`
- `derived`
- `ai_hypothesis`

The result mapper must preserve evidence provenance and keep raw payloads out of the browser response.

## 8. AI boundary

The model may:

- Summarize selected Qloo signals.
- Propose cultural territories.
- Draft activation directions.
- List validation questions.

The model may not:

- Invent entities or provider values.
- Change opportunity ranking.
- Infer audience demographics or identity.
- Claim partnership availability.
- Predict ROI.
- Make arbitrary network requests or database writes.

Provider text is untrusted input. Prompts must include only the selected evidence bundle and must be schema-validated before persistence.

## 9. Persistence model

The pivoted MVP requires:

- `campaigns` or `launch_analyses`: focused brief and ownership.
- `analysis_runs`: stage, attempt, idempotency, status, errors, timestamps.
- `culture_profiles`: normalized fingerprint layers and provider summary.
- `opportunity_candidates`: normalized Qloo entities and evidence.
- `activation_reports`: structured brief, model metadata, caveats, and version.

Use UUIDs, UTC timestamps, owner-scoped RLS, and retention-limited raw payload storage.

## 10. Failure handling

- Retry transient network, timeout, rate-limit, and selected 5xx errors.
- Do not retry invalid parameters, authentication failures, or schema mismatch automatically.
- Fail transparently when Qloo returns no usable signals.
- Permit partial results only when their limitations are visible.
- Ensure duplicate requests cannot create duplicate analysis runs.

## 11. Security requirements

- Provider credentials remain server-only.
- RLS is enabled and tested for every exposed table.
- Service-role clients are never imported into client components.
- Logs redact credentials, headers, and private payloads.
- Results and exports contain only client-safe fields.
- Sensitive demographic attributes are never inferred from cultural data.

## 12. Verification strategy

- Unit tests for schemas, normalization, ranking, evidence, and state transitions.
- Contract fixtures for Qloo success, empty, ambiguous, invalid, timeout, and schema mismatch responses.
- Integration tests for migrations, RLS, idempotency, retries, and workflow recovery.
- Acceptance test for the focused beauty/wellness launch scenario.
- Manual practitioner validation with at least three target users.
