import assert from "node:assert/strict"
import test from "node:test"
import type { LaunchAnalysisBrief, QlooFingerprint } from "../domain/types.ts"
import { generateLaunchActivationBrief } from "./activation-brief.ts"
import { rankLaunchOpportunities } from "./ranking.ts"

const brief: LaunchAnalysisBrief = {
  brandName: "Aesop",
  product: "premium facial cleanser",
  country: "India",
  city: "Mumbai",
  opportunityType: "urn:entity:brand",
  culturalReferences: ["Tata", "The Bombay Canteen"],
  launchIntent: "Find culturally adjacent launch partners.",
}

const fingerprint: QlooFingerprint = {
  locationQuery: "Mumbai, India",
  location: { name: "Mumbai", entityId: "urn:entity:locality:mumbai" },
  signals: [],
  layers: [
    {
      group: "combined",
      label: "Combined",
      signals: [
        {
          signalId: "urn:tag:style:modern",
          kind: "tag",
          name: "Modern",
          types: ["urn:tag:style"],
          sourceGroup: "combined",
          evidence: {
            source: "qloo",
            fieldPath: "$.results.tags[]",
            observedAt: "2026-10-27T00:00:00.000Z",
            verification: "provider_reported",
          },
        },
      ],
      unresolvedInputs: [],
      entitySignalCount: 0,
      tagSignalCount: 1,
    },
  ],
  unresolvedInputs: [],
  explainabilityRequested: true,
}

test("activation brief falls back to deterministic, evidence-keyed output", async () => {
  const result = await generateLaunchActivationBrief({
    brief,
    fingerprint,
    opportunities: rankLaunchOpportunities([
      {
        provider: "qloo",
        entityId: "urn:entity:brand:example",
        name: "Example Brand",
        types: ["urn:entity:brand"],
        providerRank: 1,
        affinity: 0.8,
        popularity: 0.7,
        relatedSignalIds: ["urn:tag:style:modern"],
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
      },
    ]),
  })

  assert.equal(result.generationMode, "deterministic")
  assert.equal(result.brief.schemaVersion, "phase3-v1")
  assert.equal(result.brief.activationDirections.length, 3)
  assert.ok(result.brief.activationDirections.every((item) => item.hypothesis === true))
  assert.ok(result.brief.activationDirections.every((item) => item.evidenceKeys.length > 0))
})
