import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { analyzeCulture } from "./analyze-culture.ts"
import { createQlooClient } from "./client.ts"
import { enrichCreatorsWithQloo } from "./enrich-creators.ts"
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
const tagFixture = {
  results: [
    {
      tag_id: "urn:tag:category:streetwear",
      name: "Streetwear",
      types: ["urn:entity:brand"],
    },
  ],
}
const tagAffinityFixture = {
  results: {
    tags: [
      {
        tag_id: "urn:tag:category:streetwear",
        name: "Streetwear",
        types: ["urn:entity:brand"],
        query: { affinity: 0.92 },
      },
    ],
  },
  query: { localities: { signal: { name: "India" } } },
}

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
  assert.deepEqual(
    result.fingerprint.layers.map((layer) => layer.group),
    ["market", "brand", "product", "reference", "combined"]
  )
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
  let insightsBody: Record<string, unknown> | undefined
  const client = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    apiKey: "test-key",
    fetchImpl: async (input, init) => {
      if (input.includes("/search")) {
        return new Response(JSON.stringify(entityFixture), { status: 200 })
      }
      if (input.includes("/tags")) {
        return new Response(JSON.stringify(tagFixture), { status: 200 })
      }
      insightsBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return new Response(JSON.stringify(tasteFixture), { status: 200 })
    },
  })

  await analyzeCulture(brief, client)
  assert.equal(
    JSON.stringify(insightsBody?.["signal.interests.entities"]),
    JSON.stringify([
      { id: "C70CE2B8-0AD1-4150-BF18-5A6347F2E860", weight: 30 },
    ])
  )
  assert.equal(insightsBody?.["operator.signal.interests.tags"], "intersection")
  assert.equal(insightsBody?.["feature.explainability"], true)
})

test("Qloo enriches creator content with location-conditioned affinity", async () => {
  const client = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    apiKey: "test-key",
    fetchImpl: async (input) => {
      if (input.includes("/tags")) {
        return new Response(JSON.stringify(tagFixture), { status: 200 })
      }
      return new Response(JSON.stringify(tagAffinityFixture), { status: 200 })
    },
  })
  const evidence = {
    source: "apify" as const,
    fieldPath: "$.posts[0].caption",
    observedAt: "2026-10-24T00:00:00.000Z",
    verification: "provider_reported" as const,
  }
  const [creator] = await enrichCreatorsWithQloo(
    [
      {
        provider: "apify",
        providerCreatorId: "creator-1",
        name: "Urban Streetwear",
        platform: "instagram",
        contentSignals: [
          { text: "Streetwear", sourceField: "posts", evidence },
        ],
        missingFields: [],
        sourceFields: {},
        evidence: [evidence],
      },
    ],
    "India",
    client
  )
  assert.equal(creator.qlooSignals?.[0]?.signalId, "urn:tag:category:streetwear")
  assert.equal(creator.qlooSignals?.[0]?.affinity, 0.92)
})

test("Qloo exposes documented comparison and heatmap request contracts", async () => {
  const requests: string[] = []
  const client = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    compareUrl: "https://qloo.test/v2/insights/compare",
    apiKey: "test-key",
    fetchImpl: async (input) => {
      requests.push(input)
      return new Response(JSON.stringify({ results: { tags: [] } }), { status: 200 })
    },
  })
  await client.compareInsights({
    filterType: "urn:tag",
    groupAEntityIds: ["brand-1"],
    groupBEntityIds: ["reference-1", "reference-2"],
    locationQuery: "India",
    take: 10,
  })
  await client.getHeatmap({
    locationQuery: "India",
    tagIds: ["urn:tag:streetwear"],
    boundary: "city",
    ageRange: "35_and_younger",
    gender: "female",
  })
  assert.match(requests[0] ?? "", /a\.signal\.interests\.entities=brand-1/)
  assert.match(requests[0] ?? "", /b\.signal\.interests\.entities=reference-1%2Creference-2/)
  assert.match(requests[1] ?? "", /filter\.type=urn%3Aheatmap/)
  assert.match(requests[1] ?? "", /output\.heatmap\.boundary=city/)
  assert.match(requests[1] ?? "", /signal\.demographics\.gender=female/)
})

test("Qloo uses the tag filter query and omits tag operators without tags", async () => {
  const requests: Array<{ input: string; body?: string }> = []
  const client = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    tagsUrl: "https://qloo.test/v2/tags",
    apiKey: "test-key",
    fetchImpl: async (input, init) => {
      requests.push({ input, body: typeof init?.body === "string" ? init.body : undefined })
      return new Response(JSON.stringify({ results: { tags: [] } }), { status: 200 })
    },
  })

  await client.searchTags({ query: "streetwear", take: 5 })
  await client.getInsights({
    filterType: "urn:tag",
    locationQuery: "India",
    tagOperator: "intersection",
    take: 10,
  })

  assert.match(requests[0]?.input ?? "", /filter\.query=streetwear/)
  assert.doesNotMatch(
    requests[1]?.body ?? "",
    /operator\.signal\.interests\.tags/
  )
})

test("Qloo serializes audience conditioning as a comma-separated signal", async () => {
  let body: Record<string, unknown> | undefined
  const client = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    apiKey: "test-key",
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>
      return new Response(JSON.stringify({ results: { tags: [] } }), { status: 200 })
    },
  })

  await client.getInsights({
    filterType: "urn:tag",
    locationQuery: "India",
    audienceIds: ["urn:audience:one", "urn:audience:two"],
    audienceWeight: 25,
    take: 10,
  })

  assert.equal(
    body?.["signal.demographics.audiences"],
    "urn:audience:one,urn:audience:two"
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
          input.includes("/search") || input.includes("/tags")
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
      const body = input.includes("/search")
        ? entityFixture
        : input.includes("/tags")
          ? tagFixture
          : tasteFixture
      return new Response(JSON.stringify(body), { status: 200 })
    },
  })
}
