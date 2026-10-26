import assert from "node:assert/strict"
import test from "node:test"
import { createLaunchAnalysisRequestSchema } from "./launch-analysis.ts"

test("launch analysis validation keeps the Phase 0 brief focused", () => {
  const result = createLaunchAnalysisRequestSchema.parse({
    idempotencyKey: "phase0:mumbai:001",
    brief: {
      brandName: "Aesop",
      product: "premium facial cleanser",
      country: "India",
      city: "Mumbai",
      opportunityType: "urn:entity:brand",
      culturalReferences: ["Tata", "The Bombay Canteen"],
      launchIntent: "Find culturally adjacent launch partners.",
    },
  })
  assert.equal(result.brief.city, "Mumbai")
})

test("launch analysis validation rejects fewer than two cultural references", () => {
  assert.throws(() =>
    createLaunchAnalysisRequestSchema.parse({
      idempotencyKey: "phase0:mumbai:002",
      brief: {
        brandName: "Aesop",
        product: "premium facial cleanser",
        country: "India",
        city: "Mumbai",
        opportunityType: "urn:entity:brand",
        culturalReferences: ["Tata"],
        launchIntent: "Find culturally adjacent launch partners.",
      },
    })
  )
})
