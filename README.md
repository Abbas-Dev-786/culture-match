# CultureMatch

CultureMatch is pivoting into a cultural launch intelligence product for premium beauty and wellness brands entering Indian cities. It uses Qloo to build a location-conditioned cultural fingerprint, find culturally adjacent opportunities, and generate an evidence-backed activation brief.

The creator-search workflow remains in the repository as legacy implementation during the migration. It is not part of the new MVP definition.

## Workflow

1. Submit a focused launch brief with a brand, product, city, opportunity type, and cultural references.
2. Resolve the inputs through Qloo.
3. Build market, brand, product, reference, and combined cultural fingerprint layers.
4. Discover opportunities for one validated Qloo entity type.
5. Rank opportunities using documented provider signals and evidence.
6. Generate an activation brief with facts, derived observations, hypotheses, and open questions.

The analysis is cultural decision support, not a prediction of sales, conversions, ROI, partnership availability, or audience reach.

## Local setup

Install dependencies with pnpm, then copy the environment template into the project environment:

```bash
pnpm install
copy lib\\phase-0\\env.example .env.local
```

Configure Supabase and Qloo server credentials in `.env.local`. OpenRouter is optional and only used to generate the evidence-grounded activation brief when both `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` are set with the relevant feature flag enabled. Apify credentials remain temporarily available for the legacy workflow and will be removed or isolated during the pivot implementation.

Apply the SQL migrations in `supabase/migrations` to the Supabase project before running a campaign. The `lib/db/migrations` directory is retained as the reviewed SQL source used by the migration tests; new deployments should use the canonical Supabase folder.

Start the development server:

```bash
pnpm dev
```

The application requires an authenticated user to create and view private campaigns.

## Product documents

- [Product requirements](docs/PRD.md)
- [Technical design](docs/TDD.md)
- [Implementation plan](plan/implementation-plan.md)
- [Qloo intelligence plan](docs/qloo-cultural-resonance-plan.md)

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
