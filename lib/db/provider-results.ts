import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  CultureSignal,
  EvidenceRef,
  NormalizedCreator,
  JsonObject,
} from "@/lib/domain/types"
import type {
  Database,
  CultureProfileInsert,
  CreatorCandidateInsert,
} from "@/lib/db/database.types"
import { ApplicationError } from "@/lib/errors"

export async function getCultureProfile(
  client: SupabaseClient<Database>,
  userId: string,
  analysisRunId: string
): Promise<
  { signals: CultureSignal[]; providerSummary: JsonObject } | undefined
> {
  const result = await client
    .from("culture_profiles")
    .select("signals, provider_summary")
    .eq("analysis_run_id", analysisRunId)
    .eq("user_id", userId)
    .maybeSingle()

  if (result.error)
    throw new ApplicationError(
      "DATABASE_ERROR",
      500,
      "Unable to load culture research"
    )
  if (!result.data) return undefined
  return {
    signals: readSignals(result.data.signals),
    providerSummary: isJsonObject(result.data.provider_summary)
      ? result.data.provider_summary
      : {},
  }
}

export async function saveCultureProfile(
  client: SupabaseClient<Database>,
  input: {
    campaignId: string
    analysisRunId: string
    userId: string
    marketCountry: string
    signals: CultureSignal[]
    providerSummary: JsonObject
    rawPayload?: JsonObject
    observedAt: string
  }
): Promise<void> {
  const row: CultureProfileInsert = {
    campaign_id: input.campaignId,
    analysis_run_id: input.analysisRunId,
    user_id: input.userId,
    market_country: input.marketCountry,
    signals: input.signals.map(signalToJson),
    provider_summary: input.providerSummary,
    ...(input.rawPayload ? { raw_payload: input.rawPayload } : {}),
    observed_at: input.observedAt,
    ...(input.rawPayload ? { raw_payload_expires_at: rawExpiry() } : {}),
  }
  const result = await client
    .from("culture_profiles")
    .upsert(row, { onConflict: "analysis_run_id" })
  if (result.error)
    throw new ApplicationError(
      "DATABASE_ERROR",
      500,
      "Unable to persist culture research"
    )
}

export async function saveCreatorCandidates(
  client: SupabaseClient<Database>,
  input: {
    campaignId: string
    analysisRunId: string
    userId: string
    creators: NormalizedCreator[]
  }
): Promise<void> {
  const rows: CreatorCandidateInsert[] = input.creators.map((creator) => ({
    campaign_id: input.campaignId,
    analysis_run_id: input.analysisRunId,
    user_id: input.userId,
    provider: creator.provider,
    provider_creator_id: creator.providerCreatorId,
    name: creator.name,
    platform: creator.platform,
    username: creator.username ?? null,
    profile_url: creator.profileUrl ?? null,
    bio: creator.bio ?? null,
    followers: creator.followers ?? null,
    engagement_rate: creator.engagementRate ?? null,
    is_verified: creator.isVerified ?? null,
    location_unverified: creator.locationUnverified ?? true,
    provider_match_score: creator.providerMatchScore ?? null,
    evidence: creator.evidence.map(evidenceToJson),
    normalized_payload: creatorToJson(creator),
  }))

  if (rows.length === 0) return
  const result = await client
    .from("creator_candidates")
    .upsert(rows, {
      onConflict: "analysis_run_id,provider,provider_creator_id",
    })
  if (result.error)
    throw new ApplicationError(
      "DATABASE_ERROR",
      500,
      "Unable to persist creator results"
    )
}

function signalToJson(signal: CultureSignal): JsonObject {
  return {
    provider: signal.provider,
    signalId: signal.signalId,
    name: signal.name,
    types: signal.types,
    ...(signal.affinity !== undefined ? { affinity: signal.affinity } : {}),
    evidence: evidenceToJson(signal.evidence),
  }
}

function evidenceToJson(evidence: EvidenceRef): JsonObject {
  return {
    source: evidence.source,
    fieldPath: evidence.fieldPath,
    observedAt: evidence.observedAt,
    verification: evidence.verification,
    ...(evidence.excerpt ? { excerpt: evidence.excerpt } : {}),
  }
}

function creatorToJson(creator: NormalizedCreator): JsonObject {
  return {
    provider: creator.provider,
    providerCreatorId: creator.providerCreatorId,
    name: creator.name,
    platform: creator.platform,
    ...(creator.username ? { username: creator.username } : {}),
    ...(creator.profileUrl ? { profileUrl: creator.profileUrl } : {}),
    ...(creator.bio ? { bio: creator.bio } : {}),
    ...(creator.followers !== undefined
      ? { followers: creator.followers }
      : {}),
    ...(creator.engagementRate !== undefined
      ? { engagementRate: creator.engagementRate }
      : {}),
    ...(creator.isVerified !== undefined
      ? { isVerified: creator.isVerified }
      : {}),
    locationUnverified: creator.locationUnverified ?? true,
    ...(creator.providerMatchScore !== undefined
      ? { providerMatchScore: creator.providerMatchScore }
      : {}),
  }
}

function readSignals(value: unknown): CultureSignal[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (
      !isJsonObject(item) ||
      typeof item.provider !== "string" ||
      item.provider !== "qloo" ||
      typeof item.signalId !== "string" ||
      typeof item.name !== "string" ||
      !Array.isArray(item.types) ||
      !isJsonObject(item.evidence)
    )
      return []
    const evidence = item.evidence
    if (
      typeof evidence.source !== "string" ||
      typeof evidence.fieldPath !== "string" ||
      typeof evidence.observedAt !== "string" ||
      !isVerificationState(evidence.verification)
    )
      return []
    return [
      {
        provider: "qloo" as const,
        signalId: item.signalId,
        name: item.name,
        types: item.types.filter(
          (type): type is string => typeof type === "string"
        ),
        ...(typeof item.affinity === "number"
          ? { affinity: item.affinity }
          : {}),
        evidence: {
          source: evidence.source,
          fieldPath: evidence.fieldPath,
          observedAt: evidence.observedAt,
          verification: evidence.verification,
          ...(typeof evidence.excerpt === "string"
            ? { excerpt: evidence.excerpt }
            : {}),
        },
      },
    ]
  })
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isVerificationState(
  value: unknown
): value is EvidenceRef["verification"] {
  return (
    value === "verified" ||
    value === "provider_reported" ||
    value === "unverified"
  )
}

function rawExpiry(): string {
  const days = Number(process.env.PROVIDER_RAW_RETENTION_DAYS)
  const retentionDays = Number.isInteger(days) && days > 0 ? days : 7
  return new Date(Date.now() + retentionDays * 86_400_000).toISOString()
}
