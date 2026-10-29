import assert from "node:assert/strict"
import test from "node:test"
import type { CultureSignal } from "../domain/types.ts"
import {
  evaluateResearchEvidence,
  normalizeResearchModelAction,
  normalizeResearchTagQueries,
  researchTraceToJson,
} from "./cultural-research-agent.ts"
import type { CultureResearchResult } from "../tools/qloo/analyze-culture.ts"

function signal(name: string, verification: CultureSignal["evidence"]["verification"], affinity?: number): CultureSignal {
  return {
    provider: "qloo",
    signalId: name,
    name,
    ...(affinity !== undefined ? { affinity } : {}),
    types: ["urn:tag:test"],
    evidence: {
      source: "qloo",
      fieldPath: "$.results.tags[]",
      observedAt: "2026-10-28T00:00:00.000Z",
      verification,
    },
  }
}

function result(signals: CultureSignal[], populatedLayerCount: number): CultureResearchResult {
  return {
    signals,
    resolvedReferences: [],
    resolvedTags: [],
    location: { name: "India" },
    fingerprint: {
      locationQuery: "India",
      location: { name: "India" },
      signals: [],
      layers: Array.from({ length: populatedLayerCount }, (_, index) => ({
        group: "market" as const,
        label: `Layer ${index}`,
        signals: [
          {
            signalId: `layer-${index}`,
            kind: "tag" as const,
            name: `Layer ${index}`,
            types: ["urn:tag:test"],
            sourceGroup: "market" as const,
            evidence: signal(`layer-${index}`, "provider_reported").evidence,
          },
        ],
        unresolvedInputs: [],
        entitySignalCount: 0,
        tagSignalCount: 1,
      })),
      unresolvedInputs: [],
      explainabilityRequested: true,
    },
    providerSummary: {},
  }
}

test("research agent stops when Qloo evidence clears the sufficiency threshold", () => {
  const decision = evaluateResearchEvidence(
    result(
      [
        signal("one", "verified", 0.9),
        signal("two", "provider_reported", 0.8),
        signal("three", "provider_reported"),
      ],
      2
    )
  )
  assert.equal(decision.decision, "stop")
  assert.equal(decision.evidence.evidenceBearingSignalCount, 3)
})

test("research agent requests refinement for sparse evidence and keeps trace JSON-safe", () => {
  const decision = evaluateResearchEvidence(
    result([signal("one", "provider_reported", 0.5)], 1)
  )
  assert.equal(decision.decision, "refine")
  const trace = researchTraceToJson([
    {
      step: 1,
      action: "inspect_evidence",
      focus: "campaign_fingerprint",
      status: "completed",
      summary: decision.summary,
      decision: decision.decision,
      evidence: decision.evidence,
    },
  ])
  assert.equal(trace[0]?.action, "inspect_evidence")
  assert.equal((trace[0]?.evidence as { signalCount: number }).signalCount, 1)
})

test("research agent bounds long campaign descriptions before schema validation", () => {
  const queries = normalizeResearchTagQueries([
    "streetwear",
    "x".repeat(465),
    "streetwear",
  ])
  assert.deepEqual(queries.map((query) => query.length), [10, 300])
})

test("research model actions normalize minimal and nested model responses", () => {
  const currentSelection = {
    focus: "campaign_fingerprint" as const,
    includeBrand: true,
    references: ["Dune"],
    tagQueries: ["skincare"],
  }
  const minimal = normalizeResearchModelAction(
    { action: "query_product_culture" },
    currentSelection
  )
  assert.equal(minimal?.action, "query_product_culture")
  assert.equal(minimal?.focus, "product_context")
  const minimalSelection =
    minimal && "selection" in minimal ? minimal.selection : undefined
  assert.deepEqual(
    minimalSelection?.tagQueries ?? [],
    ["skincare"]
  )

  const nested = normalizeResearchModelAction(
    {
      action: "query_market_culture",
      parameters: {
        focus: "market_context",
        includeBrand: false,
        references: [],
        tagQueries: ["streetwear"],
      },
    },
    currentSelection
  )
  assert.equal(nested?.focus, "market_context")
  const nestedSelection =
    nested && "selection" in nested ? nested.selection : undefined
  assert.deepEqual(
    nestedSelection?.tagQueries ?? [],
    ["streetwear"]
  )
})
