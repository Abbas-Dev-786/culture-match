import type { AnalysisRunRow, CampaignRow } from "@/lib/db/database.types"
import type {
  CampaignBrief,
  CultureSignal,
  JsonObject,
} from "@/lib/domain/types"
import {
  getCultureProfile,
  saveCreatorCandidates,
  saveCultureProfile,
} from "@/lib/db/provider-results"
import {
  failAnalysisRunById,
  claimProviderStart,
  getWorkflowContext,
  transitionRunById,
  updateRunDatasetId,
  updateRunProviderIds,
} from "@/lib/db/runs"
import { createApifyClient } from "@/lib/tools/apify/client"
import { getRunResults } from "@/lib/tools/apify/get-run-results"
import { startCreatorSearch } from "@/lib/tools/apify/search-creators"
import { ProviderError } from "@/lib/tools/provider-errors"
import { analyzeCulture } from "@/lib/tools/qloo/analyze-culture"
import { createQlooClient } from "@/lib/tools/qloo/client"
import { withProviderRetry } from "@/lib/workflow/retry"
import {
  actorPlanToJson,
  createDeterministicSearchPlans,
  type SearchPlan,
} from "@/lib/workflow/search-plan"
import { generateModelSearchPlan } from "@/lib/workflow/search-plan-model"

const activeCampaigns = new Set<string>()

export async function runCampaignAnalysis(
  campaignId: string
): Promise<AnalysisRunRow> {
  if (activeCampaigns.has(campaignId))
    return (await getWorkflowContext(campaignId)).run
  activeCampaigns.add(campaignId)
  try {
    const context = await getWorkflowContext(campaignId)
    try {
      return await advanceWorkflow(
        context.campaign,
        context.run,
        context.client,
        context.userId
      )
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error
      const latest = await getWorkflowContext(campaignId)
      return failAnalysisRunById(
        latest.client,
        latest.run,
        error.code,
        error.message
      )
    }
  } finally {
    activeCampaigns.delete(campaignId)
  }
}

async function advanceWorkflow(
  campaign: CampaignRow,
  initialRun: AnalysisRunRow,
  client: Parameters<typeof getCultureProfile>[0],
  userId: string
): Promise<AnalysisRunRow> {
  let run = initialRun
  const brief = campaignToBrief(campaign)

  if (run.status === "queued") {
    run = await transitionRunById(client, run, "researching_culture")
  }
  if (run.status !== "running") return run
  enforceWorkflowRuntime(run)

  if (run.stage === "researching_culture") {
    let culture = await getCultureProfile(client, userId, run.id)
    if (!culture) {
      const retries: JsonObject[] = []
      const result = await withProviderRetry(
        "qloo",
        () => analyzeCulture(brief, createQlooClient()),
        undefined,
        undefined,
        (record) =>
          retries.push({
            provider: record.provider,
            attempt: record.attempt,
            delayClass: record.delayClass,
            errorCode: record.errorCode,
            message: record.message,
          })
      )
      const providerSummary: JsonObject = {
        ...result.providerSummary,
        ...(retries.length > 0 ? { retryHistory: retries } : {}),
      }
      await saveCultureProfile(client, {
        campaignId: campaign.id,
        analysisRunId: run.id,
        userId,
        marketCountry: campaign.market_country,
        signals: result.signals,
        providerSummary,
        ...(result.rawPayload ? { rawPayload: result.rawPayload } : {}),
        observedAt: new Date().toISOString(),
      })
      culture = { signals: result.signals, providerSummary }
    }
    run = await transitionRunById(client, run, "searching_creators")
  }
  enforceWorkflowRuntime(run)

  if (run.stage !== "searching_creators") return run

  if (!run.provider_run_id) {
    const culture = await getCultureProfile(client, userId, run.id)
    if (!culture)
      throw new ProviderError({
        provider: "qloo",
        code: "EMPTY_RESULT",
        message: "Culture research is missing",
        retryable: false,
      })
    const plans = createDeterministicSearchPlans(brief, culture.signals)
    const modelPlan = await generateModelPlanSafely(brief, culture.signals)
    const culturePlan: SearchPlan = modelPlan
      ? { ...modelPlan, variant: "culture_informed" }
      : plans.cultureInformed
    const providerSummary: JsonObject = {
      ...culture.providerSummary,
      searchPlans: {
        baseline: actorPlanToJson(plans.baseline),
        cultureInformed: actorPlanToJson(culturePlan),
      },
      searchPlanSource: modelPlan ? "model" : plans.source,
    }
    await saveCultureProfile(client, {
      campaignId: campaign.id,
      analysisRunId: run.id,
      userId,
      marketCountry: campaign.market_country,
      signals: culture.signals,
      providerSummary,
      observedAt: new Date().toISOString(),
    })
    const claim = await claimProviderStart(client, run)
    if (!claim) return (await getWorkflowContext(campaign.id)).run

    const apify = createApifyClient()
    // Actor creation is intentionally single-attempt: a lost response can
    // mean Apify accepted the run, so repeating the request could duplicate it.
    const started = await startCreatorSearch(
      apify,
      culturePlan,
      run.idempotency_key
    )
    run = await updateRunProviderIds(
      client,
      claim.run,
      started.runId,
      started.datasetId,
      claim.claimToken
    )
    return run
  }

  const providerRunId = run.provider_run_id
  const results = await withProviderRetry(
    "apify",
    () =>
      getRunResults(
        createApifyClient(),
        providerRunId,
        run.provider_dataset_id ?? undefined,
        new Date().toISOString(),
        campaign.creator_limit
      ),
    undefined,
    undefined,
    (record) =>
      console.info(
        "provider_retry",
        JSON.stringify({
          runId: run.id,
          provider: record.provider,
          attempt: record.attempt,
          delayClass: record.delayClass,
          errorCode: record.errorCode,
        })
      )
  )
  if (!results) return run
  if (
    results.run.datasetId &&
    results.run.datasetId !== run.provider_dataset_id
  ) {
    run = await updateRunDatasetId(client, run, results.run.datasetId)
  }
  await saveCreatorCandidates(client, {
    ...runOwnership(run, campaign.id, userId),
    creators: results.creators,
  })
  return transitionRunById(client, run, "scoring")
}

function enforceWorkflowRuntime(run: AnalysisRunRow): void {
  if (!run.started_at) return
  const startedAt = Date.parse(run.started_at)
  if (!Number.isFinite(startedAt)) return
  const elapsed = Date.now() - startedAt
  if (elapsed <= readMaxAnalysisRuntimeMs()) return
  throw new ProviderError({
    provider: "apify",
    code: "TIMEOUT",
    message: "The analysis run exceeded its maximum runtime",
    retryable: false,
  })
}

function readMaxAnalysisRuntimeMs(): number {
  const value = Number(process.env.MAX_ANALYSIS_RUNTIME_MS)
  return Number.isInteger(value) && value > 0 ? value : 900_000
}

async function generateModelPlanSafely(
  brief: CampaignBrief,
  signals: CultureSignal[]
): Promise<Awaited<ReturnType<typeof generateModelSearchPlan>>> {
  try {
    return await generateModelSearchPlan(brief, signals)
  } catch {
    return undefined
  }
}

function campaignToBrief(campaign: CampaignRow): CampaignBrief {
  return {
    brandName: campaign.brand_name,
    productCategory: campaign.product_category,
    objective: campaign.objective,
    targetMarket: {
      country: campaign.market_country,
      marketScope: campaign.market_scope,
      ...(campaign.market_region ? { region: campaign.market_region } : {}),
      ...(campaign.market_city ? { city: campaign.market_city } : {}),
    },
    culturalReferences: campaign.cultural_references,
    preferredLanguages: campaign.preferred_languages,
    ...(campaign.min_followers !== null
      ? { minFollowers: campaign.min_followers }
      : {}),
    ...(campaign.max_followers !== null
      ? { maxFollowers: campaign.max_followers }
      : {}),
    ...(campaign.max_budget !== null ? { maxBudget: campaign.max_budget } : {}),
    ...(campaign.currency ? { currency: campaign.currency } : {}),
    creatorLimit: campaign.creator_limit,
  }
}

function runOwnership(
  run: AnalysisRunRow,
  campaignId: string,
  userId: string
): {
  campaignId: string
  analysisRunId: string
  userId: string
} {
  return { campaignId, analysisRunId: run.id, userId }
}
