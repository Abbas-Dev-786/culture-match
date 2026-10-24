import type { WorkflowStage } from "@/lib/domain/types"

export function logWorkflowEvent(input: {
  campaignId: string
  analysisRunId: string
  stage: WorkflowStage
  status: string
  previousStage?: WorkflowStage
  provider?: "qloo" | "apify" | "openrouter"
  startedAt?: string | null
  errorCode?: string
}): void {
  const startedAt = input.startedAt ? Date.parse(input.startedAt) : NaN
  const durationMs = Number.isFinite(startedAt)
    ? Math.max(0, Date.now() - startedAt)
    : undefined

  console.info(
    "workflow_stage",
    JSON.stringify({
      campaignId: input.campaignId,
      analysisRunId: input.analysisRunId,
      stage: input.stage,
      status: input.status,
      ...(input.previousStage ? { previousStage: input.previousStage } : {}),
      ...(input.provider ? { provider: input.provider } : {}),
      ...(durationMs !== undefined ? { durationMs } : {}),
      ...(input.errorCode ? { errorCode: input.errorCode } : {}),
      observedAt: new Date().toISOString(),
    })
  )
}
