import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateText, Output } from "ai"
import type { CampaignBrief, EvidenceRef } from "@/lib/domain/types"
import { evidenceGroundedReportSchema, type EvidenceGroundedReport } from "./schemas"
import { evidenceGroundedPrompt } from "./prompts"
import type { ScoredCreatorForPrompt } from "./types"

export async function generateEvidenceGroundedReport(
  brief: CampaignBrief,
  creator: ScoredCreatorForPrompt,
  evidence: EvidenceRef[]
): Promise<EvidenceGroundedReport | undefined> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  const modelId = process.env.OPENROUTER_MODEL?.trim()
  if (!apiKey || !modelId)
    return undefined

  const provider = createOpenRouter({ apiKey })
  const result = await generateText({
    model: provider(modelId),
    timeout: 20_000,
    output: Output.object({ schema: evidenceGroundedReportSchema }),
    maxOutputTokens: 700,
    providerOptions: {
      openrouter: {
        reasoning: { max_tokens: 256, exclude: true },
      },
    },
    prompt: evidenceGroundedPrompt(brief, creator, evidence),
  })
  if (!result.output) return undefined
  const parsed = evidenceGroundedReportSchema.safeParse(result.output)
  if (!parsed.success) return undefined
  const allowedKeys = new Set(evidence.map((item) => `${item.source}:${item.fieldPath}`))
  if (parsed.data.evidenceKeys.some((key) => !allowedKeys.has(key))) return undefined
  return parsed.data
}
