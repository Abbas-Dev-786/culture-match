import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { analyzeCulture } from "./analyze-culture.ts"
import { createQlooClient } from "./client.ts"
import { resolveEntities } from "./resolve-entities.ts"
import type { CampaignBrief } from "../../domain/types.ts"
import { ProviderError } from "../provider-errors.ts"

const entityFixture = JSON.parse(
  await readFile(
    new URL(
      "../../phase-0/fixtures/qloo/entity_search-response.json",
      import.meta.url
    ),
    "utf8"
  )
) as unknown
const tasteFixture = JSON.parse(
  await readFile(
    new URL(
      "../../phase-0/fixtures/qloo/location_taste-response.json",
      import.meta.url
    ),
    "utf8"
  )
) as unknown

const brief: CampaignBrief = {
  brandName: "Nike",
  productCategory: "Streetwear",
  targetMarket: { country: "India", marketScope: "country" },
  objective: "Regional launch awareness",
  culturalReferences: ["Nike"],
  preferredLanguages: ["English", "Hindi"],
  creatorLimit: 5,
}

test("Qloo resolves exact references and normalizes location signals", async () => {
  const client = createFixtureClient()
  const resolved = await resolveEntities(
    ["Nike"],
    client,
    "2026-10-23T00:00:00.000Z"
  )
  assert.equal(resolved[0]?.status, "resolved")
  assert.equal(resolved[0]?.name, "Nike")

  const result = await analyzeCulture(brief, client, "2026-10-23T00:00:00.000Z")
  assert.equal(result.location.name, "India")
  assert.equal(result.signals.length, 11)
  assert.equal(result.signals[1]?.name, "Hindi Cinema")
  assert.equal(result.signals[1]?.evidence.verification, "provider_reported")
})

test("Qloo keeps unresolved references explicit", async () => {
  const client = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    apiKey: "test-key",
    fetchImpl: async () =>
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
  })
  const resolved = await resolveEntities(["Unknown Brand"], client)
  assert.equal(resolved[0]?.status, "unresolved")
  assert.deepEqual(resolved[0]?.candidates, [])
})

test("Qloo includes resolved reference entities in the Insights signal", async () => {
  let insightsUrl = ""
  const client = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    apiKey: "test-key",
    fetchImpl: async (input) => {
      if (input.includes("/search")) {
        return new Response(JSON.stringify(entityFixture), { status: 200 })
      }
      insightsUrl = input
      return new Response(JSON.stringify(tasteFixture), { status: 200 })
    },
  })

  await analyzeCulture(brief, client)
  const url = new URL(insightsUrl)
  assert.equal(
    url.searchParams.get("signal.interests.entities"),
    "C70CE2B8-0AD1-4150-BF18-5A6347F2E860"
  )
})

test("Qloo classifies rate limits, schema mismatches, and empty signals", async () => {
  const rateLimited = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    apiKey: "test-key",
    fetchImpl: async () => new Response("", { status: 429 }),
  })
  await assert.rejects(
    () =>
      rateLimited.searchEntities({
        query: "Nike",
        types: "urn:entity:brand",
        take: 5,
      }),
    (error: unknown) =>
      error instanceof ProviderError &&
      error.code === "RATE_LIMITED" &&
      error.retryable
  )

  const malformed = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    apiKey: "test-key",
    fetchImpl: async () =>
      new Response(JSON.stringify({ unexpected: true }), { status: 200 }),
  })
  await assert.rejects(
    () =>
      malformed.searchEntities({
        query: "Nike",
        types: "urn:entity:brand",
        take: 5,
      }),
    (error: unknown) =>
      error instanceof ProviderError && error.code === "SCHEMA_MISMATCH"
  )

  const empty = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    apiKey: "test-key",
    fetchImpl: async (input) =>
      new Response(
        JSON.stringify(
          input.includes("/search")
            ? { results: [] }
            : {
                results: { tags: [] },
                query: { localities: { signal: { name: "India" } } },
              }
        ),
        { status: 200 }
      ),
  })
  await assert.rejects(
    () => analyzeCulture({ ...brief, culturalReferences: [] }, empty),
    (error: unknown) =>
      error instanceof ProviderError && error.code === "EMPTY_RESULT"
  )
})

function createFixtureClient() {
  return createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    apiKey: "test-key",
    fetchImpl: async (input) => {
      const body = input.includes("/search") ? entityFixture : tasteFixture
      return new Response(JSON.stringify(body), { status: 200 })
    },
  })
}
