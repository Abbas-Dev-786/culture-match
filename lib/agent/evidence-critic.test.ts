import assert from "node:assert/strict"
import test from "node:test"
import type { CultureSignal, NormalizedCreator } from "../domain/types.ts"
import { critiqueEvidence } from "./evidence-critic.ts"

function signal(name: string): CultureSignal {
  return {
    provider: "qloo",
    signalId: name,
    name,
    types: ["urn:tag:test"],
    evidence: {
      source: "qloo",
      fieldPath: "$.results.tags[]",
      observedAt: "2026-10-28T00:00:00.000Z",
      verification: "provider_reported",
    },
  }
}

function creator(): NormalizedCreator {
  return {
    provider: "apify",
    providerCreatorId: "creator-1",
    name: "Creator",
    platform: "instagram",
    contentSignals: [],
    missingFields: [],
    sourceFields: {},
    evidence: [{
      source: "apify",
      fieldPath: "$.creator.bio",
      observedAt: "2026-10-28T00:00:00.000Z",
      verification: "provider_reported",
    }],
  }
}

test("evidence critic requests Qloo refinement for sparse verified signals", () => {
  const decision = critiqueEvidence({
    signals: [signal("one")],
    culturalReferences: ["Hindi cinema"],
    populatedLayerCount: 1,
    creators: [creator()],
    refinementCount: 0,
  })
  assert.equal(decision.decision, "refine_qloo")
})

test("evidence critic accepts distributed evidence with caveats when needed", () => {
  const decision = critiqueEvidence({
    signals: [signal("one"), signal("two"), signal("three")],
    culturalReferences: [],
    populatedLayerCount: 2,
    creators: [creator()],
    refinementCount: 1,
  })
  assert.equal(decision.decision, "accept")
})
