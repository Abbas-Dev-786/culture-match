import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, CreatorCandidateRow, Json } from "@/lib/db/database.types"
import { getCreatorMatches } from "@/lib/db/matches"
import type { BaselineComparison } from "@/lib/domain/types"
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
  scoreComponents: Json
  evidence: Json
  caveats: Json
  reportSummary?: string
  campaignConcept?: Json
}

export interface SafeResults {
  matches: SafeCreatorResult[]
  comparison?: BaselineComparison
}

export async function getSafeResults(
  client: SupabaseClient<Database>,
  userId: string,
  analysisRunId: string
): Promise<SafeResults> {
  const matches = await getCreatorMatches(client, userId, analysisRunId)
  if (matches.length === 0) return { matches: [] }
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
  }
}

function toSafeResult(
  match: Awaited<ReturnType<typeof getCreatorMatches>>[number],
  candidate: CreatorCandidateRow
): SafeCreatorResult {
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
    scoreComponents: match.score_components,
    evidence: match.evidence,
    caveats: match.caveats,
    ...(match.report_summary ? { reportSummary: match.report_summary } : {}),
    ...(match.campaign_concept
      ? { campaignConcept: match.campaign_concept }
      : {}),
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

function isString(value: Json): value is string {
  return typeof value === "string"
}
