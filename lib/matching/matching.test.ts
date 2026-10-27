import assert from "node:assert/strict"
import test from "node:test"
import type { CampaignBrief, CultureSignal, NormalizedCreator } from "../domain/types.ts"
import { compareRuns } from "./compare-runs.ts"
import { scoreCreator, scoreCreators } from "./score-creators.ts"

const brief: CampaignBrief = {
  brandName: "Nike",
  productCategory: "Streetwear",
  productDescription: "Urban streetwear for regional creators",
  targetMarket: { country: "India", marketScope: "country" },
  objective: "Launch awareness",
  culturalReferences: ["Nike"],
  preferredLanguages: ["English"],
  minFollowers: 10_000,
  maxFollowers: 500_000,
  creatorLimit: 5,
}

const signals: CultureSignal[] = [
  {
    provider: "qloo",
    signalId: "tag-1",
    name: "Streetwear",
    types: ["urn:tag"],
    evidence: {
      source: "qloo",
      fieldPath: "$.results.tags[0]",
      observedAt: "2026-10-24T00:00:00.000Z",
      verification: "provider_reported",
    },
  },
]

function creator(overrides: Partial<NormalizedCreator> = {}): NormalizedCreator {
  return {
    provider: "apify",
    providerCreatorId: "creator-1",
    name: "Urban Streetwear",
    platform: "instagram",
    bio: "Streetwear and urban style inspiration",
    followers: 100_000,
    engagementRate: 0.05,
    locationUnverified: true,
    missingFields: ["audienceLocations", "languages", "fees"],
    contentSignals: [],
    sourceFields: {},
    evidence: [
      {
        source: "apify",
        fieldPath: "$.creator.bio",
        observedAt: "2026-10-24T00:00:00.000Z",
        verification: "provider_reported",
      },
      {
        source: "apify",
        fieldPath: "$.primary_profile.followers",
        observedAt: "2026-10-24T00:00:00.000Z",
        verification: "provider_reported",
      },
      {
        source: "apify",
        fieldPath: "$.primary_profile.engagement_rate",
        observedAt: "2026-10-24T00:00:00.000Z",
        verification: "provider_reported",
      },
    ],
    ...overrides,
  }
}

test("score math renormalizes over available components", () => {
  const result = scoreCreator(
    brief,
    signals,
    creator({
      qlooSignals: [
        {
          signalId: "tag-1",
          kind: "tag",
          name: "Streetwear",
          types: ["urn:tag"],
          affinity: 0.85,
          sourceGroup: "creator",
          evidence: signals[0].evidence,
        },
      ],
    })
  )
  assert.equal(result.campaignFitScore !== null, true)
  assert.equal(result.evidenceCompleteness, 0.6)
  assert.equal(
    result.components.find((component) => component.key === "budgetTierFit")?.availability,
    "unavailable",
  )
  assert.equal(result.caveats.includes("Audience geography is not verified; creator location is not audience evidence"), true)
})

test("missing provider fields remain unavailable instead of becoming zero scores", () => {
  const result = scoreCreator(
    { ...brief, minFollowers: undefined, maxFollowers: undefined },
    [],
    creator({ bio: undefined, followers: undefined, engagementRate: undefined })
  )
  assert.equal(result.campaignFitScore, null)
  assert.equal(result.components.every((component) => component.score === undefined), true)
})

test("baseline comparison handles no overlap and partial rank changes", () => {
  const comparison = compareRuns(
    [
      { providerCreatorId: "a", rank: 1, score: 80 },
      { providerCreatorId: "b", rank: 2, score: 70 },
    ],
    [
      { providerCreatorId: "b", rank: 1, score: 75 },
      { providerCreatorId: "c", rank: 2, score: 60 },
    ]
  )
  assert.equal(comparison.overlapCount, 1)
  assert.deepEqual(comparison.baselineOnlyIds, ["a"])
  assert.deepEqual(comparison.cultureInformedOnlyIds, ["c"])
  assert.equal(comparison.materiallyChanged, true)
})

test("baseline comparison reports identical results honestly", () => {
  const comparison = compareRuns(
    [{ providerCreatorId: "a", rank: 1, score: 80 }],
    [{ providerCreatorId: "a", rank: 1, score: 80 }]
  )
  assert.equal(comparison.overlapRate, 1)
  assert.deepEqual(comparison.rankChanges, [])
  assert.equal(comparison.materiallyChanged, false)
})

test("scoring is deterministic for the same stored inputs", () => {
  const first = scoreCreators(brief, signals, [creator()])
  const second = scoreCreators(brief, signals, [creator()])
  assert.deepEqual(first, second)
})
