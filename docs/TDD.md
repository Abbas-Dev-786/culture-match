# CultureMatch
## Technical Design Document (TDD)

**Version:** 1.0 · **Status:** Build-ready MVP draft · **Date:** 22 October 2026  
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
| Testing | Vitest + Testing Library + Playwright (if time) | Unit, contract, component and end-to-end coverage. |

Do not introduce a vector database, Redis, a separate Express service, or a multi-agent framework in the MVP unless a measured need appears. The initial matching can use structured fields and deterministic similarity/scoring code.

## 3. System architecture

![CultureMatch system architecture](architecture.png){ width=6.3in }

### Components and responsibilities

- **Dashboard:** submits campaign briefs, renders stage status, shows Regional Culture Profile, compares rankings, and displays creator evidence.
- **Campaign API:** validates requests, checks ownership/access if authentication is added, creates the campaign/run records and dispatches analysis.
- **Workflow runner:** drives the fixed state machine; owns retries, idempotency, timeouts, and persistence. It must not depend on a browser session staying open.
- **CultureMatch orchestrator:** uses the LLM to structure a research plan and generate a creator-search plan within constraints. Tools only expose known operations.
- **Qloo adapter:** wraps Qloo search/insights endpoints; validates query parameters; stores sanitized raw responses and normalized tags/entities.
- **Apify adapter:** starts the actor, records run ID/dataset ID, checks status and maps result items into a stable schema.
- **Matching engine:** pure TypeScript functions that score candidate records, report evidence availability and calculate a separate confidence/completeness indicator.
- **Report generator:** creates structured candidate explanations/campaign concepts from persisted evidence; validates model output before saving.
- **Supabase persistence:** stores state and source provenance so results can be reloaded and audited.

## 4. Agentic architecture

Use **one orchestrator agent with a narrow toolset**, inside an explicit workflow. Avoid free-running loops and avoid multiple independent agents for the MVP.

### Agent tools

| Tool | Input | Output | Notes |
|---|---|---|---|
| `resolveQlooEntities` | Search strings, allowed entity types, optional location | Resolved candidates with IDs and confidence/source metadata | Ambiguous results should be surfaced; do not silently choose low-confidence matches. |
| `analyzeRegionalCulture` | Confirmed entity IDs, location, supported tag/entity types, bounded result limit | Normalized cultural signals plus references to raw response | Only documented/validated combinations may be used. |
| `buildCreatorSearchPlan` | Campaign brief + normalized culture signals | Query text and validated actor filters | May be a structured model step, not an external tool. |
| `searchCreators` | Search plan | Apify run ID and initial status | Starts only one run for a given idempotency key. |
| `getCreatorSearchStatus` | Apify run ID | Run state and, when done, dataset items | Called by workflow, not every UI poll directly against Apify. |
| `scoreCreatorMatches` | Normalized candidate list + culture profile + constraints | Ranked candidates and score components | Deterministic code; not model-selected numbers. |
| `generateCampaignConcepts` | Top candidates + evidence bundle + campaign goal | Schema-validated concepts and evidence-based explanations | Must not invent external facts or provider fields. |

### What the LLM may and may not do

**May:** normalize free-text brief; decide among supported research actions; formulate natural-language creator query from verified signals; summarize evidence; propose creative campaign ideas.

**May not:** invent Qloo entities/tags; make unrestricted HTTP requests; alter provider authentication; set numeric match scores; infer follower geography from creator residence; manufacture engagement or audience percentages; mark an unavailable field as verified; write arbitrary database records; run unlimited searches.

### Bounded agent loop

- Maximum 5 tool/model steps for one orchestration segment.
- Maximum 1 Qloo entity-resolution refinement per ambiguous input.
- Maximum 1 Apify creator-search refinement if result quality is poor and the run budget permits.
- Maximum result set initially 10–20 creators.
- If evidence remains insufficient, return a partial report with gaps rather than looping indefinitely.

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
2. Resolve brand/cultural references through Qloo Search Entities.
3. Execute a tested Qloo Insights/Taste Analysis query for the selected region/category.
4. Normalize/store culture signals; fail or request user adjustment if results are empty or irrelevant for the selected validated market.
5. Generate the Apify query/filter plan with the LLM and validate it against supported actor inputs.
6. Start an asynchronous actor run; persist run ID and status.
7. Poll internally, receive a webhook if supported and configured, or use a bounded background/status workflow to check actor completion. Do not create duplicate runs from browser polling.
8. Read dataset items, normalize supported fields and de-duplicate candidates.
9. Score candidates deterministically and compute evidence completeness/confidence separately.
10. Generate candidate explanations and campaign concepts from a constrained evidence bundle.
11. Validate output schemas, persist report and mark run `completed`.
12. UI polls the app's own status endpoint and fetches the persisted result.

### Failure handling

- Retry 429 and transient 5xx/network failures with bounded exponential backoff and jitter.
- Do not retry most 4xx validation/auth failures; surface a sanitized actionable message.
- Store provider status/code and a redacted error summary; never log provider secrets.
- A retry must be idempotent for steps that create remote jobs or write result rows.
- If Qloo returns no usable signals, do not silently proceed as a Qloo-powered recommendation. Either stop with a transparent limitation or run a clearly labeled baseline-only mode.
- If Apify returns fewer candidates than requested, use those available and display the sample size; do not imply comprehensive coverage.

## 6. External API integration design

### 6.1 Qloo

Use server-side `fetch` with the configured `QLOO_BASE_URL` and `X-Api-Key` header. Qloo's general Insights API is documented at `https://api.qloo.com/v2/insights`; the hackathon may require the hackathon base URL, so set it by environment variable rather than hardcoding it in client code. Search Entities is documented at `https://api.qloo.com/search`.

Relevant documentation:

- [Insights API Deep Dive](https://docs.qloo.com/reference/insights-api-deep-dive)
- [Parameter Overview](https://docs.qloo.com/reference/parameter-overview)
- [Search Entities](https://docs.qloo.com/reference/get-search)
- [Taste Analysis](https://docs.qloo.com/reference/taste-analysis)

Implementation contract:

- `searchEntities(query, types?, location?)` returns candidate entity IDs and display metadata.
- `getRegionalTasteProfile({ confirmedEntityIds, location, tagTypes, parentsTypes, limit })` issues a validated Insights API request with `filter.type=urn:tag` when performing tag-level taste analysis, and uses only parameters documented as valid together for that result type.
- A second Insights request may retrieve recommendations for a supported entity type if that supports the product demo better. Validate the exact type and parameters before using it.
- Parse the actual returned response schema; do not assume field names or ranking semantics that are not documented.
- Persist request parameters (without secrets), API version/base URL and a sanitized response for debugging.

**Important:** Qloo's parameter guide requires checking parameter compatibility for a given `filter.type`. The sample query must be tested in the live Deep Dive and against hackathon API credentials. The TDD deliberately does not hardcode an unverified request shape beyond documented examples.

### 6.2 Apify / Influship

Actor: `influship/influencer-search`.

- Use `apify-client` on the server.
- Start an asynchronous run and persist actor run ID.
- Retrieve results from the run's default dataset once terminal status indicates success.
- Keep the actor input schema in one adapter module so changes do not spread through the app.
- Initially request 10–20 candidates and apply supported follower/engagement/platform filters from the current actor schema. Market and language constraints must be treated as explicit inputs, not assumed from the selected country.
- Store only fields needed for display, matching and debugging. Consider retention limits for raw profile payloads.

**Integration spike required:** fetch the actor input and output schema or run a small test, then record exactly which properties exist. Do not code assumptions about `bio`, recent posts, language, audience location, average views, growth, fees or audience demographics until observed. The actor is community-maintained and can change. Current listing: https://apify.com/influship/influencer-search

### 6.3 Language model provider

Abstract provider-specific setup behind `lib/agent/model.ts`. Keep a single model for MVP. Use structured output for `CreatorSearchPlan` and `CampaignReport`; Zod-validate all generated objects. Prompts must treat provider payloads as untrusted data: external text can contain prompt injection, so do not follow instructions embedded in creator bios or scraped content.

## 7. Data contracts and TypeScript domain types

The types below are internal normalized contracts, not claims about raw provider schemas.

```ts
export type CampaignStatus =
  | "queued"
  | "researching_culture"
  | "searching_creators"
  | "scoring"
  | "generating_report"
  | "completed"
  | "failed"
  | "cancelled";

export interface CampaignBrief {
  brandName: string;
  productCategory: string;
  targetMarket: {
    country: string;
    region?: string;
    city?: string;
    marketScope?: "city" | "region" | "country";
  };
  objective: string;
  culturalReferences: string[];
  preferredLanguages: string[];
  minFollowers?: number;
  maxFollowers?: number;
  maxBudget?: number;
  currency?: string;
  creatorLimit: number; // server-enforced, e.g. 10–20 for MVP
}

export interface EvidenceRef {
  source: "qloo" | "apify" | "user_input" | "derived";
  label: string;
  fieldPath?: string;
  providerEntityId?: string;
  excerpt?: string;
  observedAt: string;
  verified: boolean;
}

export interface CultureSignal {
  id: string;
  label: string;
  signalType: "tag" | "entity" | "other";
  score?: number;
  scoreMeaning?: string; // only if provider documents semantics
  qlooEntityId?: string;
  evidence: EvidenceRef[];
}

export interface NormalizedCreator {
  provider: "apify_influship";
  externalId?: string;
  handle?: string;
  displayName: string;
  profileUrl?: string;
  platform: "instagram" | "other";
  bio?: string;
  followerCount?: number;
  engagementRate?: number;
  postingFrequency?: number | string;
  verified?: boolean;
  languages?: string[];
  audienceLocations?: Array<{ label: string; share?: number }>;
  contentSignals: Array<{ label: string; evidence: EvidenceRef[] }>;
  sourceFields: Record<string, unknown>;
  missingFields: string[];
}

export interface ScoreComponent {
  key: "culturalAlignment" | "contentFit" | "marketRelevance" | "engagement" | "reachBudgetFit";
  weight: number;
  score?: number; // 0–100 where calculable
  available: boolean;
  rationale: string;
  evidence: EvidenceRef[];
}

export interface CreatorMatch {
  creator: NormalizedCreator;
  campaignFitScore: number | null;
  evidenceCompleteness: number;
  components: ScoreComponent[];
  explanation: string;
  caveats: string[];
  campaignConcept?: { title: string; idea: string; rationale: string; hypothesis: true };
}
```

Important: in production TypeScript, prefer stricter, provider-specific parsing schemas with `z.unknown()`/unknown passthrough only for raw provider payloads, and explicit numeric normalization for counts and percentages. Do not treat this example as the actor's exact raw JSON schema.

Market handling is globally extensible but evidence-limited: maintain a tested-market configuration containing supported countries, regions/cities, Qloo location-query behavior, and known data limitations. The initial demo may focus on an India-based market without making India-specific assumptions in the domain types or scoring code.

## 8. Match scoring algorithm

Initial weights are configurable hypotheses:

- Cultural alignment: 0.35
- Content/campaign fit: 0.30
- Market relevance: 0.15
- Engagement quality: 0.10
- Reach/budget fit: 0.10

### Normalize available component scores

1. Each component returns either a normalized score in `[0, 100]` or unavailable.
2. Calculate weighted mean over available components only: `sum(score_i * weight_i) / sum(weight_i for available components)`.
3. Return `null` if no meaningful components can be scored.
4. Calculate `evidenceCompleteness` separately (for example, weight coverage or required-field coverage); do not conflate completeness with match quality.
5. Store the score algorithm version and component values so the same campaign can be rescored later.

### Cultural alignment

The exact algorithm depends on usable evidence. MVP options:

- If Qloo supplies tag/entity labels and the creator dataset provides comparable creator topics/entities, use a documented overlap/similarity score.
- If only profile text is available, map content text to Qloo-derived signal labels with a transparent lexical/embedding similarity method. Record that this is a derived text match, not an audience-level cultural affinity.
- Do not simply reuse the Apify semantic match score as the cultural component if the Qloo-derived terms were already passed into the Apify query.

### Engagement and reach/budget

- Use rates and counts exactly as sourced, normalized for string/number representations.
- Validate expected ranges and preserve raw values for traceability.
- If creator fees or audience geography are unavailable, mark budget-fit or market-relevance components unavailable; don't infer a concrete result.

### Explainability

Every candidate explanation must be generated from the score components and evidence list, not from a free-form prompt without grounding. UI should link each claim to a returned field/signal where possible.

## 9. Database model

Use UUID primary keys, timestamps in UTC and JSONB for versioned provider output where useful. Suggested MVP tables:

### `campaigns`

- `id UUID PRIMARY KEY`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `brief JSONB NOT NULL`
- `created_by UUID NULL` (if authentication is included)

### `analysis_runs`

- `id UUID PRIMARY KEY`
- `campaign_id UUID REFERENCES campaigns(id)`
- `status TEXT NOT NULL`
- `stage TEXT NOT NULL`
- `attempt INTEGER NOT NULL DEFAULT 1`
- `idempotency_key TEXT UNIQUE NOT NULL`
- `apify_run_id TEXT NULL`
- `apify_dataset_id TEXT NULL`
- `qloo_request_summary JSONB NULL` (exclude secrets)
- `error_code TEXT NULL`
- `error_message_safe TEXT NULL`
- `started_at TIMESTAMPTZ NULL`
- `completed_at TIMESTAMPTZ NULL`

### `culture_profiles`

- `id UUID PRIMARY KEY`
- `analysis_run_id UUID REFERENCES analysis_runs(id)`
- `provider_version TEXT NULL`
- `market JSONB NOT NULL`
- `signals JSONB NOT NULL`
- `raw_response JSONB NULL` (redacted and retention-limited)
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

### `creator_candidates`

- `id UUID PRIMARY KEY`
- `analysis_run_id UUID REFERENCES analysis_runs(id)`
- `external_id TEXT NULL`
- `profile_url TEXT NULL`
- `handle TEXT NULL`
- `normalized_profile JSONB NOT NULL`
- `source_payload JSONB NULL` (retention-limited)
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- Unique constraint per run on stable provider ID/profile URL where available.

### `creator_matches`

- `id UUID PRIMARY KEY`
- `analysis_run_id UUID REFERENCES analysis_runs(id)`
- `creator_candidate_id UUID REFERENCES creator_candidates(id)`
- `rank INTEGER NOT NULL`
- `score_algorithm_version TEXT NOT NULL`
- `campaign_fit_score NUMERIC NULL`
- `evidence_completeness NUMERIC NOT NULL`
- `components JSONB NOT NULL`
- `explanation TEXT NOT NULL`
- `caveats JSONB NOT NULL DEFAULT '[]'`
- `campaign_concept JSONB NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

For the hackathon, JSONB for normalized sub-objects accelerates development. Keep IDs, statuses, run IDs and foreign keys relational. Enable Row Level Security on every table in an exposed schema by default; use owner-scoped policies when authentication is present, or keep campaign writes server-side/private when authentication is not shipped. Never expose the service role to the client.

## 10. Internal API design

All provider calls occur server-side. Response shapes below are recommended app contracts, not provider payloads.

### `POST /api/campaigns`

Request: validated `CampaignBrief`.

Response `201`:

```json
{
  "campaignId": "uuid",
  "analysisRunId": "uuid",
  "status": "queued"
}
```

### `POST /api/campaigns/:id/analyze`

Starts an analysis for an existing campaign or creates the run if the product flow combines those steps. Require an idempotency key or enforce one active run per campaign. Response `202` with `analysisRunId` and status.

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

Optional. Creates a new attempt for a failed run, with a new attempt ID and preserved prior failure record. Must be idempotent.

## 11. Suggested repository layout

```text
app/
  campaigns/
    new/page.tsx
    [id]/page.tsx
  api/
    campaigns/route.ts
    campaigns/[id]/analyze/route.ts
    campaigns/[id]/status/route.ts
    campaigns/[id]/results/route.ts
components/
  campaign-form.tsx
  analysis-progress.tsx
  culture-profile.tsx
  creator-card.tsx
  match-breakdown.tsx
  baseline-comparison.tsx
lib/
  agent/
    model.ts
    culturematch-agent.ts
    prompts.ts
    schemas.ts
  workflow/
    run-campaign-analysis.ts
    state-machine.ts
    retry.ts
  tools/
    qloo/client.ts
    qloo/resolve-entities.ts
    qloo/analyze-culture.ts
    apify/client.ts
    apify/search-creators.ts
    apify/get-run-results.ts
  matching/
    normalize-creator.ts
    score-creators.ts
    confidence.ts
    evidence.ts
  db/
    campaigns.ts
    analysis-runs.ts
    culture-profiles.ts
    creator-candidates.ts
    creator-matches.ts
  validation/
    campaign.ts
    provider-payloads.ts
  observability/
    logger.ts
    metrics.ts
  supabase/server.ts
  supabase/client.ts
types/
  campaign.ts
  culture.ts
  creator.ts
  report.ts
supabase/
  migrations/
```

## 12. Environment configuration and secrets

```bash
# Server-side only
QLOO_BASE_URL=https://hackathon.api.qloo.com
QLOO_API_KEY=
APIFY_API_TOKEN=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=qwen/qwen3.8-27b:free

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
- Redact credentials and sensitive raw request data from logs.
- Add request limits, result limits and cost budgets; prevent duplicate actor jobs with idempotency keys.
- Enable RLS on every exposed table. When auth is used, add owner-scoped policies; when auth is not shipped, keep writes behind server-side code or use a private schema and clearly document demo limitations.
- Respect provider terms and the actor's supported collection method; do not bypass access controls.
- Establish raw payload retention, such as short-lived retention for diagnostics and a smaller persisted normalized representation for campaign results.

## 14. Observability

Log one structured event per stage with `campaignId`, `analysisRunId`, `stage`, provider name, duration, status and a redacted error code. Track:

- Qloo request success rate, latency, number of usable signals, response schema errors.
- Apify runs started/completed/failed, time to completion, result count and cost if exposed.
- Culture-informed vs baseline candidate overlap and rank changes.
- Percentage of matches with each evidence component available.
- Model output schema validation failures and token usage if available.

Don't log full creator payloads or API keys in normal production logs.

## 15. Test plan

### Unit tests

- Campaign and tool-input schemas reject unsupported/oversized values.
- Normalizers correctly handle missing, null, numeric-string and unexpected fields.
- Score math, unavailable components and weight renormalization behave deterministically.
- Evidence completeness and score algorithm version are persisted.
- State machine rejects invalid transitions.

### Contract/integration tests

- Qloo adapter parses a fixture captured from a real successful response.
- Qloo no-result and invalid-parameter responses yield safe errors.
- Apify adapter handles SUCCEEDED, FAILED, ABORTED and RUNNING states.
- Apify dataset adapter maps actual response fields to normalized creator schema.
- Idempotent retries do not duplicate runs or match rows.

### End-to-end acceptance tests

1. User can submit an allowed campaign.
2. Campaign becomes visible immediately and shows progress.
3. A successful Qloo run stores real signals and provenance.
4. Apify run ID is stored once; polling does not start duplicates.
5. Completed run displays actual creator records and score breakdowns.
6. Missing audience geography or language is labeled unverified.
7. Baseline and culture-informed ranking comparison renders, including when there is little/no difference.
8. Provider failure displays a useful safe message and retry path.
9. Public deployment works without secrets in client bundle.

## 16. Deployment strategy

- Deploy Next.js app to Vercel; use Supabase-managed Postgres.
- Run Qloo lookup/analysis as short server-side stages where possible.
- Run Apify actor asynchronously and persist actor ID; do not depend on one long-running serverless request waiting for the entire pipeline.
- Use either bounded server-side polling, a provider callback/webhook if available, or a durable workflow service if required. The app's status endpoint reads persisted app state.
- Vercel function execution duration is configurable and has plan/runtime constraints; design around async work rather than assuming a long function can run indefinitely: https://vercel.com/docs/functions/configuring-functions/duration
- Add a health/diagnostics page for the demo only if time permits; never expose credentials there.

## 17. Implementation phases

### Phase 0 — API feasibility spike (first)

- Verify Qloo key and base URL.
- Test entity search and one location/tag Insights query in the live docs/API.
- Run Influship actor with 5–10 results; inspect input/output schema and actual item JSON.
- Record a minimal set of fixtures and decide which match components can genuinely be scored.
- Decide the first campaign category and market based on returned data.

**Exit gate:** at least one real Qloo culture result and one real Apify creator result can be connected without fabricating fields.

### Phase 1 — Thin vertical slice

- Build campaign form and create/status/results endpoints.
- Persist campaign/run state.
- Run Qloo + Apify via adapters.
- Render simple creator shortlist using raw/normalized fields.

### Phase 2 — Agentic value

- Add structured creator search plan from Qloo signals.
- Add deterministic scoring and evidence provenance.
- Add baseline-vs-culture-informed comparison.
- Add schema-validated explanations/campaign concept cards.

### Phase 3 — Submission hardening

- Retry, empty-data and provider-error cases.
- Security/logging and responsive UI checks.
- Deploy public app; publish repository, license and setup instructions.
- Record a short optional demo video if it helps judges understand the project quickly.

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
- Qloo Taste Analysis: https://docs.qloo.com/reference/taste-analysis
- Apify Influship Influencer Search input/schema: https://apify.com/influship/influencer-search/input-schema
- Apify JavaScript client: https://docs.apify.com/api/client/js/
- AI SDK Core Tool Calling: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
- Vercel Function Duration: https://vercel.com/docs/functions/configuring-functions/duration

---

**Implementation warning:** Qloo request parameters and Apify actor fields must be verified against the live API and actual payloads. This document defines internal contracts and safe behavior; it intentionally avoids treating unverified provider fields or query combinations as guaranteed.
