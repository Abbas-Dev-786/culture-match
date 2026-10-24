# Phase 1 database foundation

`migrations/0001_foundation.sql` is the reviewed schema source for the five Phase 1 tables:

- `campaigns`
- `analysis_runs`
- `culture_profiles`
- `creator_candidates`
- `creator_matches`

`migrations/0002_security_hardening.sql` removes public execution privileges from the existing `public.rls_auto_enable()` event-trigger function.

`migrations/0003_workflow_guards.sql` adds durable provider-start leases and indexes the composite foreign keys used by the workflow tables.

`migrations/0004_matching_results.sql` adds baseline/culture-informed provider runs, search variants, versioned score metadata, evidence completeness, caveats, concepts, and comparison metadata.

The canonical deployment files are in `supabase/migrations/`. The matching files in `lib/db/migrations/` are retained as the reviewed SQL source used by the migration tests. Apply the canonical Supabase migrations before exercising the API against the project.

The schema uses authenticated owner-scoped RLS. Every table carries `user_id`, every child table has composite ownership foreign keys, and normal user-facing data access uses the publishable client with RLS. The production Apify webhook is a separately authenticated internal route and uses the service-role client only after validating its bearer secret.

After applying the migration, verify the following with the Supabase CLI or MCP:

1. All five tables exist in `public`.
2. RLS is enabled on all five tables.
3. `anon` has no table grants and `authenticated` has only the intended CRUD grants.
4. Two authenticated users cannot read or update each other's campaigns or child records.
5. Database advisors report no missing RLS policies for these tables and no publicly executable security-definer helpers.
