# Phase 0 feasibility spike

This directory contains the provider feasibility harness and the decision artifacts required before building the CultureMatch workflow.

## Current scenario

- Market: India, country scope.
- Category: streetwear.
- Objective: launch awareness for a limited regional collection.
- Creator limit: five results for the spike.
- Preferred languages: English and Hindi as user-entered constraints only.

The market remains `pending_live_validation` until Qloo returns a usable location/taste response and the result is reviewed.

## Run the spike

The runner uses Node's built-in `fetch` and does not write raw credentials or request headers to fixtures.

Required server-side variables:

```text
QLOO_BASE_URL
QLOO_API_KEY
QLOO_SEARCH_URL
QLOO_TAGS_URL
QLOO_INSIGHTS_URL
QLOO_COMPARE_URL
APIFY_API_TOKEN
```

`QLOO_SEARCH_URL` and `QLOO_INSIGHTS_URL` are endpoint URLs. The runner adds the documented request parameters below unless a parameter is already present in the configured URL:

```text
QLOO_SEARCH_QUERY=Nike
QLOO_SEARCH_TYPES=urn:entity:brand
QLOO_SEARCH_TAKE=5
QLOO_INSIGHTS_FILTER_TYPE=urn:tag
QLOO_INSIGHTS_LOCATION_QUERY=India
QLOO_INSIGHTS_TAKE=10
```

These defaults are explicit and can be overridden in `.env.local` when testing another entity or market.

Optional variables:

```text
PHASE0_APIFY_QUERY
PHASE0_APIFY_TIMEOUT_SECONDS
QLOO_SEARCH_QUERY
QLOO_SEARCH_TYPES
QLOO_SEARCH_TAKE
QLOO_INSIGHTS_FILTER_TYPE
QLOO_INSIGHTS_LOCATION_QUERY
QLOO_INSIGHTS_TAKE
QLOO_TAGS_URL
QLOO_CREATOR_ENRICH_LIMIT
QLOO_ENABLE_HEATMAP
QLOO_HEATMAP_BOUNDARY
QLOO_HEATMAP_TAKE
OPENROUTER_API_KEY
OPENROUTER_MODEL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
DB_PASSWORD
```

Run with the local environment file:

```text
node --experimental-strip-types --env-file=.env.local lib/phase-0/run-spike.mts
```

The runner writes only sanitized output to `lib/phase-0/fixtures/`, including a `qloo/cultural-fingerprint.json` produced by the same layered analysis path used by the application. It updates `provider-field-matrix.md` and writes `fixtures/phase-0-run-summary.json`.

The Phase 0 model decision is OpenRouter with `qwen/qwen3.8-27b:free`. It is used only for optional schema-validated planning/report text in later phases; deterministic matching and scoring must work without it. OpenRouter credentials remain server-side. The selected free endpoint is rate-limited and must not receive confidential or personal data.

The Phase 0 Supabase decision is authenticated access with `campaigns.user_id` as the ownership field. The publishable key may be used by browser and SSR clients; service-role credentials, database passwords, and provider keys remain server-only. Every exposed table requires RLS and owner-scoped policies.

## Acceptance gate

Phase 0 is complete only after manual review confirms:

1. At least one Qloo entity resolves successfully.
2. The Qloo location/taste request returns a usable signal with documented parameters.
3. The Apify actor reaches a terminal success state.
4. At least one creator is mapped without guessing fields.
5. Supported, conditional, derived, and unavailable fields are recorded in the matrix.
6. The decision log contains the selected market, model, runtime, Supabase access mode, cost ceiling, and limitations.

Missing credentials or a captured HTTP response do not satisfy the gate.
