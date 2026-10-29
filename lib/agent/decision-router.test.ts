import assert from "node:assert/strict"
import test from "node:test"
import type { CreatorSearchDecision } from "./creator-search-agent.ts"
import { routeCreatorSearchDecision } from "./decision-router.ts"

const baseDecision: CreatorSearchDecision = {
  action: "broaden_query",
  decision: "refine_creator_search",
  signalIds: ["signal-1"],
  summary: "Broaden the creator search",
  rejectedActions: ["stop_search"],
  decisionMode: "deterministic_fallback",
  fallbackReason: "test",
}

const assessment = {
  creatorCount: 1,
  culturallyRelevantCount: 0,
  marketCoveredCount: 0,
  evidenceBearingCreatorCount: 0,
  missingEvidenceCount: 1,
  decision: "refine_creator_search" as const,
  action: "broaden_query" as const,
  summary: "Sparse results",
}

test("evidence acceptance suppresses an unnecessary creator refinement", () => {
  const result = routeCreatorSearchDecision({
    agentDecision: baseDecision,
    evidenceDecision: "accept",
    assessment,
    refinementCount: 0,
    maxRefinements: 1,
    targetedEnrichmentCount: 0,
  })

  assert.equal(result.decision.action, "stop_search")
  assert.equal(result.canRefine, false)
})

test("creator critic enables one bounded refinement", () => {
  const result = routeCreatorSearchDecision({
    agentDecision: { ...baseDecision, decision: "accept", action: "stop_search" },
    evidenceDecision: "refine_creator_search",
    assessment,
    refinementCount: 0,
    maxRefinements: 1,
    targetedEnrichmentCount: 0,
  })

  assert.equal(result.decision.action, "broaden_query")
  assert.equal(result.canRefine, true)
})

test("approved proposals resume the exact action and signal set", () => {
  const result = routeCreatorSearchDecision({
    agentDecision: { ...baseDecision, action: "add_cultural_signals" },
    evidenceDecision: "refine_creator_search",
    assessment,
    approvedAction: "broaden_query",
    approvedSignalIds: ["approved-signal"],
    approvedPlan: { ...({ query: "streetwear", platforms: ["instagram"], maxResults: 5 } as const), variant: "culture_informed" },
    refinementCount: 0,
    maxRefinements: 1,
    targetedEnrichmentCount: 0,
  })

  assert.equal(result.decision.action, "broaden_query")
  assert.deepEqual(result.decision.signalIds, ["approved-signal"])
  assert.equal(result.canRefine, true)
})

test("sparse evidence can request one targeted enrichment pass", () => {
  const result = routeCreatorSearchDecision({
    agentDecision: {
      ...baseDecision,
      action: "request_enrichment",
      decision: "request_enrichment",
    },
    evidenceDecision: "refine_creator_search",
    assessment: { ...assessment, action: "request_enrichment", decision: "request_enrichment" },
    refinementCount: 0,
    maxRefinements: 1,
    targetedEnrichmentCount: 0,
  })

  assert.equal(result.shouldEnrich, true)
})
