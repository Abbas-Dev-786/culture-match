# Phase 1 — Foundation and Secure Persistence

**Purpose:** Establish the application skeleton, domain contracts, database, security boundaries, and workflow state machine.

**Depends on:** Validated provider contracts and test fixtures

**Exit condition:** The application can create and retrieve a campaign/run record, validate inputs, enforce legal state transitions, and pass database/security tests.

## Build order

### P1-01 — Bootstrap and verify the runtime

Create the application shell, install pinned dependencies, configure strict TypeScript, and add lint/test commands. Verify that a clean checkout can install dependencies and start the development server before adding business logic.

### P1-02 — Add contracts first

Create the domain types and runtime schemas in `types/` and `lib/validation/`. Add tests for valid global markets, invalid market scopes, follower/budget bounds, candidate limits, and unknown optional fields.

### P1-03 — Add migrations and database access

Create the initial Supabase migration files for the five core tables. Implement server-only data-access modules in `lib/db/`. Keep SQL schema changes in migrations and keep provider payloads separate from normalized fields.

### P1-04 — Add RLS and access tests

Enable RLS in the migration. Add policies for the selected auth mode. Add a test that proves a user cannot read another user's campaign, or that unauthenticated access is limited to the explicitly supported public-demo behavior.

### P1-05 — Add the state machine

Implement `lib/workflow/state-machine.ts` with transition guards, terminal-state protection, retry-attempt creation, and safe error persistence. Test every legal and illegal transition.

### P1-06 — Add the API skeleton

Create the route handlers and connect only campaign creation, status retrieval, and results placeholders. Add idempotency handling before connecting external providers.

### P1-07 — Add the minimal UI shell

Create the new-campaign route, campaign route, and basic loading/error states. The UI should prove the API contract and refresh behavior, not final styling.

## 1. Bootstrap the repository

Create or verify:

- Next.js App Router application with TypeScript.
- Strict TypeScript settings.
- Pinned dependency versions and committed lockfile.
- Formatting and linting configuration.
- Unit-test runner and browser-test scaffolding.
- `.env.example` containing names only, never secrets.
- `.gitignore` covering `.env*`, local fixtures containing sensitive data, build output, and runtime logs.

Keep all provider clients and secret-dependent modules server-only.

## 2. Establish the directory structure

Use the TDD layout as the baseline:

```text
app/
  campaigns/new/
  campaigns/[id]/
  api/campaigns/
components/
lib/
  agent/
  workflow/
  tools/qloo/
  tools/apify/
  matching/
  db/
  validation/
  observability/
types/
supabase/migrations/
fixtures/
```

Do not add separate services or a vector database during this phase.

## 3. Define domain contracts

Implement and validate the internal contracts from the TDD:

- `CampaignBrief` with country, optional region/city, and market scope.
- `CampaignStatus` and workflow stages.
- `EvidenceRef` with source, field path, observed time, and verification state.
- `CultureSignal`.
- `NormalizedCreator`.
- `ScoreComponent`.
- `CreatorMatch`.

Rules:

- Provider payload types are separate from normalized domain types.
- Unknown provider fields remain in a controlled raw payload object only.
- Numeric fields are normalized explicitly.
- Optional fields remain optional; do not use placeholder values such as `0` or `unknown` when the source is missing.
- Use schema validation at every external and API boundary.

## 4. Create the database schema

Create migrations for:

- `campaigns`.
- `analysis_runs`.
- `culture_profiles`.
- `creator_candidates`.
- `creator_matches`.

Include:

- UUID primary keys.
- UTC timestamps.
- Foreign keys and useful indexes.
- Unique idempotency key for analysis runs.
- Provider run and dataset IDs.
- Score algorithm version.
- JSONB for versioned provider summaries and normalized sub-objects.
- Retention metadata or deletion timestamps where raw payloads are stored.

Add indexes for campaign/run lookup, status, provider run ID, and candidate lookup within a run.

## 5. Secure Supabase access

- Enable RLS on every table in an exposed schema.
- If auth is enabled, add policies using the campaign owner relationship.
- Policies must constrain rows, not merely check that a user is authenticated.
- Any UPDATE policy must include both `USING` and `WITH CHECK` where applicable.
- Do not authorize with editable user metadata.
- Do not expose the service-role key or secret key to browser code.
- Prefer publishable/legacy public keys only where the client truly needs them.
- Verify Data API exposure and grants separately from RLS.
- Avoid public views that bypass RLS; use security-invoker views or a private schema if views are required.

If the MVP has no auth, keep campaign writes behind server-side code and document that the demo is not a multi-user private workspace.

## 6. Implement the workflow state machine

Implement legal transitions for:

```text
queued
  -> researching_culture
  -> searching_creators
  -> scoring
  -> generating_report
  -> completed

Any active state -> failed
Failed -> new retry attempt
Active state -> cancelled only if cancellation is implemented
```

Requirements:

- Terminal states cannot be mutated accidentally.
- Retry creates a new attempt or run record and preserves history.
- State changes record timestamps and safe error metadata.
- Invalid transitions fail deterministically.
- The browser never directly controls a provider state.

## 7. Create internal API contracts

Implement the application-level contracts for:

- `POST /api/campaigns`.
- `POST /api/campaigns/:id/analyze`.
- `GET /api/campaigns/:id/status`.
- `GET /api/campaigns/:id/results`.
- `POST /api/campaigns/:id/retry`.

Each endpoint must:

- Validate request input.
- Return only client-safe fields.
- Use stable error codes and safe messages.
- Enforce idempotency where a remote job or database write can be duplicated.
- Avoid provider calls from read-only status endpoints.

## 8. Add the initial application shell

Create minimal pages for:

- New campaign form placeholder.
- Campaign progress placeholder.
- Results placeholder.

The UI only needs to prove routing, campaign creation, and status retrieval in this phase. Do not spend time on final visual polish.

## Tests and evidence

- Campaign schema accepts valid global market inputs and rejects invalid combinations.
- Oversized strings, unsupported limits, and invalid follower ranges are rejected.
- State machine accepts legal transitions and rejects illegal transitions.
- Duplicate idempotency keys do not create duplicate runs.
- RLS policies prevent cross-owner reads when auth is enabled.
- Service-role key is absent from client bundles.
- API errors do not include provider tokens or raw credentials.
- Database foreign keys and unique constraints behave as expected.

## Deliverables

- Bootstrap configuration and lockfile.
- Domain schemas and types.
- Supabase migrations and policy definitions.
- State machine implementation.
- API route skeletons.
- Minimal routed UI.
- Unit and database integration tests.

## Exit checklist

- [ ] A campaign can be created and retrieved by ID.
- [ ] An analysis run is persisted with an idempotency key.
- [ ] Status survives a page refresh.
- [ ] Invalid transitions are blocked.
- [ ] RLS and secret boundaries are tested.
- [ ] Provider fixtures and validated contracts are accessible to the application.
