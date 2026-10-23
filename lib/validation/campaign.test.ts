import assert from "node:assert/strict"
import test from "node:test"
import { campaignBriefSchema, createCampaignRequestSchema } from "./campaign.ts"

const validBrief = {
  brandName: "Northstar",
  productCategory: "streetwear",
  targetMarket: { country: "India", marketScope: "country" },
  objective: "Launch a regional collection",
  culturalReferences: ["Nike"],
  preferredLanguages: ["English", "Hindi"],
  maxFollowers: 500000,
  maxBudget: 5000,
  currency: "INR",
  creatorLimit: 5,
}

test("accepts a valid country campaign brief", () => {
  assert.equal(campaignBriefSchema.safeParse(validBrief).success, true)
})

test("rejects an invalid market scope combination", () => {
  const result = campaignBriefSchema.safeParse({
    ...validBrief,
    targetMarket: { country: "India", marketScope: "country", city: "Mumbai" },
  })
  assert.equal(result.success, false)
})

test("rejects invalid follower bounds and budget currency", () => {
  const result = campaignBriefSchema.safeParse({
    ...validBrief,
    minFollowers: 100,
    maxFollowers: 10,
    currency: undefined,
  })
  assert.equal(result.success, false)
})

test("rejects unsupported creator limits and idempotency keys", () => {
  assert.equal(
    campaignBriefSchema.safeParse({ ...validBrief, creatorLimit: 101 }).success,
    false,
  )
  assert.equal(
    createCampaignRequestSchema.safeParse({ idempotencyKey: "bad", brief: validBrief }).success,
    false,
  )
})
