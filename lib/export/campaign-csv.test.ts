import assert from "node:assert/strict"
import test from "node:test"
import type { SafeCreatorResult } from "../db/results.ts"
import { campaignResultsToCsv } from "./campaign-csv.ts"

test("campaign CSV export includes both variants and escapes values", () => {
  const match: SafeCreatorResult = {
    id: "match-1",
    variant: "culture_informed",
    name: "Creator, One",
    platform: "instagram",
    creatorTier: "Micro",
    regionalMatch: "unverified",
    languageMatch: "unverified",
    matchReasons: [],
    bio: "Streetwear creator",
    locationUnverified: true,
    rank: 1,
    campaignFitScore: 82.5,
    scoreAlgorithmVersion: "prd-v1",
    evidenceCompleteness: 0.85,
    scoreComponents: [],
    evidence: [],
    caveats: ["Missing fees data"],
    reportSummary: "Strong fit",
  }

  const csv = campaignResultsToCsv([match])

  assert.match(csv, /^variant,rank,name,username,platform/m)
  assert.match(csv, /culture_informed,1,"Creator, One",,instagram/)
  assert.match(csv, /Missing fees data/)
})
