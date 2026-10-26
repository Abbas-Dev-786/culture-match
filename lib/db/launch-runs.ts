import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  Database,
  LaunchAnalysisRunInsert,
  LaunchAnalysisRunRow,
} from "@/lib/db/database.types"
import { ApplicationError, isUniqueViolation } from "@/lib/errors"
import type { LaunchWorkflowStage } from "@/lib/domain/types"
import {
  getLatestLaunchRun,
  getOwnedLaunchAnalysis,
} from "@/lib/db/launch-analyses"

const stageTransitions: Readonly<
  Record<LaunchWorkflowStage, readonly LaunchWorkflowStage[]>
> = {
  queued: ["resolving_inputs"],
  resolving_inputs: ["researching_market"],
  researching_market: ["discovering_opportunities"],
  discovering_opportunities: ["generating_brief"],
  generating_brief: [],
}

export async function transitionLaunchRun(
  client: SupabaseClient<Database>,
  run: LaunchAnalysisRunRow,
  nextStage: LaunchWorkflowStage
): Promise<LaunchAnalysisRunRow> {
  if (
    run.status !== "queued" &&
    run.status !== "running"
  ) {
    throw new ApplicationError(
      "WORKFLOW_CONFLICT",
      409,
      "The launch analysis is no longer active"
    )
  }
  if (!stageTransitions[run.stage].includes(nextStage)) {
    throw new ApplicationError(
      "INVALID_WORKFLOW_TRANSITION",
      409,
      `Cannot transition from ${run.stage} to ${nextStage}`
    )
  }
  const result = await client
    .from("launch_analysis_runs")
    .update({
      status: "running",
      stage: nextStage,
      started_at: run.started_at ?? new Date().toISOString(),
    })
    .eq("id", run.id)
    .eq("user_id", run.user_id)
    .eq("status", run.status)
    .eq("stage", run.stage)
    .select("*")
    .maybeSingle()
  if (result.error || !result.data)
    throw new ApplicationError(
      "WORKFLOW_CONFLICT",
      409,
      "The launch analysis changed before it could advance"
    )
  await client
    .from("launch_analyses")
    .update({ status: nextStage })
    .eq("id", run.analysis_id)
    .eq("user_id", run.user_id)
  return result.data
}

export async function completeLaunchRun(
  client: SupabaseClient<Database>,
  run: LaunchAnalysisRunRow
): Promise<LaunchAnalysisRunRow> {
  if (run.stage !== "generating_brief" || run.status !== "running")
    throw new ApplicationError(
      "WORKFLOW_CONFLICT",
      409,
      "The launch analysis is not ready to complete"
    )
  const result = await client
    .from("launch_analysis_runs")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", run.id)
    .eq("user_id", run.user_id)
    .eq("status", "running")
    .eq("stage", "generating_brief")
    .select("*")
    .maybeSingle()
  if (result.error || !result.data)
    throw new ApplicationError(
      "WORKFLOW_CONFLICT",
      409,
      "The launch analysis changed before it could complete"
    )
  await client
    .from("launch_analyses")
    .update({ status: "completed" })
    .eq("id", run.analysis_id)
    .eq("user_id", run.user_id)
  return result.data
}

export async function failLaunchRun(
  client: SupabaseClient<Database>,
  run: LaunchAnalysisRunRow,
  code: string,
  message: string
): Promise<LaunchAnalysisRunRow> {
  const result = await client
    .from("launch_analysis_runs")
    .update({
      status: "failed",
      error_code: code.replace(/[^A-Z0-9_]/g, "_").slice(0, 80),
      error_message: message.replace(/\s+/g, " ").trim().slice(0, 500),
      completed_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .eq("user_id", run.user_id)
    .in("status", ["queued", "running"])
    .select("*")
    .maybeSingle()
  if (result.error || !result.data)
    throw new ApplicationError(
      "WORKFLOW_CONFLICT",
      409,
      "The launch analysis changed before it could fail"
    )
  await client
    .from("launch_analyses")
    .update({ status: "failed" })
    .eq("id", run.analysis_id)
    .eq("user_id", run.user_id)
  return result.data
}

export async function createLaunchRetryRun(
  analysisId: string
): Promise<LaunchAnalysisRunRow> {
  const { client, userId } = await getOwnedLaunchAnalysis(analysisId)
  const latest = await getLatestLaunchRun(client, userId, analysisId)
  if (latest.status !== "failed")
    throw new ApplicationError(
      "RETRY_NOT_ALLOWED",
      409,
      "Only failed launch analyses can be retried"
    )
  const maxAttempts = Number(process.env.MAX_ANALYSIS_ATTEMPTS)
  const attemptLimit = Number.isInteger(maxAttempts) && maxAttempts > 0 ? maxAttempts : 3
  if (latest.attempt >= attemptLimit)
    throw new ApplicationError(
      "RETRY_LIMIT_REACHED",
      409,
      "The launch analysis retry limit has been reached"
    )

  const attempt = latest.attempt + 1
  const insert: LaunchAnalysisRunInsert = {
    analysis_id: analysisId,
    user_id: userId,
    attempt,
    idempotency_key: `${latest.id}:retry:${attempt}`,
    status: "queued",
    stage: "queued",
  }
  const result = await client
    .from("launch_analysis_runs")
    .insert(insert)
    .select("*")
    .single()
  if (result.error || !result.data) {
    if (isUniqueViolation(result.error)) {
      const existing = await client
        .from("launch_analysis_runs")
        .select("*")
        .eq("analysis_id", analysisId)
        .eq("attempt", attempt)
        .maybeSingle()
      if (!existing.error && existing.data) return existing.data
    }
    throw new ApplicationError(
      "DATABASE_ERROR",
      500,
      "Unable to create launch analysis retry"
    )
  }
  await client
    .from("launch_analyses")
    .update({ status: "queued" })
    .eq("id", analysisId)
    .eq("user_id", userId)
  return result.data
}
