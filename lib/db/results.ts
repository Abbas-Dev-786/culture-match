import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, CreatorCandidateRow, Json } from "@/lib/db/database.types"
import { getCreatorMatches } from "@/lib/db/matches"
import { getCultureProfile } from "@/lib/db/provider-results"
import type {
  BaselineComparison,
  CultureSignal,
  EvidenceRef,
  QlooFingerprint,
  QlooSignalRecord,
  SafeCultureProfile,
  SafeCultureReference,
  ScoreComponent,
} from "@/lib/domain/types"
import { ApplicationError } from "@/lib/errors"
import { normalizeStoredCreator } from "@/lib/matching/normalize-creator"

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
  contentSignals?: Array<{ text: string; sourceField: string }>
  qlooSignals?: Array<{ name: string; affinity?: number; sourceGroup: string }>
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
  const normalized = normalizeStoredCreator(candidate)
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
    ...(normalized.contentSignals.length > 0
      ? {
          contentSignals: normalized.contentSignals.map((signal) => ({
            text: signal.text,
            sourceField: signal.sourceField,
          })),
        }
      : {}),
    ...(normalized.qlooSignals && normalized.qlooSignals.length > 0
      ? {
          qlooSignals: normalized.qlooSignals.map((signal) => ({
            name: signal.name,
            ...(signal.affinity !== undefined
              ? { affinity: signal.affinity }
              : {}),
            sourceGroup: signal.sourceGroup,
          })),
        }
      : {}),
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
  const fingerprint = readFingerprint(summary.fingerprint)

  return {
    signals,
    ...(fingerprint ? { fingerprint } : {}),
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

function readFingerprint(value: Json | undefined): QlooFingerprint | undefined {
  if (!isObject(value) || typeof value.locationQuery !== "string") return undefined
  if (!isObject(value.location) || typeof value.location.name !== "string") return undefined
  if (!Array.isArray(value.signals)) return undefined
  const signals = value.signals.flatMap(readQlooSignal)
  if (signals.length === 0) return undefined
  const unresolvedInputs = Array.isArray(value.unresolvedInputs)
    ? value.unresolvedInputs.filter(isString)
    : []
  return {
    locationQuery: value.locationQuery,
    location: {
      name: value.location.name,
      ...(typeof value.location.entityId === "string"
        ? { entityId: value.location.entityId }
        : {}),
      ...(typeof value.location.disambiguation === "string"
        ? { disambiguation: value.location.disambiguation }
        : {}),
    },
    signals,
    unresolvedInputs,
    ...(value.tagOperator === "union" || value.tagOperator === "intersection"
      ? { tagOperator: value.tagOperator }
      : {}),
    explainabilityRequested: value.explainabilityRequested === true,
  }
}

function readQlooSignal(value: Json): QlooSignalRecord[] {
  if (
    !isObject(value) ||
    typeof value.signalId !== "string" ||
    typeof value.name !== "string" ||
    !Array.isArray(value.types) ||
    !isQlooKind(value.kind) ||
    !isQlooGroup(value.sourceGroup) ||
    !isObject(value.evidence)
  )
    return []
  if (
    !isEvidenceSource(value.evidence.source) ||
    typeof value.evidence.fieldPath !== "string" ||
    typeof value.evidence.observedAt !== "string" ||
    !isVerificationState(value.evidence.verification)
  )
    return []
  return [
    {
      signalId: value.signalId,
      kind: value.kind,
      name: value.name,
      types: value.types.filter(isString),
      ...(typeof value.affinity === "number" ? { affinity: value.affinity } : {}),
      ...(typeof value.inputWeight === "number"
        ? { inputWeight: value.inputWeight }
        : {}),
      sourceGroup: value.sourceGroup,
      evidence: {
        source: value.evidence.source,
        fieldPath: value.evidence.fieldPath,
        observedAt: value.evidence.observedAt,
        verification: value.evidence.verification,
        ...(typeof value.evidence.label === "string"
          ? { label: value.evidence.label }
          : {}),
        ...(typeof value.evidence.providerEntityId === "string"
          ? { providerEntityId: value.evidence.providerEntityId }
          : {}),
        ...(typeof value.evidence.excerpt === "string"
          ? { excerpt: value.evidence.excerpt }
          : {}),
      },
    },
  ]
}

function readCultureReference(value: Json): SafeCultureReference[] {
  if (!isObject(value) || typeof value.reference !== "string") return []
  if (
    value.status !== "resolved" &&
    value.status !== "ambiguous" &&
    value.status !== "unresolved"
  )
    return []
  const candidates = readReferenceCandidates(value.candidates)
  return [
    {
      reference: value.reference,
      status: value.status,
      ...(typeof value.entityId === "string" ? { entityId: value.entityId } : {}),
      ...(typeof value.name === "string" ? { name: value.name } : {}),
      ...(candidates.length > 0 ? { candidates } : {}),
    },
  ]
}

function readReferenceCandidates(
  value: Json | undefined
): Array<{ entityId: string; name: string; types: string[] }> {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isObject(item) || typeof item.entityId !== "string" || typeof item.name !== "string" || !Array.isArray(item.types)) return []
    const types = item.types.filter(isString)
    return types.length > 0 ? [{ entityId: item.entityId, name: item.name, types }] : []
  })
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
    ...(readQlooAblation(value.qlooAblation)
      ? { qlooAblation: readQlooAblation(value.qlooAblation) }
      : {}),
  }
}

function readQlooAblation(
  value: Json | undefined
): BaselineComparison["qlooAblation"] | undefined {
  if (!isObject(value)) return undefined
  if (
    typeof value.scoredCreatorCount !== "number" ||
    typeof value.averageScoreDelta !== "number" ||
    typeof value.materiallyChanged !== "boolean" ||
    !Array.isArray(value.rankChanges)
  )
    return undefined
  return {
    scoredCreatorCount: value.scoredCreatorCount,
    averageScoreDelta: value.averageScoreDelta,
    materiallyChanged: value.materiallyChanged,
    rankChanges: value.rankChanges.flatMap((item) => {
      if (!isObject(item) || typeof item.providerCreatorId !== "string") return []
      return [
        {
          providerCreatorId: item.providerCreatorId,
          ...(typeof item.withQlooRank === "number"
            ? { withQlooRank: item.withQlooRank }
            : {}),
          ...(typeof item.withoutQlooRank === "number"
            ? { withoutQlooRank: item.withoutQlooRank }
            : {}),
          ...(typeof item.scoreDelta === "number"
            ? { scoreDelta: item.scoreDelta }
            : {}),
        },
      ]
    }),
  }
}

function isObject(value: Json | undefined): value is { [key: string]: Json } {
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

function isQlooKind(
  value: Json | undefined
): value is QlooSignalRecord["kind"] {
  return (
    value === "entity" ||
    value === "tag" ||
    value === "audience" ||
    value === "locality"
  )
}

function isQlooGroup(
  value: Json | undefined
): value is QlooSignalRecord["sourceGroup"] {
  return (
    value === "market" ||
    value === "brand" ||
    value === "product" ||
    value === "reference" ||
    value === "combined" ||
    value === "creator"
  )
}
