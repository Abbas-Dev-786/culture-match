import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { analyzeCulture, getTagOperator } from "./analyze-culture.ts"
import { createQlooClient, serializeQlooAgeRange } from "./client.ts"
import { enrichCreatorsWithQloo } from "./enrich-creators.ts"
import { resolveEntities } from "./resolve-entities.ts"
import { expandTagQueries, resolveTags } from "./resolve-tags.ts"
import type { CampaignBrief } from "../../domain/types.ts"
import { ProviderError } from "../provider-errors.ts"
import {
  getTrendingPublicFigures,
  parseTrendingEntities,
} from "./trending.ts"

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

test("Qloo research actions select only the requested layer and optional tools", async () => {
  const result = await analyzeCulture(
    brief,
    createFixtureClient(),
    "2026-10-23T00:00:00.000Z",
    { requestedAction: "query_market_culture" }
  )

  assert.deepEqual(
    result.fingerprint.layers.map((layer) => layer.group),
    ["market"]
  )
  assert.equal(result.fingerprint.comparison, undefined)
  assert.equal(result.fingerprint.heatmap, undefined)
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

test("Qloo falls back to a scoped tag when entity resolution has no match", async () => {
  const requests: string[] = []
  const client = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    tagsUrl: "https://qloo.test/v2/tags",
    apiKey: "test-key",
    fetchImpl: async (input) => {
      requests.push(input)
      if (input.includes("/search"))
        return new Response(JSON.stringify({ results: [] }), { status: 200 })
      return new Response(
        JSON.stringify({
          tags: [{ id: "urn:tag:style:qloo:eyewear", title: "Eyewear" }],
        }),
        { status: 200 }
      )
    },
  })

  const [resolved] = await resolveEntities(["Eyewear"], client)
  assert.equal(resolved?.status, "unresolved")
  assert.equal(resolved?.tagFallback?.tagId, "urn:tag:style:qloo:eyewear")
  assert.equal(resolved?.tagFallback?.name, "Eyewear")
  assert.match(requests[1] ?? "", /filter\.query=Eyewear/)
  assert.match(requests[1] ?? "", /feature\.semantic_search=true/)
  assert.doesNotMatch(requests[1] ?? "", /filter\.tag\.types=/)
})

test("Qloo resolves punctuation variants such as Rayban to Ray-Ban", async () => {
  const client = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    apiKey: "test-key",
    fetchImpl: async (input) => {
      const query = new URL(input).searchParams.get("query")
      return new Response(
        JSON.stringify({
          results:
            query === "Ray-Ban"
              ? [
                  {
                    entity_id: "ray-ban-id",
                    name: "Ray-Ban",
                    types: ["urn:entity:brand"],
                  },
                ]
              : [],
        }),
        { status: 200 }
      )
    },
  })

  const [resolved] = await resolveEntities(["Rayban"], client)
  assert.equal(resolved?.status, "resolved")
  assert.equal(resolved?.entityId, "ray-ban-id")
})

test("Qloo normalizes generic references through tag aliases", async () => {
  const searched: string[] = []
  const client = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    apiKey: "test-key",
    fetchImpl: async (input) => {
      const url = new URL(input)
      const query = url.searchParams.get("filter.query") ?? ""
      searched.push(query)
      const names: Record<string, string> = {
        beach: "Beach",
        party: "Party",
        eyewear: "Eyewear",
      }
      return new Response(
        JSON.stringify({
          results: {
            tags: [
              {
                tag_id: `urn:tag:test:${query}`,
                name: names[query] ?? query,
              },
            ],
          },
        }),
        { status: 200 }
      )
    },
  })

  const resolved = await resolveTags(
    ["beaches", "parties", "eye-wears"],
    client
  )
  assert.deepEqual(
    resolved.map((tag) => tag.status),
    ["resolved", "resolved", "resolved"]
  )
  assert.deepEqual(
    expandTagQueries(["Premium sunglasses and eye-wears for genz"]),
    ["Premium sunglasses and eyewear for", "sunglasses eyewear"]
  )
  assert.ok(searched.includes("beach"))
  assert.ok(searched.includes("party"))
  assert.ok(searched.includes("eyewear"))
})

test("Qloo rejects ambiguous semantic tag results without confidence", async () => {
  const client = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    tagsUrl: "https://qloo.test/v2/tags",
    apiKey: "test-key",
    fetchImpl: async (input) => {
      if (input.includes("/tags"))
        return new Response(
          JSON.stringify({
            tags: [
              { id: "urn:tag:lifestyle:qloo:nightlife", title: "Nightlife" },
              { id: "urn:tag:lifestyle:qloo:dining", title: "Dining" },
            ],
          }),
          { status: 200 }
        )
      return new Response(JSON.stringify({ results: [] }), { status: 200 })
    },
  })

  const [resolved] = await resolveTags(["parties"], client)
  assert.equal(resolved?.status, "ambiguous")
  assert.equal(resolved?.tagId, undefined)
})

test("Qloo uses a permissive operator for sparse tag resolution", () => {
  assert.equal(getTagOperator(0), "union")
  assert.equal(getTagOperator(2), "union")
  assert.equal(getTagOperator(4), "union")
  assert.equal(getTagOperator(5), "intersection")
})

test("Qloo falls back when a combined entity and tag query is rejected", async () => {
  let combinedRequestRejected = false
  const client = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    compareUrl: "https://qloo.test/v2/analysis/compare",
    tagsUrl: "https://qloo.test/v2/tags",
    apiKey: "test-key",
    fetchImpl: async (input, init) => {
      if (input.includes("/search")) {
        const query = new URL(input).searchParams.get("query") ?? "Reference"
        return new Response(
          JSON.stringify({
            results: [{ entity_id: `${query}-id`, name: query, types: ["urn:entity:brand"] }],
          }),
          { status: 200 }
        )
      }
      if (input.includes("/tags")) {
        const query = new URL(input).searchParams.get("filter.query") ?? "Culture"
        return new Response(
          JSON.stringify({
            results: [{ tag_id: `${query}-tag`, name: query, types: ["urn:tag:style:qloo"] }],
          }),
          { status: 200 }
        )
      }
      if (input.includes("/compare")) return new Response(JSON.stringify({ results: [] }), { status: 200 })
      if (init?.body) {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>
        const entities = body["signal.interests.entities"]
        const tags = body["signal.interests.tags"]
        if (Array.isArray(entities) && entities.length > 1 && Array.isArray(tags) && tags.length > 0) {
          combinedRequestRejected = true
          return new Response(JSON.stringify({ errors: [{ message: "filter.tag.types must be an array of at least one element" }] }), { status: 400 })
        }
      }
      return new Response(JSON.stringify(tasteFixture), { status: 200 })
    },
  })

  const result = await analyzeCulture(
    {
      ...brief,
      culturalReferences: ["Nike", "Cultural Reference"],
    },
    client
  )
  assert.equal(combinedRequestRejected, true)
  assert.ok(result.signals.length > 0)
})

test("Qloo uses GET scalar weights and POST per-entity weights", async () => {
  const requests: Array<{ method: string; url: URL; body: unknown }> = []
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
      const requestUrl = new URL(input)
      const requestBody = init?.body
        ? (JSON.parse(String(init.body)) as unknown)
        : undefined
      requests.push({
        method: init?.method ?? "GET",
        url: requestUrl,
        body: requestBody,
      })
      return new Response(JSON.stringify(tasteFixture), { status: 200 })
    },
  })

  await analyzeCulture(brief, client)
  await client.getInsights({
    filterType: "urn:tag",
    entitySignals: [
      { id: "brand-1", weight: 30 },
      { id: "reference-1", weight: 20 },
    ],
    take: 10,
  })
  const weightedGet = requests.find(
    (request) =>
      request.method === "GET" &&
      request.url.searchParams.has("signal.interests.entities")
  )
  assert.equal(
    weightedGet?.url.searchParams.get("signal.interests.entities"),
    "C70CE2B8-0AD1-4150-BF18-5A6347F2E860"
  )
  assert.equal(
    weightedGet?.url.searchParams.get("signal.interests.entities.weight"),
    "30"
  )
  const weightedPost = requests.find((request) => request.method === "POST")
  assert.ok(weightedPost)
  assert.deepEqual(
    (weightedPost?.body as Record<string, unknown>)[
      "signal.interests.entities"
    ],
    [
      { entity: "brand-1", weight: 30 },
      { entity: "reference-1", weight: 20 },
    ]
  )

  await client.getInsights({
    filterType: "urn:tag",
    tagSignals: [
      { tag: "tag-1", weight: 30 },
      { tag: "tag-2", weight: 10 },
    ],
    take: 10,
  })
  const weightedTagPost = requests.find(
    (request) =>
      request.method === "POST" &&
      Array.isArray((request.body as Record<string, unknown>)["signal.interests.tags"])
  )
  assert.deepEqual(
    (weightedTagPost?.body as Record<string, unknown>)["signal.interests.tags"],
    [
      { tag: "tag-1", weight: 30 },
      { tag: "tag-2", weight: 10 },
    ]
  )
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
  assert.equal(
    creator.qlooSignals?.[0]?.signalId,
    "urn:tag:category:streetwear"
  )
  assert.equal(creator.qlooSignals?.[0]?.affinity, 0.92)
})

test("Qloo targeted enrichment leaves unselected creators untouched", async () => {
  const client = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    apiKey: "test-key",
    fetchImpl: async (input) => {
      if (input.includes("/tags"))
        return new Response(JSON.stringify(tagFixture), { status: 200 })
      return new Response(JSON.stringify(tagAffinityFixture), { status: 200 })
    },
  })
  const evidence = {
    source: "apify" as const,
    fieldPath: "$.posts[0].caption",
    observedAt: "2026-10-24T00:00:00.000Z",
    verification: "provider_reported" as const,
  }
  const creators = await enrichCreatorsWithQloo(
    [
      {
        provider: "apify",
        providerCreatorId: "creator-target",
        name: "Target Creator",
        platform: "instagram",
        contentSignals: [{ text: "Streetwear", sourceField: "posts", evidence }],
        missingFields: [],
        sourceFields: {},
        evidence: [evidence],
      },
      {
        provider: "apify",
        providerCreatorId: "creator-other",
        name: "Other Creator",
        platform: "instagram",
        contentSignals: [{ text: "Streetwear", sourceField: "posts", evidence }],
        missingFields: [],
        sourceFields: {},
        evidence: [evidence],
      },
    ],
    "India",
    client,
    [],
    {},
    { creatorIds: ["creator-target"], maxCreators: 1 }
  )

  assert.equal(creators[0]?.qlooSignals?.length, 1)
  assert.equal(creators[1]?.qlooSignals, undefined)
})

test("Qloo validates creators from the documented person insight response", async () => {
  let personRequestUrl: URL | undefined
  let personRequestMethod: string | undefined
  let personRequestBody: Record<string, unknown> | undefined
  const personPayload = {
    results: {
      entities: [
        {
          entity_id: "person-1",
          name: "Urban Streetwear",
          affinity: 0.91,
          popularity: 0.87,
          tags: [{ id: "urn:tag:genre:person:influencer", name: "Influencer" }],
        },
      ],
    },
  }
  const client = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    apiKey: "test-key",
    fetchImpl: async (input, init) => {
      const url = new URL(input)
      const body = init?.body
        ? (JSON.parse(String(init.body)) as Record<string, unknown>)
        : undefined
      if (
        url.searchParams.get("filter.type") === "urn:entity:person" ||
        body?.["filter.type"] === "urn:entity:person"
      ) {
        personRequestUrl = url
        personRequestMethod = init?.method ?? "GET"
        personRequestBody = body
        return new Response(JSON.stringify(personPayload), { status: 200 })
      }
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
    [
      {
        provider: "apify",
        providerCreatorId: "creator-person-1",
        name: "Urban Streetwear",
        platform: "instagram",
        contentSignals: [],
        missingFields: [],
        sourceFields: {},
        evidence: [evidence],
      },
    ],
    "Berlin",
    client
  )
  assert.equal(creator.qlooEntityId, "person-1")
  assert.equal(creator.qlooAffinity, 0.91)
  assert.equal(creator.qlooPopularity, 0.87)
  assert.equal(creator.qlooPersonEntityId, "person-1")
  assert.equal(creator.qlooPersonAffinity, 0.91)
  assert.equal(creator.qlooPersonSignals?.[0]?.name, "Influencer")
  assert.equal(personRequestMethod, "POST")
  assert.equal(
    JSON.stringify(personRequestBody?.["filter.results.entities.query"]),
    JSON.stringify(["Urban Streetwear"])
  )
  assert.equal(personRequestBody?.["bias.trends"], "high")
  assert.equal(personRequestBody?.["signal.demographics.age"], undefined)
  assert.equal(personRequestBody?.["signal.location.query"], "Berlin")
  assert.equal(personRequestUrl?.searchParams.has("filter.type"), false)
  assert.equal(personRequestBody?.["filter.type"], "urn:entity:person")
  assert.equal(personRequestBody?.["filter.tags"], undefined)
})

test("Qloo rejects a person result whose name does not match the creator", async () => {
  const client = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    apiKey: "test-key",
    fetchImpl: async (input) => {
      if (input.includes("filter.type=urn%3Aentity%3Aperson")) {
        return new Response(JSON.stringify({
          results: { entities: [{ entity_id: "wrong-person", name: "Different Person", affinity: 0.99 }] },
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ results: { tags: [] } }), { status: 200 })
    },
  })

  const [creator] = await enrichCreatorsWithQloo(
    [{
      provider: "apify",
      providerCreatorId: "creator-unresolved",
      name: "Urban Streetwear",
      platform: "instagram",
      contentSignals: [],
      missingFields: [],
      sourceFields: {},
      evidence: [],
    }],
    "Berlin",
    client,
  )

  assert.equal(creator.qlooPersonEntityId, undefined)
  assert.equal(creator.qlooPersonAffinity, undefined)
})

test("Qloo applies tag operators to signal interests tags", async () => {
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
    tagSignals: [
      { tag: "urn:tag:style:qloo:streetwear" },
      { tag: "urn:tag:lifestyle:qloo:outdoor" },
    ],
    tagOperator: "intersection",
    take: 5,
  })

  assert.equal(
    requestUrl?.searchParams.get("signal.interests.tags"),
    "urn:tag:style:qloo:streetwear,urn:tag:lifestyle:qloo:outdoor",
  )
  assert.equal(
    requestUrl?.searchParams.get("operator.signal.interests.tags"),
    "intersection",
  )
  assert.equal(requestUrl?.searchParams.get("operator.filter.tags"), null)
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
      return new Response(JSON.stringify({ results: { tags: [] } }), {
        status: 200,
      })
    },
  })
  await client.compareInsights({
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
  assert.match(
    requests[0] ?? "",
    /b\.signal\.interests\.entities=reference-1%2Creference-2/
  )
  assert.doesNotMatch(requests[0] ?? "", /filter\.type=/)
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
      return new Response(JSON.stringify({ results: { tags: [] } }), {
        status: 200,
      })
    },
  })

  await client.searchTags({ query: "streetwear", take: 5 })
  await client.getInsights({
    filterType: "urn:tag",
    locationQuery: "India",
    tagOperator: "intersection",
    take: 10,
  })

  assert.match(requests[0] ?? "", /filter\.query=streetwear/)
  assert.match(requests[0] ?? "", /feature\.typo_tolerance=true/)
  assert.match(requests[0] ?? "", /feature\.semantic_search=true/)
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
      return new Response(JSON.stringify({ results: { tags: [] } }), {
        status: 200,
      })
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
      return new Response(JSON.stringify({ results: { tags: [] } }), {
        status: 200,
      })
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
  assert.deepEqual(entities, [
    {
      entityId: "person-1",
      name: "Public Figure",
      types: ["urn:entity:person"],
      trendScore: 0.82,
      affinity: 0.74,
      popularity: 0.61,
    },
  ])
})

test("Qloo loads trend-biased public figures with regional conditioning", async () => {
  let requestUrl: URL | undefined
  const client = createQlooClient({
    baseUrl: "https://qloo.test",
    searchUrl: "https://qloo.test/search",
    insightsUrl: "https://qloo.test/v2/insights",
    apiKey: "test-key",
    fetchImpl: async (input) => {
      requestUrl = new URL(input)
      return new Response(
        JSON.stringify({
          success: true,
          results: {
            entities: [
              {
                entity_id: "person-1",
                name: "Public Figure",
                subtype: "urn:entity:person",
                popularity: 0.61,
                query: {
                  affinity: 0.74,
                  measurements: { audience_growth: 0.82 },
                },
              },
            ],
          },
        }),
        { status: 200 },
      )
    },
  })

  const entities = await getTrendingPublicFigures(client, 20, "Berlin")

  assert.equal(entities[0]?.trendScore, 0.82)
  assert.deepEqual(entities[0]?.types, ["urn:entity:person"])
  assert.equal(requestUrl?.pathname, "/v2/insights")
  assert.equal(requestUrl?.searchParams.get("filter.type"), "urn:entity:person")
  assert.equal(requestUrl?.searchParams.get("bias.trends"), "high")
  assert.equal(requestUrl?.searchParams.get("filter.popularity.min"), "0.01")
  assert.equal(requestUrl?.searchParams.get("signal.location.query"), "Berlin")
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
