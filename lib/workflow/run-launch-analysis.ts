import type {
  Json,
  LaunchAnalysisRow,
  LaunchAnalysisRunRow,
} from "@/lib/db/database.types"
import {
  getLaunchWorkflowContext,
} from "@/lib/db/launch-analyses"
import {
  completeLaunchRun,
  failLaunchRun,
  transitionLaunchRun,
} from "@/lib/db/launch-runs"
import {
  getLaunchActivationReport,
  getLaunchCulturalProfile,
  getLaunchOpportunities,
  saveLaunchCulturalProfile,
  saveLaunchActivationReport,
  saveLaunchOpportunities,
} from "@/lib/db/launch-results"
import type { LaunchAnalysisBrief, JsonObject } from "@/lib/domain/types"
import { generateLaunchActivationBrief } from "@/lib/launch/activation-brief"
import { rankLaunchOpportunities } from "@/lib/launch/ranking"
import { serializeLaunchOpportunity } from "@/lib/db/launch-serializers"
import { ProviderError } from "@/lib/tools/provider-errors"
import { analyzeLaunchCulture } from "@/lib/tools/qloo/analyze-launch"
import { createQlooClient } from "@/lib/tools/qloo/client"
import { discoverOpportunities } from "@/lib/tools/qloo/discover-opportunities"
import { readFingerprint } from "@/lib/db/results"
import { withProviderRetry } from "@/lib/workflow/retry"

const activeLaunchAnalyses = new Set<string>()

export async function runLaunchAnalysis(
  analysisId: string
): Promise<LaunchAnalysisRunRow> {
  const context = await getLaunchWorkflowContext(analysisId)
  if (context.run.status === "completed" || context.run.status === "failed") {
    return context.run
  }
  if (activeLaunchAnalyses.has(analysisId)) return context.run

  activeLaunchAnalyses.add(analysisId)
  try {
    return await advanceLaunchWorkflow(
      context.analysis,
      context.run,
      context.client,
      context.userId
    )
  } catch (error) {
    if (!(error instanceof ProviderError)) throw error
    const latest = await getLaunchWorkflowContext(analysisId)
    if (latest.run.status === "failed" || latest.run.status === "completed") {
      return latest.run
    }
    return failLaunchRun(
      latest.client,
      latest.run,
      error.code,
      error.message
    )
  } finally {
    activeLaunchAnalyses.delete(analysisId)
  }
}

async function advanceLaunchWorkflow(
  analysis: LaunchAnalysisRow,
  initialRun: LaunchAnalysisRunRow,
  client: Parameters<typeof getLaunchCulturalProfile>[0],
  userId: string
): Promise<LaunchAnalysisRunRow> {
  let run = initialRun
  const brief = analysisToBrief(analysis)

  if (run.status === "queued") {
    run = await transitionLaunchRun(client, run, "resolving_inputs")
  }
  if (run.stage === "resolving_inputs") {
    run = await transitionLaunchRun(client, run, "researching_market")
  }

  if (run.stage === "researching_market") {
    let profile = await getLaunchCulturalProfile(client, userId, run.id)
    if (!profile) {
      const retries: JsonObject[] = []
      const result = await withProviderRetry(
        "qloo",
        () => analyzeLaunchCulture(brief, createQlooClient()),
        undefined,
        undefined,
        (record) => {
          retries.push({
            provider: record.provider,
            attempt: record.attempt,
            delayClass: record.delayClass,
            errorCode: record.errorCode,
            message: record.message,
          })
        }
      )
      const providerSummary: JsonObject = {
        ...result.providerSummary,
        ...(retries.length > 0 ? { retryHistory: retries } : {}),
      }
      await saveLaunchCulturalProfile(client, {
        analysisId: analysis.id,
        runId: run.id,
        userId,
        fingerprint: result.fingerprint,
        providerSummary,
        ...(result.rawPayload ? { rawPayload: result.rawPayload } : {}),
        observedAt: new Date().toISOString(),
      })
      profile = await getLaunchCulturalProfile(client, userId, run.id)
      if (!profile) {
        throw new ProviderError({
          provider: "qloo",
          code: "UPSTREAM_FAILURE",
          message: "Saved launch cultural research could not be reloaded",
          retryable: true,
        })
      }
    }
    run = await transitionLaunchRun(client, run, "discovering_opportunities")
    const fingerprint = readFingerprint(profile.fingerprint)
    if (!fingerprint) {
      throw new ProviderError({
        provider: "qloo",
        code: "SCHEMA_MISMATCH",
        message: "Saved cultural fingerprint is not usable",
        retryable: false,
      })
    }
    await discoverAndPersist(analysis, run, client, userId, brief, fingerprint)
    run = await transitionLaunchRun(client, run, "generating_brief")
  } else if (run.stage === "discovering_opportunities") {
    const profile = await getLaunchCulturalProfile(client, userId, run.id)
    if (!profile) {
      throw new ProviderError({
        provider: "qloo",
        code: "EMPTY_RESULT",
        message: "Launch cultural research is missing",
        retryable: false,
      })
    }
    const fingerprint = readFingerprint(profile.fingerprint)
    if (!fingerprint) {
      throw new ProviderError({
        provider: "qloo",
        code: "SCHEMA_MISMATCH",
        message: "Saved cultural fingerprint is not usable",
        retryable: false,
      })
    }
    const existing = await getLaunchOpportunities(client, userId, run.id)
    if (existing.length === 0) {
      await discoverAndPersist(analysis, run, client, userId, brief, fingerprint)
    }
    run = await transitionLaunchRun(client, run, "generating_brief")
  }

  if (run.stage === "generating_brief") {
    const profile = await getLaunchCulturalProfile(client, userId, run.id)
    if (!profile) {
      throw new ProviderError({
        provider: "qloo",
        code: "EMPTY_RESULT",
        message: "Launch cultural research is missing",
        retryable: false,
      })
    }
    const fingerprint = readFingerprint(profile.fingerprint)
    if (!fingerprint) {
      throw new ProviderError({
        provider: "qloo",
        code: "SCHEMA_MISMATCH",
        message: "Saved cultural fingerprint is not usable",
        retryable: false,
      })
    }
    const report = await getLaunchActivationReport(client, userId, run.id)
    if (!report) {
      const rows = await getLaunchOpportunities(client, userId, run.id)
      const generated = await generateLaunchActivationBrief({
        brief,
        fingerprint,
        opportunities: rows.map(serializeLaunchOpportunity),
        observedAt: new Date().toISOString(),
      })
      await saveLaunchActivationReport(client, {
        analysisId: analysis.id,
        runId: run.id,
        userId,
        report: toJson(generated.brief),
        generationMode: generated.generationMode,
        ...(generated.modelProvider
          ? { modelProvider: generated.modelProvider }
          : {}),
        ...(generated.modelId ? { modelId: generated.modelId } : {}),
        promptVersion: generated.promptVersion,
        generatedAt: generated.generatedAt,
      })
    }
  }

  return completeLaunchRun(client, run)
}

async function discoverAndPersist(
  analysis: LaunchAnalysisRow,
  run: LaunchAnalysisRunRow,
  client: Parameters<typeof getLaunchCulturalProfile>[0],
  userId: string,
  brief: LaunchAnalysisBrief,
  fingerprint: NonNullable<ReturnType<typeof readFingerprint>>
): Promise<void> {
  const result = await withProviderRetry(
    "qloo",
    () => discoverOpportunities(brief, fingerprint, createQlooClient()),
  )
  await saveLaunchOpportunities(client, {
    analysisId: analysis.id,
    runId: run.id,
    userId,
    opportunities: rankLaunchOpportunities(result.opportunities),
  })
}

function analysisToBrief(analysis: LaunchAnalysisRow): LaunchAnalysisBrief {
  return {
    brandName: analysis.brand_name,
    product: analysis.product,
    country: analysis.country,
    city: analysis.city,
    opportunityType: analysis.opportunity_type,
    culturalReferences: analysis.cultural_references,
    launchIntent: analysis.launch_intent,
  }
}

function toJson(value: unknown): Json {
  if (value === null) return null
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return value
  if (Array.isArray(value)) return value.flatMap((item) => [toJson(item)])
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, toJson(nested)])
    )
  }
  return null
}
