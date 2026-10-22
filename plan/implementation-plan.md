# CultureMatch Implementation Plan

**Status:** Execution plan for the MVP

**Source documents:** [`docs/PRD.md`](../docs/PRD.md) and [`docs/TDD.md`](../docs/TDD.md)

**Product direction:** Globally extensible cultural intelligence for regional creator marketing, demonstrated initially with an India-focused market.

## 1. Objective

Build and deploy a working MVP that:

1. Accepts a campaign brief for a validated country, region, or city.
2. Resolves campaign references and researches market signals through Qloo.
3. Discovers creator candidates through the Influship Apify actor.
4. Compares a baseline creator search with a Qloo-informed search.
5. Scores candidates deterministically from available evidence.
6. Separates verified facts, provider-derived signals, and AI-generated hypotheses.
7. Shows missing or unverified fields instead of inventing them.
8. Persists workflow state so the user can refresh and resume the analysis.

The first public demonstration should use one India-focused market. The implementation must not encode India-specific assumptions into the domain model, matching logic, or provider adapters.

## 2. Non-negotiable product rules

- Qloo signals must come from actual API responses.
- Creator fields must come from actual Apify results or be marked unavailable.
- Creator residence must never be presented as audience geography.
- Campaign Fit Score is a ranking aid, not a probability of success or ROI forecast.
- Missing language, audience-location, fee, engagement, or content fields remain unverified.
- The model may summarize evidence and suggest hypotheses, but it may not assign numeric scores or invent provider facts.
- All provider secrets remain server-side.
- All exposed Supabase tables use RLS with policies matching the access model.
- Provider-specific schemas remain isolated behind adapters.
- Every external request and result used in a recommendation is traceable.

## 3. MVP boundaries

### Required for the first release

- One product category.
- One validated India-focused market.
- Instagram creator discovery through the configured Apify actor.
- Qloo entity resolution and one validated location/taste query.
- Asynchronous Apify execution with persisted run state.
- Normalization, deterministic scoring, evidence references, and baseline comparison.
- Campaign form, progress state, results dashboard, and candidate detail view.
- Safe retry behavior, input validation, secret protection, and deployment documentation.

### Defer unless the provider spike proves them reliable

- Multiple countries or cities in one analysis.
- Audience demographics and geography.
- Creator fees and confirmed budget fit.
- Post-level language classification.
- Multi-platform discovery.
- Automated outreach, payments, CRM, or ROI prediction.
- PDF export, bookmarking, and advanced collaboration.

## 4. Architecture workstreams

| Workstream | Responsibility | Main output |
|---|---|---|
| Product and market configuration | Validated global market list, India-first demo scope, campaign constraints | Market configuration and acceptance brief |
| Provider adapters | Qloo and Apify authentication, requests, parsing, retries, fixtures | Tested provider clients |
| Workflow orchestration | State machine, idempotency, asynchronous jobs, recovery | Resumable analysis run |
| Persistence | Campaigns, runs, signals, candidates, matches, provenance | Secure database schema and migrations |
| Matching | Normalization, score components, evidence completeness, ranking | Deterministic scoring engine |
| Agent layer | Search-plan and report generation within narrow tool boundaries | Schema-validated model outputs |
| Experience | Campaign form, progress, results, comparison, export | Responsive dashboard |
| Delivery | Tests, observability, deployment, README, demo | Public working submission |

## 5. Phase map

| Phase | Name | Depends on | Exit gate |
|---|---|---|---|
| 0 | Feasibility spike and decisions | None | One real Qloo result and one real Apify result are captured and mapped without fabricated fields. |
| 1 | Foundation and secure persistence | Phase 0 decisions | App shell, migrations, RLS, domain contracts, and workflow skeleton pass tests. |
| 2 | Provider adapters and analysis workflow | Phases 0–1 | A campaign can execute Qloo and Apify asynchronously with persisted status and safe retries. |
| 3 | Matching, evidence, and agent outputs | Phase 2 fixtures and normalized data | Results are deterministically scored, explainable, and baseline-comparable. |
| 4 | Product experience and export | Phase 3 contracts | A tester can submit a campaign and understand the first recommendations without developer help. |
| 5 | Hardening, deployment, and submission | Phases 1–4 | Public demo, repository, tests, security review, and submission materials are complete. |

Detailed instructions are in:

- [`phase-0-feasibility-spike.md`](phase-0-feasibility-spike.md)
- [`phase-1-foundation.md`](phase-1-foundation.md)
- [`phase-2-provider-workflow.md`](phase-2-provider-workflow.md)
- [`phase-3-matching-evidence.md`](phase-3-matching-evidence.md)
- [`phase-4-results-experience.md`](phase-4-results-experience.md)
- [`phase-5-hardening-deployment.md`](phase-5-hardening-deployment.md)

## 6. Build execution rules

Build in dependency order. Do not begin a later phase because a screen exists; begin it only after the previous phase's exit gate is evidenced.

For each phase, create work items using this sequence:

1. Add or update the contract/types.
2. Implement the smallest working path.
3. Add unit/contract tests beside the implementation.
4. Add fixture or integration coverage.
5. Run the phase validation checklist.
6. Record unresolved limitations before moving on.

Use the following implementation order:

```text
provider fixtures
  -> domain contracts
  -> database and state machine
  -> provider adapters
  -> workflow runner
  -> normalization and scoring
  -> results API
  -> UI
  -> deployment and submission
```

Keep each provider behind a single adapter. UI components must consume application contracts, never raw Qloo or Apify payloads.

## 7. Build artifacts by phase

| Phase | Build artifacts that must exist before handoff |
|---|---|
| 0 | Decision log, validated market config, sanitized Qloo/Apify fixtures, provider field matrix |
| 1 | Project bootstrap, domain schemas, migrations, RLS/policies, state machine, API skeleton |
| 2 | Qloo client, Apify client, workflow runner, retries, idempotency, status/retry endpoints |
| 3 | Normalizers, evidence builder, scoring engine, baseline comparison, report schemas |
| 4 | Campaign form, progress UI, culture profile, creator cards, comparison, safe export |
| 5 | Full test suite, security review, deployment config, README, demo script, release checklist |

## 8. Critical decisions to lock before implementation

1. **Validated market:** select the first India-focused country/region/city and product category.
2. **Qloo request contract:** confirm base URL, authentication header, entity-search route, exact Insights parameters, response fields, and location behavior.
3. **Apify actor contract:** confirm input fields, output fields, terminal statuses, dataset behavior, result limits, cost, and expected latency.
4. **Model provider:** choose one provider and pin the AI SDK and provider package versions.
5. **Execution model:** choose how the asynchronous workflow advances after the initial request: bounded background polling, webhook, scheduled job, or durable workflow service.
6. **Authentication mode:** either ship a clearly limited public demo or add authentication and owner-scoped access from the first database migration.
7. **Retention policy:** define how long raw provider payloads, normalized records, and campaign reports remain stored.

## 9. Global definition of done

A phase is complete only when its code, tests, fixtures, documentation, and acceptance evidence are present. The final MVP is complete when:

- A new user can submit a valid campaign brief.
- The campaign receives a stable ID and visible progress state.
- Qloo and Apify requests use server-side credentials and validated inputs.
- Duplicate browser polling cannot create duplicate provider jobs.
- A successful run stores provider provenance and normalized records.
- A failed run shows a safe message and a bounded retry path.
- Every displayed score has component values, availability, rationale, and evidence references.
- Baseline and culture-informed results can be compared even when they are similar.
- AI-generated concepts are clearly labeled hypotheses and schema-validated.
- No secrets, raw credentials, or unnecessary provider payloads reach the client.
- RLS, policies, grants, and service-role usage have been reviewed.
- The public deployment works from the documented setup instructions.

## 10. Cross-phase testing strategy

- **Unit:** schemas, normalization, score math, state transitions, evidence completeness, and comparison logic.
- **Contract:** Qloo and Apify fixtures, response validation, terminal status handling, and retry classification.
- **Integration:** database writes, idempotency, provider adapters, and workflow recovery.
- **End-to-end:** submit campaign, observe progress, inspect results, refresh, retry a failure, and compare rankings.
- **Security:** environment-variable exposure, RLS/policy behavior, prompt-injection fixtures, safe logs, and client bundle inspection.

## 11. Delivery priorities under time pressure

Protect Phase 0, provider adapters, deterministic scoring, evidence display, and the end-to-end demo path. Cut PDF export, bookmarks, multi-market comparison, advanced agent loops, and cosmetic dashboard work before cutting validation, provenance, retries, or security.

The missing `architecture.png` and `sequence.png` files referenced by the TDD should be added during documentation hardening or the references should be removed before the repository is published.
