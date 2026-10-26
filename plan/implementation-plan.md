# CultureMatch Implementation Plan

**Status:** Pivoted MVP execution plan
**Source:** [`docs/PRD.md`](../docs/PRD.md)
**Product direction:** Cultural launch and partnership intelligence for premium beauty and wellness brands entering Indian cities.

## 1. Objective

Build a focused product that:

1. Accepts one beauty/wellness market-entry brief for one city.
2. Resolves the brief into Qloo entities and tags.
3. Builds a location-conditioned cultural fingerprint.
4. Discovers opportunities for one validated Qloo entity type.
5. Ranks opportunities using documented provider signals.
6. Generates an evidence-backed activation brief.
7. Persists all inputs, stages, provenance, and limitations.

The MVP does not require Apify, creator discovery, campaign scoring, or influencer audience analysis. Those are future integrations.

## 2. Scope decisions

| Decision | MVP choice |
|---|---|
| Vertical | Premium beauty and wellness |
| Geography | One validated Indian city per analysis |
| Primary user | Brand strategist, growth marketer, or boutique agency |
| Primary decision | Find culturally aligned launch partners and places |
| Intelligence provider | Qloo |
| AI role | Evidence-grounded activation brief only |
| Primary output | Ranked opportunities plus cultural rationale |
| Deferred provider | Apify creator search |

## 3. Architecture workstreams

| Workstream | Responsibility | Main output |
|---|---|---|
| Product configuration | Vertical, cities, opportunity types, fixtures | Validated launch scenarios |
| Qloo adapter | Search, tags, Insights, comparison, optional heatmaps | Typed provider boundary |
| Workflow | Stages, idempotency, retries, recovery | Resumable analysis run |
| Persistence | Campaigns, fingerprints, opportunities, reports | Secure database model |
| Opportunity ranking | Provider rank/affinity and deterministic derived context | Reproducible results |
| Agent layer | Activation brief and evidence summary | Schema-validated report |
| Experience | Focused form, progress, fingerprint, opportunity view | Usable product surface |
| Delivery | Tests, security, deployment, demo | Release candidate |

## 4. Phase map

| Phase | Name | Depends on | Exit gate |
|---|---|---|---|
| 0 | Vertical and Qloo feasibility | None | Three representative briefs produce usable Qloo signals and at least one validated opportunity type. |
| 1 | Domain foundation and persistence | Phase 0 | New contracts, migrations, RLS, and state machine support the pivoted workflow. |
| 2 | Qloo research and opportunity workflow | Phases 0–1 | A run resolves inputs, builds fingerprints, retrieves opportunities, and survives interruption. |
| 3 | Evidence, ranking, and activation brief | Phase 2 | Recommendations are reproducible, traceable, and summarized without unsupported claims. |
| 4 | Focused product experience | Phase 3 | A user can complete an analysis and understand the top recommendations without assistance. |
| 5 | Hardening and deployment | Phases 1–4 | Public demo, tests, security review, documentation, and release walkthrough are complete. |

Detailed instructions live in:

- [`phase-0-feasibility-spike.md`](phase-0-feasibility-spike.md)
- [`phase-1-foundation.md`](phase-1-foundation.md)
- [`phase-2-provider-workflow.md`](phase-2-provider-workflow.md)
- [`phase-3-matching-evidence.md`](phase-3-matching-evidence.md)
- [`phase-4-results-experience.md`](phase-4-results-experience.md)
- [`phase-5-hardening-deployment.md`](phase-5-hardening-deployment.md)

## 5. Execution rules

For every phase:

1. Update the contract before implementation.
2. Implement the smallest working path.
3. Add unit and contract tests beside the implementation.
4. Add sanitized provider fixtures.
5. Run the phase acceptance checklist.
6. Record limitations before starting the next phase.

Build order:

```text
Qloo fixtures
  -> domain contracts
  -> persistence and state machine
  -> Qloo adapter
  -> workflow runner
  -> opportunity normalization and ranking
  -> activation brief schema
  -> results API
  -> focused UI
  -> deployment
```

## 6. Required artifacts by phase

| Phase | Required artifacts |
|---|---|
| 0 | Decision log, validated cities, Qloo fixtures, field matrix, representative briefs |
| 1 | Domain schemas, migrations, RLS policies, state machine, API skeleton |
| 2 | Qloo client, research workflow, opportunity retrieval, retries, status/retry routes |
| 3 | Evidence builder, opportunity ranking, report schema, grounded prompts, result persistence |
| 4 | Focused form, progress UI, fingerprint view, opportunity cards, activation brief, export |
| 5 | Full verification, security review, deployment config, README, demo script, release checklist |

## 7. Definition of done

The MVP is complete only when:

- A user can submit a valid focused brief.
- Qloo requests use server-side credentials and validated parameters.
- A run can resume after a refresh or process interruption.
- Every recommendation has provider provenance or is explicitly marked derived.
- Unknown commercial facts remain unknown.
- AI output is schema-validated and labeled as hypothesis where appropriate.
- RLS and secret boundaries have been tested.
- The public demo follows the release scenario in the PRD.

## 8. Deferred work

Do not begin these before Phase 5:

- Creator discovery or influencer ranking.
- Multi-platform social data.
- Multi-city comparison.
- Additional verticals.
- Automated outreach or CRM.
- ROI prediction or performance calibration.
- Advanced audience/demographic configuration.
