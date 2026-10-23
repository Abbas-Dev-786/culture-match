import type { CampaignRow, AnalysisRunRow } from "@/lib/db/database.types"
import type { SafeAnalysisRun, SafeCampaign, TargetMarket } from "@/lib/domain/types"

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
    ...(run.provider_dataset_id ? { providerDatasetId: run.provider_dataset_id } : {}),
    ...(run.error_code ? { errorCode: run.error_code } : {}),
    ...(run.error_message ? { errorMessage: run.error_message } : {}),
    queuedAt: run.queued_at,
    ...(run.started_at ? { startedAt: run.started_at } : {}),
    ...(run.completed_at ? { completedAt: run.completed_at } : {}),
    createdAt: run.created_at,
    updatedAt: run.updated_at,
  }
}
