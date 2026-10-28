import { z } from "zod"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateText, Output } from "ai"
import type {
  AgentDecisionMode,
  CampaignBrief,
  JsonObject,
  ResearchTraceEntry,
} from "../domain/types.ts"
import {
  analyzeCulture,
  type CultureResearchResult,
} from "../tools/qloo/analyze-culture.ts"
import type { QlooClient } from "../tools/qloo/client.ts"
import { ProviderError } from "../tools/provider-errors.ts"
import { expandTagQueries } from "../tools/qloo/resolve-tags.ts"
import { decisionModeFromEnvironment } from "./action-trace.ts"

export const MAX_RESEARCH_REFINEMENTS = 2
const MAX_AGENT_TAG_QUERIES = 4

const researchSelectionSchema = z
  .object({
    focus: z.enum([
      "campaign_fingerprint",
      "market_context",
      "product_context",
    ]),
    includeBrand: z.boolean(),
    references: z.array(z.string().trim().min(2).max(200)).max(5),
    tagQueries: z.array(z.string().trim().min(2).max(300)).min(1).max(6),
  })
  .strict()

export const researchSupervisorActionSchema = z
  .discriminatedUnion("action", [
    z.object({
      action: z.literal("resolve_cultural_references"),
      focus: z.literal("campaign_fingerprint"),
      selection: z.lazy(() => researchSelectionSchema),
      summary: z.string().trim().min(1).max(240),
      rejectedActions: z.array(z.string().trim().min(1).max(120)).max(6),
    }),
    z.object({
      action: z.enum(["query_market_culture", "query_product_culture"]),
      focus: z.enum(["market_context", "product_context"]),
      selection: z.lazy(() => researchSelectionSchema),
      summary: z.string().trim().min(1).max(240),
      rejectedActions: z.array(z.string().trim().min(1).max(120)).max(6),
    }),
    z.object({
      action: z.enum(["compare_brand_and_references", "request_qloo_heatmap"]),
      focus: z.literal("campaign_fingerprint"),
      selection: z.lazy(() => researchSelectionSchema),
      summary: z.string().trim().min(1).max(240),
      rejectedActions: z.array(z.string().trim().min(1).max(120)).max(6),
    }),
    z.object({
      action: z.enum(["broaden_inputs", "narrow_inputs"]),
      focus: z.enum([
        "campaign_fingerprint",
        "market_context",
        "product_context",
      ]),
      selection: z.lazy(() => researchSelectionSchema),
      summary: z.string().trim().min(1).max(240),
      rejectedActions: z.array(z.string().trim().min(1).max(120)).max(6),
    }),
    z.object({
      action: z.literal("stop_research"),
      focus: z.enum([
        "campaign_fingerprint",
        "market_context",
        "product_context",
      ]),
      summary: z.string().trim().min(1).max(240),
      rejectedActions: z.array(z.string().trim().min(1).max(120)).max(6),
    }),
  ])

const researchEvidenceSchema = z
  .object({
    signalCount: z.number().int().nonnegative(),
    evidenceBearingSignalCount: z.number().int().nonnegative(),
    affinitySignalCount: z.number().int().nonnegative(),
    populatedLayerCount: z.number().int().nonnegative(),
    unresolvedInputCount: z.number().int().nonnegative(),
  })
  .strict()

const researchActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("select_research_inputs"),
    focus: z.enum([
      "campaign_fingerprint",
      "market_context",
      "product_context",
    ]),
    selection: researchSelectionSchema,
    summary: z.string().trim().min(1).max(240),
  }),
  z.object({
    action: z.literal("query_qloo"),
    focus: z.enum([
      "campaign_fingerprint",
      "market_context",
      "product_context",
    ]),
    selection: researchSelectionSchema,
    summary: z.string().trim().min(1).max(240),
  }),
  z.object({
    action: z.literal("inspect_evidence"),
    focus: z.enum([
      "campaign_fingerprint",
      "market_context",
      "product_context",
    ]),
    evidence: researchEvidenceSchema,
    decision: z.enum(["continue", "refine", "stop"]),
    summary: z.string().trim().min(1).max(240),
  }),
  z.object({
    action: z.literal("refine_research_inputs"),
    focus: z.enum([
      "campaign_fingerprint",
      "market_context",
      "product_context",
    ]),
    selection: researchSelectionSchema,
    summary: z.string().trim().min(1).max(240),
  }),
  z.object({
    action: z.literal("complete_research"),
    focus: z.enum([
      "campaign_fingerprint",
      "market_context",
      "product_context",
    ]),
    decision: z.literal("stop"),
    summary: z.string().trim().min(1).max(240),
  }),
])

type ResearchSelection = z.infer<typeof researchSelectionSchema>
type ResearchEvidence = z.infer<typeof researchEvidenceSchema>
type ResearchAction = z.infer<typeof researchActionSchema>
type TraceMetadata = {
  toolName?: string
  resultCount?: number
  evidenceCount?: number
  nextAction?: string
  rejectedActions?: string[]
  rationale?: string
}
export type ResearchSupervisorAction = z.infer<
  typeof researchSupervisorActionSchema
>

export interface CulturalResearchAgentResult extends CultureResearchResult {
  trace: ResearchTraceEntry[]
  refinementCount: number
  agentState: JsonObject
}

export interface ResearchEvidenceDecision {
  decision: "refine" | "stop"
  evidence: ResearchEvidence
  summary: string
}

export interface ResearchDecisionResult {
  action?: ResearchSupervisorAction
  mode: AgentDecisionMode
  fallbackReason?: string
}

export async function runCulturalResearchAgent(
  brief: CampaignBrief,
  client: QlooClient
): Promise<CulturalResearchAgentResult> {
  const trace: ResearchTraceEntry[] = []
  let selection = createInitialSelection(brief)
  let refinementCount = 0
  let lastResult: CultureResearchResult | undefined
  const rejectedActions: string[] = []
  const decisionModes: AgentDecisionMode[] = []
  const fallbackReasons: string[] = []

  addTrace(trace, {
    action: "select_research_inputs",
    focus: selection.focus,
    selection,
    summary: "Selected the campaign, market, and cultural reference inputs for Qloo.",
  })

  for (let attempt = 0; attempt <= MAX_RESEARCH_REFINEMENTS; attempt += 1) {
    const plannedDecision = await chooseResearchAction(
      brief,
      selection,
      lastResult,
      refinementCount
    )
    decisionModes.push(plannedDecision.mode)
    if (plannedDecision.fallbackReason)
      fallbackReasons.push(plannedDecision.fallbackReason)
    const plannedAction = plannedDecision.action
    if (plannedAction?.action === "stop_research" && lastResult) {
      addTrace(trace, {
        action: "complete_research",
        focus: selection.focus,
        decision: "stop",
        summary: plannedAction.summary,
      })
      break
    }
    if (plannedAction && "selection" in plannedAction)
      selection = plannedAction.selection
    if (plannedAction?.rejectedActions) {
      rejectedActions.push(...plannedAction.rejectedActions)
    }
    addTrace(trace, {
      action: "query_qloo",
      focus: selection.focus,
      selection,
      toolName: plannedAction?.action ?? "query_qloo",
      rejectedActions: plannedAction?.rejectedActions,
      nextAction: "inspect_evidence",
      summary: `Queried Qloo with the ${selection.focus.replaceAll("_", " ")} input set.`,
    })

    try {
      lastResult = await analyzeCulture(brief, client, new Date().toISOString(), {
        selection,
        ...(plannedAction?.action
          ? { requestedAction: plannedAction.action }
          : {}),
      })
    } catch (error) {
      if (!isSparseResearchError(error) || attempt >= MAX_RESEARCH_REFINEMENTS)
        throw error

      const evidence = emptyEvidence()
      addTrace(trace, {
        action: "inspect_evidence",
        focus: selection.focus,
        evidence,
        decision: "refine",
        nextAction: "broaden_inputs",
        summary: "Qloo returned no usable cultural signals, so the agent will broaden the inputs.",
      })
      selection = nextSelection(brief, refinementCount + 1)
      refinementCount += 1
      addTrace(trace, {
        action: "refine_research_inputs",
        focus: selection.focus,
        selection,
        toolName: "broaden_inputs",
        nextAction: "query_qloo",
        summary: "Broadened the research inputs after an empty Qloo result.",
      })
      continue
    }

    const decision = evaluateResearchEvidence(lastResult)
    addTrace(trace, {
      action: "inspect_evidence",
      focus: selection.focus,
      evidence: decision.evidence,
      decision: decision.decision,
      nextAction: decision.decision === "stop" ? "stop_research" : "broaden_inputs",
      summary: decision.summary,
    })

    if (decision.decision === "stop" || attempt >= MAX_RESEARCH_REFINEMENTS) {
      addTrace(trace, {
        action: "complete_research",
        focus: selection.focus,
        decision: "stop",
        toolName: "stop_research",
        summary:
          decision.decision === "stop"
            ? "Evidence met the deterministic sufficiency threshold; continuing to creator discovery."
            : "The refinement budget is exhausted; continuing with the evidence collected.",
      })
      break
    }

    selection = nextSelection(brief, refinementCount + 1)
    refinementCount += 1
    addTrace(trace, {
      action: "refine_research_inputs",
      focus: selection.focus,
      selection,
      toolName: "broaden_inputs",
      nextAction: "query_qloo",
      summary: "Evidence was sparse, so the agent selected a broader Qloo research input set.",
    })
  }

  if (!lastResult) {
    throw new ProviderError({
      provider: "qloo",
      code: "EMPTY_RESULT",
      message: "The cultural research agent did not collect usable evidence",
      retryable: false,
    })
  }

  return {
    ...lastResult,
    trace,
    refinementCount,
    agentState: {
      objective: "Build an evidence-grounded cultural fingerprint for creator discovery",
      selectedInputs: {
        focus: selection.focus,
        referenceCount: selection.references.length,
        tagQueryCount: selection.tagQueries.length,
      },
      actionsTaken: trace.map((entry) => entry.action),
      rejectedActions: [...new Set(rejectedActions)].slice(0, 12),
      refinementCount,
      budgetRemaining: Math.max(0, MAX_RESEARCH_REFINEMENTS - refinementCount),
      decisionMode: decisionModes.includes("model")
        ? "model"
        : "deterministic_fallback",
      actionCount: trace.length,
      modelDecisionCount: decisionModes.filter((mode) => mode === "model").length,
      ...(fallbackReasons[0] ? { fallbackReason: fallbackReasons[0] } : {}),
      stopReason:
        refinementCount >= MAX_RESEARCH_REFINEMENTS
          ? "research_refinement_budget_exhausted"
          : "evidence_sufficient",
    },
  }
}

export async function chooseResearchAction(
  brief: CampaignBrief,
  selection: ResearchSelection,
  result: CultureResearchResult | undefined,
  refinementCount: number
): Promise<ResearchDecisionResult> {
  const environment = decisionModeFromEnvironment()
  if (environment.mode === "deterministic_fallback") return environment
  const apiKey = process.env.OPENROUTER_API_KEY?.trim() as string
  const modelId = process.env.OPENROUTER_MODEL?.trim() as string

  try {
    const response = await generateText({
      model: createOpenRouter({ apiKey })(modelId),
      output: Output.object({ schema: researchSupervisorActionSchema }),
      maxOutputTokens: 700,
      prompt: [
        "Choose exactly one bounded Qloo research action for this campaign.",
        "The action must use only the supplied selection fields and must not invent provider parameters.",
        `Refinement budget remaining: ${Math.max(0, MAX_RESEARCH_REFINEMENTS - refinementCount)}.`,
        JSON.stringify({
          campaign: {
            brandName: brief.brandName,
            productCategory: brief.productCategory,
            objective: brief.objective,
            market: brief.targetMarket,
            culturalReferences: brief.culturalReferences,
          },
          currentSelection: selection,
          evidence: result ? evaluateResearchEvidence(result).evidence : emptyEvidence(),
          availableActions: [
            "resolve_cultural_references",
            "query_market_culture",
            "query_product_culture",
            "compare_brand_and_references",
            "request_qloo_heatmap",
            "broaden_inputs",
            "narrow_inputs",
            "stop_research",
          ],
        }),
      ].join("\n"),
    })
    if (!response.output)
      return {
        mode: "deterministic_fallback",
        fallbackReason: "research_model_returned_no_action",
      }
    return {
      action: researchSupervisorActionSchema.parse(response.output),
      mode: "model",
    }
  } catch {
    return {
      mode: "deterministic_fallback",
      fallbackReason: "research_model_action_invalid_or_unavailable",
    }
  }
}

export function evaluateResearchEvidence(
  result: CultureResearchResult
): ResearchEvidenceDecision {
  const evidenceBearingSignalCount = result.signals.filter(
    (signal) => signal.evidence.verification !== "unverified"
  ).length
  const affinitySignalCount = result.signals.filter(
    (signal) => signal.affinity !== undefined && Number.isFinite(signal.affinity)
  ).length
  const populatedLayerCount = result.fingerprint.layers.filter(
    (layer) => layer.signals.length > 0
  ).length
  const unresolvedInputCount = result.fingerprint.unresolvedInputs.length
  const evidence: ResearchEvidence = {
    signalCount: result.signals.length,
    evidenceBearingSignalCount,
    affinitySignalCount,
    populatedLayerCount,
    unresolvedInputCount,
  }
  const sufficient =
    evidenceBearingSignalCount >= 3 &&
    (affinitySignalCount >= 2 || populatedLayerCount >= 2)

  return {
    decision: sufficient ? "stop" : "refine",
    evidence,
    summary: sufficient
      ? `Found ${evidenceBearingSignalCount} evidence-bearing signals across ${populatedLayerCount} Qloo layers.`
      : `Only ${evidenceBearingSignalCount} evidence-bearing signals were available; more research is needed.`,
  }
}

export function researchTraceToJson(trace: ResearchTraceEntry[]): JsonObject[] {
  return trace.map((entry) => ({
    step: entry.step,
    action: entry.action,
    focus: entry.focus,
    status: entry.status,
    summary: entry.summary,
    ...(entry.decision ? { decision: entry.decision } : {}),
    ...(entry.inputCounts ? { inputCounts: entry.inputCounts } : {}),
    ...(entry.evidence ? { evidence: entry.evidence } : {}),
    ...(entry.toolName ? { toolName: entry.toolName } : {}),
    ...(entry.resultCount !== undefined ? { resultCount: entry.resultCount } : {}),
    ...(entry.evidenceCount !== undefined
      ? { evidenceCount: entry.evidenceCount }
      : {}),
    ...(entry.nextAction ? { nextAction: entry.nextAction } : {}),
    ...(entry.rejectedActions ? { rejectedActions: entry.rejectedActions } : {}),
    ...(entry.rationale ? { rationale: entry.rationale } : {}),
  }))
}

function createInitialSelection(brief: CampaignBrief): ResearchSelection {
  return researchSelectionSchema.parse({
    focus: "campaign_fingerprint",
    includeBrand: true,
    references: brief.culturalReferences.slice(0, 5),
    tagQueries: normalizeResearchTagQueries([
      brief.productCategory,
      brief.productDescription,
      ...brief.culturalReferences,
    ]).slice(0, 6),
  })
}

function nextSelection(
  brief: CampaignBrief,
  refinementNumber: number
): ResearchSelection {
  if (refinementNumber === 1) {
    return researchSelectionSchema.parse({
      focus: "market_context",
      includeBrand: false,
      references: [],
      tagQueries: normalizeResearchTagQueries([
        brief.productCategory,
        brief.productDescription,
      ]).slice(0, 2),
    })
  }

  return researchSelectionSchema.parse({
    focus: "product_context",
    includeBrand: false,
    references: brief.culturalReferences.slice(0, 2),
    tagQueries: normalizeResearchTagQueries([
      brief.productCategory,
      ...brief.preferredLanguages,
    ]).slice(0, 6),
  })
}

export function normalizeResearchTagQueries(values: string[]): string[] {
  return expandTagQueries(
    values
      .map((value) => value.trim().slice(0, 300))
      .filter((value) => Boolean(value))
  )
    .filter((value) => value.length >= 2)
    .slice(0, MAX_AGENT_TAG_QUERIES)
}

function addTrace(
  trace: ResearchTraceEntry[],
  action: ResearchAction & TraceMetadata
): void {
  const parsed = researchActionSchema.parse(action)
  const entry: ResearchTraceEntry = {
    step: trace.length + 1,
    action: parsed.action,
    focus: parsed.focus,
    status: "completed",
    summary: parsed.summary,
    ...(parsed.action === "inspect_evidence"
      ? { decision: parsed.decision, evidence: parsed.evidence }
      : "decision" in parsed
        ? { decision: parsed.decision }
        : {}),
    ...( "selection" in parsed
      ? {
          inputCounts: {
            includesBrand: parsed.selection.includeBrand,
            referenceCount: parsed.selection.references.length,
            tagQueryCount: parsed.selection.tagQueries.length,
          },
        }
      : {}),
  }
  if (action.toolName) entry.toolName = action.toolName
  if (action.resultCount !== undefined) entry.resultCount = action.resultCount
  if (action.evidenceCount !== undefined) entry.evidenceCount = action.evidenceCount
  if (action.nextAction) entry.nextAction = action.nextAction
  if (action.rejectedActions) entry.rejectedActions = action.rejectedActions
  if (action.rationale) entry.rationale = action.rationale
  trace.push(entry)
}

function emptyEvidence(): ResearchEvidence {
  return {
    signalCount: 0,
    evidenceBearingSignalCount: 0,
    affinitySignalCount: 0,
    populatedLayerCount: 0,
    unresolvedInputCount: 0,
  }
}

function isSparseResearchError(error: unknown): error is ProviderError {
  return error instanceof ProviderError && error.code === "EMPTY_RESULT"
}
