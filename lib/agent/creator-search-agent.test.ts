import assert from "node:assert/strict"
import test from "node:test"
import type { CampaignBrief, NormalizedCreator } from "../domain/types.ts"
import {
  assessCreatorSearchResults,
  refineCreatorSearchPlan,
} from "./creator-search-agent.ts"
import { createDeterministicSearchPlans } from "../workflow/search-plan.ts"

const brief: CampaignBrief = {
  brandName: "Example",
  productCategory: "Streetwear",
  productDescription: "Urban clothing",
  targetMarket: { country: "India", city: "Mumbai", marketScope: "city" },
  objective: "Launch awareness",
  culturalReferences: ["Hindi cinema"],
  preferredLanguages: ["English"],
  creatorLimit: 5,
}

function creator(id: string): NormalizedCreator {
  return {
    provider: "apify",
    providerCreatorId: id,
    name: id,
    platform: "instagram",
    contentSignals: [],
    missingFields: [],
    sourceFields: {},
    evidence: [],
  }
}

test("creator critic broadens a sparse result set once", () => {
  const assessment = assessCreatorSearchResults(brief, [creator("one")], 0)
  assert.equal(assessment.decision, "refine_creator_search")
  assert.equal(assessment.action, "broaden_query")
})

test("adaptive creator plans preserve campaign constraints", () => {
  const plans = createDeterministicSearchPlans(brief, [])
  const refined = refineCreatorSearchPlan(
    plans.cultureInformed,
    brief,
    [],
    "broaden_query"
  )
  assert.ok(refined)
  assert.equal(refined.maxResults, brief.creatorLimit)
  assert.equal(refined.variant, "culture_informed")
  assert.match(refined.query, /emerging community creators/)
})
