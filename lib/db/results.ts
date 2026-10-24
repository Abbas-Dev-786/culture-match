import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, CreatorCandidateRow, Json } from "@/lib/db/database.types"
import { getCreatorMatches } from "@/lib/db/matches"
import { getCultureProfile } from "@/lib/db/provider-results"
import type {
  BaselineComparison,
  CultureSignal,
  EvidenceRef,
  SafeCultureProfile,
  SafeCultureReference,
  ScoreComponent,
} from "@/lib/domain/types"
import { ApplicationError } from "@/lib/errors"

export interface SafeCreatorResult {
  id: string
  variant: "baseline" | "culture_informed"
  name: string
  platform: string
  username?: string
  profileUrl?: string
  bio?: string
  followers?: number
  engagementRate?: number
  isVerified?: boolean
  locationUnverified: boolean
  rank: number
  campaignFitScore: number | null
  scoreAlgorithmVersion: string
  evidenceCompleteness: number
  scoreComponents: ScoreComponent[]
  evidence: EvidenceRef[]
  caveats: string[]
  reportSummary?: string
  campaignConcept?: {
    title: string
    idea: string
    rationale: string
    hypothesis: true
  }
}

export interface SafeResults {
  matches: SafeCreatorResult[]
  comparison?: BaselineComparison
  cultureProfile?: SafeCultureProfile
}

export async function getSafeResults(
  client: SupabaseClient<Database>,
  userId: string,
  analysisRunId: string
): Promise<SafeResults> {
  const culture = await getCultureProfile(client, userId, analysisRunId)
  const cultureProfile = culture
    ? toSafeCultureProfile(culture.signals, culture.providerSummary)
    : undefined
  const matches = await getCreatorMatches(client, userId, analysisRunId)
  if (matches.length === 0)
    return {
      matches: [],
      ...(cultureProfile ? { cultureProfile } : {}),
    }
  const candidateIds = matches.map((match) => match.creator_candidate_id)
  const candidatesResult = await client
    .from("creator_candidates")
    .select("*")
    .in("id", candidateIds)
    .eq("user_id", userId)
  if (candidatesResult.error)
    throw new ApplicationError("DATABASE_ERROR", 500, "Unable to load result candidates")

  const candidates = new Map(
    candidatesResult.data.map((candidate) => [candidate.id, candidate])
  )
  const safeMatches = matches.flatMap((match) => {
    const candidate = candidates.get(match.creator_candidate_id)
    if (!candidate) return []
    return [toSafeResult(match, candidate)]
  })
  const comparison = readComparison(matches[0]?.comparison_metadata ?? {})
  return {
    matches: safeMatches,
    ...(comparison ? { comparison } : {}),
    ...(cultureProfile ? { cultureProfile } : {}),
  }
}

function toSafeResult(
  match: Awaited<ReturnType<typeof getCreatorMatches>>[number],
  candidate: CreatorCandidateRow
): SafeCreatorResult {
  const campaignConcept = readCampaignConcept(match.campaign_concept)
  return {
    id: candidate.id,
    variant: candidate.search_variant,
    name: candidate.name,
    platform: candidate.platform,
    ...(candidate.username ? { username: candidate.username } : {}),
    ...(candidate.profile_url ? { profileUrl: candidate.profile_url } : {}),
    ...(candidate.bio ? { bio: candidate.bio } : {}),
    ...(candidate.followers !== null ? { followers: candidate.followers } : {}),
    ...(candidate.engagement_rate !== null
      ? { engagementRate: candidate.engagement_rate }
      : {}),
    ...(candidate.is_verified !== null
      ? { isVerified: candidate.is_verified }
      : {}),
    locationUnverified: candidate.location_unverified ?? true,
    rank: match.rank,
    campaignFitScore: match.campaign_fit_score,
    scoreAlgorithmVersion: match.score_algorithm_version,
    evidenceCompleteness: match.evidence_completeness,
    scoreComponents: readScoreComponents(match.score_components),
    evidence: readEvidence(match.evidence),
    caveats: readStringArray(match.caveats),
    ...(match.report_summary ? { reportSummary: match.report_summary } : {}),
    ...(campaignConcept ? { campaignConcept } : {}),
  }
}

function toSafeCultureProfile(
  signals: CultureSignal[],
  providerSummary: Json
): SafeCultureProfile {
  const summary = isObject(providerSummary) ? providerSummary : {}
  const references = isJsonArray(summary.resolvedReferences)
    ? summary.resolvedReferences.flatMap(readCultureReference)
    : []
  const unresolvedReferences = isJsonArray(summary.unresolvedReferences)
    ? summary.unresolvedReferences.filter(isString)
    : references
        .filter((reference) => reference.status !== "resolved")
        .map((reference) => reference.reference)
  const location = isObject(summary.location)
    ? readLocation(summary.location)
    : undefined
  const searchPlanSource =
    summary.searchPlanSource === "model" || summary.searchPlanSource === "deterministic"
      ? summary.searchPlanSource
      : undefined

  return {
    signals,
    ...(typeof summary.locationQuery === "string"
      ? { locationQuery: summary.locationQuery }
      : {}),
    ...(location ? { location } : {}),
    resolvedReferences: references,
    unresolvedReferences,
    signalCount:
      typeof summary.signalCount === "number"
        ? summary.signalCount
        : signals.length,
    ...(searchPlanSource ? { searchPlanSource } : {}),
  }
}

function readCultureReference(value: Json): SafeCultureReference[] {
  if (!isObject(value) || typeof value.reference !== "string") return []
  if (
    value.status !== "resolved" &&
    value.status !== "ambiguous" &&
    value.status !== "unresolved"
  )
    return []
  return [
    {
      reference: value.reference,
      status: value.status,
      ...(typeof value.entityId === "string" ? { entityId: value.entityId } : {}),
      ...(typeof value.name === "string" ? { name: value.name } : {}),
    },
  ]
}

function readLocation(value: { [key: string]: Json }): SafeCultureProfile["location"] {
  if (typeof value.name !== "string") return undefined
  return {
    name: value.name,
    ...(typeof value.entityId === "string" ? { entityId: value.entityId } : {}),
    ...(typeof value.disambiguation === "string"
      ? { disambiguation: value.disambiguation }
      : {}),
  }
}

function readScoreComponents(value: Json): ScoreComponent[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isObject(item)) return []
    if (
      typeof item.key !== "string" ||
      typeof item.label !== "string" ||
      typeof item.weight !== "number" ||
      !isAvailability(item.availability) ||
      typeof item.rationale !== "string"
    )
      return []
    return [
      {
        key: item.key,
        label: item.label,
        ...(typeof item.score === "number" ? { score: item.score } : {}),
        weight: item.weight,
        availability: item.availability,
        rationale: item.rationale,
        evidence: readEvidence(item.evidence),
      },
    ]
  })
}

function readEvidence(value: Json): EvidenceRef[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isObject(item)) return []
    if (
      !isEvidenceSource(item.source) ||
      typeof item.fieldPath !== "string" ||
      typeof item.observedAt !== "string" ||
      !isVerificationState(item.verification)
    )
      return []
    return [
      {
        source: item.source,
        fieldPath: item.fieldPath,
        observedAt: item.observedAt,
        verification: item.verification,
        ...(typeof item.label === "string" ? { label: item.label } : {}),
        ...(typeof item.providerEntityId === "string"
          ? { providerEntityId: item.providerEntityId }
          : {}),
        ...(typeof item.excerpt === "string" ? { excerpt: item.excerpt } : {}),
      },
    ]
  })
}

function readCampaignConcept(
  value: Json
): SafeCreatorResult["campaignConcept"] | undefined {
  if (
    !isObject(value) ||
    typeof value.title !== "string" ||
    typeof value.idea !== "string" ||
    typeof value.rationale !== "string" ||
    value.hypothesis !== true
  )
    return undefined
  return {
    title: value.title,
    idea: value.idea,
    rationale: value.rationale,
    hypothesis: true,
  }
}

function readComparison(value: Json): BaselineComparison | undefined {
  if (!isObject(value)) return undefined
  if (
    typeof value.overlapCount !== "number" ||
    typeof value.baselineCount !== "number" ||
    typeof value.cultureInformedCount !== "number" ||
    typeof value.overlapRate !== "number" ||
    !Array.isArray(value.baselineOnlyIds) ||
    !Array.isArray(value.cultureInformedOnlyIds) ||
    !Array.isArray(value.rankChanges) ||
    typeof value.materiallyChanged !== "boolean"
  )
    return undefined
  return {
    overlapCount: value.overlapCount,
    baselineCount: value.baselineCount,
    cultureInformedCount: value.cultureInformedCount,
    overlapRate: value.overlapRate,
    baselineOnlyIds: value.baselineOnlyIds.filter(isString),
    cultureInformedOnlyIds: value.cultureInformedOnlyIds.filter(isString),
    rankChanges: value.rankChanges.flatMap((item) => {
      if (!isObject(item) || typeof item.providerCreatorId !== "string") return []
      return [
        {
          providerCreatorId: item.providerCreatorId,
          ...(typeof item.baselineRank === "number"
            ? { baselineRank: item.baselineRank }
            : {}),
          ...(typeof item.cultureInformedRank === "number"
            ? { cultureInformedRank: item.cultureInformedRank }
            : {}),
          ...(typeof item.scoreDelta === "number"
            ? { scoreDelta: item.scoreDelta }
            : {}),
        },
      ]
    }),
    materiallyChanged: value.materiallyChanged,
  }
}

function isObject(value: Json): value is { [key: string]: Json } {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isJsonArray(value: Json | undefined): value is Json[] {
  return Array.isArray(value)
}

function isString(value: Json): value is string {
  return typeof value === "string"
}

function readStringArray(value: Json): string[] {
  return Array.isArray(value) ? value.filter(isString) : []
}

function isEvidenceSource(
  value: Json | undefined
): value is EvidenceRef["source"] {
  return (
    value === "qloo" ||
    value === "apify" ||
    value === "user_input" ||
    value === "derived"
  )
}

function isVerificationState(
  value: Json | undefined
): value is EvidenceRef["verification"] {
  return (
    value === "verified" ||
    value === "provider_reported" ||
    value === "unverified"
  )
}

function isAvailability(
  value: Json | undefined
): value is ScoreComponent["availability"] {
  return (
    value === "supported" ||
    value === "conditional" ||
    value === "unavailable"
  )
}
