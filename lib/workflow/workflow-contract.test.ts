import assert from "node:assert/strict"
import test from "node:test"
import type { CampaignBrief, CultureSignal } from "../domain/types.ts"
import { withProviderRetry } from "./retry.ts"
import {
  createDeterministicSearchPlans,
  searchPlanSchema,
  validateSearchPlanAgainstCampaign,
} from "./search-plan.ts"
import { ProviderError } from "../tools/provider-errors.ts"

const brief: CampaignBrief = {
  brandName: "Nike",
  productCategory: "Streetwear",
  productDescription: "Urban streetwear",
  targetMarket: { country: "India", marketScope: "country" },
  objective: "Launch awareness",
  culturalReferences: ["Nike"],
  preferredLanguages: ["English"],
  qlooAgeRange: "35_and_younger",
  qlooGender: "female",
  minFollowers: 10_000,
  maxFollowers: 500_000,
  creatorLimit: 5,
}

const signal: CultureSignal = {
  provider: "qloo",
  signalId: "tag-1",
  name: "Hindi Cinema",
  affinity: 1,
  types: ["urn:entity:person"],
  evidence: {
    source: "qloo",
    fieldPath: "$.results.tags[]",
    observedAt: "2026-10-23T00:00:00.000Z",
    verification: "provider_reported",
  },
}

test("initial search plans preserve constraints and guide culture discovery", () => {
  const plans = createDeterministicSearchPlans(brief, [signal])
  assert.equal(plans.baseline.variant, "baseline")
  assert.equal(plans.cultureInformed.variant, "culture_informed")
  assert.notEqual(plans.baseline.query, plans.cultureInformed.query)
  assert.equal(plans.cultureInformed.minFollowers, 10_000)
  assert.equal(plans.cultureInformed.maxResults, 5)
  assert.match(plans.cultureInformed.query, /female audience/)
  assert.match(plans.cultureInformed.query, /younger audience/)
  assert.deepEqual(plans.queryConstruction.baseline.qlooTerms, [])
  assert.deepEqual(plans.queryConstruction.cultureInformed.qlooTerms, ["Hindi Cinema"])
  assert.deepEqual(plans.queryConstruction.cultureInformed.qlooSignalIds, ["tag-1"])
  assert.match(plans.cultureInformed.query, /Hindi Cinema/)
  assert.doesNotMatch(plans.baseline.query, /Hindi Cinema/)
})

test("search plan schema rejects unsupported filters and URLs", () => {
  assert.throws(() =>
    searchPlanSchema.parse({
      query: "streetwear creators in India",
      platforms: ["instagram"],
      maxResults: 5,
      unsupportedFilter: "Mumbai",
    })
  )
  assert.throws(() =>
    searchPlanSchema.parse({
      query: "https://example.com",
      platforms: ["instagram"],
      maxResults: 5,
    })
  )
})

test("search plan validation preserves the campaign result limit", () => {
  const plans = createDeterministicSearchPlans(brief, [signal])
  assert.throws(() =>
    validateSearchPlanAgainstCampaign(
      { ...plans.baseline, maxResults: 4 },
      brief
    )
  )
})

test("retries transient provider failures only up to the configured limit", async () => {
  let calls = 0
  const records: string[] = []
  const result = await withProviderRetry(
    "qloo",
    async () => {
      calls += 1
      if (calls < 3)
        throw new ProviderError({
          provider: "qloo",
          code: "RATE_LIMITED",
          message: "limited",
        })
      return "ok"
    },
    {
      maxAttempts: 3,
      baseDelayMs: 0,
      maxDelayMs: 0,
      maxElapsedMs: 5_000,
      jitterMs: 0,
    },
    async () => undefined,
    (record) => records.push(`${record.attempt}:${record.errorCode}`)
  )
  assert.equal(result, "ok")
  assert.equal(calls, 3)
  assert.deepEqual(records, ["1:RATE_LIMITED", "2:RATE_LIMITED"])
})
