# Phase 1 database foundation

`migrations/0001_foundation.sql` is the reviewed schema source for the five Phase 1 tables:

- `campaigns`
- `analysis_runs`
- `culture_profiles`
- `creator_candidates`
- `creator_matches`

`migrations/0002_security_hardening.sql` removes public execution privileges from the existing `public.rls_auto_enable()` event-trigger function.

The repository instructions keep new files under `app/` and `lib/`, so the migration is stored under `lib/db/migrations/`. Apply its SQL through the Supabase migration workflow before exercising the API against the project.

The schema uses authenticated owner-scoped RLS. Every table carries `user_id`, every child table has composite ownership foreign keys, and the service-role key is never used by the application data-access modules.

After applying the migration, verify the following with the Supabase CLI or MCP:

1. All five tables exist in `public`.
2. RLS is enabled on all five tables.
3. `anon` has no table grants and `authenticated` has only the intended CRUD grants.
4. Two authenticated users cannot read or update each other's campaigns or child records.
5. Database advisors report no missing RLS policies for these tables and no publicly executable security-definer helpers.
