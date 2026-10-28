import { ApplicationError, isUniqueViolation } from "@/lib/errors"
import type { AnalysisRunInsert, AnalysisRunRow } from "@/lib/db/database.types"
import { requireAuthenticatedUser } from "@/lib/db/auth"
import { getOwnedCampaign } from "@/lib/db/campaigns"
import {
  campaignStatusForRunState,
  failWorkflow,
  transitionWorkflow,
} from "@/lib/workflow/state-machine"
import type { WorkflowStage } from "@/lib/domain/types"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/db/database.types"
import { logWorkflowEvent } from "@/lib/workflow/telemetry"
import { SCORE_ALGORITHM_VERSION } from "@/lib/matching/score-creators"

export interface WorkflowContext {
  client: SupabaseClient<Database>
  userId: string
  campaign: Awaited<ReturnType<typeof getOwnedCampaign>>["campaign"]
  run: AnalysisRunRow
}

export async function getLatestRunForCampaign(
  campaignId: string
): Promise<{ run: AnalysisRunRow; campaignId: string }> {
  const { client, userId } = await getOwnedCampaign(campaignId)
  const result = await client
    .from("analysis_runs")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("user_id", userId)
    .order("attempt", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (result.error || !result.data) {
    throw new ApplicationError(
      "ANALYSIS_RUN_NOT_FOUND",
      404,
      "Analysis run was not found"
    )
  }

  return { run: result.data, campaignId }
}

export async function getRunById(runId: string): Promise<AnalysisRunRow> {
  const { client, user } = await requireAuthenticatedUser()
  const result = await client
    .from("analysis_runs")
    .select("*")
    .eq("id", runId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (result.error || !result.data) {
    throw new ApplicationError(
      "ANALYSIS_RUN_NOT_FOUND",
      404,
      "Analysis run was not found"
    )
  }

  return result.data
}

export async function getWorkflowContext(
  campaignId: string
): Promise<WorkflowContext> {
  const { client, userId, campaign } = await getOwnedCampaign(campaignId)
  const result = await client
    .from("analysis_runs")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("user_id", userId)
    .order("attempt", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (result.error || !result.data) {
    throw new ApplicationError(
      "ANALYSIS_RUN_NOT_FOUND",
      404,
      "Analysis run was not found"
    )
  }
  return { client, userId, campaign, run: result.data }
}

export async function getWorkflowContextByProviderRunId(
  client: SupabaseClient<Database>,
  providerRunId: string
): Promise<WorkflowContext | undefined> {
  const runResult = await client
    .from("analysis_runs")
    .select("*")
    .or(
      `provider_run_id.eq.${providerRunId},baseline_provider_run_id.eq.${providerRunId}`
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (runResult.error) {
    throw new ApplicationError(
      "DATABASE_ERROR",
      500,
      "Unable to load the provider workflow"
    )
  }
  if (!runResult.data) return undefined

  const campaignResult = await client
    .from("campaigns")
    .select("*")
    .eq("id", runResult.data.campaign_id)
    .eq("user_id", runResult.data.user_id)
    .maybeSingle()
  if (campaignResult.error || !campaignResult.data) {
    throw new ApplicationError(
      "DATABASE_ERROR",
      500,
      "Unable to load the provider workflow campaign"
    )
  }

  return {
    client,
    userId: runResult.data.user_id,
    campaign: campaignResult.data,
    run: runResult.data,
  }
}

export async function transitionRunById(
  client: SupabaseClient<Database>,
  run: AnalysisRunRow,
  nextStage: WorkflowStage
): Promise<AnalysisRunRow> {
  const next = transitionWorkflow(
    { status: run.status, stage: run.stage },
    nextStage
  )
  const result = await client
    .from("analysis_runs")
    .update({
      status: next.status,
      stage: next.stage,
      started_at: run.started_at ?? new Date().toISOString(),
    })
    .eq("id", run.id)
    .eq("user_id", run.user_id)
    .eq("status", run.status)
    .eq("stage", run.stage)
    .select("*")
    .maybeSingle()
  if (result.error || !result.data) {
    throw new ApplicationError(
      "WORKFLOW_CONFLICT",
      409,
      "The analysis run changed before it could advance"
    )
  }
  const campaignStatus = campaignStatusForRunState(next)
  await client
    .from("campaigns")
    .update({ status: campaignStatus })
    .eq("id", run.campaign_id)
    .eq("user_id", run.user_id)
  logWorkflowEvent({
    campaignId: run.campaign_id,
    analysisRunId: run.id,
    stage: next.stage,
    status: next.status,
    previousStage: run.stage,
    startedAt: result.data.started_at,
  })
  return result.data
}

export async function updateRunProviderIds(
  client: SupabaseClient<Database>,
  run: AnalysisRunRow,
  providerRunId: string,
  providerDatasetId: string | undefined,
  claimToken: string
): Promise<AnalysisRunRow> {
  const result = await client
    .from("analysis_runs")
    .update({
      provider_run_id: providerRunId,
      ...(providerDatasetId ? { provider_dataset_id: providerDatasetId } : {}),
      provider_start_claim_token: null,
      provider_start_claimed_until: null,
    })
    .eq("id", run.id)
    .eq("user_id", run.user_id)
    .eq("provider_start_claim_token", claimToken)
    .is("provider_run_id", null)
    .select("*")
    .maybeSingle()
  if (result.error || !result.data) {
    const existing = await client
      .from("analysis_runs")
      .select("*")
      .eq("id", run.id)
      .eq("user_id", run.user_id)
      .maybeSingle()
    if (!existing.data || !existing.data.provider_run_id)
      throw new ApplicationError(
        "WORKFLOW_CONFLICT",
        409,
        "The provider run could not be persisted safely"
      )
    return existing.data
  }
  return result.data
}

export async function updateRunProviderIdForRefinement(
  client: SupabaseClient<Database>,
  run: AnalysisRunRow,
  currentProviderRunId: string,
  providerRunId: string,
  providerDatasetId: string | undefined
): Promise<AnalysisRunRow> {
  const result = await client
    .from("analysis_runs")
    .update({
      provider_run_id: providerRunId,
      ...(providerDatasetId ? { provider_dataset_id: providerDatasetId } : {}),
    })
    .eq("id", run.id)
    .eq("user_id", run.user_id)
    .eq("provider_run_id", currentProviderRunId)
    .select("*")
    .maybeSingle()
  if (result.error || !result.data)
    throw new ApplicationError(
      "WORKFLOW_CONFLICT",
      409,
      "The refinement provider run could not be persisted safely"
    )
  return result.data
}

export async function updateRunBaselineProviderIds(
  client: SupabaseClient<Database>,
  run: AnalysisRunRow,
  providerRunId: string,
  providerDatasetId: string | undefined,
  claimToken: string
): Promise<AnalysisRunRow> {
  const result = await client
    .from("analysis_runs")
    .update({
      baseline_provider_run_id: providerRunId,
      ...(providerDatasetId
        ? { baseline_provider_dataset_id: providerDatasetId }
        : {}),
    })
    .eq("id", run.id)
    .eq("user_id", run.user_id)
    .eq("provider_start_claim_token", claimToken)
    .is("baseline_provider_run_id", null)
    .select("*")
    .maybeSingle()
  if (result.error) {
    console.error(
      "workflow_database_error",
      JSON.stringify({
        operation: "persist_baseline_provider_run",
        code: result.error.code,
        message: result.error.message,
      })
    )
    throw new ApplicationError(
      result.error.code === "42703" || result.error.code === "PGRST204"
        ? "PHASE3_MIGRATION_REQUIRED"
        : "DATABASE_ERROR",
      500,
      result.error.code === "42703" || result.error.code === "PGRST204"
        ? "The Phase 3 database migration has not been applied"
        : "Unable to persist the baseline provider run"
    )
  }
  if (!result.data)
    throw new ApplicationError(
      "WORKFLOW_CONFLICT",
      409,
      "The baseline provider run could not be persisted safely"
    )
  return result.data
}

export async function claimProviderStart(
  client: SupabaseClient<Database>,
  run: AnalysisRunRow
): Promise<{ run: AnalysisRunRow; claimToken: string } | undefined> {
  const claimToken = crypto.randomUUID()
  const now = new Date().toISOString()
  const claimedUntil = new Date(
    Date.now() + readProviderStartLeaseMs()
  ).toISOString()
  const result = await client
    .from("analysis_runs")
    .update({
      provider_start_claim_token: claimToken,
      provider_start_claimed_until: claimedUntil,
    })
    .eq("id", run.id)
    .eq("user_id", run.user_id)
    .is("provider_run_id", null)
    .or(
      `provider_start_claimed_until.is.null,provider_start_claimed_until.lt.${now}`
    )
    .select("*")
    .maybeSingle()

  if (result.error)
    throw new ApplicationError(
      "DATABASE_ERROR",
      500,
      "Unable to claim the provider start"
    )
  if (!result.data) return undefined
  return { run: result.data, claimToken }
}

export async function updateRunDatasetId(
  client: SupabaseClient<Database>,
  run: AnalysisRunRow,
  providerDatasetId: string
): Promise<AnalysisRunRow> {
  const result = await client
    .from("analysis_runs")
    .update({ provider_dataset_id: providerDatasetId })
    .eq("id", run.id)
    .eq("user_id", run.user_id)
    .select("*")
    .single()
  if (result.error || !result.data)
    throw new ApplicationError(
      "DATABASE_ERROR",
      500,
      "Unable to persist the provider dataset"
    )
  return result.data
}

export async function updateRunBaselineDatasetId(
  client: SupabaseClient<Database>,
  run: AnalysisRunRow,
  providerDatasetId: string
): Promise<AnalysisRunRow> {
  const result = await client
    .from("analysis_runs")
    .update({ baseline_provider_dataset_id: providerDatasetId })
    .eq("id", run.id)
    .eq("user_id", run.user_id)
    .select("*")
    .single()
  if (result.error || !result.data)
    throw new ApplicationError(
      "DATABASE_ERROR",
      500,
      "Unable to persist the baseline provider dataset"
    )
  return result.data
}

export async function completeAnalysisRunById(
  client: SupabaseClient<Database>,
  run: AnalysisRunRow
): Promise<AnalysisRunRow> {
  const next = {
    status: "completed" as const,
    stage: run.stage,
  }
  if (run.stage !== "generating_report")
    throw new ApplicationError(
      "WORKFLOW_CONFLICT",
      409,
      "The analysis run is not ready to complete"
    )
  const result = await client
    .from("analysis_runs")
    .update({
      status: next.status,
      completed_at: new Date().toISOString(),
      provider_start_claim_token: null,
      provider_start_claimed_until: null,
    })
    .eq("id", run.id)
    .eq("user_id", run.user_id)
    .eq("status", "running")
    .eq("stage", "generating_report")
    .select("*")
    .maybeSingle()
  if (result.error || !result.data)
    throw new ApplicationError(
      "WORKFLOW_CONFLICT",
      409,
      "The analysis run changed before it could complete"
    )
  await client
    .from("campaigns")
    .update({ status: "completed" })
    .eq("id", run.campaign_id)
    .eq("user_id", run.user_id)
  logWorkflowEvent({
    campaignId: run.campaign_id,
    analysisRunId: run.id,
    stage: run.stage,
    status: next.status,
    startedAt: result.data.started_at,
  })
  return result.data
}

export async function failAnalysisRunById(
  client: SupabaseClient<Database>,
  run: AnalysisRunRow,
  errorCode: string,
  errorMessage: string
): Promise<AnalysisRunRow> {
  const next = failWorkflow({ status: run.status, stage: run.stage })
  const result = await client
    .from("analysis_runs")
    .update({
      status: next.status,
      error_code: errorCode.replace(/[^A-Z0-9_]/g, "_").slice(0, 80),
      error_message: errorMessage.replace(/\s+/g, " ").trim().slice(0, 500),
      completed_at: new Date().toISOString(),
      provider_start_claim_token: null,
      provider_start_claimed_until: null,
    })
    .eq("id", run.id)
    .eq("user_id", run.user_id)
    .in("status", ["queued", "running"])
    .select("*")
    .maybeSingle()
  if (result.error || !result.data) {
    throw new ApplicationError(
      "WORKFLOW_CONFLICT",
      409,
      "The analysis run changed before it could fail"
    )
  }
  await client
    .from("campaigns")
    .update({ status: campaignStatusForRunState(next) })
    .eq("id", run.campaign_id)
    .eq("user_id", run.user_id)
  logWorkflowEvent({
    campaignId: run.campaign_id,
    analysisRunId: run.id,
    stage: next.stage,
    status: next.status,
    startedAt: run.started_at,
    errorCode,
  })
  return result.data
}

function readProviderStartLeaseMs(): number {
  const value = Number(process.env.APIFY_START_LEASE_MS)
  return Number.isInteger(value) && value >= 30_000 ? value : 120_000
}

export async function advanceAnalysisRun(
  campaignId: string,
  nextStage: WorkflowStage
): Promise<AnalysisRunRow> {
  const { client, userId } = await getOwnedCampaign(campaignId)
  const latest = await client
    .from("analysis_runs")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("user_id", userId)
    .order("attempt", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latest.error || !latest.data) {
    throw new ApplicationError(
      "ANALYSIS_RUN_NOT_FOUND",
      404,
      "Analysis run was not found"
    )
  }

  const current = latest.data
  const next = transitionWorkflow(
    { status: current.status, stage: current.stage },
    nextStage
  )
  const now = new Date().toISOString()
  const result = await client
    .from("analysis_runs")
    .update({
      status: next.status,
      stage: next.stage,
      started_at: current.started_at ?? now,
    })
    .eq("id", current.id)
    .eq("user_id", userId)
    .eq("status", current.status)
    .eq("stage", current.stage)
    .select("*")
    .maybeSingle()

  if (result.error || !result.data) {
    throw new ApplicationError(
      "WORKFLOW_CONFLICT",
      409,
      "The analysis run changed before it could advance"
    )
  }

  await client
    .from("campaigns")
    .update({ status: campaignStatusForRunState(next) })
    .eq("id", campaignId)
    .eq("user_id", userId)

  return result.data
}

export async function createRetryRun(
  campaignId: string
): Promise<AnalysisRunRow> {
  const { client, userId } = await getOwnedCampaign(campaignId)
  const latest = await client
    .from("analysis_runs")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("user_id", userId)
    .order("attempt", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latest.error || !latest.data) {
    throw new ApplicationError(
      "ANALYSIS_RUN_NOT_FOUND",
      404,
      "Analysis run was not found"
    )
  }

  if (latest.data.status !== "failed") {
    throw new ApplicationError(
      "RETRY_NOT_ALLOWED",
      409,
      "Only failed analysis runs can be retried"
    )
  }

  const maxAttempts = Number(process.env.MAX_ANALYSIS_ATTEMPTS)
  const attemptLimit =
    Number.isInteger(maxAttempts) && maxAttempts > 0 ? maxAttempts : 3
  if (latest.data.attempt >= attemptLimit) {
    throw new ApplicationError(
      "RETRY_LIMIT_REACHED",
      409,
      "The analysis retry limit has been reached"
    )
  }

  const attempt = latest.data.attempt + 1
  const insert: AnalysisRunInsert = {
    campaign_id: campaignId,
    user_id: userId,
    attempt,
    idempotency_key: `${latest.data.id}:retry:${attempt}`,
    status: "queued",
    stage: "queued",
    score_algorithm_version: SCORE_ALGORITHM_VERSION,
  }
  const result = await client
    .from("analysis_runs")
    .insert(insert)
    .select("*")
    .single()

  if (result.error || !result.data) {
    if (isUniqueViolation(result.error)) {
      const existing = await client
        .from("analysis_runs")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("attempt", attempt)
        .single()
      if (!existing.error && existing.data) return existing.data
    }
    throw new ApplicationError(
      "DATABASE_ERROR",
      500,
      "Unable to create retry run"
    )
  }

  await client
    .from("campaigns")
    .update({ status: "queued" })
    .eq("id", campaignId)
    .eq("user_id", userId)

  return result.data
}

export async function failAnalysisRun(
  campaignId: string,
  errorCode: string,
  errorMessage: string
): Promise<AnalysisRunRow> {
  const { client, userId } = await getOwnedCampaign(campaignId)
  const latest = await client
    .from("analysis_runs")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("user_id", userId)
    .order("attempt", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latest.error || !latest.data) {
    throw new ApplicationError(
      "ANALYSIS_RUN_NOT_FOUND",
      404,
      "Analysis run was not found"
    )
  }

  const current = latest.data
  const next = failWorkflow({ status: current.status, stage: current.stage })
  const result = await client
    .from("analysis_runs")
    .update({
      status: next.status,
      error_code: errorCode.replace(/[^A-Z0-9_]/g, "_").slice(0, 80),
      error_message: errorMessage.replace(/\s+/g, " ").trim().slice(0, 500),
      completed_at: new Date().toISOString(),
      provider_start_claim_token: null,
      provider_start_claimed_until: null,
    })
    .eq("id", current.id)
    .eq("user_id", userId)
    .eq("status", current.status)
    .select("*")
    .maybeSingle()

  if (result.error || !result.data) {
    throw new ApplicationError(
      "WORKFLOW_CONFLICT",
      409,
      "The analysis run changed before it could fail"
    )
  }

  await client
    .from("campaigns")
    .update({ status: campaignStatusForRunState(next) })
    .eq("id", campaignId)
    .eq("user_id", userId)

  return result.data
}
