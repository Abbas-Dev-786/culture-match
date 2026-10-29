# CultureMatch

**CultureMatch is an agentic creator-discovery tool that finds creators whose observed content culturally resonates with a specific campaign in a specific market.**

Generic creator discovery can find people with relevant keywords, follower counts, or engagement. It cannot reliably answer the harder question: *does this creator's content fit what this market already cares about in the context of this campaign?*

CultureMatch uses Qloo's Taste Graph to turn a campaign brief into a market-aware cultural fingerprint, then measures observed creator-content signals against that fingerprint. The result is a ranked, evidence-backed shortlist rather than a keyword-only search result.

> **Live demo:** _Add the deployed public URL before submission._
>
> **Source repository:** _Add the public GitHub, GitLab, or Bitbucket URL before submission._

## Why Qloo is essential

Qloo is the cultural intelligence layer of CultureMatch, not a decorative enrichment step.

Without Qloo, the product can only discover creators from a broad campaign brief and rank provider-reported metrics. It cannot create or validate the core **campaign x market x creator-content** relationship.

With Qloo, CultureMatch:

- Resolves campaign references, concepts, and product language into validated cultural entities and tags.
- Builds a target-market taste profile from Qloo signals.
- Resolves observed creator content into Qloo signals.
- Measures each creator-content signal against the campaign fingerprint in the selected market.
- Uses that evidence as the largest weighted component of the final fit score.
- Shows a Qloo ablation comparison so a reviewer can see how the ranking changes when cultural resonance is excluded.

This is the difference between "find creators talking about skincare in Mumbai" and "find creators whose demonstrated cultural signals resonate with this skincare campaign in Mumbai."

## How it works

```text
Campaign brief
  + target market
  + cultural references
        |
        v
Qloo entity/tag resolution and market Taste Graph research
        |
        v
Campaign cultural fingerprint -----+
                                   +-- Qloo affinity matching --> evidence-backed cultural resonance
Observed creator content ----------+
        ^
        |
Apify creator discovery
        |
        v
Deterministic scoring, Qloo ablation, and an explainable shortlist
```

1. A marketer submits a campaign brief with a target market, audience constraints, product/category context, and cultural references.
2. Qloo resolves the input into entities and tags, then retrieves market-conditioned cultural signals to create a campaign fingerprint.
3. The application runs a broad creator search through the configured Apify influencer actor.
4. Qloo resolves creator bio and observed content signals and matches them to the campaign fingerprint in the target market.
5. A bounded research/critic workflow can assess evidence sufficiency and authorize at most one targeted refinement when it is justified.
6. A deterministic scorer ranks candidates using cultural affinity, engagement, semantic relevance, momentum, consistency, and budget-tier fit.
7. The results explain each score, preserve provider evidence, surface missing data, and compare the ranking with and without Qloo cultural resonance.

## What makes it agentic

CultureMatch uses agents where judgment is useful, while keeping external effects bounded and ranking reproducible.

- A research supervisor selects validated Qloo research actions and builds the campaign fingerprint.
- A creator-search critic evaluates whether the evidence justifies one constrained refinement search.
- An evidence critic can request targeted enrichment when cultural evidence is too sparse.
- Model outputs are schema-validated and use deterministic fallbacks when a model is unavailable or invalid.
- Action, provider-call, provider-request, and model-call budgets prevent unbounded tool loops.
- Final creator ranking is deterministic from stored inputs and score configuration; an LLM does not silently decide the winner.

## Qloo-powered capabilities

| Capability | How Qloo is used | Why it matters |
|---|---|---|
| Campaign fingerprint | Resolves references and tags; researches market-conditioned Taste Graph signals | Grounds an ambiguous brief in observed cultural relationships. |
| Creator resonance | Matches Qloo-resolved creator-content signals to campaign signals in the target market | Measures fit to the campaign, not just local topic popularity. |
| Person-level fallback | Validates an exact Qloo person entity when content evidence is unavailable | Keeps weaker profile-level evidence clearly distinct from content evidence. |
| Qloo ablation | Re-scores the same candidates without cultural affinity | Makes Qloo's effect on ranking inspectable. |
| Cultural exploration | Supports entity comparison, signal heatmaps, and regional trending public figures | Helps marketers understand the surrounding cultural context. |

## Product capabilities

- Authenticated campaign workspace and private campaign history.
- Campaign briefs with market, platform, follower, budget, language, and audience-conditioning inputs.
- Qloo entity/tag resolution with explicit unresolved or ambiguous states.
- Market-aware cultural fingerprints, comparison, heatmap, and trend views.
- Apify-based creator discovery with persisted runs, retries, idempotency, and webhook completion.
- Creator normalization that does not invent unavailable fields.
- Transparent 0-100 creator-fit scoring with component-level evidence and caveats.
- Broad-versus-refined and with-Qloo-versus-without-Qloo comparisons.
- CSV export and print-friendly campaign reports.

## Scoring and evidence policy

The cultural-affinity component carries 35% of available score weight. It is calculated from Qloo affinity between resolved creator-content signals and resolved campaign signals, weighted by evidence quality. If the necessary evidence is missing, the component is marked unavailable instead of fabricated or converted to zero.

CultureMatch deliberately does **not** claim that:

- A creator's location proves their audience geography.
- A Qloo affinity score predicts sales, conversion, or ROI.
- A public cultural trend proves Instagram reach or campaign performance.
- Missing fees, audience data, or post-content data are known facts.

Those constraints are shown as caveats in the product.

## Tech stack

- Next.js and React
- TypeScript
- Supabase Auth and Postgres with owner-scoped RLS
- Qloo Taste Graph API
- Apify influencer-discovery actor
- Vercel AI SDK with OpenRouter for bounded, schema-validated agent decisions
- Zod for runtime validation
- Tailwind CSS and Base UI

## Run locally

### Prerequisites

- Node.js 20+
- pnpm
- A Supabase project
- Qloo API credentials and active endpoint URLs
- An Apify API token and compatible influencer actor
- Optional: OpenRouter credentials for model-assisted planning and critics

### Setup

```bash
pnpm install
copy lib\env.example .env.local
```

Fill in `.env.local`. Keep all provider credentials server-side; do not commit this file.

| Group | Required values |
|---|---|
| Qloo | `QLOO_BASE_URL`, `QLOO_API_KEY`, `QLOO_SEARCH_URL`, `QLOO_TAGS_URL`, `QLOO_INSIGHTS_URL`, `QLOO_COMPARE_URL` |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Apify | `APIFY_API_TOKEN`, `APIFY_ACTOR_ID`, `APIFY_WEBHOOK_SECRET` |
| OpenRouter (optional) | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` |

Apply the canonical SQL migrations in `supabase/migrations` to the Supabase project. The matching files under `lib/db/migrations` are retained for migration-contract tests.

Start the application:

```bash
pnpm dev
```

Visit `http://localhost:3000`, create an account, and create a campaign at `/campaigns/new`.

### Apify webhook

For asynchronous actor completion, configure the deployed webhook URL:

```text
https://YOUR_DOMAIN/api/internal/apify/webhook
```

Enable these terminal events:

- `ACTOR.RUN.SUCCEEDED`
- `ACTOR.RUN.FAILED`
- `ACTOR.RUN.ABORTED`
- `ACTOR.RUN.TIMED_OUT`

Set the webhook authorization header to `Bearer <APIFY_WEBHOOK_SECRET>`.

## Quality checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The test suite covers Qloo request construction and response parsing, Apify normalization and terminal states, cultural-resonance scoring, Qloo ablation, agent budget enforcement, workflow transitions, database migration contracts, and export behavior.

## Deployment

Deploy the Next.js application to a public host, configure the environment variables there, apply Supabase migrations, and register the public Apify webhook URL. Confirm that a new authenticated user can submit a campaign and receive results end to end using non-private credentials and access paths.

`/api/health` is available for deployment health checks. The `/trending` page exposes regional Qloo public-entity momentum as directional cultural context.

## Hackathon submission checklist

- [ ] Add the public demo URL at the top of this README.
- [ ] Add the public repository URL at the top of this README.
- [ ] Confirm an end-to-end campaign works in the deployed application.
- [ ] Add an open-source `LICENSE` file at the repository root and select it in the repository's About section.
- [ ] Verify no secrets, private URLs, or private access requirements remain.

## License

An open-source license file must be added before hackathon submission. MIT is a straightforward choice for this project, but the final license should match the repository owner's intent.
