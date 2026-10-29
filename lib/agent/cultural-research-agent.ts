import { z } from "zod"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateText, isStepCount, tool, ToolLoopAgent } from "ai"
import type {
  AgentDecisionMode,
  CampaignBrief,
  JsonObject,
  ResearchTraceEntry,
} from "../domain/types.ts"
import {
  analyzeCulture,
  type CultureResearchOptions,
  type CultureResearchResult,
} from "../tools/qloo/analyze-culture.ts"
import type { QlooClient } from "../tools/qloo/client.ts"
import { ProviderError } from "../tools/provider-errors.ts"
import { expandTagQueries } from "../tools/qloo/resolve-tags.ts"
import { decisionModeFromEnvironment } from "./action-trace.ts"
import { executeAgentTool } from "./tool-execution.ts"

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

const researchModelActionSchema = z
  .object({
    action: z.enum([
      "resolve_cultural_references",
      "query_market_culture",
      "query_product_culture",
      "compare_brand_and_references",
      "request_qloo_heatmap",
      "broaden_inputs",
      "narrow_inputs",
      "stop_research",
    ]),
    focus: z
      .enum(["campaign_fingerprint", "market_context", "product_context"])
      .optional(),
    selection: z.unknown().optional(),
    parameters: z.unknown().optional(),
    summary: z.string().trim().max(240).optional(),
    rejectedActions: z.array(z.string().trim().min(1).max(120)).max(6).optional(),
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
  modelCallCount?: number
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
  let modelCallCount = 0

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
    modelCallCount += plannedDecision.modelCallCount ?? 0
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
      const researchTool = {
        name: "qloo_cultural_research",
        provider: "qloo" as const,
        inputSchema: z.object({
          selection: researchSelectionSchema,
          requestedAction: z
            .enum([
              "resolve_cultural_references",
              "query_market_culture",
              "query_product_culture",
              "compare_brand_and_references",
              "request_qloo_heatmap",
              "broaden_inputs",
              "narrow_inputs",
            ])
            .optional(),
        }),
        outputSchema: z.custom<CultureResearchResult>(isCultureResearchResult),
        execute: async (input: {
          selection: ResearchSelection
          requestedAction?: CultureResearchOptions["requestedAction"]
        }) =>
          analyzeCulture(brief, client, new Date().toISOString(), {
            selection: input.selection,
            ...(input.requestedAction
              ? { requestedAction: input.requestedAction }
              : {}),
          }),
      }
      lastResult = (
        await executeAgentTool(researchTool, {
          selection,
          ...(plannedAction?.action
            ? { requestedAction: plannedAction.action }
            : {}),
        })
      ).output
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
      modelDecisionCount: modelCallCount,
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
    const chooseResearchActionTool = tool({
      description:
        "Choose exactly one validated, bounded Qloo research action for the campaign.",
      inputSchema: researchModelActionSchema,
      execute: async (input) => {
        const action = normalizeResearchModelAction(input, selection)
        if (!action)
          throw new Error("Research model action could not be validated")
        return action
      },
    })
    const agent = new ToolLoopAgent({
      model: createOpenRouter({ apiKey })(modelId),
      instructions: [
        "You are the cultural research supervisor.",
        "Use the chooseResearchAction tool exactly once.",
        "Choose only actions supported by the provided campaign evidence and selection.",
        "Do not invent provider parameters, credentials, URLs, or unlisted actions.",
      ].join(" "),
      tools: { chooseResearchAction: chooseResearchActionTool },
      toolChoice: "auto",
      stopWhen: isStepCount(1),
      maxOutputTokens: 700,
      providerOptions: {
        openrouter: {
          reasoning: { max_tokens: 256, exclude: true },
        },
      },
    })
    const response = await agent.generate({
      timeout: 20_000,
      prompt: researchActionPrompt(brief, selection, result, refinementCount),
    })
    const toolResult = response.toolResults.find(
      (item) => item.toolName === "chooseResearchAction"
    )
    if (!toolResult) {
      const textAction = researchModelActionSchema.safeParse(
        parseJsonObject(response.text)
      )
      const normalizedTextAction = textAction.success
        ? normalizeResearchModelAction(textAction.data, selection)
        : undefined
      if (normalizedTextAction) {
        return {
          action: normalizedTextAction,
          mode: "model",
          modelCallCount: 1,
        }
      }
      const textDecision = await chooseResearchActionWithJsonText(
        brief,
        selection,
        result,
        refinementCount,
        modelId,
        apiKey
      )
      if (textDecision) return textDecision
      return {
        mode: "deterministic_fallback",
        fallbackReason: "research_model_returned_no_action",
        modelCallCount: 2,
      }
    }
    const action = researchSupervisorActionSchema.parse(toolResult.output)
    return {
      action,
      mode: "model",
      modelCallCount: 1,
    }
  } catch (error) {
    const reason = researchModelFailureReason(error)
    if (reason === "research_model_tool_call_unsupported") {
      const textDecision = await chooseResearchActionWithJsonText(
        brief,
        selection,
        result,
        refinementCount,
        modelId,
        apiKey
      )
      if (textDecision) return textDecision
    }
    console.warn(
      "research_agent_model_fallback",
      JSON.stringify({
        model: modelId,
        reason,
        error: researchModelErrorDetail(error),
      })
    )
    return {
      mode: "deterministic_fallback",
      fallbackReason: reason,
      modelCallCount: reason === "research_model_tool_call_unsupported" ? 2 : 1,
    }
  }
}

function researchModelFailureReason(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (message.includes("401") || message.includes("unauthorized"))
      return "research_model_authentication_failed"
    if (message.includes("429") || message.includes("rate limit"))
      return "research_model_rate_limited"
    if (
      error.name === "AI_ToolChoiceViolationError" ||
      message.includes("did not contain a tool call") ||
      (message.includes("tool") && message.includes("support"))
    )
      return "research_model_tool_call_unsupported"
    if (message.includes("timeout") || message.includes("timed out"))
      return "research_model_timeout"
    if (message.includes("no endpoints"))
      return "research_model_no_provider_endpoint"
  }
  return "research_model_request_failed"
}

async function chooseResearchActionWithJsonText(
  brief: CampaignBrief,
  selection: ResearchSelection,
  result: CultureResearchResult | undefined,
  refinementCount: number,
  modelId: string,
  apiKey: string
): Promise<ResearchDecisionResult | undefined> {
  try {
    const response = await generateText({
      model: createOpenRouter({ apiKey })(modelId),
      timeout: 20_000,
      maxOutputTokens: 700,
      providerOptions: {
        openrouter: {
          reasoning: { max_tokens: 256, exclude: true },
        },
      },
      prompt: [
        "Return only one JSON object for the validated Qloo research action.",
        "Do not use markdown, code fences, commentary, or extra keys.",
        researchActionPrompt(brief, selection, result, refinementCount),
      ].join("\n"),
    })
    const parsed = parseJsonObject(response.text)
    const action = researchModelActionSchema.safeParse(parsed)
    const normalizedAction = action.success
      ? normalizeResearchModelAction(action.data, selection)
      : undefined
    if (!normalizedAction) {
      console.warn(
        "research_agent_json_fallback_invalid",
        JSON.stringify({
          model: modelId,
          output: response.text.slice(0, 300),
          issueCount: action.success ? 1 : action.error.issues.length,
        })
      )
      return undefined
    }
    return { action: normalizedAction, mode: "model", modelCallCount: 2 }
  } catch (error) {
    console.warn(
      "research_agent_json_fallback_failed",
      JSON.stringify({ model: modelId, error: researchModelErrorDetail(error) })
    )
    return undefined
  }
}

function researchActionPrompt(
  brief: CampaignBrief,
  selection: ResearchSelection,
  result: CultureResearchResult | undefined,
  refinementCount: number
): string {
  return [
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
  ].join("\n")
}

function parseJsonObject(text: string): unknown {
  const normalized = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
  try {
    return JSON.parse(normalized) as unknown
  } catch {
    const start = normalized.indexOf("{")
    const end = normalized.lastIndexOf("}")
    if (start < 0 || end <= start) return undefined
    try {
      return JSON.parse(normalized.slice(start, end + 1)) as unknown
    } catch {
      return undefined
    }
  }
}

export function normalizeResearchModelAction(
  input: z.infer<typeof researchModelActionSchema>,
  currentSelection: ResearchSelection
): ResearchSupervisorAction | undefined {
  const parameters = isRecord(input.parameters) ? input.parameters : {}
  const modelSelection = isRecord(input.selection)
    ? input.selection
    : parameters
  const requestedFocus =
    input.focus ??
    (isResearchFocus(parameters.focus) ? parameters.focus : undefined)
  const focus = focusForResearchAction(input.action, requestedFocus)
  const safeSelection = researchSelectionSchema.parse({
    ...currentSelection,
    focus,
    ...(typeof modelSelection.includeBrand === "boolean"
      ? { includeBrand: modelSelection.includeBrand }
      : {}),
    ...(Array.isArray(modelSelection.references)
      ? {
          references: modelSelection.references.filter(
            (value): value is string =>
              typeof value === "string" && value.trim().length >= 2
          ),
        }
      : {}),
    ...(Array.isArray(modelSelection.tagQueries)
      ? {
          tagQueries: modelSelection.tagQueries.filter(
            (value): value is string =>
              typeof value === "string" && value.trim().length >= 2
          ),
        }
      : {}),
  })
  const summary =
    input.summary?.trim() ||
    `The research model selected ${input.action.replaceAll("_", " ")}.`
  const rejectedActions = input.rejectedActions ?? []
  const candidate =
    input.action === "stop_research"
      ? {
          action: input.action,
          focus,
          summary,
          rejectedActions,
        }
      : {
          action: input.action,
          focus,
          selection: safeSelection,
          summary,
          rejectedActions,
        }
  const parsed = researchSupervisorActionSchema.safeParse(candidate)
  return parsed.success ? parsed.data : undefined
}

function isResearchFocus(value: unknown): value is ResearchSelection["focus"] {
  return (
    value === "campaign_fingerprint" ||
    value === "market_context" ||
    value === "product_context"
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function focusForResearchAction(
  action: z.infer<typeof researchModelActionSchema>["action"],
  requestedFocus: z.infer<typeof researchModelActionSchema>["focus"]
): ResearchSelection["focus"] {
  if (action === "resolve_cultural_references") return "campaign_fingerprint"
  if (action === "compare_brand_and_references") return "campaign_fingerprint"
  if (action === "request_qloo_heatmap") return "campaign_fingerprint"
  if (action === "query_market_culture") return "market_context"
  if (action === "query_product_culture") return "product_context"
  return requestedFocus ?? "campaign_fingerprint"
}

function researchModelErrorDetail(error: unknown): {
  name: string
  message: string
  status?: number
} {
  if (!(error instanceof Error))
    return { name: "UnknownError", message: "unknown model error" }
  const record = error as Error & {
    statusCode?: unknown
    status?: unknown
  }
  const status =
    typeof record.statusCode === "number"
      ? record.statusCode
      : typeof record.status === "number"
        ? record.status
        : undefined
  return {
    name: error.name,
    message: error.message
      .replaceAll(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
      .replaceAll(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
      .slice(0, 300),
    ...(status !== undefined ? { status } : {}),
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

function isCultureResearchResult(value: unknown): value is CultureResearchResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return (
    Array.isArray(record.signals) &&
    Array.isArray(record.resolvedReferences) &&
    Array.isArray(record.resolvedTags) &&
    typeof record.location === "object" &&
    record.location !== null &&
    typeof record.fingerprint === "object" &&
    record.fingerprint !== null &&
    typeof record.providerSummary === "object" &&
    record.providerSummary !== null
  )
}

function isSparseResearchError(error: unknown): error is ProviderError {
  return error instanceof ProviderError && error.code === "EMPTY_RESULT"
}
