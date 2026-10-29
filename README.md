# CultureMatch

CultureMatch helps marketers discover creators for regional campaigns using broad search, Qloo cultural enrichment, and an optional agent-selected refinement search.

## Workflow

1. Submit a campaign brief.
2. Resolve cultural references and research regional taste signals with Qloo.
3. Build a broad Instagram creator-search plan from campaign constraints.
4. Run the broad search through the Influship influencer-search actor on Apify.
5. Enrich creators with Qloo cultural evidence and let the critic decide whether one refinement search is justified.
6. Normalize creators and calculate deterministic campaign-fit scores.
7. Compare broad and optional refinement shortlist overlap and rank changes.
8. Optionally generate evidence-grounded creator concepts through OpenRouter.
9. Revisit campaigns from private history, save searches, and inspect Qloo trends.

The analysis is a ranking aid, not a validated prediction of sales, conversions, or ROI. Audience geography and creator fees are reported as unavailable when the providers do not supply them.

## Local setup

Install dependencies with pnpm, then copy the environment template into the project environment:

```bash
pnpm install
copy lib\\phase-0\\env.example .env.local
```

Configure Supabase, Qloo, and Apify server credentials in `.env.local`. OpenRouter is optional; when its credentials are present, the system uses it for validated search planning, bounded refinement decisions and evidence-grounded reports. Without model credentials, deterministic fallbacks keep the workflow fully operational.

Apply the SQL migrations in `supabase/migrations` to the Supabase project before running a campaign. The `lib/db/migrations` directory is retained as the reviewed SQL source used by the migration tests; new deployments should use the canonical Supabase folder.

Start the development server:

```bash
pnpm dev
```

The application requires an authenticated user to create and view private campaigns.

## Apify webhook

Configure the deployed webhook URL as:

```text
https://your-domain.com/api/internal/apify/webhook
```

Enable these terminal events:

- `ACTOR.RUN.SUCCEEDED`
- `ACTOR.RUN.FAILED`
- `ACTOR.RUN.ABORTED`
- `ACTOR.RUN.TIMED_OUT`

Set the webhook authorization header to `Bearer <APIFY_WEBHOOK_SECRET>`.

## Useful commands

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The campaign page supports a print-friendly report / browser PDF save and an authenticated CSV export at `/api/campaigns/:id/export`. Authenticated campaign history is available at `/campaigns`; Qloo trends are available at `/trending`. `/api/health` is available for deployment health checks.

## Repository notes

Provider credentials remain server-side. Results expose normalized provider evidence and caveats, while raw provider payloads are retained only when explicitly enabled and expire according to the configured retention period.

Choose and add a repository license before publishing the project publicly.
