import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { analyzeCulture } from "./analyze-culture.ts"
import { createQlooClient, serializeQlooAgeRange } from "./client.ts"
import { enrichCreatorsWithQloo } from "./enrich-creators.ts"
import { resolveEntities } from "./resolve-entities.ts"
import type { CampaignBrief } from "../../domain/types.ts"
import { ProviderError } from "../provider-errors.ts"
import { parseTrendingEntities } from "./trending.ts"

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
  productDescription: "Urban streetwear",
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
  assert.equal(result.signals.length, 12)
  assert.equal(result.signals[1]?.name, "Streetwear")
  assert.equal(result.signals[2]?.name, "Hindi Cinema")
  assert.equal(result.signals[2]?.evidence.verification, "provider_reported")
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
    fetchImpl: async (input) => {
      if (input.includes("/search")) {
        return new Response(JSON.stringify(entityFixture), { status: 200 })
      }
      if (input.includes("/tags")) {
        return new Response(JSON.stringify(tagFixture), { status: 200 })
      }
      insightsBody = Object.fromEntries(new URL(input).searchParams.entries())
      return new Response(JSON.stringify(tasteFixture), { status: 200 })
    },
  })

  await analyzeCulture(brief, client)
  assert.equal(
    insightsBody?.["signal.interests.entities"],
    "C70CE2B8-0AD1-4150-BF18-5A6347F2E860"
  )
  assert.equal(insightsBody?.["signal.interests.entities.weights"], "30")
  assert.equal(insightsBody?.["operator.signal.interests.tags"], "intersection")
  assert.equal(insightsBody?.["feature.explainability"], "true")
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

test("Qloo validates creators from the documented person insight response", async () => {
  const personPayload = {
    results: {
      entities: [{
        entity_id: "person-1",
        name: "Urban Streetwear",
        affinity: 0.91,
        popularity: 0.87,
        tags: [{ id: "urn:tag:genre:person:influencer", name: "Influencer" }],
      }],
    },
  }
  const client = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    apiKey: "test-key",
    fetchImpl: async (input) => {
      const url = new URL(input)
      if (url.searchParams.get("filter.type") === "urn:entity:person")
        return new Response(JSON.stringify(personPayload), { status: 200 })
      if (input.includes("/tags"))
        return new Response(JSON.stringify(tagFixture), { status: 200 })
      return new Response(JSON.stringify(tagAffinityFixture), { status: 200 })
    },
  })
  const evidence = {
    source: "apify" as const,
    fieldPath: "$.creator.bio",
    observedAt: "2026-10-24T00:00:00.000Z",
    verification: "provider_reported" as const,
  }
  const [creator] = await enrichCreatorsWithQloo(
    [{
      provider: "apify",
      providerCreatorId: "creator-person-1",
      name: "Urban Streetwear",
      platform: "instagram",
      contentSignals: [],
      missingFields: [],
      sourceFields: {},
      evidence: [evidence],
    }],
    "Berlin",
    client
  )
  assert.equal(creator.qlooEntityId, "person-1")
  assert.equal(creator.qlooAffinity, 0.91)
  assert.equal(creator.qlooPopularity, 0.87)
})

test("Qloo exposes documented comparison and heatmap request contracts", async () => {
  const requests: string[] = []
  const client = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    compareUrl: "https://qloo.test/v2/analysis/compare",
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
  const requests: string[] = []
  const client = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    tagsUrl: "https://qloo.test/v2/tags",
    apiKey: "test-key",
    fetchImpl: async (input) => {
      requests.push(input)
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

  assert.match(requests[0] ?? "", /query=streetwear/)
  assert.doesNotMatch(requests[1] ?? "", /operator\.signal\.interests\.tags/)
})

test("Qloo serializes audience conditioning as a comma-separated signal", async () => {
  let requestUrl: URL | undefined
  const client = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    apiKey: "test-key",
    fetchImpl: async (input) => {
      requestUrl = new URL(input)
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
    requestUrl?.searchParams.get("signal.demographics.audiences"),
    "urn:audience:one,urn:audience:two"
  )
})

test("Qloo expands the legacy 25 to 34 campaign range into valid age buckets", async () => {
  let requestUrl: URL | undefined
  const client = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    apiKey: "test-key",
    fetchImpl: async (input) => {
      requestUrl = new URL(input)
      return new Response(JSON.stringify({ results: { tags: [] } }), { status: 200 })
    },
  })

  await client.getInsights({
    filterType: "urn:tag",
    ageRange: "25_to_34",
    take: 10,
  })

  assert.equal(
    requestUrl?.searchParams.get("signal.demographics.age"),
    "25_to_29,30_to_34"
  )
  assert.equal(serializeQlooAgeRange("35_and_younger"), "35_and_younger")
})

test("Qloo parses trending public-entity metrics without inventing social fields", () => {
  const entities = parseTrendingEntities({
    results: {
      entities: [
        {
          entity_id: "person-1",
          name: "Public Figure",
          types: ["urn:entity:person"],
          query: { trending: 0.82, affinity: 0.74, popularity: 0.61 },
        },
      ],
    },
  })
  assert.deepEqual(entities, [{
    entityId: "person-1",
    name: "Public Figure",
    types: ["urn:entity:person"],
    trendScore: 0.82,
    affinity: 0.74,
    popularity: 0.61,
  }])
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
