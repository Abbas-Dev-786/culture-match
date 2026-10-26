# Phase 0 feasibility spike

This directory contains the provider feasibility harness and the decision artifacts required before building the CultureMatch workflow.

## Current scenario

- Product: premium beauty and wellness launches.
- Markets: Mumbai, Bengaluru, and Delhi.
- Opportunity types: Qloo brands and places.
- Inputs: brand, product, city, two cultural references, and launch intent.
- Output: a cultural fingerprint plus ranked Qloo opportunities.

The pivot remains `pending_live_validation` until all three launch briefs produce usable fingerprints and opportunities that a human reviewer considers relevant.

## Run the spike

The runner uses Node's built-in `fetch` and does not write raw credentials or request headers to fixtures.

Required server-side variables:

```text
QLOO_BASE_URL
QLOO_API_KEY
QLOO_SEARCH_URL
QLOO_INSIGHTS_URL
```

`QLOO_SEARCH_URL` and `QLOO_INSIGHTS_URL` are endpoint URLs. The runner uses the same entity-resolution, layered fingerprint, and opportunity-discovery code as the application.

```text
QLOO_OPPORTUNITY_TAKE=10
```

Optional variables:

```text
QLOO_TAGS_URL
QLOO_COMPARE_URL
QLOO_TIMEOUT_MS=60000
QLOO_ENABLE_HEATMAP
QLOO_HEATMAP_BOUNDARY
QLOO_HEATMAP_TAKE
PROVIDER_RETAIN_RAW
PROVIDER_RAW_RETENTION_DAYS
```

Run with the local environment file:

```text
node --experimental-strip-types --env-file=.env.local lib/phase-0/run-spike.mts
```

The runner writes only sanitized output to `lib/phase-0/fixtures/`, one fixture per launch brief, and updates `provider-field-matrix.md` plus `fixtures/phase-0-run-summary.json`.

The narrowed MVP does not require a language model. Qloo is used for cultural signal resolution and recommendations; deterministic normalization, evidence, and workflow state remain application-owned.

The Phase 0 Supabase decision is authenticated access with `campaigns.user_id` as the ownership field. The publishable key may be used by browser and SSR clients; service-role credentials, database passwords, and provider keys remain server-only. Every exposed table requires RLS and owner-scoped policies.

## Acceptance gate

Phase 0 is complete only after manual review confirms:

1. Each launch brief resolves at least one reference.
2. Each launch brief returns a usable city fingerprint.
3. Each launch brief returns at least one opportunity for its selected Qloo type.
4. Opportunity fields and evidence paths are manually reviewed.
5. Supported, derived, and unavailable fields are recorded in the matrix.
6. The decision log contains the selected markets, runtime, Supabase access mode, cost ceiling, and limitations.

Missing credentials or a captured HTTP response do not satisfy the gate.
