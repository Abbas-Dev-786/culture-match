import assert from "node:assert/strict"
import test from "node:test"
import { parseOpportunityCandidates } from "./discover-opportunities.ts"
import type { QlooSignalRecord } from "../../domain/types.ts"

const signal: QlooSignalRecord = {
  signalId: "urn:tag:style:modern",
  name: "Modern",
  types: ["urn:tag:style"],
  kind: "tag",
  sourceGroup: "combined",
  evidence: {
    source: "qloo",
    fieldPath: "$.results.tags[]",
    observedAt: "2026-10-26T00:00:00.000Z",
    verification: "provider_reported",
  },
}

test("opportunity parsing preserves provider ranking and missing-field caveats", () => {
  const opportunities = parseOpportunityCandidates(
    {
      results: {
        entities: [
          {
            entity_id: "urn:entity:brand:example",
            name: "Example Brand",
            types: ["urn:entity:brand"],
            query: { affinity: 0.91, popularity: 0.77 },
            properties: { category: "lifestyle" },
          },
          {
            entity_id: "urn:entity:brand:incomplete",
            name: "Incomplete Brand",
          },
        ],
      },
    },
    [signal],
    "2026-10-26T00:00:00.000Z"
  )

  assert.equal(opportunities[0]?.providerRank, 1)
  assert.equal(opportunities[0]?.affinity, 0.91)
  assert.deepEqual(opportunities[0]?.metadata, { category: "lifestyle" })
  assert.deepEqual(opportunities[1]?.missingFields, ["types", "affinity", "popularity"])
})
