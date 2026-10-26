import assert from "node:assert/strict"
import test from "node:test"
import type { LaunchOpportunityCandidate } from "../domain/types.ts"
import { rankLaunchOpportunities } from "./ranking.ts"

function candidate(
  entityId: string,
  providerRank: number | undefined,
  affinity: number | undefined
): LaunchOpportunityCandidate {
  return {
    provider: "qloo",
    entityId,
    name: entityId,
    types: ["urn:entity:brand"],
    ...(providerRank !== undefined ? { providerRank } : {}),
    ...(affinity !== undefined ? { affinity } : {}),
    relatedSignalIds: ["signal-1"],
    metadata: {},
    evidence: [
      {
        source: "qloo",
        fieldPath: "$.results.entities[0]",
        observedAt: "2026-10-27T00:00:00.000Z",
        verification: "provider_reported",
      },
    ],
    missingFields: [],
  }
}

test("opportunity ranking deduplicates and follows provider rank", () => {
  const ranked = rankLaunchOpportunities([
    candidate("second", 2, 0.99),
    candidate("first", 1, 0.4),
    candidate("first", 3, 0.2),
  ])

  assert.deepEqual(ranked.map((item) => item.entityId), ["first", "second"])
  assert.equal(ranked[0]?.rank, 1)
  assert.equal(ranked[0]?.rankingBasis, "provider_rank")
  assert.equal(ranked[0]?.evidenceCompleteness, 0.67)
})

test("opportunity ranking falls back to affinity when provider rank is missing", () => {
  const ranked = rankLaunchOpportunities([
    candidate("lower", undefined, 0.2),
    candidate("higher", undefined, 0.8),
  ])

  assert.deepEqual(ranked.map((item) => item.entityId), ["higher", "lower"])
  assert.equal(ranked[0]?.rankingBasis, "affinity")
})
