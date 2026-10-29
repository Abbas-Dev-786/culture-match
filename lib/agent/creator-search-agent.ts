import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateText, Output } from "ai"
import { z } from "zod"
import type {
  AgentDecisionMode,
  CampaignBrief,
  CultureSignal,
  JsonObject,
  NormalizedCreator,
} from "../domain/types.ts"
import {
  createAdaptiveSearchPlan,
  type SearchPlan,
} from "../workflow/search-plan.ts"
import { decisionModeFromEnvironment } from "./action-trace.ts"

export const MAX_CREATOR_SEARCH_REFINEMENTS = 1

export const creatorSearchActionSchema = z
  .object({
    action: z.enum([
      "broaden_query",
      "add_cultural_signals",
      "adjust_market_terms",
      "request_enrichment",
      "stop_search",
    ]),
    decision: z.enum([
      "accept",
      "refine_creator_search",
      "request_enrichment",
      "stop_with_caveats",
    ]),
    signalIds: z.array(z.string().trim().min(1).max(200)).max(3),
    summary: z.string().trim().min(1).max(240),
    rejectedActions: z.array(z.string().trim().min(1).max(120)).max(6),
  })
  .strict()

export type CreatorSearchAction = z.infer<typeof creatorSearchActionSchema>

export type CreatorSearchDecision = CreatorSearchAction & {
  decisionMode: AgentDecisionMode
  fallbackReason?: string
}

export interface CreatorSearchAssessment {
  creatorCount: number
  culturallyRelevantCount: number
  marketCoveredCount: number
  evidenceBearingCreatorCount: number
  missingEvidenceCount: number
  decision: CreatorSearchAction["decision"]
  action: CreatorSearchAction["action"]
  summary: string
}

export async function decideCreatorSearch(
  brief: CampaignBrief,
  basePlan: SearchPlan,
  signals: CultureSignal[],
  creators: NormalizedCreator[],
  refinementCount: number
): Promise<CreatorSearchDecision> {
  const deterministic = assessCreatorSearchResults(brief, creators, refinementCount)
  const environment = decisionModeFromEnvironment()
  if (environment.mode === "deterministic_fallback")
    return toAction(deterministic, signals, environment.fallbackReason)
  const apiKey = process.env.OPENROUTER_API_KEY?.trim() as string
  const modelId = process.env.OPENROUTER_MODEL?.trim() as string

  try {
    const result = await generateText({
      model: createOpenRouter({ apiKey })(modelId),
      timeout: 20_000,
      output: Output.object({ schema: creatorSearchActionSchema }),
      maxOutputTokens: 500,
      providerOptions: {
        openrouter: {
          reasoning: { max_tokens: 256, exclude: true },
        },
      },
      prompt: [
        "Critique this creator search and choose one bounded next action.",
        "Preserve all campaign constraints. The workflow permits at most one refinement search after the broad search.",
        JSON.stringify({
          campaign: {
            productCategory: brief.productCategory,
            objective: brief.objective,
            targetMarket: brief.targetMarket,
            creatorLimit: brief.creatorLimit,
          },
          searchPlan: basePlan,
          assessment: deterministic,
          availableSignals: signals.slice(0, 10).map((signal) => ({
            signalId: signal.signalId,
            name: signal.name,
          })),
          resultCount: creators.length,
          refinementCount,
          refinementBudget: MAX_CREATOR_SEARCH_REFINEMENTS,
        }),
      ].join("\n"),
    })
    if (!result.output)
      return toAction(deterministic, signals, "creator_model_returned_no_action")
    const parsed = creatorSearchActionSchema.parse(result.output)
    const knownSignals = new Set(signals.map((signal) => signal.signalId))
    return {
      ...parsed,
      signalIds: parsed.signalIds.filter((signalId) => knownSignals.has(signalId)),
      decisionMode: "model",
    }
  } catch {
    return toAction(
      deterministic,
      signals,
      "creator_model_action_invalid_or_unavailable"
    )
  }
}

export function assessCreatorSearchResults(
  brief: CampaignBrief,
  creators: NormalizedCreator[],
  refinementCount: number
): CreatorSearchAssessment {
  const minimumUsefulResults = Math.min(3, brief.creatorLimit)
  const culturallyRelevantCount = creators.filter(
    (creator) =>
      (creator.qlooSignals?.length ?? 0) > 0 ||
      creator.contentSignals.some((signal) => signal.evidenceKind === "post_or_content")
  ).length
  const marketTerms = [
    brief.targetMarket.city,
    brief.targetMarket.region,
    brief.targetMarket.country,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizeLabel)
  const marketCoveredCount = creators.filter((creator) =>
    (creator.audienceRegions ?? []).some((region) =>
      marketTerms.some((term) => normalizeLabel(region).includes(term))
    )
  ).length
  const evidenceBearingCreatorCount = creators.filter(
    (creator) =>
      creator.evidence.some((evidence) => evidence.verification !== "unverified")
  ).length
  const missingEvidenceCount = creators.filter(
    (creator) => creator.missingFields.length > 0
  ).length

  if (creators.length < minimumUsefulResults && refinementCount === 0) {
    return {
      creatorCount: creators.length,
      culturallyRelevantCount,
      marketCoveredCount,
      evidenceBearingCreatorCount,
      missingEvidenceCount,
      decision: "refine_creator_search",
      action: "broaden_query",
      summary: `Only ${creators.length} creators were returned; broaden the query once within the campaign constraints.`,
    }
  }
  if (
    creators.length > 0 &&
    culturallyRelevantCount / creators.length < 0.35 &&
    refinementCount === 0
  ) {
    return {
      creatorCount: creators.length,
      culturallyRelevantCount,
      marketCoveredCount,
      evidenceBearingCreatorCount,
      missingEvidenceCount,
      decision: "refine_creator_search",
      action: "add_cultural_signals",
      summary: "The result set has weak cultural relevance; add stronger Qloo signals to one refinement search.",
    }
  }
  if (
    creators.length > 0 &&
    marketCoveredCount === 0 &&
    refinementCount === 0
  ) {
    return {
      creatorCount: creators.length,
      culturallyRelevantCount,
      marketCoveredCount,
      evidenceBearingCreatorCount,
      missingEvidenceCount,
      decision: "refine_creator_search",
      action: "adjust_market_terms",
      summary: "No creator records carry verified market coverage; adjust the location terms once.",
    }
  }
  if (
    creators.length > 0 &&
    evidenceBearingCreatorCount / creators.length < 0.5
  ) {
    return {
      creatorCount: creators.length,
      culturallyRelevantCount,
      marketCoveredCount,
      evidenceBearingCreatorCount,
      missingEvidenceCount,
      decision: "request_enrichment",
      action: "request_enrichment",
      summary: "The result set is usable but evidence is sparse; request one targeted enrichment pass before scoring.",
    }
  }
  return {
    creatorCount: creators.length,
    culturallyRelevantCount,
    marketCoveredCount,
    evidenceBearingCreatorCount,
    missingEvidenceCount,
    decision: "accept",
    action: "stop_search",
    summary: `Accepted ${creators.length} creators with bounded evidence coverage.`,
  }
}

export function refineCreatorSearchPlan(
  basePlan: SearchPlan,
  brief: CampaignBrief,
  signals: CultureSignal[],
  action: CreatorSearchAction["action"],
  selectedSignalIds: string[] = []
): SearchPlan | undefined {
  if (
    action !== "broaden_query" &&
    action !== "add_cultural_signals" &&
    action !== "adjust_market_terms"
  )
    return undefined
  return createAdaptiveSearchPlan(
    basePlan,
    brief,
    signals,
    action,
    selectedSignalIds
  )
}

export function creatorSearchStateToJson(
  brief: CampaignBrief,
  assessment: CreatorSearchAssessment,
  action: CreatorSearchDecision,
  refinementCount: number,
  plan: SearchPlan,
  approved = false,
  approvalKey?: string
): JsonObject {
  return {
    objective: "Find culturally relevant creators without weakening campaign constraints",
    selectedInputs: {
      action: action.action,
      query: plan.query,
      signalIds: action.signalIds,
    },
    availableEvidence: {
      creatorCount: assessment.creatorCount,
      culturallyRelevantCount: assessment.culturallyRelevantCount,
      marketCoveredCount: assessment.marketCoveredCount,
      evidenceBearingCreatorCount: assessment.evidenceBearingCreatorCount,
      missingEvidenceCount: assessment.missingEvidenceCount,
    },
    actionsTaken: [action.action],
    rejectedActions: action.rejectedActions,
    refinementCount,
    budgetRemaining: Math.max(0, MAX_CREATOR_SEARCH_REFINEMENTS - refinementCount),
    decisionMode: action.decisionMode,
    ...(action.fallbackReason ? { fallbackReason: action.fallbackReason } : {}),
    decision: action.decision,
    ...(action.decision === "accept" || action.decision === "stop_with_caveats"
      ? { stopReason: action.summary }
      : {}),
    approved,
    ...(approved && approvalKey ? { approvedApprovalKey: approvalKey } : {}),
    campaignObjective: brief.objective,
  }
}

function toAction(
  assessment: CreatorSearchAssessment,
  signals: CultureSignal[],
  fallbackReason?: string
): CreatorSearchDecision {
  return {
    ...creatorSearchActionSchema.parse({
    action: assessment.action,
    decision: assessment.decision,
    signalIds: signals.slice(0, 3).map((signal) => signal.signalId),
    summary: assessment.summary,
    rejectedActions:
      assessment.decision === "refine_creator_search"
        ? ["stop_search"]
        : ["broaden_query", "add_cultural_signals", "adjust_market_terms"],
    }),
    decisionMode: "deterministic_fallback",
    ...(fallbackReason ? { fallbackReason } : {}),
  }
}

function normalizeLabel(value: string): string {
  return value.trim().toLocaleLowerCase().replaceAll(/[^\p{L}\p{N}]+/gu, " ")
}
