import type { CampaignRow, AnalysisRunRow } from "@/lib/db/database.types"
import type {
  SafeAnalysisRun,
  SafeCampaign,
  TargetMarket,
  WorkflowStage,
} from "@/lib/domain/types"

export function serializeCampaign(campaign: CampaignRow): SafeCampaign {
  const targetMarket: TargetMarket = {
    country: campaign.market_country,
    marketScope: campaign.market_scope,
    ...(campaign.market_region ? { region: campaign.market_region } : {}),
    ...(campaign.market_city ? { city: campaign.market_city } : {}),
  }

  return {
    id: campaign.id,
    brandName: campaign.brand_name,
    productCategory: campaign.product_category,
    objective: campaign.objective,
    targetMarket,
    creatorLimit: campaign.creator_limit,
    status: campaign.status,
    createdAt: campaign.created_at,
    updatedAt: campaign.updated_at,
  }
}

export function serializeAnalysisRun(run: AnalysisRunRow): SafeAnalysisRun {
  return {
    id: run.id,
    campaignId: run.campaign_id,
    attempt: run.attempt,
    status: run.status,
    stage: run.stage,
    ...(run.provider_run_id ? { providerRunId: run.provider_run_id } : {}),
    ...(run.provider_dataset_id
      ? { providerDatasetId: run.provider_dataset_id }
      : {}),
    ...(run.error_code ? { errorCode: run.error_code } : {}),
    ...(run.error_message ? { errorMessage: run.error_message } : {}),
    queuedAt: run.queued_at,
    ...(run.started_at ? { startedAt: run.started_at } : {}),
    ...(run.completed_at ? { completedAt: run.completed_at } : {}),
    stageMessage: stageMessage(run.stage, run.status),
    retryAvailable: run.status === "failed" && run.attempt < readMaxAttempts(),
    createdAt: run.created_at,
    updatedAt: run.updated_at,
  }
}

function stageMessage(
  stage: WorkflowStage,
  status: AnalysisRunRow["status"]
): string {
  if (status === "completed") return "Analysis complete"
  if (status === "failed")
    return "Analysis failed; a new attempt can be started"
  if (status === "cancelled") return "Analysis cancelled"
  const messages: Record<WorkflowStage, string> = {
    queued: "Waiting to start",
    researching_culture: "Researching cultural signals for the target market",
    searching_creators:
      "Searching for creators with the validated provider plan",
    scoring: "Creator results are ready for deterministic scoring",
    generating_report: "Preparing the evidence report",
  }
  return messages[stage]
}

function readMaxAttempts(): number {
  const value = Number(process.env.MAX_ANALYSIS_ATTEMPTS)
  return Number.isInteger(value) && value > 0 ? value : 3
}
