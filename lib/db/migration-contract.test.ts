import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationPath = new URL("./migrations/0001_foundation.sql", import.meta.url)
const canonicalMigrationPath = new URL(
  "../../supabase/migrations/20261023053521_foundation.sql",
  import.meta.url
)

test("foundation migration defines all core tables and owner RLS", async () => {
  const sql = await readFile(migrationPath, "utf8")
  for (const table of [
    "campaigns",
    "analysis_runs",
    "culture_profiles",
    "creator_candidates",
    "creator_matches",
  ]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`))
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`))
  }

  assert.match(sql, /to authenticated/)
  assert.match(sql, /using \(\(select auth\.uid\(\)\) = user_id\)/)
  assert.match(sql, /with check \(\(select auth\.uid\(\)\) = user_id\)/)
  assert.match(sql, /revoke all [\s\S]* from public, anon/)
  assert.doesNotMatch(sql, /user_metadata/)
})

test("canonical Supabase foundation matches the application schema", async () => {
  const sql = await readFile(canonicalMigrationPath, "utf8")
  assert.match(sql, /market_scope text not null/)
  assert.match(sql, /cultural_references text\[\]/)
  assert.match(sql, /normalized_payload jsonb/)
  assert.doesNotMatch(sql, /target_demographics text not null/)
})

test("security hardening migration does not expose the RLS event trigger", async () => {
  const securityMigrationPath = new URL("./migrations/0002_security_hardening.sql", import.meta.url)
  const sql = await readFile(securityMigrationPath, "utf8")

  assert.match(sql, /revoke execute on function public\.rls_auto_enable\(\) from public, anon, authenticated;/)
})

test("workflow guards migration adds durable provider-start claims and FK indexes", async () => {
  const workflowMigrationPath = new URL("./migrations/0003_workflow_guards.sql", import.meta.url)
  const sql = await readFile(workflowMigrationPath, "utf8")

  assert.match(sql, /provider_start_claim_token text/)
  assert.match(sql, /provider_start_claimed_until timestamptz/)
  assert.match(sql, /analysis_runs_provider_start_claim_idx/)
  assert.match(sql, /creator_matches_candidate_user_fk_idx/)
})

test("matching results migration stores both search variants and scored evidence", async () => {
  const sql = await readFile(
    new URL("./migrations/0004_matching_results.sql", import.meta.url),
    "utf8"
  )
  assert.match(sql, /baseline_provider_run_id text/)
  assert.match(sql, /search_variant text not null/)
  assert.match(sql, /creator_candidates_run_provider_variant_key/)
  assert.match(sql, /evidence_completeness numeric/)
  assert.match(sql, /campaign_concept jsonb/)
  assert.match(sql, /comparison_metadata jsonb/)
})

test("Qloo conditioning migration stores explicit audience and demographic inputs", async () => {
  const sql = await readFile(
    new URL("./migrations/0005_qloo_conditioning.sql", import.meta.url),
    "utf8"
  )
  assert.match(sql, /qloo_audience_ids text\[\]/)
  assert.match(sql, /qloo_audience_weight numeric/)
  assert.match(sql, /qloo_age_range text/)
  assert.match(sql, /qloo_gender text/)
  assert.match(sql, /campaigns_qloo_age_range_check/)
})

test("canonical Supabase Qloo conditioning migration is present", async () => {
  const sql = await readFile(
    new URL(
      "../../supabase/migrations/20261024100000_qloo_conditioning.sql",
      import.meta.url
    ),
    "utf8"
  )
  assert.match(sql, /qloo_audience_ids text\[\]/)
  assert.match(sql, /campaigns_qloo_gender_check/)
})
