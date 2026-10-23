import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationPath = new URL("./migrations/0001_foundation.sql", import.meta.url)

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

test("security hardening migration does not expose the RLS event trigger", async () => {
  const securityMigrationPath = new URL("./migrations/0002_security_hardening.sql", import.meta.url)
  const sql = await readFile(securityMigrationPath, "utf8")

  assert.match(sql, /revoke execute on function public\.rls_auto_enable\(\) from public, anon, authenticated;/)
})
