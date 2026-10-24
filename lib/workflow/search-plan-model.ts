import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateText, Output } from "ai"
import type { CampaignBrief, CultureSignal } from "@/lib/domain/types"
import {
  searchPlanSchema,
  validateSearchPlanAgainstCampaign,
  type ActorSearchPlan,
} from "@/lib/workflow/search-plan"

export async function generateModelSearchPlan(
  brief: CampaignBrief,
  signals: CultureSignal[]
): Promise<ActorSearchPlan | undefined> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  const modelId = process.env.OPENROUTER_MODEL?.trim()
  if (!apiKey || !modelId || process.env.ENABLE_MODEL_SEARCH_PLAN !== "true")
    return undefined

  const provider = createOpenRouter({ apiKey })
  const result = await generateText({
    model: provider(modelId),
    output: Output.object({ schema: searchPlanSchema }),
    maxOutputTokens: 500,
    prompt: [
      "Create an Instagram creator search plan for the campaign below.",
      "Return only supported actor filters. Do not include URLs, credentials, endpoints, or extra fields.",
      "Preserve the campaign follower limits and result limit exactly.",
      JSON.stringify({
        brand: brief.brandName,
        productCategory: brief.productCategory,
        objective: brief.objective,
        targetMarket: brief.targetMarket,
        preferredLanguages: brief.preferredLanguages,
        culturalSignals: signals
          .slice(0, 10)
          .map((signal) => ({ name: signal.name, affinity: signal.affinity })),
        constraints: {
          minFollowers: brief.minFollowers,
          maxFollowers: brief.maxFollowers,
          maxResults: brief.creatorLimit,
        },
      }),
    ].join("\n"),
  })

  if (!result.output) return undefined
  return validateSearchPlanAgainstCampaign(result.output, brief)
}
