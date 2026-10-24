# CultureMatch

CultureMatch helps marketers compare a normal creator search with a culture-informed search for a regional campaign.

## Workflow

1. Submit a campaign brief.
2. Resolve cultural references and research regional taste signals with Qloo.
3. Build baseline and culture-informed Instagram search plans.
4. Run both searches through the Influship influencer-search actor on Apify.
5. Normalize creators and calculate deterministic campaign-fit scores.
6. Compare shortlist overlap and rank changes.
7. Optionally generate evidence-grounded creator concepts through OpenRouter.

The analysis is a ranking aid, not a validated prediction of sales, conversions, or ROI. Audience geography and creator fees are reported as unavailable when the providers do not supply them.

## Local setup

Install dependencies with pnpm, then copy the environment template into the project environment:

```bash
pnpm install
copy lib\\phase-0\\env.example .env.local
```

Configure Supabase, Qloo, and Apify server credentials in `.env.local`. OpenRouter is optional and only used when both `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` are set with the relevant feature flag enabled.

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

The campaign page supports a print-friendly report and an authenticated CSV export at `/api/campaigns/:id/export`. `/api/health` is available for deployment health checks.

## Repository notes

Provider credentials remain server-side. Results expose normalized provider evidence and caveats, while raw provider payloads are retained only when explicitly enabled and expire according to the configured retention period.

Choose and add a repository license before publishing the project publicly.
