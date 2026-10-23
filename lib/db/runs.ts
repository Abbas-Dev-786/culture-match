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

export async function getLatestRunForCampaign(
  campaignId: string,
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
    throw new ApplicationError("ANALYSIS_RUN_NOT_FOUND", 404, "Analysis run was not found")
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
    throw new ApplicationError("ANALYSIS_RUN_NOT_FOUND", 404, "Analysis run was not found")
  }

  return result.data
}

export async function advanceAnalysisRun(
  campaignId: string,
  nextStage: WorkflowStage,
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
    throw new ApplicationError("ANALYSIS_RUN_NOT_FOUND", 404, "Analysis run was not found")
  }

  const current = latest.data
  const next = transitionWorkflow(
    { status: current.status, stage: current.stage },
    nextStage,
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
    throw new ApplicationError("WORKFLOW_CONFLICT", 409, "The analysis run changed before it could advance")
  }

  await client
    .from("campaigns")
    .update({ status: campaignStatusForRunState(next) })
    .eq("id", campaignId)
    .eq("user_id", userId)

  return result.data
}

export async function createRetryRun(campaignId: string): Promise<AnalysisRunRow> {
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
    throw new ApplicationError("ANALYSIS_RUN_NOT_FOUND", 404, "Analysis run was not found")
  }

  if (latest.data.status !== "failed") {
    throw new ApplicationError("RETRY_NOT_ALLOWED", 409, "Only failed analysis runs can be retried")
  }

  const attempt = latest.data.attempt + 1
  const insert: AnalysisRunInsert = {
    campaign_id: campaignId,
    user_id: userId,
    attempt,
    idempotency_key: `${latest.data.id}:retry:${attempt}`,
    status: "queued",
    stage: "queued",
  }
  const result = await client.from("analysis_runs").insert(insert).select("*").single()

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
    throw new ApplicationError("DATABASE_ERROR", 500, "Unable to create retry run")
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
  errorMessage: string,
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
    throw new ApplicationError("ANALYSIS_RUN_NOT_FOUND", 404, "Analysis run was not found")
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
    })
    .eq("id", current.id)
    .eq("user_id", userId)
    .eq("status", current.status)
    .select("*")
    .maybeSingle()

  if (result.error || !result.data) {
    throw new ApplicationError("WORKFLOW_CONFLICT", 409, "The analysis run changed before it could fail")
  }

  await client
    .from("campaigns")
    .update({ status: campaignStatusForRunState(next) })
    .eq("id", campaignId)
    .eq("user_id", userId)

  return result.data
}
