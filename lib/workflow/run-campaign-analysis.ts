import type { AnalysisRunRow, CampaignRow } from "@/lib/db/database.types"
import type {
  BaselineComparison,
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
  completeAnalysisRunById,
  getWorkflowContext,
  getWorkflowContextByProviderRunId,
  transitionRunById,
  updateRunBaselineDatasetId,
  updateRunBaselineProviderIds,
  updateRunDatasetId,
  updateRunProviderIds,
} from "@/lib/db/runs"
import {
  getCreatorCandidates,
  getCreatorMatches,
  saveCreatorMatches,
  updateCreatorMatchReport,
} from "@/lib/db/matches"
import { createApifyClient } from "@/lib/tools/apify/client"
import { getRunResults } from "@/lib/tools/apify/get-run-results"
import { startCreatorSearch } from "@/lib/tools/apify/search-creators"
import { ProviderError } from "@/lib/tools/provider-errors"
import { analyzeCulture } from "@/lib/tools/qloo/analyze-culture"
import { createQlooClient } from "@/lib/tools/qloo/client"
import { enrichCreatorsWithQloo } from "@/lib/tools/qloo/enrich-creators"
import { withProviderRetry } from "@/lib/workflow/retry"
import {
  actorPlanToJson,
  createDeterministicSearchPlans,
  type SearchPlan,
} from "@/lib/workflow/search-plan"
import { generateModelSearchPlan } from "@/lib/workflow/search-plan-model"
import { createServiceRoleClient } from "@/lib/server-admin"
import type { WorkflowContext } from "@/lib/db/runs"
import { ApplicationError, isApplicationError } from "@/lib/errors"
import { normalizeStoredCreator } from "@/lib/matching/normalize-creator"
import { normalizeCultureSignals } from "@/lib/matching/normalize-culture"
import {
  scoreCreators,
  SCORE_ALGORITHM_VERSION,
} from "@/lib/matching/score-creators"
import { compareRuns, rankedCreators } from "@/lib/matching/compare-runs"
import { generateEvidenceGroundedReport } from "@/lib/agent/model"
import { logWorkflowEvent } from "@/lib/workflow/telemetry"

const activeCampaigns = new Set<string>()

export async function runCampaignAnalysis(
  campaignId: string
): Promise<AnalysisRunRow> {
  const context = await getWorkflowContext(campaignId)
  return executeWorkflow(context, () => getWorkflowContext(campaignId))
}

export async function runCampaignAnalysisForProviderRun(
  providerRunId: string
): Promise<AnalysisRunRow | undefined> {
  const client = createServiceRoleClient()
  const context = await getWorkflowContextByProviderRunId(client, providerRunId)
  if (!context) return undefined
  try {
    return await executeWorkflow(
      context,
      () => getWorkflowContextByProviderRunId(client, providerRunId)
    )
  } catch (error) {
    if (!isApplicationError(error) || error.code !== "WORKFLOW_CONFLICT")
      throw error
    const latest = await getWorkflowContextByProviderRunId(client, providerRunId)
    return latest?.run ?? context.run
  }
}

async function executeWorkflow(
  context: WorkflowContext,
  refreshContext: () => Promise<WorkflowContext | undefined>
): Promise<AnalysisRunRow> {
  const campaignId = context.campaign.id
  if (activeCampaigns.has(campaignId)) return context.run
  activeCampaigns.add(campaignId)
  try {
    return await advanceWorkflow(
      context.campaign,
      context.run,
      context.client,
      context.userId
    )
  } catch (error) {
    if (!(error instanceof ProviderError)) throw error
    const latest = (await refreshContext()) ?? context
    return failAnalysisRunById(
      latest.client,
      latest.run,
      error.code,
      error.message
    )
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
      const providerStartedAt = new Date().toISOString()
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
      logWorkflowEvent({
        campaignId: campaign.id,
        analysisRunId: run.id,
        stage: "researching_culture",
        status: "provider_completed",
        provider: "qloo",
        startedAt: providerStartedAt,
      })
      culture = { signals: result.signals, providerSummary }
    }
    run = await transitionRunById(client, run, "searching_creators")
  }
  enforceWorkflowRuntime(run)

  if (run.stage === "searching_creators" && (!run.provider_run_id || !run.baseline_provider_run_id)) {
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
    if (!claim) return run

    const apify = createApifyClient()
    // Actor creation is intentionally single-attempt: a lost response can
    // mean Apify accepted the run, so repeating the request could duplicate it.
    if (!claim.run.baseline_provider_run_id) {
      const baselineStarted = await startCreatorSearch(
        apify,
        plans.baseline,
        `${run.idempotency_key}:baseline`
      )
      logWorkflowEvent({
        campaignId: campaign.id,
        analysisRunId: run.id,
        stage: "searching_creators",
        status: "provider_started",
        provider: "apify",
        startedAt: run.started_at,
      })
      run = await updateRunBaselineProviderIds(
        client,
        claim.run,
        baselineStarted.runId,
        baselineStarted.datasetId,
        claim.claimToken
      )
    }
    if (!run.provider_run_id) {
      const started = await startCreatorSearch(
        apify,
        culturePlan,
        `${run.idempotency_key}:culture`
      )
      logWorkflowEvent({
        campaignId: campaign.id,
        analysisRunId: run.id,
        stage: "searching_creators",
        status: "provider_started",
        provider: "apify",
        startedAt: run.started_at,
      })
      run = await updateRunProviderIds(
        client,
        run,
        started.runId,
        started.datasetId,
        claim.claimToken
      )
    }
    return run
  }

  if (run.stage !== "searching_creators") {
    if (run.stage === "scoring")
      return scoreWorkflow(client, campaign, run, userId)
    if (run.stage === "generating_report")
      return reportWorkflow(client, campaign, run, userId)
    return run
  }

  const baselineResults = await withProviderRetry(
    "apify",
    () =>
      getRunResults(
        createApifyClient(),
        run.baseline_provider_run_id as string,
        run.baseline_provider_dataset_id ?? undefined,
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
  if (!baselineResults) return run
  if (
    baselineResults.run.datasetId &&
    baselineResults.run.datasetId !== run.baseline_provider_dataset_id
  ) {
    run = await updateRunBaselineDatasetId(
      client,
      run,
      baselineResults.run.datasetId
    )
  }

  const cultureResults = await withProviderRetry(
    "apify",
    () =>
      getRunResults(
        createApifyClient(),
        run.provider_run_id as string,
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
  if (!cultureResults) return run
  if (
    cultureResults.run.datasetId &&
    cultureResults.run.datasetId !== run.provider_dataset_id
  ) {
    run = await updateRunDatasetId(client, run, cultureResults.run.datasetId)
  }
  let enrichedBaselineCreators = baselineResults.creators
  let enrichedCultureCreators = cultureResults.creators
  try {
    const allCreators = [
      ...baselineResults.creators,
      ...cultureResults.creators,
    ]
    const enrichedCreators = await enrichCreatorsWithQloo(
      allCreators,
      locationQueryForCampaign(campaign),
      createQlooClient()
    )
    const enrichedById = new Map(
      enrichedCreators.map((creator) => [creator.providerCreatorId, creator])
    )
    enrichedBaselineCreators = baselineResults.creators.map(
      (creator) => enrichedById.get(creator.providerCreatorId) ?? creator
    )
    enrichedCultureCreators = cultureResults.creators.map(
      (creator) => enrichedById.get(creator.providerCreatorId) ?? creator
    )
  } catch {
    // Cultural creator enrichment is additive. Qloo market research remains the source of truth.
  }
  await saveCreatorCandidates(client, {
    ...runOwnership(run, campaign.id, userId),
    searchVariant: "baseline",
    creators: enrichedBaselineCreators,
  })
  await saveCreatorCandidates(client, {
    ...runOwnership(run, campaign.id, userId),
    searchVariant: "culture_informed",
    creators: enrichedCultureCreators,
  })
  logWorkflowEvent({
    campaignId: campaign.id,
    analysisRunId: run.id,
    stage: "searching_creators",
    status: "provider_completed",
    provider: "apify",
    startedAt: run.started_at,
  })
  return transitionRunById(client, run, "scoring")
}

async function scoreWorkflow(
  client: Parameters<typeof getCultureProfile>[0],
  campaign: CampaignRow,
  run: AnalysisRunRow,
  userId: string
): Promise<AnalysisRunRow> {
  const culture = await getCultureProfile(client, userId, run.id)
  if (!culture)
    throw new ProviderError({
      provider: "qloo",
      code: "EMPTY_RESULT",
      message: "Culture research is missing before scoring",
      retryable: false,
    })

  const [baselineRows, cultureRows] = await Promise.all([
    getCreatorCandidates(client, userId, run.id, "baseline"),
    getCreatorCandidates(client, userId, run.id, "culture_informed"),
  ])
  const brief = campaignToBrief(campaign)
  const signals = normalizeCultureSignals(culture.signals)
  const baselineScores = scoreCreators(
    brief,
    signals,
    baselineRows.map(normalizeStoredCreator),
    undefined,
    { includeQlooResonance: false }
  )
  const cultureScores = scoreCreators(
    brief,
    signals,
    cultureRows.map(normalizeStoredCreator)
  )
  const cultureAblationScores = scoreCreators(
    brief,
    signals,
    cultureRows.map(normalizeStoredCreator),
    undefined,
    { includeQlooResonance: false }
  )
  const comparison: BaselineComparison = {
    ...compareRuns(
    rankedCreators(baselineScores),
    rankedCreators(cultureScores)
    ),
    qlooAblation: compareQlooAblation(cultureScores, cultureAblationScores),
  }

  await saveCreatorMatches(client, {
    ...runOwnership(run, campaign.id, userId),
    searchVariant: "baseline",
    scored: baselineScores,
    candidateByProviderId: new Map(
      baselineRows.map((candidate) => [candidate.provider_creator_id, candidate])
    ),
    comparison,
  })
  await saveCreatorMatches(client, {
    ...runOwnership(run, campaign.id, userId),
    searchVariant: "culture_informed",
    scored: cultureScores,
    candidateByProviderId: new Map(
      cultureRows.map((candidate) => [candidate.provider_creator_id, candidate])
    ),
    comparison,
  })
  await updateScoreAlgorithmVersion(client, run, SCORE_ALGORITHM_VERSION)
  logWorkflowEvent({
    campaignId: campaign.id,
    analysisRunId: run.id,
    stage: "scoring",
    status: "completed",
    startedAt: run.started_at,
  })
  return transitionRunById(client, run, "generating_report")
}

async function reportWorkflow(
  client: Parameters<typeof getCultureProfile>[0],
  campaign: CampaignRow,
  run: AnalysisRunRow,
  userId: string
): Promise<AnalysisRunRow> {
  const modelEnabled = process.env.ENABLE_MODEL_REPORTS === "true"
  if (modelEnabled) {
    const culture = await getCultureProfile(client, userId, run.id)
    const candidates = await getCreatorCandidates(
      client,
      userId,
      run.id,
      "culture_informed"
    )
    const matches = await getCreatorMatches(client, userId, run.id)
    if (culture) {
      const scored = scoreCreators(
        campaignToBrief(campaign),
        normalizeCultureSignals(culture.signals),
        candidates.map(normalizeStoredCreator)
      )
      const matchesByCandidateId = new Map(
        matches.map((match) => [match.creator_candidate_id, match])
      )
      const candidateByProviderId = new Map(
        candidates.map((candidate) => [candidate.provider_creator_id, candidate])
      )
      for (const result of scored.slice(0, 5)) {
        const candidate = candidateByProviderId.get(result.creator.providerCreatorId)
        if (!candidate) continue
        const match = matchesByCandidateId.get(candidate.id)
        if (!match) continue
        try {
          const report = await generateEvidenceGroundedReport(
            campaignToBrief(campaign),
            {
              name: result.creator.name,
              ...(result.creator.username
                ? { username: result.creator.username }
                : {}),
              platform: result.creator.platform,
              ...(result.creator.bio ? { bio: result.creator.bio } : {}),
              campaignFitScore: result.campaignFitScore,
              evidenceCompleteness: result.evidenceCompleteness,
              components: result.components,
              caveats: result.caveats,
            },
            result.evidence
          )
          if (report) {
            await updateCreatorMatchReport(client, match.id, userId, {
              summary: report.summary,
              caveats: report.caveats,
              concept: report.concept,
            })
          }
        } catch {
          // Deterministic match data remains the source of truth if model output fails.
        }
      }
    }
  }
  if (modelEnabled) {
    logWorkflowEvent({
      campaignId: campaign.id,
      analysisRunId: run.id,
      stage: "generating_report",
      status: "completed",
      provider: "openrouter",
      startedAt: run.started_at,
    })
  }
  return completeAnalysisRunById(client, run)
}

async function updateScoreAlgorithmVersion(
  client: Parameters<typeof getCultureProfile>[0],
  run: AnalysisRunRow,
  version: string
): Promise<void> {
  const result = await client
    .from("analysis_runs")
    .update({ score_algorithm_version: version })
    .eq("id", run.id)
    .eq("user_id", run.user_id)
  if (result.error)
    throw new ApplicationError(
      "DATABASE_ERROR",
      500,
      "Unable to persist the score algorithm version"
    )
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

function locationQueryForCampaign(campaign: CampaignRow): string {
  return [campaign.market_city, campaign.market_region, campaign.market_country]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(", ")
}

function compareQlooAblation(
  withQloo: ReturnType<typeof scoreCreators>,
  withoutQloo: ReturnType<typeof scoreCreators>
): NonNullable<BaselineComparison["qlooAblation"]> {
  const withoutMap = new Map(
    withoutQloo.map((result, index) => [result.creator.providerCreatorId, {
      rank: index + 1,
      score: result.campaignFitScore,
    }])
  )
  const withMap = new Map(
    withQloo.map((result, index) => [result.creator.providerCreatorId, {
      rank: index + 1,
      score: result.campaignFitScore,
    }])
  )
  const deltas = [...withMap.keys()].flatMap((providerCreatorId) => {
    const withResult = withMap.get(providerCreatorId)
    const withoutResult = withoutMap.get(providerCreatorId)
    if (!withResult || !withoutResult) return []
    return withResult.score !== null && withoutResult.score !== null
      ? [withResult.score - withoutResult.score]
      : []
  })
  const rankChanges = [...new Set([...withMap.keys(), ...withoutMap.keys()])]
    .flatMap((providerCreatorId) => {
      const withResult = withMap.get(providerCreatorId)
      const withoutResult = withoutMap.get(providerCreatorId)
      if (!withResult || !withoutResult) return []
      const scoreDelta =
        withResult.score !== null && withoutResult.score !== null
          ? round(withResult.score - withoutResult.score)
          : undefined
      if (withResult.rank === withoutResult.rank && !scoreDelta) return []
      return [{
        providerCreatorId,
        withQlooRank: withResult.rank,
        withoutQlooRank: withoutResult.rank,
        ...(scoreDelta !== undefined ? { scoreDelta } : {}),
      }]
    })
  return {
    scoredCreatorCount: deltas.length,
    averageScoreDelta: deltas.length > 0 ? round(deltas.reduce((sum, value) => sum + value, 0) / deltas.length) : 0,
    materiallyChanged: rankChanges.length > 0,
    rankChanges,
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
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
