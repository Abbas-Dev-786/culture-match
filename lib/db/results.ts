import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, CreatorCandidateRow, Json, CampaignRow } from "@/lib/db/database.types"
import { getCreatorMatches } from "@/lib/db/matches"
import { getCultureProfile } from "@/lib/db/provider-results"
import type {
  BaselineComparison,
  CultureSignal,
  EvidenceRef,
  QlooAgeRange,
  QlooComparisonSummary,
  QlooFingerprint,
  QlooFingerprintLayer,
  QlooHeatmap,
  QlooGender,
  QlooSignalRecord,
  SafeCultureProfile,
  SafeCultureReference,
  ScoreComponent,
} from "@/lib/domain/types"
import { ApplicationError } from "@/lib/errors"
import { normalizeStoredCreator } from "@/lib/matching/normalize-creator"
import { creatorTier, creatorTierLabel } from "@/lib/matching/creator-tier"
import type { MatchConstraintStatus } from "@/lib/domain/types"

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
  monthlyGrowthRate?: number
  postingFrequency?: number
  estimatedFee?: number
  languages?: string[]
  audienceRegions?: string[]
  qlooAffinity?: number
  qlooPopularity?: number
  creatorTier: string
  regionalMatch: MatchConstraintStatus
  languageMatch: MatchConstraintStatus
  matchReasons: string[]
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
  analysisRunId: string,
  campaign: CampaignRow
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
    return [toSafeResult(match, candidate, campaign)]
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
  candidate: CreatorCandidateRow,
  campaign: CampaignRow
): SafeCreatorResult {
  const campaignConcept = readCampaignConcept(match.campaign_concept)
  const normalized = normalizeStoredCreator(candidate)
  const regionalMatch = constraintStatus(
    normalized.audienceRegions,
    [campaign.market_city, campaign.market_region, campaign.market_country].filter(
      (value): value is string => Boolean(value)
    )
  )
  const languageMatch = constraintStatus(normalized.languages, campaign.preferred_languages)
  const scoreComponents = readScoreComponents(match.score_components)
  const matchReasons = buildMatchReasons(normalized, scoreComponents, regionalMatch, languageMatch)
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
    ...(normalized.monthlyGrowthRate !== undefined
      ? { monthlyGrowthRate: normalized.monthlyGrowthRate }
      : {}),
    ...(normalized.postingFrequency !== undefined
      ? { postingFrequency: normalized.postingFrequency }
      : {}),
    ...(normalized.estimatedFee !== undefined
      ? { estimatedFee: normalized.estimatedFee }
      : {}),
    ...(normalized.languages ? { languages: normalized.languages } : {}),
    ...(normalized.audienceRegions ? { audienceRegions: normalized.audienceRegions } : {}),
    ...(normalized.qlooAffinity !== undefined ? { qlooAffinity: normalized.qlooAffinity } : {}),
    ...(normalized.qlooPopularity !== undefined ? { qlooPopularity: normalized.qlooPopularity } : {}),
    creatorTier: creatorTierLabel(creatorTier(normalized.followers)),
    regionalMatch,
    languageMatch,
    matchReasons,
    ...(candidate.is_verified !== null
      ? { isVerified: candidate.is_verified }
      : {}),
    locationUnverified: candidate.location_unverified ?? true,
    rank: match.rank,
    campaignFitScore: match.campaign_fit_score,
    scoreAlgorithmVersion: match.score_algorithm_version,
    evidenceCompleteness: match.evidence_completeness,
    scoreComponents,
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
  const layers = Array.isArray(value.layers)
    ? value.layers.flatMap(readQlooLayer)
    : []
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
    layers,
    unresolvedInputs,
    ...(readQlooConditioning(value.conditioning)
      ? { conditioning: readQlooConditioning(value.conditioning) }
      : {}),
    ...(value.tagOperator === "union" || value.tagOperator === "intersection"
      ? { tagOperator: value.tagOperator }
      : {}),
    explainabilityRequested: value.explainabilityRequested === true,
    ...(readQlooComparison(value.comparison)
      ? { comparison: readQlooComparison(value.comparison) }
      : {}),
    ...(readQlooHeatmap(value.heatmap)
      ? { heatmap: readQlooHeatmap(value.heatmap) }
      : {}),
  }
}

function readQlooConditioning(
  value: Json | undefined
): QlooFingerprint["conditioning"] | undefined {
  if (!isObject(value) || !Array.isArray(value.audienceIds)) return undefined
  return {
    audienceIds: value.audienceIds.filter(isString),
    ...(typeof value.audienceWeight === "number"
      ? { audienceWeight: value.audienceWeight }
      : {}),
    ...(isAgeRange(value.ageRange) ? { ageRange: value.ageRange } : {}),
    ...(isGender(value.gender) ? { gender: value.gender } : {}),
  }
}

function readQlooLayer(value: Json): QlooFingerprintLayer[] {
  if (!isObject(value) || typeof value.group !== "string" || typeof value.label !== "string") return []
  if (
    value.group !== "market" &&
    value.group !== "brand" &&
    value.group !== "product" &&
    value.group !== "reference" &&
    value.group !== "combined"
  ) return []
  if (!Array.isArray(value.signals)) return []
  const signals = value.signals.flatMap(readQlooSignal)
  return [
    {
      group: value.group,
      label: value.label,
      signals,
      unresolvedInputs: Array.isArray(value.unresolvedInputs)
        ? value.unresolvedInputs.filter(isString)
        : [],
      ...(value.operator === "union" || value.operator === "intersection"
        ? { operator: value.operator }
        : {}),
      entitySignalCount:
        typeof value.entitySignalCount === "number" ? value.entitySignalCount : 0,
      tagSignalCount:
        typeof value.tagSignalCount === "number" ? value.tagSignalCount : 0,
    },
  ]
}

function readQlooComparison(value: Json | undefined): QlooComparisonSummary | undefined {
  if (
    !isObject(value) ||
    typeof value.groupA !== "string" ||
    typeof value.groupB !== "string" ||
    typeof value.resultCount !== "number" ||
    !Array.isArray(value.topResults)
  ) return undefined
  return {
    groupA: value.groupA,
    groupB: value.groupB,
    resultCount: value.resultCount,
    topResults: value.topResults.flatMap((item) => {
      if (!isObject(item) || typeof item.signalId !== "string" || !Array.isArray(item.types)) return []
      return [{
        signalId: item.signalId,
        ...(typeof item.name === "string" ? { name: item.name } : {}),
        types: item.types.filter(isString),
        ...(typeof item.affinity === "number" ? { affinity: item.affinity } : {}),
      }]
    }),
  }
}

function readQlooHeatmap(value: Json | undefined): QlooHeatmap | undefined {
  if (!isObject(value) || !isHeatmapBoundary(value.boundary) || !Array.isArray(value.points)) return undefined
  return {
    boundary: value.boundary,
    points: value.points.flatMap((item) => {
      if (!isObject(item) || typeof item.latitude !== "number" || typeof item.longitude !== "number") return []
      return [{
        latitude: item.latitude,
        longitude: item.longitude,
        ...(typeof item.geohash === "string" ? { geohash: item.geohash } : {}),
        ...(typeof item.affinity === "number" ? { affinity: item.affinity } : {}),
        ...(typeof item.affinityRank === "number" ? { affinityRank: item.affinityRank } : {}),
        ...(typeof item.popularity === "number" ? { popularity: item.popularity } : {}),
      }]
    }),
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
    ...(typeof value.creatorSignalCount === "number"
      ? { creatorSignalCount: value.creatorSignalCount }
      : {}),
    ...(typeof value.resolvedCreatorSignalCount === "number"
      ? { resolvedCreatorSignalCount: value.resolvedCreatorSignalCount }
      : {}),
    ...(typeof value.unresolvedCreatorSignalCount === "number"
      ? { unresolvedCreatorSignalCount: value.unresolvedCreatorSignalCount }
      : {}),
    ...(typeof value.creatorEvidenceCoverage === "number"
      ? { creatorEvidenceCoverage: value.creatorEvidenceCoverage }
      : {}),
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

function constraintStatus(
  observed: string[] | undefined,
  requested: string[]
): MatchConstraintStatus {
  if (!requested.length || !observed?.length) return "unverified"
  const normalizedObserved = observed.map(normalizeLabel)
  return requested.some((value) => {
    const normalizedRequested = normalizeLabel(value)
    return normalizedObserved.some(
      (candidate) => candidate === normalizedRequested || candidate.includes(normalizedRequested) || normalizedRequested.includes(candidate)
    )
  })
    ? "matched"
    : "not_matched"
}

function normalizeLabel(value: string): string {
  return value.trim().toLocaleLowerCase().replaceAll(/[^\p{L}\p{N}]+/gu, " ")
}

function buildMatchReasons(
  creator: ReturnType<typeof normalizeStoredCreator>,
  components: ScoreComponent[],
  regionalMatch: MatchConstraintStatus,
  languageMatch: MatchConstraintStatus
): string[] {
  const reasons: string[] = []
  const culture = components.find((component) => component.key === "culturalAffinity")
  if (creator.qlooAffinity !== undefined) {
    reasons.push(`Qloo person-level cultural affinity: ${(creator.qlooAffinity * 100).toFixed(0)}/100`)
  } else if (culture?.score !== undefined && creator.qlooSignals?.length) {
    reasons.push(`Qloo matched ${creator.qlooSignals.length} creator-content signal${creator.qlooSignals.length === 1 ? "" : "s"}`)
  }
  const engagement = components.find((component) => component.key === "engagementRate")
  if (creator.engagementRate !== undefined && engagement?.score !== undefined) {
    reasons.push(`Provider engagement rate: ${(creator.engagementRate * 100).toFixed(2)}%`)
  }
  if (creator.providerMatchScore !== undefined) {
    reasons.push(`Natural-language search relevance: ${(creator.providerMatchScore * 100).toFixed(0)}/100`)
  }
  if (regionalMatch === "matched") reasons.push("Provider-reported audience region matches the target market")
  if (languageMatch === "matched") reasons.push("Provider-reported language matches campaign needs")
  return reasons.length > 0 ? reasons.slice(0, 5) : ["No verified match rationale is available from provider data"]
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

function isHeatmapBoundary(
  value: Json | undefined
): value is QlooHeatmap["boundary"] {
  return value === "geohash" || value === "city" || value === "neighborhood"
}

function isAgeRange(value: Json | undefined): value is QlooAgeRange {
  return value === "25_to_34" || value === "35_and_younger" || value === "36_to_55" || value === "55_and_older"
}

function isGender(value: Json | undefined): value is QlooGender {
  return value === "male" || value === "female"
}
