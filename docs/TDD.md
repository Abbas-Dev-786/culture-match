# CultureMatch
## Technical Design Document (TDD)

**Version:** 1.1 · **Status:** Implemented MVP flow · **Date:** 27 October 2026
**Architecture:** Next.js + TypeScript + AI SDK tool-calling + Qloo + Apify + Supabase Postgres

> **Design principle:** one bounded orchestrator, explicit workflow stages, deterministic matching, and evidence-grounded language-model output.

\newpage


## 1. Technical goals

1. Ship a reliable, hosted hackathon MVP with a single codebase for UI and server-side routes, while keeping market configuration globally extensible.
2. Keep Qloo and Apify provider-specific logic behind adapters.
3. Make each recommendation explainable and reproducible from persisted inputs and output evidence.
4. Handle the Apify actor as a long-running external job rather than a synchronous page request.
5. Prevent language-model output from fabricating provider metrics, cultural signals, audience geography or campaign results.
6. Make provider failures, empty responses and missing fields first-class workflow states.

## 2. Proposed stack

| Layer | Choice | Reason / boundary |
|---|---|---|
| Web application | Next.js App Router + React + TypeScript | Single deployable app; UI and server-side Route Handlers. |
| UI | Tailwind CSS + shadcn/ui + Lucide | Fast, coherent dashboard components. |
| Agent/tool layer | Vercel AI SDK + one configured model provider + Zod | Typed tool definitions and constrained tool-calling. |
| Cultural intelligence | Qloo API | Entity search, Insights/Taste Analysis and supported location signals. |
| Creator search | Apify JavaScript client / Actor API | Executes `influship/influencer-search`; use actual schema returned by live run. |
| Persistence | Supabase Postgres | Campaigns, workflow runs, provider-run IDs, normalized candidates and score breakdowns. |
| Hosting | Vercel | Public app/API deployment; avoid relying on long-running synchronous functions. |
| Testing | Node's built-in test runner + TypeScript strip-types execution | Fast unit, contract and migration tests without a second test framework. |

Do not introduce a vector database, Redis, a separate Express service, or a multi-agent framework in the MVP unless a measured need appears. The initial matching can use structured fields and deterministic similarity/scoring code.

## 3. System architecture

![CultureMatch system architecture](architecture.png){ width=6.3in }

### Components and responsibilities

- **Dashboard:** submits campaign briefs, renders stage status, shows Regional Culture Profile, compares rankings, and displays creator evidence.
- **Campaign API:** validates requests, checks ownership/access if authentication is added, creates the campaign/run records and dispatches analysis.
- **Workflow runner:** drives the fixed state machine; owns retries, idempotency, timeouts, and persistence. It must not depend on a browser session staying open.
- **CultureMatch orchestrator:** owns the deterministic workflow. Optional model calls generate a validated culture-informed search plan and evidence-grounded reports; they do not control provider access or numeric scores.
- **Qloo adapter:** wraps entity search, tag search and Insights/Compare/Heatmap endpoints; centralizes age serialization, weighted GET/POST requests, namespace scoping and response validation.
- **Qloo resolution/enrichment:** retries entity spelling variants, falls back to scoped tags, resolves semantic tags, runs five culture layers, enriches creator content, and validates named persons without local name matching.
- **Apify adapter:** starts paired baseline/culture runs, records run ID/dataset ID, checks status and maps result items into a stable schema.
- **Matching engine:** pure TypeScript functions that score candidate records, report evidence availability and calculate a separate confidence/completeness indicator.
- **Report generator:** creates structured candidate explanations/campaign concepts from persisted evidence; validates model output before saving.
- **Supabase persistence:** stores state and source provenance so results can be reloaded and audited.

## 4. Agentic architecture

Use **one orchestrator agent with a narrow toolset**, inside an explicit workflow. Avoid free-running loops and avoid multiple independent agents for the MVP.

### Agent tools

| Tool | Input | Output | Notes |
|---|---|---|---|
| `resolveQlooEntities` | Brand/reference strings and allowed entity type | Resolved candidates, explicit ambiguity/unresolved state, and a scoped tag fallback when entity search fails | Do not silently promote a tag fallback to an entity. |
| `resolveQlooTags` | Product/reference/content terms and scoped tag namespaces | Exact or ranked semantic tag matches with provider evidence | Typo tolerance and semantic search are enabled on every tag request. |
| `analyzeRegionalCulture` | Resolved entities/tags, location, demographic conditioning and bounded result limit | Five normalized cultural layers plus provenance | Uses only centralized, documented request contracts. |
| `buildCreatorSearchPlan` | Campaign brief + normalized culture signals | Query text and validated actor filters | May be a structured model step, not an external tool. |
| `searchCreators` | Search plan | Apify run ID and initial status | Starts only one run for a given idempotency key. |
| `getCreatorSearchStatus` | Apify run ID | Run state and, when done, dataset items | Called by workflow, not every UI poll directly against Apify. |
| `scoreCreatorMatches` | Normalized candidate list + culture profile + constraints | Ranked candidates and score components | Deterministic code; not model-selected numbers. |
| `generateCampaignConcepts` | Top candidates + evidence bundle + campaign goal | Schema-validated concepts and evidence-based explanations | Must not invent external facts or provider fields. |

### What the LLM may and may not do

**May:** normalize free-text brief; decide among supported research actions; formulate natural-language creator query from verified signals; summarize evidence; propose creative campaign ideas.

**May not:** invent Qloo entities/tags; make unrestricted HTTP requests; alter provider authentication; set numeric match scores; infer follower geography from creator residence; manufacture engagement or audience percentages; mark an unavailable field as verified; write arbitrary database records; run unlimited searches.

### Bounded agent loop

- Maximum one model search-plan call and one optional report call per workflow stage.
- Entity spelling retries and tag fallback are bounded inside the Qloo adapter; there is no free-running agent loop.
- Exactly one baseline and one culture-informed Apify run are created per analysis attempt.
- Creator enrichment is capped by `QLOO_CREATOR_ENRICH_LIMIT`; creator results are capped by the campaign limit.
- If evidence remains insufficient, preserve unavailable fields and continue with transparent caveats rather than inventing data.

AI SDK tool definitions should use Zod schemas and narrow `execute` functions. Use `stopWhen`/step limits supported by the installed AI SDK version and add a workflow-level budget that does not depend on the model stopping correctly. See the AI SDK tool-calling reference listed in the References section.

## 5. Workflow state machine and sequence

![Campaign analysis sequence](sequence.png){ width=5.6in }

### Persistent status enum

- `queued`
- `researching_culture`
- `searching_creators`
- `scoring`
- `generating_report`
- `completed`
- `failed`
- `cancelled` (optional if cancellation is implemented)

Allowed transitions should be enforced in server-side code. `completed`, `failed` and `cancelled` are terminal states; retrying a failed campaign should create a new analysis run or explicit retry attempt rather than erasing audit history.

### Workflow steps

1. Validate the request, generate an idempotency key, insert campaign and run.
2. Resolve brand and cultural references through Qloo entity search with bounded spelling retries; if an entity is not resolved, immediately try scoped tag search and preserve the entity status.
3. Resolve product, description and unresolved-reference terms through Qloo tag search with typo tolerance, semantic search and relevant tag namespaces.
4. Execute five Qloo Taste Analysis layers—market, brand, product, reference and combined—using location signals, scoped tag types, centralized demographic serialization and safe entity weighting. Use `union` for sparse combined tags and `intersection` only when at least five tags resolve.
5. Persist normalized culture signals, provider summary and optional short-lived raw payload. Fail the culture stage when no usable cultural signal exists; do not silently downgrade the run to an unlabeled baseline.
6. Build deterministic baseline and culture-informed Apify plans. Optionally replace the culture plan with a schema-validated model plan when `ENABLE_MODEL_SEARCH_PLAN=true`.
7. Claim provider start once, start one Apify run for each plan, and persist both provider run IDs/dataset IDs. Browser polling never creates provider runs.
8. Poll the app-owned workflow; read terminal datasets, normalize observed fields, de-duplicate creators and persist candidates by `baseline` or `culture_informed` variant.
9. Enrich the combined creator set with location-conditioned Qloo tag affinity. For named creators, run POST person validation with `filter.results.entities.query`, campaign tags, demographic conditioning and `bias.trends=high`; omit person location signals and keep missing matches unavailable.
10. Score baseline candidates with Qloo resonance disabled, culture-informed candidates with Qloo enabled, and culture candidates again with Qloo disabled for ablation. Persist component evidence, completeness, caveats and comparison metrics.
11. When `ENABLE_MODEL_REPORTS=true`, generate validated reports for the top five culture-informed matches using only persisted evidence. Deterministic score data remains authoritative if model output is unavailable.
12. UI polls the app's status endpoint and fetches the persisted, client-safe result.

### Failure handling

- Retry 429 and transient 5xx/network failures with bounded exponential backoff and jitter.
- Do not retry most 4xx validation/auth failures; surface a sanitized actionable message.
- Store provider status/code and a redacted error summary; never log provider secrets.
- A retry must be idempotent for steps that create remote jobs or write result rows.
- If Qloo returns no usable cultural signals, fail the culture stage with a safe error; baseline-only scoring is used only as the explicit comparison variant after successful culture research, never as a hidden fallback.
- If Apify returns fewer candidates than requested, use those available and display the sample size; do not imply comprehensive coverage.

## 6. External API integration design

### 6.1 Qloo

Use server-side `fetch` with the configured `QLOO_BASE_URL` and `X-Api-Key` header. Qloo's general Insights API is documented at `https://api.qloo.com/v2/insights`; the hackathon may require the hackathon base URL, so set it by environment variable rather than hardcoding it in client code. Search Entities is documented at `https://api.qloo.com/search`.

Relevant documentation:

- [Insights API Deep Dive](https://docs.qloo.com/reference/insights-api-deep-dive)
- [Parameter Overview](https://docs.qloo.com/reference/parameter-overview)
- [Search Entities](https://docs.qloo.com/reference/get-search)
- [Search Tags](https://docs.qloo.com/reference/search-tags)
- [Taste Analysis](https://docs.qloo.com/reference/taste-analysis)
- [Analysis Compare](https://docs.qloo.com/reference/analysis-compare)
- [Heatmap Insights](https://docs.qloo.com/reference/heatmap-insights)

Implementation contract:

- `searchEntities(query, types, take)` searches brand entities with bounded spelling retries and conservative exact matching. An unresolved input calls `searchTags` with the same term before being surfaced as unresolved.
- `searchTags(query, take, tagTypes)` always sends `filter.query`, `feature.typo_tolerance=true`, `feature.semantic_search=true` and scoped tag types. The parser accepts documented nested/top-level tag responses and `name`/`title` labels.
- `getInsights(input)` centralizes every Insights request. It serializes `25_to_34` as `25_to_29,30_to_34`, omits `signal.location.query` for Person, uses scalar singular entity weights for uniform GET signals, and uses POST bodies for distinct per-entity weights or explicitly requested POST calls.
- Cultural layers use `filter.type=urn:tag`, `signal.location.query`, and market/cultural `filter.tag.types` scopes. The heatmap uses `filter.type=urn:heatmap` with `filter.location.query`. Compare requests omit `filter.type` unless an entity-category scope is intentionally supplied.
- Person validation uses POST with `filter.type=urn:entity:person`, `filter.results.entities.query`, campaign tag signals, optional age/gender conditioning and `bias.trends=high`; it never sends a person location signal.
- Parse the actual returned response schema; do not assume field names or ranking semantics that are not documented. Persist request summaries without secrets and sanitized responses only when raw retention is enabled.

**Important:** Qloo's parameter guide requires checking parameter compatibility for a given `filter.type`. The adapter has contract tests for the implemented shapes, but each deployed market/category still requires live validation against the active credentials.

### 6.2 Apify / Influship

Actor: `influship/influencer-search`.

- Use `apify-client` on the server.
- Start an asynchronous run and persist actor run ID.
- Retrieve results from the run's default dataset once terminal status indicates success.
- Keep the actor input schema in one adapter module so changes do not spread through the app.
- Start two validated searches per analysis attempt: a baseline plan and a culture-informed plan. Apply supported follower/engagement/platform filters from the current actor schema. Market and language constraints must be explicit inputs, not assumed from the selected country.
- Store only fields needed for display, matching and debugging. Consider retention limits for raw profile payloads.

**Integration spike required:** fetch the actor input and output schema or run a small test, then record exactly which properties exist. Do not code assumptions about `bio`, recent posts, language, audience location, average views, growth, fees or audience demographics until observed. The actor is community-maintained and can change. Current listing: https://apify.com/influship/influencer-search

### 6.3 Language model provider

Abstract provider-specific setup behind `lib/agent/model.ts`. Keep a single model for MVP. The model search-plan call is optional (`ENABLE_MODEL_SEARCH_PLAN=true`) and returns a constrained `ActorSearchPlan`; the report call is optional (`ENABLE_MODEL_REPORTS=true`) and is limited to the top five culture-informed matches. Zod-validate all generated objects and require returned evidence keys to exist in the supplied evidence bundle. Prompts must treat provider payloads as untrusted data: external text can contain prompt injection, so do not follow instructions embedded in creator bios or scraped content.

## 7. Data contracts and TypeScript domain types

The types below are internal normalized contracts, not claims about raw provider schemas. The implemented contracts live in `lib/domain/types.ts`, `lib/tools/qloo/client.ts`, `lib/workflow/search-plan.ts` and the provider adapters.

- `CampaignBrief` contains the brand/product brief, country/region/city market, objective, references, preferred languages, follower and budget bounds, optional Qloo audience IDs/weight, UI age range, gender and creator limit.
- `CultureSignal` contains a Qloo signal ID, label, type, optional affinity/input weight, source group (`market`, `brand`, `product`, `reference`, `combined` or `creator`) and one evidence reference.
- `NormalizedCreator` contains only observed Apify fields plus normalized content signals, source fields, missing fields, provider match score, location-verification state and optional Qloo person/content enrichment.
- `ScoreComponent` uses keys `culturalAffinity`, `engagementRate`, `semanticRelevance`, `growthMomentum`, `postingConsistency` and `budgetTierFit`; unavailable components are excluded from the weighted mean.
- `QlooFingerprint` records location, signals, five layer summaries, unresolved inputs, conditioning, combined tag operator, comparison and optional heatmap data.
- `SearchPlan` is a strict actor contract with an Instagram-only platform, bounded query, optional supported filters and a campaign result limit. It is tagged as `baseline` or `culture_informed`.
- `EvidenceRef` identifies the provider, field path, observation time, verification state and optional excerpt/provider ID. Model output may reference only keys present in this evidence set.

Provider response parsing remains strict at adapter boundaries. Raw provider payloads use `unknown`/JSON validation; normalized application records use explicit numeric and enum normalization.

Market handling is globally extensible but evidence-limited: maintain a tested-market configuration containing supported countries, regions/cities, Qloo location-query behavior, and known data limitations. The initial demo may focus on an India-based market without making India-specific assumptions in the domain types or scoring code.

## 8. Match scoring algorithm

The implemented scoring contract is versioned as `prd-v1` in `lib/matching/score-creators.ts`:

- Cultural affinity: 0.35
- Engagement rate: 0.25
- Semantic relevance: 0.20
- Growth momentum: 0.10
- Posting consistency: 0.05
- Budget tier fit: 0.05

### Normalize available component scores

1. Each component returns either a normalized score in `[0, 100]` or unavailable.
2. Calculate weighted mean over available components only: `sum(score_i * weight_i) / sum(weight_i for available components)`.
3. Return `null` if no meaningful components can be scored.
4. Calculate `evidenceCompleteness` separately (for example, weight coverage or required-field coverage); do not conflate completeness with match quality.
5. Store the score algorithm version and component values so the same campaign can be rescored later.

### Cultural affinity

- Prefer the Qloo person-level `qlooAffinity` returned by the named-person validation request.
- Otherwise use the weighted, location-conditioned Qloo creator-content signals. This is creator-content/market resonance, not audience-level affinity.
- If no Qloo signal is available, return the component as unavailable and renormalize the remaining weights. Do not convert unavailable Qloo data to zero.
- Baseline scoring sets `includeQlooResonance=false`; culture-informed scoring enables it. The culture-informed candidates are rescored with Qloo disabled for the ablation comparison.

### Engagement and reach/budget

- Engagement is normalized against a 10% ceiling, growth against a 20% ceiling, and posting consistency against 12 posts/month.
- Use rates and counts exactly as sourced, normalized for string/number representations; validate expected ranges and preserve evidence.
- Budget fit uses the provider-reported fee when available, otherwise the creator tier. Missing fee or verified audience geography remains a caveat rather than an inferred value.

### Explainability

Every candidate explanation must be generated from the score components and evidence list, not from a free-form prompt without grounding. UI should link each claim to a returned field/signal where possible.

## 9. Database model

The implemented Supabase schema uses UUIDs, UTC timestamps, user-scoped foreign keys and JSONB for normalized provider evidence. The migration contract is the source of truth; keep this document aligned with it.

### `campaigns`

- `id UUID PRIMARY KEY`
- `user_id UUID NOT NULL REFERENCES auth.users`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- Campaign brief fields are stored as typed columns, including country, region/city, objective, references, languages, follower bounds and budget bounds.

### `analysis_runs`

- `id UUID PRIMARY KEY`
- `campaign_id UUID REFERENCES campaigns(id)`
- `status TEXT NOT NULL`
- `stage TEXT NOT NULL`
- `attempt INTEGER NOT NULL DEFAULT 1`
- `idempotency_key TEXT UNIQUE NOT NULL`
- `apify_run_id TEXT NULL`
- `apify_dataset_id TEXT NULL`
- `baseline_provider_run_id TEXT NULL`
- `baseline_provider_dataset_id TEXT NULL`
- `score_algorithm_version TEXT NOT NULL`
- workflow status/stage, safe error fields and provider-start lease/claim fields
- `started_at TIMESTAMPTZ NULL`
- `completed_at TIMESTAMPTZ NULL`

### `culture_profiles`

- `id UUID PRIMARY KEY`
- `campaign_id UUID`, `analysis_run_id UUID UNIQUE`, `user_id UUID`
- `market_country TEXT NOT NULL`
- `signals JSONB NOT NULL`
- `provider_summary JSONB NOT NULL`
- `observed_at TIMESTAMPTZ NULL`
- optional `raw_payload JSONB` and `raw_payload_expires_at` for short-lived diagnostics

### `creator_candidates`

- `id UUID PRIMARY KEY`
- `analysis_run_id UUID REFERENCES analysis_runs(id)`
- `campaign_id UUID`, `user_id UUID`, provider and stable provider creator ID
- `search_variant TEXT CHECK (search_variant IN ('baseline', 'culture_informed'))`
- observed profile fields such as name, platform, username, profile URL, bio, followers, engagement and verification state
- `location_unverified BOOLEAN`, provider match score, evidence JSONB and normalized payload JSONB
- optional short-lived `raw_payload JSONB`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- Unique constraint per run/provider/provider-creator/variant prevents duplicate candidates across retries.

### `creator_matches`

- `id UUID PRIMARY KEY`
- `analysis_run_id UUID REFERENCES analysis_runs(id)`
- `creator_candidate_id UUID REFERENCES creator_candidates(id)`
- `rank INTEGER NOT NULL`
- `campaign_fit_score NUMERIC NULL`
- `score_components JSONB`, evidence JSONB and optional report summary
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Keep IDs, statuses, run IDs, search variants and foreign keys relational. Enable Row Level Security on every table; policies and composite foreign keys scope campaigns, runs, candidates and matches to the authenticated user. Never expose the service role to the client. Raw provider payloads are optional and retention-limited.

## 10. Internal API design

All provider calls occur server-side. Response shapes below are recommended app contracts, not provider payloads.

### `POST /api/campaigns`

Request: validated `CampaignBrief`.

Response `201`:

```json
{
  "campaign": { "id": "uuid", "status": "queued" },
  "run": { "id": "uuid", "status": "queued", "stage": "queued" }
}
```

### `POST /api/campaigns/:id/analyze`

Advances the persisted analysis workflow for an existing campaign and returns the serialized campaign and run. The workflow enforces one active provider-start claim and must not create duplicate baseline or culture-informed Apify runs. Long-running provider work continues through persisted state and webhook/polling advancement.

### `GET /api/campaigns/:id/status`

Response:

```json
{
  "campaignId": "uuid",
  "analysisRunId": "uuid",
  "status": "searching_creators",
  "stageMessage": "Searching creator profiles",
  "updatedAt": "ISO-8601 timestamp",
  "error": null
}
```

Status endpoint reads app database only; it should not start a new Apify run. Provider status checking belongs in the workflow runner or a deliberate refresh operation.

### `GET /api/campaigns/:id/results`

Response contains campaign summary, culture signals, ranked creator matches, evidence references, caveats and baseline/culture-informed comparison metadata. Return only client-safe fields.

### `POST /api/campaigns/:id/retry`

Creates a new attempt for a failed run while preserving prior failure history. The retry has a new idempotency key and must remain safe if the request is repeated.

### `GET /api/campaigns/:id/export`

Returns the latest safe matches as a private CSV download. It never exports raw provider payloads or secrets.

### `POST /api/campaigns/:id/advance`

Development-only workflow advancement endpoint. It is useful for manually driving a queued run while integrating providers; production progress is driven by the workflow runner and provider webhook/polling path.

## 11. Implemented repository layout

```text
app/
  campaigns/
    new/page.tsx
    [id]/page.tsx
  api/
    campaigns/route.ts
    campaigns/[id]/analyze/route.ts
    campaigns/[id]/route.ts
    campaigns/[id]/status/route.ts
    campaigns/[id]/results/route.ts
    campaigns/[id]/retry/route.ts
    campaigns/[id]/advance/route.ts
    campaigns/[id]/export/route.ts
    health/route.ts
    internal/apify/webhook/route.ts
    trending/route.ts
components/
  ui/                         # shared shadcn-style primitives
  theme-provider.tsx
lib/
  agent/
    model.ts
    prompts.ts
    schemas.ts
    types.ts
  workflow/
    run-campaign-analysis.ts
    state-machine.ts
    retry.ts
    search-plan.ts
    search-plan-model.ts
    apify-webhook.ts
    telemetry.ts
  tools/
    qloo/client.ts
    qloo/resolve-entities.ts
    qloo/resolve-tags.ts
    qloo/analyze-culture.ts
    qloo/enrich-creators.ts
    qloo/query-config.ts
    apify/client.ts
    apify/search-creators.ts
    apify/get-run-results.ts
  matching/
    normalize-creator.ts
    score-creators.ts
    compare-runs.ts
    normalize-culture.ts
    evidence.ts
  db/
    campaigns.ts
    runs.ts
    provider-results.ts
    matches.ts
    results.ts
  validation/
    campaign.ts
    provider-payloads.ts
  observability/
    logger.ts
    metrics.ts
  supabase/server.ts
  supabase/client.ts
  domain/types.ts
  phase-0/
  matching/*.test.ts
  workflow/*.test.ts
lib/db/migrations/
```

## 12. Environment configuration and secrets

```bash
# Server-side only
QLOO_BASE_URL=https://hackathon.api.qloo.com
QLOO_SEARCH_URL=
QLOO_TAGS_URL=
QLOO_INSIGHTS_URL=
QLOO_COMPARE_URL=
QLOO_TRENDS_URL=
QLOO_API_KEY=
QLOO_TIMEOUT_MS=20000
QLOO_CACHE_ENABLED=false
QLOO_CREATOR_ENRICH_LIMIT=20
QLOO_ENABLE_HEATMAP=false
QLOO_HEATMAP_BOUNDARY=geohash
QLOO_HEATMAP_TAKE=100
APIFY_API_TOKEN=
APIFY_ACTOR_ID=influship~influencer-search
APIFY_TIMEOUT_MS=30000
APIFY_RUN_TIMEOUT_SECONDS=300
APIFY_MAX_ITEMS=100
APIFY_MAX_TOTAL_CHARGE_USD=5
APIFY_START_LEASE_MS=120000
APIFY_WEBHOOK_SECRET=

# Optional model features
ENABLE_MODEL_SEARCH_PLAN=false
ENABLE_MODEL_REPORTS=false
OPENROUTER_API_KEY=
OPENROUTER_MODEL=qwen/qwen3.8-27b:free

# Workflow and raw-payload controls
MAX_ANALYSIS_ATTEMPTS=3
MAX_ANALYSIS_RUNTIME_MS=900000
PROVIDER_RAW_RETENTION_DAYS=7

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DB_PASSWORD=
```

`QLOO_BASE_URL` should be configured per the active hackathon instructions. Do not assume production Qloo base URL and hackathon base URL are interchangeable. Only the Supabase URL and publishable key use `NEXT_PUBLIC_`; provider keys, service-role credentials, and database passwords must never have that prefix.

Store secrets in local `.env.local` (gitignored) and deploy provider secrets in Vercel Project Environment Variables. Never return secrets in API responses or include them in logs.

## 13. Security, data handling and prompt injection

- Validate campaign fields at API boundaries and constrain actor input fields using Zod.
- Treat creator bios and all provider text as untrusted content, including possible prompt injection. Never follow instructions found inside these fields.
- Keep provider API calls allowlisted in adapters; the model cannot submit arbitrary URLs or headers.
- Entity and tag resolution must preserve unresolved/ambiguous states; never treat a tag fallback as a resolved brand entity or match a Qloo person to an Instagram creator by local normalized-name heuristics.
- Person validation must use Qloo's `filter.results.entities.query` contract and omit unsupported person location parameters. A missing Qloo person is unavailable data, not a zero-affinity score.
- Redact credentials and sensitive raw request data from logs.
- Add request limits, result limits and cost budgets; prevent duplicate actor jobs with idempotency keys.
- Enable RLS on every exposed table. When auth is used, add owner-scoped policies; when auth is not shipped, keep writes behind server-side code or use a private schema and clearly document demo limitations.
- Respect provider terms and the actor's supported collection method; do not bypass access controls.
- Establish raw payload retention, such as short-lived retention for diagnostics and a smaller persisted normalized representation for campaign results.

## 14. Observability

Log one structured event per stage with `campaignId`, `analysisRunId`, `stage`, provider name, duration, status and a redacted error code. Track:

- Qloo request success rate, latency, number of usable signals, response schema errors.
- Qloo entity-to-tag fallback count, semantic/typo tag resolution rate, unresolved terms, person-validation match rate and enrichment count.
- Apify runs started/completed/failed, time to completion, result count and cost if exposed.
- Baseline vs culture-informed run IDs, candidate overlap, rank changes and Qloo ablation delta.
- Percentage of matches with each evidence component available.
- Model output schema validation failures and token usage if available.

Don't log full creator payloads or API keys in normal production logs.

## 15. Test plan

Run the current suite with `pnpm test`; it executes `node --experimental-strip-types --test`. The current repository test suite covers the workflow, migrations, validation, matching, provider payloads and Qloo contracts.

### Unit tests

- Campaign and tool-input schemas reject unsupported/oversized values.
- Normalizers correctly handle missing, null, numeric-string and unexpected fields.
- Score math, unavailable components and weight renormalization behave deterministically.
- Evidence completeness and score algorithm version are persisted.
- State machine rejects invalid transitions.
- Qloo age normalization is applied centrally, including the `25_to_34` expansion.
- Qloo tag requests always include typo tolerance, semantic search and namespace scopes; nested and top-level tag response shapes parse correctly.
- Unresolved entity searches fall back to scoped tag search without changing the entity resolution status.
- Sparse combined tags use `union`; only five or more resolved tags use `intersection`.
- Weighted GET requests use the singular scalar entity-weight parameter; distinct weights use POST bodies.
- Person validation uses POST, name query and campaign tags, and never sends `signal.location.query`.

### Contract/integration tests

- Qloo adapter parses a fixture captured from a real successful response.
- Qloo no-result and invalid-parameter responses yield safe errors.
- Compare omits `filter.type=urn:tag`; heatmap uses `filter.location.query`.
- Apify adapter handles SUCCEEDED, FAILED, ABORTED and RUNNING states.
- Apify dataset adapter maps actual response fields to normalized creator schema.
- Idempotent retries do not duplicate runs or match rows.

### End-to-end acceptance tests

1. User can submit an allowed campaign and receive a queued run.
2. Campaign becomes visible immediately and shows progress.
3. A successful Qloo run stores real signals and provenance.
4. Baseline and culture-informed Apify run IDs are stored once; polling does not start duplicates.
5. Completed run displays actual creator records and score breakdowns.
6. Missing audience geography or language is labeled unverified, and missing Qloo person matches remain unavailable.
7. Baseline, culture-informed and Qloo-ablation ranking comparison renders, including when there is little/no difference.
8. Provider failure displays a useful safe message and retry path; a Qloo culture failure is not silently presented as a successful baseline-only analysis.
9. Public deployment works without secrets in the client bundle.

## 16. Deployment strategy

- Deploy Next.js app to Vercel; use Supabase-managed Postgres.
- Run Qloo lookup/analysis as short server-side stages where possible.
- Run Apify actor asynchronously and persist actor ID; do not depend on one long-running serverless request waiting for the entire pipeline.
- Use either bounded server-side polling, a provider callback/webhook if available, or a durable workflow service if required. The app's status endpoint reads persisted app state.
- Vercel function execution duration is configurable and has plan/runtime constraints; design around async work rather than assuming a long function can run indefinitely: https://vercel.com/docs/functions/configuring-functions/duration
- Add a health/diagnostics page for the demo only if time permits; never expose credentials there.

## 17. Implementation status and remaining work

### Phase 0 — API feasibility spike — complete

- Verify Qloo key and base URL.
- Test entity search and one location/tag Insights query in the live docs/API.
- Run Influship actor with 5–10 results; inspect input/output schema and actual item JSON.
- Record a minimal set of fixtures and decide which match components can genuinely be scored.
- Decide the first campaign category and market based on returned data.

**Exit gate:** adapter fixtures, provider contracts and environment-driven spike tooling are in place; live credential validation remains deployment-specific.

### Phase 1 — Thin vertical slice — complete

- Build campaign form and create/status/results endpoints.
- Persist campaign/run state.
- Run Qloo + Apify via adapters.
- Render simple creator shortlist using raw/normalized fields.

### Phase 2 — Provider workflow and scoring — complete

- Add structured creator search plan from Qloo signals.
- Add deterministic scoring and evidence provenance.
- Add baseline-vs-culture-informed comparison.
- Add schema-validated explanations/campaign concept cards.

### Phase 3 — Submission hardening — current

- Retry, empty-data and provider-error cases.
- Security/logging and responsive UI checks.
- Deploy public app; publish repository, license and setup instructions.
- Record a short optional demo video if it helps judges understand the project quickly.

Remaining work is live-provider validation, actor schema monitoring, deployment configuration and broader market fixtures. These are operational validation tasks, not reasons to relax the unavailable-data and evidence rules above.

## 18. Technical decisions and unresolved items

| Decision | Current choice | Revisit when |
|---|---|---|
| Agent pattern | One bounded orchestrator + explicit workflow | Tool routing becomes genuinely complex or several independent long-running workflows are needed. |
| Matching logic | Deterministic weighted components | A labeled evaluation set exists to tune/calibrate weights. |
| Creator evidence | Influship actor output first; normalize only actual fields | Live schema lacks needed content/language/location attributes. |
| Regionality | Qloo location signals plus separately evidenced creator market fit | Reliable audience geography source is integrated. |
| Job orchestration | App-owned status workflow and persisted Apify run ID | Need durable long-running orchestration beyond simple polling. |
| Authentication | Optional for public hackathon demo | Multi-user private campaigns or production usage begins. |
| Market coverage | Globally extensible schema with a validated-market allowlist; India-focused first demo | Additional markets pass the same Qloo/Apify fixture and evidence checks. |

## 19. References

- Qloo Agentic Hackathon rules: https://qloo.devpost.com/rules
- Qloo Insights API Deep Dive: https://docs.qloo.com/reference/insights-api-deep-dive
- Qloo Parameter Overview: https://docs.qloo.com/reference/parameter-overview
- Qloo Search Entities: https://docs.qloo.com/reference/get-search
- Qloo Search Tags: https://docs.qloo.com/reference/search-tags
- Qloo Taste Analysis: https://docs.qloo.com/reference/taste-analysis
- Qloo Analysis Compare: https://docs.qloo.com/reference/analysis-compare
- Qloo Heatmap Insights: https://docs.qloo.com/reference/heatmap-insights
- Apify Influship Influencer Search input/schema: https://apify.com/influship/influencer-search/input-schema
- Apify JavaScript client: https://docs.apify.com/api/client/js/
- AI SDK Core Tool Calling: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
- Vercel Function Duration: https://vercel.com/docs/functions/configuring-functions/duration

---

**Implementation warning:** Qloo request parameters and Apify actor fields must still be verified against live credentials and actual payloads for each deployed market. This document defines the implemented internal contracts, fallback behavior and safe unavailable-data semantics; it does not guarantee provider coverage for every creator or namespace.
