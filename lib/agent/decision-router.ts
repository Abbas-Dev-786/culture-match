import type { EvidenceCriticDecision } from "./evidence-critic.ts"
import type {
  CreatorSearchAction,
  CreatorSearchAssessment,
  CreatorSearchDecision,
} from "./creator-search-agent.ts"
import type { SearchPlan } from "../workflow/search-plan.ts"

export function routeCreatorSearchDecision(input: {
  agentDecision: CreatorSearchDecision
  evidenceDecision: EvidenceCriticDecision["decision"]
  assessment: CreatorSearchAssessment
  approvedAction?: CreatorSearchAction["action"]
  approvedSignalIds?: string[]
  approvedPlan?: SearchPlan
  refinementCount: number
  maxRefinements: number
  refinementEnabled: boolean
  targetedEnrichmentCount: number
}): {
  decision: CreatorSearchDecision
  canRefine: boolean
  shouldEnrich: boolean
} {
  const fallbackAction = [
    "broaden_query",
    "add_cultural_signals",
    "adjust_market_terms",
  ].includes(input.assessment.action)
    ? input.assessment.action
    : "broaden_query"
  const approvedDecision =
    input.evidenceDecision === "refine_creator_search" &&
    input.approvedAction &&
    input.approvedPlan
      ? {
          ...input.agentDecision,
          action: input.approvedAction,
          decision: "refine_creator_search" as const,
          signalIds: input.approvedSignalIds ?? input.agentDecision.signalIds,
          summary: "Resuming the exact creator-search action approved by the user.",
        }
      : input.agentDecision
  const decision =
    input.evidenceDecision === "accept" ||
    input.evidenceDecision === "stop_with_caveats"
      ? {
          ...approvedDecision,
          action: "stop_search" as const,
          decision: input.evidenceDecision,
          summary: "Evidence review completed; continue with the recorded caveats.",
          rejectedActions: [
            ...new Set([
              ...approvedDecision.rejectedActions,
              "broaden_query",
              "add_cultural_signals",
              "adjust_market_terms",
            ]),
          ],
        }
      : input.evidenceDecision === "refine_creator_search" &&
          input.agentDecision.decision !== "refine_creator_search"
        ? input.agentDecision.decision === "request_enrichment"
          ? approvedDecision
          : {
              ...approvedDecision,
              action: fallbackAction,
              decision: "refine_creator_search" as const,
              summary: "Evidence review selected one bounded creator-search refinement.",
              rejectedActions: ["stop_search"],
            }
        : approvedDecision
  return {
    decision,
    canRefine:
      input.refinementEnabled &&
      input.evidenceDecision === "refine_creator_search" &&
      decision.decision === "refine_creator_search" &&
      input.refinementCount < input.maxRefinements,
    shouldEnrich:
      decision.action === "request_enrichment" &&
      input.targetedEnrichmentCount === 0,
  }
}
