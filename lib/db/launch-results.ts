import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  Database,
  LaunchCulturalProfileInsert,
  LaunchCulturalProfileRow,
  LaunchOpportunityInsert,
  LaunchOpportunityRow,
  LaunchActivationReportInsert,
  LaunchActivationReportRow,
  Json,
} from "@/lib/db/database.types"
import type {
  JsonObject,
  QlooFingerprint,
} from "@/lib/domain/types"
import type { RankedLaunchOpportunityCandidate } from "@/lib/launch/ranking"
import { ApplicationError } from "@/lib/errors"

export async function saveLaunchCulturalProfile(
  client: SupabaseClient<Database>,
  input: {
    analysisId: string
    runId: string
    userId: string
    fingerprint: QlooFingerprint
    providerSummary: JsonObject
    rawPayload?: JsonObject
    observedAt: string
  }
): Promise<void> {
  const row: LaunchCulturalProfileInsert = {
    analysis_id: input.analysisId,
    run_id: input.runId,
    user_id: input.userId,
    fingerprint: toJson(input.fingerprint) ?? {},
    provider_summary: input.providerSummary,
    ...(input.rawPayload ? { raw_payload: input.rawPayload } : {}),
    observed_at: input.observedAt,
    ...(input.rawPayload
      ? { raw_payload_expires_at: rawExpiry() }
      : {}),
  }
  const result = await client
    .from("launch_cultural_profiles")
    .upsert(row, { onConflict: "run_id" })
  if (result.error)
    throw new ApplicationError(
      "DATABASE_ERROR",
      500,
      "Unable to persist launch cultural research"
    )
}

export async function getLaunchCulturalProfile(
  client: SupabaseClient<Database>,
  userId: string,
  runId: string
): Promise<LaunchCulturalProfileRow | undefined> {
  const result = await client
    .from("launch_cultural_profiles")
    .select("*")
    .eq("run_id", runId)
    .eq("user_id", userId)
    .maybeSingle()
  if (result.error)
    throw new ApplicationError(
      "DATABASE_ERROR",
      500,
      "Unable to load launch cultural research"
    )
  return result.data ?? undefined
}

export async function saveLaunchOpportunities(
  client: SupabaseClient<Database>,
  input: {
    analysisId: string
    runId: string
    userId: string
    opportunities: RankedLaunchOpportunityCandidate[]
  }
): Promise<void> {
  const rows: LaunchOpportunityInsert[] = input.opportunities.map((item) => ({
    analysis_id: input.analysisId,
    run_id: input.runId,
    user_id: input.userId,
    provider: "qloo",
    entity_id: item.entityId,
    name: item.name,
    types: item.types,
    provider_rank: item.providerRank ?? null,
    affinity: item.affinity ?? null,
    popularity: item.popularity ?? null,
    related_signal_ids: item.relatedSignalIds,
    opportunity_rank: item.rank,
    ranking_basis: item.rankingBasis,
    ranking_algorithm_version: item.rankingAlgorithmVersion,
    evidence_completeness: item.evidenceCompleteness,
    caveats: toJson(item.caveats) ?? [],
    evidence: toJson(item.evidence) ?? [],
    normalized_payload:
      toJson({
        provider: item.provider,
        entityId: item.entityId,
        name: item.name,
        types: item.types,
        ...(item.providerRank !== undefined
          ? { providerRank: item.providerRank }
          : {}),
        ...(item.affinity !== undefined ? { affinity: item.affinity } : {}),
        ...(item.popularity !== undefined
          ? { popularity: item.popularity }
          : {}),
        relatedSignalIds: item.relatedSignalIds,
        metadata: item.metadata,
        missingFields: item.missingFields,
        rank: item.rank,
        rankingBasis: item.rankingBasis,
        rankingAlgorithmVersion: item.rankingAlgorithmVersion,
        evidenceCompleteness: item.evidenceCompleteness,
        caveats: item.caveats,
      }) ?? {},
  }))
  if (rows.length === 0) return
  const result = await client
    .from("launch_opportunities")
    .upsert(rows, { onConflict: "run_id,provider,entity_id" })
  if (result.error)
    throw new ApplicationError(
      "DATABASE_ERROR",
      500,
      "Unable to persist launch opportunities"
    )
}

export async function getLaunchOpportunities(
  client: SupabaseClient<Database>,
  userId: string,
  runId: string
): Promise<LaunchOpportunityRow[]> {
  const result = await client
    .from("launch_opportunities")
    .select("*")
    .eq("run_id", runId)
    .eq("user_id", userId)
    .order("opportunity_rank", { ascending: true })
  if (result.error)
    throw new ApplicationError(
      "DATABASE_ERROR",
      500,
      "Unable to load launch opportunities"
    )
  return result.data
}

export async function saveLaunchActivationReport(
  client: SupabaseClient<Database>,
  input: {
    analysisId: string
    runId: string
    userId: string
    report: Json
    generationMode: "deterministic" | "openrouter"
    modelProvider?: string
    modelId?: string
    promptVersion: string
    generatedAt: string
  }
): Promise<void> {
  const row: LaunchActivationReportInsert = {
    analysis_id: input.analysisId,
    run_id: input.runId,
    user_id: input.userId,
    schema_version: "phase3-v1",
    report: input.report,
    generation_mode: input.generationMode,
    model_provider: input.modelProvider ?? null,
    model_id: input.modelId ?? null,
    prompt_version: input.promptVersion,
    generated_at: input.generatedAt,
  }
  const result = await client
    .from("launch_activation_reports")
    .upsert(row, { onConflict: "run_id" })
  if (result.error)
    throw new ApplicationError(
      "DATABASE_ERROR",
      500,
      "Unable to persist launch activation brief"
    )
}

export async function getLaunchActivationReport(
  client: SupabaseClient<Database>,
  userId: string,
  runId: string
): Promise<LaunchActivationReportRow | undefined> {
  const result = await client
    .from("launch_activation_reports")
    .select("*")
    .eq("run_id", runId)
    .eq("user_id", userId)
    .maybeSingle()
  if (result.error)
    throw new ApplicationError(
      "DATABASE_ERROR",
      500,
      "Unable to load launch activation brief"
    )
  return result.data ?? undefined
}

function rawExpiry(): string {
  const days = Number(process.env.PROVIDER_RAW_RETENTION_DAYS)
  const retentionDays = Number.isInteger(days) && days > 0 ? days : 7
  return new Date(Date.now() + retentionDays * 86_400_000).toISOString()
}

function toJson(value: unknown): Json | undefined {
  if (value === null) return null
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return value
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const normalized = toJson(item)
      return normalized === undefined ? [] : [normalized]
    })
  }
  if (typeof value === "object" && value !== null) {
    const output: { [key: string]: Json } = {}
    for (const [key, item] of Object.entries(value)) {
      const normalized = toJson(item)
      if (normalized !== undefined) output[key] = normalized
    }
    return output
  }
  return undefined
}
