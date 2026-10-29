import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { isStepCount, tool, ToolLoopAgent } from "ai"
import { executeAgentTool } from "@/lib/agent/tool-execution"
import type { CampaignBrief, CultureSignal } from "@/lib/domain/types"
import {
  searchPlanSchema,
  validateSearchPlanAgainstCampaign,
  type ActorSearchPlan,
} from "@/lib/workflow/search-plan"

export interface ModelSearchPlanResult {
  plan?: ActorSearchPlan
  attempted: boolean
  decisionMode: "model" | "deterministic_fallback"
  fallbackReason?: string
}

export async function generateModelSearchPlan(
  brief: CampaignBrief,
  signals: CultureSignal[]
): Promise<ActorSearchPlan | undefined> {
  const result = await generateModelSearchPlanResult(brief, signals)
  return result.plan
}

export async function generateModelSearchPlanResult(
  brief: CampaignBrief,
  signals: CultureSignal[]
): Promise<ModelSearchPlanResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  const modelId = process.env.OPENROUTER_MODEL?.trim()
  if (!apiKey || !modelId)
    return {
      attempted: false,
      decisionMode: "deterministic_fallback",
      fallbackReason: "search_plan_model_configuration_missing",
    }

  const provider = createOpenRouter({ apiKey })
  try {
    const searchPlanTool = {
      name: "propose_search_plan",
      provider: "internal" as const,
      inputSchema: searchPlanSchema,
      outputSchema: searchPlanSchema,
      execute: async (input: ActorSearchPlan) =>
        validateSearchPlanAgainstCampaign(input, brief),
    }
    const proposeSearchPlan = tool({
      description:
        "Return one validated Instagram creator search plan for the campaign.",
      inputSchema: searchPlanSchema,
      execute: async (input) =>
        (await executeAgentTool(searchPlanTool, input)).output,
    })
    const agent = new ToolLoopAgent({
      model: provider(modelId),
      instructions:
        "You are a campaign search planner. Use the proposeSearchPlan tool exactly once. Use cultural signals as meaningful search concepts, preserve hard campaign constraints, and do not invent unsupported filters.",
      tools: { proposeSearchPlan },
      toolChoice: { type: "tool", toolName: "proposeSearchPlan" },
      stopWhen: isStepCount(1),
      maxOutputTokens: 500,
      providerOptions: {
        openrouter: {
          reasoning: { max_tokens: 256, exclude: true },
        },
      },
    })
    const result = await agent.generate({
      prompt: [
        "Create an Instagram creator search plan for the campaign below.",
        "Use the cultural signals as meaningful search concepts, not as generic popularity terms.",
        "Return only supported actor filters. Do not include URLs, credentials, endpoints, or extra fields.",
        "Preserve the campaign follower limits and result limit exactly.",
        JSON.stringify({
          brand: brief.brandName,
          productCategory: brief.productCategory,
          productDescription: brief.productDescription,
          objective: brief.objective,
          targetMarket: brief.targetMarket,
          preferredLanguages: brief.preferredLanguages,
          culturalSignals: signals
            .slice(0, 10)
            .map((signal) => ({
              id: signal.signalId,
              name: signal.name,
              affinity: signal.affinity,
              sourceGroup: signal.sourceGroup,
            })),
          constraints: {
            minFollowers: brief.minFollowers,
            maxFollowers: brief.maxFollowers,
            maxResults: brief.creatorLimit,
          },
        }),
      ].join("\n"),
    })

    const toolResult = result.toolResults.find(
      (item) => item.toolName === "proposeSearchPlan"
    )
    if (!toolResult) {
      return {
        attempted: true,
        decisionMode: "deterministic_fallback",
        fallbackReason: "search_plan_model_returned_no_plan",
      }
    }
    return {
      plan: searchPlanSchema.parse(toolResult.output),
      attempted: true,
      decisionMode: "model",
    }
  } catch {
    return {
      attempted: true,
      decisionMode: "deterministic_fallback",
      fallbackReason: "search_plan_model_failed_validation_or_request",
    }
  }
}
