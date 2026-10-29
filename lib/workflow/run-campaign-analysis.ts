import type { AnalysisRunRow, CampaignRow } from "@/lib/db/database.types"
import type {
  BaselineComparison,
  CampaignBrief,
  CultureSignal,
  JsonObject,
  JsonValue,
} from "@/lib/domain/types"
import {
  getCultureProfile,
  saveCreatorCandidates,
  saveCultureProfile,
  updateCultureProfileSummary,
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
  updateRunProviderIdsForInitialComparison,
  updateRunProviderIdForRefinement,
} from "@/lib/db/runs"
import {
  getCreatorCandidates,
  getCreatorMatches,
  saveCreatorMatches,
  updateCreatorMatchReport,
} from "@/lib/db/matches"
import { createApifyClient } from "@/lib/tools/apify/client"
import { getRunResults } from "@/lib/tools/apify/get-run-results"
import { ProviderError } from "@/lib/tools/provider-errors"
import { createQlooClient } from "@/lib/tools/qloo/client"
import { withProviderRetry } from "@/lib/workflow/retry"
import {
  actorPlanToJson,
  createDeterministicSearchPlans,
  searchPlanSchema,
  type SearchPlan,
} from "@/lib/workflow/search-plan"
import { generateModelSearchPlanResult } from "@/lib/workflow/search-plan-model"
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
import {
  researchTraceToJson,
  runCulturalResearchAgent,
} from "@/lib/agent/cultural-research-agent"
import {
  MAX_CREATOR_SEARCH_REFINEMENTS,
  assessCreatorSearchResults,
  creatorSearchStateToJson,
  decideCreatorSearch,
  refineCreatorSearchPlan,
  type CreatorSearchAction,
} from "@/lib/agent/creator-search-agent"
import { critiqueEvidence } from "@/lib/agent/evidence-critic"
import { routeCreatorSearchDecision } from "@/lib/agent/decision-router"
import {
  createApprovalKey,
  validateAgentActionTrace,
} from "@/lib/agent/action-trace"
import {
  autonomyBudgetToJson,
  AutonomyBudgetExceededError,
  initialAutonomyBudget,
  readAutonomyBudget,
  reserveAutonomyBudget,
} from "@/lib/agent/autonomy-budget"
import { decisionModeFromEnvironment } from "@/lib/agent/action-trace"
import { createProviderRequestMeter } from "@/lib/agent/provider-usage"
import { executeAgentTool } from "@/lib/agent/tool-execution"
import {
  createCreatorSearchTool,
  createQlooCreatorEnrichmentTool,
  actorPlanForTool,
} from "@/lib/agent/provider-tools"
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
    if (error instanceof AutonomyBudgetExceededError) {
      const latest = (await refreshContext()) ?? context
      return failAnalysisRunById(
        latest.client,
        latest.run,
        error.code,
        error.message
      )
    }
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
      const researchUsage = createProviderRequestMeter()
      const research = await withProviderRetry(
        "qloo",
        () =>
          runCulturalResearchAgent(
            brief,
            createQlooClient({
              onRequest: () => researchUsage.record("qloo"),
            })
          ),
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
      const researchBudget = reserveAutonomyBudget(initialAutonomyBudget(), {
        actions:
          typeof research.agentState.actionCount === "number"
            ? research.agentState.actionCount
            : research.trace.length,
        providerCalls: research.trace.filter(
          (entry) => entry.action === "query_qloo"
        ).length,
        providerRequests: researchUsage.snapshot().qlooRequests,
        modelCalls:
          typeof research.agentState.modelDecisionCount === "number"
            ? research.agentState.modelDecisionCount
            : 0,
      })
      const providerSummary: JsonObject = {
        ...research.providerSummary,
        agent: {
          name: "Cultural research agent",
          version: "v2",
          refinementCount: research.refinementCount,
          maxRefinements: 2,
          decisionPolicy: "validated model action with deterministic evidence critic",
        },
        agentState: research.agentState,
        agentTrace: researchTraceToJson(research.trace),
        autonomyBudget: autonomyBudgetToJson(researchBudget),
        ...(retries.length > 0 ? { retryHistory: retries } : {}),
      }
      await saveCultureProfile(client, {
        campaignId: campaign.id,
        analysisRunId: run.id,
        userId,
        marketCountry: campaign.market_country,
        signals: research.signals,
        providerSummary,
        ...(research.rawPayload ? { rawPayload: research.rawPayload } : {}),
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
      culture = { signals: research.signals, providerSummary }
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
    if (hasPendingApproval(culture.providerSummary)) return run
    const deterministicPlans = createDeterministicSearchPlans(
      brief,
      culture.signals
    )
    const searchPlanResult = await generateModelSearchPlanResult(
      brief,
      culture.signals
    )
    const plans = searchPlanResult.plan
      ? {
          ...deterministicPlans,
          cultureInformed: {
            ...searchPlanResult.plan,
            variant: "culture_informed" as const,
          },
          source: "model" as const,
          queryConstruction: {
            ...deterministicPlans.queryConstruction,
            cultureInformed: {
              ...deterministicPlans.queryConstruction.cultureInformed,
              query: searchPlanResult.plan.query,
            },
          },
        }
      : deterministicPlans
    const broadPlan = plans.baseline
    const culturePlan = plans.cultureInformed
    const searchPlanBudget = reserveAutonomyBudget(
      readAutonomyBudget(culture.providerSummary),
      {
        actions: 1,
        modelCalls: searchPlanResult.attempted ? 1 : 0,
      }
    )
    const providerSummary: JsonObject = {
      ...culture.providerSummary,
      discoveryStrategy: "qloo_guided_parallel",
      searchPlans: {
        baseline: actorPlanToJson(broadPlan),
        cultureInformed: actorPlanToJson(culturePlan),
      },
      searchQueryConstruction: {
        commonTerms: plans.queryConstruction.commonTerms,
        baseline: {
          qlooTerms: plans.queryConstruction.baseline.qlooTerms,
          qlooSignalIds: [],
          query: plans.queryConstruction.baseline.query,
        },
        cultureInformed: {
          qlooTerms: plans.queryConstruction.cultureInformed.qlooTerms,
          qlooSignalIds: plans.queryConstruction.cultureInformed.qlooSignalIds,
          query: culturePlan.query,
          source: "qloo_guided_parallel",
        },
      },
      searchPlanSource: plans.source,
      searchPlanAgent: {
        attempted: searchPlanResult.attempted,
        decisionMode: searchPlanResult.decisionMode,
        ...(searchPlanResult.fallbackReason
          ? { fallbackReason: searchPlanResult.fallbackReason }
          : {}),
      },
      autonomyBudget: autonomyBudgetToJson(searchPlanBudget),
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

    const broadSearchBudget = reserveAutonomyBudget(searchPlanBudget, {
      actions: 2,
      providerCalls: 2,
    })
    await updateCultureProfileSummary(client, userId, run.id, {
      ...providerSummary,
      autonomyBudget: autonomyBudgetToJson(broadSearchBudget),
    })
    const discoveryUsage = createProviderRequestMeter()
    const apify = createApifyClient({
      onRequest: () => discoveryUsage.record("apify"),
    })
    const creatorSearchTool = createCreatorSearchTool(apify)
    // Run broad and Qloo-guided discovery in parallel so the comparison is
    // meaningful before any later bounded refinement decision.
    const broadAttempt =
      claim.run.baseline_provider_run_id || claim.run.provider_run_id
        ? Promise.resolve(undefined)
        : executeAgentTool(creatorSearchTool, {
            plan: actorPlanForTool(broadPlan),
            idempotencyKey: `${run.idempotency_key}:broad`,
          }).then((result) => ({
            runId: result.output.runId,
            ...(result.output.datasetId
              ? { datasetId: result.output.datasetId }
              : {}),
          }))
    const cultureAttempt =
      claim.run.baseline_provider_run_id || claim.run.provider_run_id
        ? Promise.resolve(undefined)
        : executeAgentTool(creatorSearchTool, {
            plan: actorPlanForTool(culturePlan),
            idempotencyKey: `${run.idempotency_key}:culture:initial`,
          }).then((result) => ({
            runId: result.output.runId,
            ...(result.output.datasetId
              ? { datasetId: result.output.datasetId }
              : {}),
          }))

    let persistedRun = claim.run
    const providerResults = await Promise.allSettled([
      broadAttempt,
      cultureAttempt,
    ])
    const measuredDiscoveryBudget = reserveAutonomyBudget(broadSearchBudget, {
      providerRequests: discoveryUsage.snapshot().apifyRequests,
    })
    await updateCultureProfileSummary(client, userId, run.id, {
      ...providerSummary,
      autonomyBudget: autonomyBudgetToJson(measuredDiscoveryBudget),
    })
    const broadAttemptResult = providerResults[0]
    const cultureAttemptResult = providerResults[1]
    if (
      broadAttemptResult?.status === "fulfilled" &&
      broadAttemptResult.value &&
      cultureAttemptResult?.status === "fulfilled" &&
      cultureAttemptResult.value
    ) {
      logWorkflowEvent({
        campaignId: campaign.id,
        analysisRunId: run.id,
        stage: "searching_creators",
        status: "provider_started",
        provider: "apify",
        startedAt: run.started_at,
      })
      persistedRun = await updateRunProviderIdsForInitialComparison(
        client,
        persistedRun,
        broadAttemptResult.value.runId,
        broadAttemptResult.value.datasetId,
        cultureAttemptResult.value.runId,
        cultureAttemptResult.value.datasetId,
        claim.claimToken
      )
    } else if (!persistedRun.provider_run_id && persistedRun.baseline_provider_run_id) {
      persistedRun = await updateRunProviderIds(
        client,
        persistedRun,
        persistedRun.baseline_provider_run_id,
        persistedRun.baseline_provider_dataset_id ?? undefined,
        claim.claimToken
      )
    } else if (
      !persistedRun.baseline_provider_run_id &&
      persistedRun.provider_run_id
    ) {
      persistedRun = await updateRunBaselineProviderIds(
        client,
        persistedRun,
        persistedRun.provider_run_id,
        persistedRun.provider_dataset_id ?? undefined,
        claim.claimToken
      )
    }
    run = persistedRun

    const failedAttempt = providerResults.find(
      (attempt) => attempt.status === "rejected"
    )
    if (failedAttempt?.status === "rejected") {
      if (failedAttempt.reason instanceof ProviderError) {
        throw failedAttempt.reason
      }
      throw new ProviderError({
        provider: "apify",
        code: "INVALID_PARAMETERS",
        message: `One of the parallel Apify searches failed validation before starting: ${errorMessage(failedAttempt.reason)}`,
        retryable: false,
        cause: failedAttempt.reason,
      })
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

  const retrievalUsage = createProviderRequestMeter()
  const retrievalApify = createApifyClient({
    onRequest: () => retrievalUsage.record("apify"),
  })
  const baselineResults = await withProviderRetry(
    "apify",
    () =>
      getRunResults(
        retrievalApify,
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

  const cultureResults =
    run.provider_run_id === run.baseline_provider_run_id
      ? baselineResults
      : await withProviderRetry(
          "apify",
          () =>
            getRunResults(
              retrievalApify,
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
  let culture = await getCultureProfile(client, userId, run.id)
  if (!culture)
    throw new ProviderError({
      provider: "qloo",
      code: "EMPTY_RESULT",
      message: "Culture research is missing before creator replanning",
      retryable: false,
    })
  if (hasPendingApproval(culture.providerSummary)) return run
  const retrievalBudget = reserveAutonomyBudget(
    readAutonomyBudget(culture.providerSummary),
    {
      actions: 1,
      providerCalls: run.provider_run_id === run.baseline_provider_run_id ? 1 : 2,
      providerRequests: retrievalUsage.snapshot().apifyRequests,
    }
  )
  const retrievalSummary = {
    ...culture.providerSummary,
    autonomyBudget: autonomyBudgetToJson(retrievalBudget),
  }
  await updateCultureProfileSummary(client, userId, run.id, retrievalSummary)
  culture = { ...culture, providerSummary: retrievalSummary }
  const enrichmentUsage = createProviderRequestMeter()
  let enrichmentBudget: ReturnType<typeof readAutonomyBudget> | undefined
  try {
    enrichmentBudget = reserveAutonomyBudget(
      readAutonomyBudget(culture.providerSummary),
      { actions: 1, providerCalls: 1 }
    )
    await updateCultureProfileSummary(client, userId, run.id, {
      ...culture.providerSummary,
      autonomyBudget: autonomyBudgetToJson(enrichmentBudget),
    })
    const allCreators = [
      ...new Map(
        [...baselineResults.creators, ...cultureResults.creators].map(
          (creator) => [creator.providerCreatorId, creator] as const
        )
      ).values(),
    ]
    const baselineCreatorIds = new Set(
      baselineResults.creators.map((creator) => creator.providerCreatorId)
    )
    const cultureCreatorIds = new Set(
      cultureResults.creators.map((creator) => creator.providerCreatorId)
    )
    const enrichedCreators = (
      await executeAgentTool(
        createQlooCreatorEnrichmentTool(
          createQlooClient({
            onRequest: () => enrichmentUsage.record("qloo"),
          }),
          async (creator) => {
            if (baselineCreatorIds.has(creator.providerCreatorId)) {
              await saveCreatorCandidates(client, {
                ...runOwnership(run, campaign.id, userId),
                searchVariant: "baseline",
                creators: [creator],
              })
            }
            if (cultureCreatorIds.has(creator.providerCreatorId)) {
              await saveCreatorCandidates(client, {
                ...runOwnership(run, campaign.id, userId),
                searchVariant: "culture_informed",
                creators: [creator],
              })
            }
          }
        ),
        {
          creators: allCreators,
          locationQuery: locationQueryForCampaign(campaign),
          campaignSignals: normalizeCultureSignals(culture?.signals ?? []),
          conditioning: {
        ...(brief.qlooAudienceIds ? { audienceIds: brief.qlooAudienceIds } : {}),
        ...(brief.qlooAudienceWeight !== undefined ? { audienceWeight: brief.qlooAudienceWeight } : {}),
        ...(brief.qlooAgeRange ? { ageRange: brief.qlooAgeRange } : {}),
        ...(brief.qlooGender ? { gender: brief.qlooGender } : {}),
          },
        }
      )
    ).output
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
  if (enrichmentBudget) {
    const measuredEnrichmentBudget = reserveAutonomyBudget(enrichmentBudget, {
      providerRequests: enrichmentUsage.snapshot().qlooRequests,
    })
    const enrichmentSummary = {
      ...culture.providerSummary,
      autonomyBudget: autonomyBudgetToJson(measuredEnrichmentBudget),
    }
    await updateCultureProfileSummary(client, userId, run.id, enrichmentSummary)
    culture = { ...culture, providerSummary: enrichmentSummary }
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

  const searchState = readCreatorSearchState(culture.providerSummary)
  const baseCulturePlan =
    readStoredCultureSearchPlan(culture.providerSummary) ??
    createDeterministicSearchPlans(brief, culture.signals).cultureInformed
  const creatorDecisionEnvironment = decisionModeFromEnvironment()
  const creatorDecisionBudget = reserveAutonomyBudget(
    readAutonomyBudget(culture.providerSummary),
    {
      actions: 1,
      modelCalls: creatorDecisionEnvironment.mode === "model" ? 1 : 0,
    }
  )
  await updateCultureProfileSummary(client, userId, run.id, {
    ...culture.providerSummary,
    autonomyBudget: autonomyBudgetToJson(creatorDecisionBudget),
  })
  const searchDecisionFromAgent = await decideCreatorSearch(
    brief,
    baseCulturePlan,
    culture.signals,
    enrichedCultureCreators,
    searchState.refinementCount
  )
  const criticBudget = reserveAutonomyBudget(creatorDecisionBudget, {
    actions: 1,
  })
  await updateCultureProfileSummary(client, userId, run.id, {
    ...culture.providerSummary,
    autonomyBudget: autonomyBudgetToJson(criticBudget),
  })
  const evidenceCritic = critiqueEvidence({
    signals: culture.signals,
    culturalReferences: brief.culturalReferences,
    populatedLayerCount: readPopulatedLayerCount(culture.providerSummary),
    creators: enrichedCultureCreators,
    refinementCount: Math.max(
      searchState.refinementCount,
      readQlooRefinementCount(culture.providerSummary)
    ),
  })
  const budgetedSummary: JsonObject = {
    ...culture.providerSummary,
    autonomyBudget: autonomyBudgetToJson(criticBudget),
  }
  if (
    evidenceCritic.decision === "refine_qloo" &&
    readQlooRefinementCount(culture.providerSummary) === 0
  ) {
    await refineCultureProfile(
      client,
      campaign,
      run,
      userId,
      brief,
      culture,
      criticBudget
    )
    return run
  }
  const assessment = assessCreatorSearchResults(
    brief,
    enrichedCultureCreators,
    searchState.refinementCount
  )
  const routedDecision = routeCreatorSearchDecision({
    agentDecision: searchDecisionFromAgent,
    evidenceDecision: evidenceCritic.decision,
    assessment,
    approvedAction: searchState.approvedAction,
    approvedPlan: searchState.approvedPlan,
    approvedSignalIds: searchState.approvedSignalIds,
    refinementCount: searchState.refinementCount,
    maxRefinements: MAX_CREATOR_SEARCH_REFINEMENTS,
    targetedEnrichmentCount: readTargetedEnrichmentCount(culture.providerSummary),
  })
  const searchDecision = routedDecision.decision
  const canRefine = routedDecision.canRefine
  const refinedPlan = canRefine
    ? searchState.approvedPlan ?? refineCreatorSearchPlan(
        baseCulturePlan,
        brief,
        culture.signals,
        searchDecision.action,
        searchDecision.signalIds
      )
    : undefined
  const approvalPlan = refinedPlan ?? baseCulturePlan
  const approvalKey = createApprovalKey({
    action: searchDecision.action,
    plan: actorPlanToJson(approvalPlan),
    signalIds: searchDecision.signalIds,
    refinementCount: searchState.refinementCount,
  })
  const shouldEnrich = routedDecision.shouldEnrich
  const requiresApproval = true
  const approvedAction = searchState.approvedAction
  const approvedApprovalKey = searchState.approvedApprovalKey
  const approvalSatisfied =
    approvedAction === searchDecision.action &&
    approvedApprovalKey === approvalKey
  const needsApproval =
    requiresApproval &&
    (canRefine || shouldEnrich)

  if (needsApproval && !approvalSatisfied) {
    await updateCultureProfileSummary(client, userId, run.id, {
      ...budgetedSummary,
      creatorSearchAgentState: {
        ...creatorSearchStateToJson(
          brief,
          assessment,
          searchDecision,
          searchState.refinementCount,
          approvalPlan,
          false,
          approvalKey
        ),
        pendingApproval: {
          action: shouldEnrich
            ? "request_enrichment"
            : "broaden_creator_search",
          reason: searchDecision.summary,
          requestedAction: searchDecision.action,
          approvalKey,
          plan: actorPlanToJson(approvalPlan),
          signalIds: searchDecision.signalIds,
        },
      },
      evidenceCritic,
    })
    return run
  }

  if (shouldEnrich) {
    const targetedEnrichmentBudget = reserveAutonomyBudget(criticBudget, {
      actions: 1,
      providerCalls: 1,
    })
    const enrichmentCandidates = enrichedCultureCreators
      .filter(
        (creator) =>
          creator.missingFields.length > 0 ||
          (creator.qlooSignals?.length ?? 0) === 0
      )
      .slice(0, 10)
    const enrichmentIds = enrichmentCandidates.map(
      (creator) => creator.providerCreatorId
    )
    const refinementSummary: JsonObject = {
      ...budgetedSummary,
      autonomyBudget: autonomyBudgetToJson(targetedEnrichmentBudget),
      creatorSearchAgentState: {
        ...creatorSearchStateToJson(
          brief,
          assessment,
          searchDecision,
          searchState.refinementCount,
          baseCulturePlan,
          approvalSatisfied,
          approvalKey
        ),
        pendingProviderOperation: {
          toolName: "qloo_creator_enrichment",
          action: searchDecision.action,
          inputHash: approvalKey,
          creatorIds: enrichmentIds,
        },
      },
      evidenceCritic,
    }
    await updateCultureProfileSummary(
      client,
      userId,
      run.id,
      refinementSummary
    )
    const targetedUsage = createProviderRequestMeter()
    if (enrichmentCandidates.length > 0) {
      const targetedCreators = (
        await executeAgentTool(
          createQlooCreatorEnrichmentTool(
            createQlooClient({
              onRequest: () => targetedUsage.record("qloo"),
            }),
            async (creator) => {
              if (
                enrichedBaselineCreators.some(
                  (candidate) =>
                    candidate.providerCreatorId === creator.providerCreatorId
                )
              ) {
                await saveCreatorCandidates(client, {
                  ...runOwnership(run, campaign.id, userId),
                  searchVariant: "baseline",
                  creators: [creator],
                })
              }
              if (
                enrichedCultureCreators.some(
                  (candidate) =>
                    candidate.providerCreatorId === creator.providerCreatorId
                )
              ) {
                await saveCreatorCandidates(client, {
                  ...runOwnership(run, campaign.id, userId),
                  searchVariant: "culture_informed",
                  creators: [creator],
                })
              }
            }
          ),
          {
            creators: enrichmentCandidates,
            locationQuery: locationQueryForCampaign(campaign),
            campaignSignals: normalizeCultureSignals(culture.signals),
            conditioning: {
          ...(brief.qlooAudienceIds
            ? { audienceIds: brief.qlooAudienceIds }
            : {}),
          ...(brief.qlooAudienceWeight !== undefined
            ? { audienceWeight: brief.qlooAudienceWeight }
            : {}),
          ...(brief.qlooAgeRange ? { ageRange: brief.qlooAgeRange } : {}),
          ...(brief.qlooGender ? { gender: brief.qlooGender } : {}),
            },
            creatorIds: enrichmentIds,
            maxCreators: enrichmentIds.length,
          }
        )
      ).output
      const targetedById = new Map(
        targetedCreators.map((creator) => [creator.providerCreatorId, creator])
      )
      enrichedBaselineCreators = enrichedBaselineCreators.map(
        (creator) => targetedById.get(creator.providerCreatorId) ?? creator
      )
      enrichedCultureCreators = enrichedCultureCreators.map(
        (creator) => targetedById.get(creator.providerCreatorId) ?? creator
      )
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
    }
    const measuredTargetedBudget = reserveAutonomyBudget(
      targetedEnrichmentBudget,
      { providerRequests: targetedUsage.snapshot().qlooRequests }
    )
    await updateCultureProfileSummary(client, userId, run.id, {
      ...refinementSummary,
      autonomyBudget: autonomyBudgetToJson(measuredTargetedBudget),
      creatorSearchAgentState: {
        ...(refinementSummary.creatorSearchAgentState as JsonObject),
        pendingProviderOperation: null,
      },
      targetedEnrichmentCount: 1,
      creatorSearchTrace: appendCreatorSearchTrace(
        culture.providerSummary,
        searchDecision,
        enrichmentCandidates.length,
        baseCulturePlan,
        approvalKey,
        "qloo_creator_enrichment"
      ),
    })
    return run
  }

  if (canRefine && refinedPlan) {
      const refinementIdempotencyKey = `${run.idempotency_key}:culture:refinement:${searchState.refinementCount + 1}`
      const refinementBudget = reserveAutonomyBudget(criticBudget, {
        actions: 1,
        providerCalls: 1,
      })
      const refinementSummary: JsonObject = {
        ...budgetedSummary,
        autonomyBudget: autonomyBudgetToJson(refinementBudget),
      }
      const nextState = creatorSearchStateToJson(
        brief,
        assessment,
        searchDecision,
        searchState.refinementCount + 1,
        refinedPlan,
        approvalSatisfied,
        approvalKey
      )
      await updateCultureProfileSummary(client, userId, run.id, {
        ...refinementSummary,
        creatorSearchAgentState: {
          ...nextState,
          pendingProviderOperation: {
            toolName: "apify_creator_search",
            action: searchDecision.action,
            idempotencyKey: refinementIdempotencyKey,
            inputHash: approvalKey,
          },
        },
        evidenceCritic,
        creatorSearchTrace: appendCreatorSearchTrace(
          culture.providerSummary,
          searchDecision,
          enrichedCultureCreators.length,
          refinedPlan,
          approvalKey
        ),
      })
      const refinementUsage = createProviderRequestMeter()
      const refinedAttemptResult = await executeAgentTool(
        createCreatorSearchTool(
          createApifyClient({
            onRequest: () => refinementUsage.record("apify"),
          })
        ),
        {
          plan: actorPlanForTool(refinedPlan),
          idempotencyKey: refinementIdempotencyKey,
        }
      )
      const refinedAttempt = refinedAttemptResult.output
      const measuredRefinementBudget = reserveAutonomyBudget(
        refinementBudget,
        { providerRequests: refinementUsage.snapshot().apifyRequests }
      )
      await updateCultureProfileSummary(client, userId, run.id, {
        ...refinementSummary,
        autonomyBudget: autonomyBudgetToJson(measuredRefinementBudget),
        creatorSearchAgentState: {
          ...nextState,
          pendingProviderOperation: null,
        },
        evidenceCritic,
        creatorSearchTrace: appendCreatorSearchTrace(
          culture.providerSummary,
          searchDecision,
          enrichedCultureCreators.length,
          refinedPlan,
          approvalKey
        ),
      })
      run = await updateRunProviderIdForRefinement(
        client,
        run,
        run.provider_run_id as string,
        refinedAttempt.runId,
        refinedAttempt.datasetId
      )
      return run
  }

  await updateCultureProfileSummary(client, userId, run.id, {
    ...budgetedSummary,
    creatorSearchAgentState: creatorSearchStateToJson(
      brief,
      assessment,
      searchDecision,
      searchState.refinementCount,
      baseCulturePlan,
      approvalSatisfied,
      approvalKey
    ),
    evidenceCritic,
    creatorSearchTrace: appendCreatorSearchTrace(
      culture.providerSummary,
      searchDecision,
      enrichedCultureCreators.length,
      baseCulturePlan
    ),
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

async function refineCultureProfile(
  client: Parameters<typeof getCultureProfile>[0],
  campaign: CampaignRow,
  run: AnalysisRunRow,
  userId: string,
  brief: CampaignBrief,
  culture: { signals: CultureSignal[]; providerSummary: JsonObject },
  currentBudget: ReturnType<typeof readAutonomyBudget>
): Promise<void> {
  const refinementBudget = reserveAutonomyBudget(currentBudget, {
    actions: 1,
    providerCalls: 1,
  })
  await updateCultureProfileSummary(client, userId, run.id, {
    ...culture.providerSummary,
    autonomyBudget: autonomyBudgetToJson(refinementBudget),
  })
  const research = await withProviderRetry(
    "qloo",
    () => runCulturalResearchAgent(brief, createQlooClient()),
    undefined,
    undefined
  )
  const refinementCount = readQlooRefinementCount(culture.providerSummary) + 1
  const providerSummary: JsonObject = {
    ...culture.providerSummary,
    ...research.providerSummary,
    autonomyBudget: autonomyBudgetToJson(refinementBudget),
    qlooRefinementCount: refinementCount,
    agent: {
      name: "Cultural research agent",
      version: "v2",
      refinementCount: research.refinementCount,
      maxRefinements: 2,
      decisionPolicy: "validated model action with deterministic evidence critic",
    },
    agentState: research.agentState,
    agentTrace: researchTraceToJson(research.trace),
  }
  await saveCultureProfile(client, {
    campaignId: campaign.id,
    analysisRunId: run.id,
    userId,
    marketCountry: campaign.market_country,
    signals: research.signals,
    providerSummary,
    ...(research.rawPayload ? { rawPayload: research.rawPayload } : {}),
    observedAt: new Date().toISOString(),
  })
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
  const cultureDiscoveryScores = scoreCreators(
    brief,
    signals,
    cultureRows.map(normalizeStoredCreator),
    undefined,
    { includeQlooResonance: false }
  )
  const cultureAblationScores = scoreCreators(
    brief,
    signals,
    cultureRows.map(normalizeStoredCreator),
    undefined,
    { includeQlooResonance: false, normalization: "fixed" }
  )
  const cultureFixedScores = scoreCreators(
    brief,
    signals,
    cultureRows.map(normalizeStoredCreator),
    undefined,
    { normalization: "fixed" }
  )
  const qlooMetrics = summarizeQlooCreatorSignals(
    cultureRows.map(normalizeStoredCreator)
  )
  const creatorSearchState = readCreatorSearchState(culture.providerSummary)
  const comparison: BaselineComparison = {
    ...compareRuns(
    rankedCreators(baselineScores),
    rankedCreators(cultureDiscoveryScores)
    ),
    cultureDiscoveryRan: run.provider_run_id !== run.baseline_provider_run_id,
    refinementRan: creatorSearchState.refinementCount > 0,
    qlooAblation: compareQlooAblation(
      cultureFixedScores,
      cultureAblationScores,
      qlooMetrics
    ),
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
  if (process.env.OPENROUTER_API_KEY?.trim() && process.env.OPENROUTER_MODEL?.trim()) {
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

function campaignToBrief(campaign: CampaignRow): CampaignBrief {
  return {
    brandName: campaign.brand_name,
    productCategory: campaign.product_category,
    productDescription: campaign.product_description,
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
    ...(campaign.min_budget !== null ? { minBudget: campaign.min_budget } : {}),
    ...(campaign.max_budget !== null ? { maxBudget: campaign.max_budget } : {}),
    ...(campaign.currency ? { currency: campaign.currency } : {}),
    ...(campaign.qloo_audience_ids.length > 0
      ? { qlooAudienceIds: campaign.qloo_audience_ids }
      : {}),
    ...(campaign.qloo_audience_weight !== null
      ? { qlooAudienceWeight: campaign.qloo_audience_weight }
      : {}),
    ...(campaign.qloo_age_range
      ? { qlooAgeRange: campaign.qloo_age_range }
      : {}),
    ...(campaign.qloo_gender ? { qlooGender: campaign.qloo_gender } : {}),
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
  withoutQloo: ReturnType<typeof scoreCreators>,
  metrics: ReturnType<typeof summarizeQlooCreatorSignals>
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
      if (withResult.rank === withoutResult.rank) return []
      return [{
        providerCreatorId,
        withQlooRank: withResult.rank,
        withoutQlooRank: withoutResult.rank,
        ...(scoreDelta !== undefined ? { scoreDelta } : {}),
      }]
    })
  return {
    scoredCreatorCount: withMap.size,
    averageScoreDelta: deltas.length > 0 ? round(deltas.reduce((sum, value) => sum + value, 0) / deltas.length) : 0,
    materiallyChanged: rankChanges.length > 0,
    ...metrics,
    rankChanges,
  }
}

function summarizeQlooCreatorSignals(
  creators: ReturnType<typeof normalizeStoredCreator>[]
) {
  const creatorSignalCount = creators.reduce(
    (sum, creator) => sum + creator.contentSignals.length,
    0
  )
  const resolvedCreatorSignalCount = creators.reduce(
    (sum, creator) =>
      sum +
      (creator.qlooSignals?.filter(
        (signal) =>
          signal.affinity !== undefined &&
          (signal.campaignSignalIds?.length ?? 0) > 0
      )
        .length ?? 0),
    0
  )
  return {
    creatorSignalCount,
    resolvedCreatorSignalCount,
    unresolvedCreatorSignalCount: Math.max(
      0,
      creatorSignalCount - resolvedCreatorSignalCount
    ),
    creatorEvidenceCoverage:
      creatorSignalCount > 0
        ? round(Math.min(1, resolvedCreatorSignalCount / creatorSignalCount))
        : 0,
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function readCreatorSearchState(summary: JsonObject): {
  refinementCount: number
  approvedAction?: CreatorSearchAction["action"]
  approvedApprovalKey?: string
  approvedPlan?: SearchPlan
  approvedSignalIds?: string[]
} {
  const state = summary.creatorSearchAgentState
  if (!isJsonObject(state)) return { refinementCount: 0 }
  const approvedPlan = readSearchPlan(state.approvedPlan)
  return {
    refinementCount:
      typeof state.refinementCount === "number" && state.refinementCount >= 0
        ? Math.floor(state.refinementCount)
        : 0,
    ...(typeof state.approvedAction === "string" &&
    isCreatorSearchAction(state.approvedAction)
      ? { approvedAction: state.approvedAction }
      : {}),
    ...(typeof state.approvedApprovalKey === "string"
      ? { approvedApprovalKey: state.approvedApprovalKey }
      : {}),
    ...(approvedPlan ? { approvedPlan } : {}),
    ...(Array.isArray(state.approvedSignalIds) &&
    state.approvedSignalIds.every((value): value is string => typeof value === "string")
      ? { approvedSignalIds: state.approvedSignalIds }
      : {}),
  }
}

function readSearchPlan(value: JsonValue | undefined): SearchPlan | undefined {
  if (!isJsonObject(value)) return undefined
  const actorPlan = { ...value }
  const variant = actorPlan.variant
  delete actorPlan.variant
  const parsed = searchPlanSchema.safeParse(actorPlan)
  return parsed.success && (variant === "baseline" || variant === "culture_informed")
    ? { ...parsed.data, variant }
    : undefined
}

function isCreatorSearchAction(value: string): value is CreatorSearchAction["action"] {
  return [
    "broaden_query",
    "add_cultural_signals",
    "adjust_market_terms",
    "request_enrichment",
    "stop_search",
  ].includes(value)
}

function readQlooRefinementCount(summary: JsonObject): number {
  return isJsonObject(summary) &&
    typeof summary.qlooRefinementCount === "number" &&
    summary.qlooRefinementCount >= 0
    ? Math.floor(summary.qlooRefinementCount)
    : 0
}

function readTargetedEnrichmentCount(summary: JsonObject): number {
  return typeof summary.targetedEnrichmentCount === "number" &&
    summary.targetedEnrichmentCount >= 0
    ? Math.floor(summary.targetedEnrichmentCount)
    : 0
}

function readStoredCultureSearchPlan(
  summary: JsonObject
): SearchPlan | undefined {
  const searchPlans = summary.searchPlans
  if (!isJsonObject(searchPlans)) return undefined
  const stored = searchPlans.cultureInformed
  if (!isJsonObject(stored)) return undefined
  const actorPlan = { ...stored }
  delete actorPlan.variant
  const parsed = searchPlanSchema.safeParse(actorPlan)
  return parsed.success
    ? { ...parsed.data, variant: "culture_informed" }
    : undefined
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return "unknown tool error"
}

function appendCreatorSearchTrace(
  summary: JsonObject,
  decision: Awaited<ReturnType<typeof decideCreatorSearch>>,
  resultCount: number,
  plan: SearchPlan,
  inputHash?: string,
  toolName = "apify_creator_search"
): JsonObject[] {
  const existing = Array.isArray(summary.creatorSearchTrace)
    ? summary.creatorSearchTrace.filter(isJsonObject)
    : []
  const trace = validateAgentActionTrace({
      toolName,
      action: decision.action,
      decision: decision.decision,
      decisionMode: decision.decisionMode,
      ...(decision.fallbackReason
        ? { fallbackReason: decision.fallbackReason }
        : {}),
      ...(inputHash ? { inputHash } : {}),
      inputSummary: {
        query: plan.query,
        maxResults: plan.maxResults,
        minFollowers: plan.minFollowers ?? null,
        maxFollowers: plan.maxFollowers ?? null,
      },
      resultCount,
      evidenceCount: decision.signalIds.length,
      nextAction:
        decision.decision === "refine_creator_search"
          ? "run_refinement_search"
          : "stop_search",
      rejectedActions: decision.rejectedActions,
      rationale: decision.summary,
    })
  return [...existing, trace].slice(-4)
}

function hasPendingApproval(summary: JsonObject): boolean {
  const state = summary.creatorSearchAgentState
  return isJsonObject(state) && isJsonObject(state.pendingApproval)
}

function readPopulatedLayerCount(summary: JsonObject): number {
  const fingerprint = summary.fingerprint
  if (!isJsonObject(fingerprint) || !Array.isArray(fingerprint.layers)) return 0
  return fingerprint.layers.filter((layer) => {
    return isJsonObject(layer) && Array.isArray(layer.signals) && layer.signals.length > 0
  }).length
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
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
