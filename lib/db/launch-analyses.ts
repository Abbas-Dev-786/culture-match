import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  Database,
  LaunchAnalysisInsert,
  LaunchAnalysisRow,
  LaunchAnalysisRunInsert,
  LaunchAnalysisRunRow,
} from "@/lib/db/database.types"
import { ApplicationError, isUniqueViolation } from "@/lib/errors"
import { requireAuthenticatedUser } from "@/lib/db/auth"
import type { CreateLaunchAnalysisRequest } from "@/lib/validation/launch-analysis"

export interface LaunchWorkflowContext {
  client: SupabaseClient<Database>
  userId: string
  analysis: LaunchAnalysisRow
  run: LaunchAnalysisRunRow
}

function toAnalysisInsert(
  brief: CreateLaunchAnalysisRequest["brief"],
  userId: string
): LaunchAnalysisInsert {
  return {
    user_id: userId,
    brand_name: brief.brandName,
    product: brief.product,
    country: brief.country,
    city: brief.city,
    opportunity_type: brief.opportunityType,
    cultural_references: brief.culturalReferences,
    launch_intent: brief.launchIntent,
    status: "queued",
  }
}

export async function createLaunchAnalysisWithRun(
  input: CreateLaunchAnalysisRequest
): Promise<{ analysis: LaunchAnalysisRow; run: LaunchAnalysisRunRow }> {
  const { client, user } = await requireAuthenticatedUser()
  const existing = await client
    .from("launch_analysis_runs")
    .select("*")
    .eq("user_id", user.id)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle()

  if (existing.error)
    throw new ApplicationError(
      "DATABASE_ERROR",
      500,
      "Unable to check launch analysis idempotency"
    )
  if (existing.data) {
    const analysis = await getLaunchAnalysisById(
      client,
      user.id,
      existing.data.analysis_id
    )
    return { analysis, run: existing.data }
  }

  const analysisResult = await client
    .from("launch_analyses")
    .insert(toAnalysisInsert(input.brief, user.id))
    .select("*")
    .single()
  if (analysisResult.error || !analysisResult.data)
    throw new ApplicationError(
      "DATABASE_ERROR",
      500,
      "Unable to create launch analysis"
    )

  const runInsert: LaunchAnalysisRunInsert = {
    analysis_id: analysisResult.data.id,
    user_id: user.id,
    attempt: 1,
    idempotency_key: input.idempotencyKey,
    status: "queued",
    stage: "queued",
  }
  const runResult = await client
    .from("launch_analysis_runs")
    .insert(runInsert)
    .select("*")
    .single()
  if (runResult.error || !runResult.data) {
    if (isUniqueViolation(runResult.error)) {
      const retryExisting = await client
        .from("launch_analysis_runs")
        .select("*")
        .eq("user_id", user.id)
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle()
      await client
        .from("launch_analyses")
        .delete()
        .eq("id", analysisResult.data.id)
        .eq("user_id", user.id)
      if (!retryExisting.error && retryExisting.data) {
        const analysis = await getLaunchAnalysisById(
          client,
          user.id,
          retryExisting.data.analysis_id
        )
        return { analysis, run: retryExisting.data }
      }
    }
    await client
      .from("launch_analyses")
      .delete()
      .eq("id", analysisResult.data.id)
      .eq("user_id", user.id)
    throw new ApplicationError(
      "DATABASE_ERROR",
      500,
      "Unable to create launch analysis run"
    )
  }
  return { analysis: analysisResult.data, run: runResult.data }
}

export async function getLaunchAnalysisById(
  client: SupabaseClient<Database>,
  userId: string,
  analysisId: string
): Promise<LaunchAnalysisRow> {
  const result = await client
    .from("launch_analyses")
    .select("*")
    .eq("id", analysisId)
    .eq("user_id", userId)
    .maybeSingle()
  if (result.error || !result.data)
    throw new ApplicationError(
      "LAUNCH_ANALYSIS_NOT_FOUND",
      404,
      "Launch analysis was not found"
    )
  return result.data
}

export async function getOwnedLaunchAnalysis(
  analysisId: string
): Promise<{
  client: SupabaseClient<Database>
  userId: string
  analysis: LaunchAnalysisRow
}> {
  const { client, user } = await requireAuthenticatedUser()
  const analysis = await getLaunchAnalysisById(client, user.id, analysisId)
  return { client, userId: user.id, analysis }
}

export async function getLatestLaunchRun(
  client: SupabaseClient<Database>,
  userId: string,
  analysisId: string
): Promise<LaunchAnalysisRunRow> {
  const result = await client
    .from("launch_analysis_runs")
    .select("*")
    .eq("analysis_id", analysisId)
    .eq("user_id", userId)
    .order("attempt", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (result.error || !result.data)
    throw new ApplicationError(
      "LAUNCH_RUN_NOT_FOUND",
      404,
      "Launch analysis run was not found"
    )
  return result.data
}

export async function getLaunchWorkflowContext(
  analysisId: string
): Promise<LaunchWorkflowContext> {
  const { client, userId, analysis } = await getOwnedLaunchAnalysis(analysisId)
  const run = await getLatestLaunchRun(client, userId, analysisId)
  return { client, userId, analysis, run }
}
