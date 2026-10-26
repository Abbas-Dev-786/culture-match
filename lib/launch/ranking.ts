import type {
  LaunchOpportunityCandidate,
} from "../domain/types.ts"

export const LAUNCH_RANKING_ALGORITHM_VERSION = "phase3-v1"

export type LaunchRankingBasis =
  | "provider_rank"
  | "affinity"
  | "popularity"
  | "stable_entity_id"

export interface RankedLaunchOpportunityCandidate
  extends LaunchOpportunityCandidate {
  rank: number
  rankingBasis: LaunchRankingBasis
  rankingAlgorithmVersion: string
  evidenceCompleteness: number
  caveats: string[]
}

export function rankLaunchOpportunities(
  candidates: LaunchOpportunityCandidate[]
): RankedLaunchOpportunityCandidate[] {
  const deduplicated = deduplicateCandidates(candidates)
  return deduplicated
    .sort(compareCandidates)
    .map((candidate, index) => {
      const rankingBasis = readRankingBasis(candidate)
      const evidenceCompleteness = calculateEvidenceCompleteness(candidate)
      return {
        ...candidate,
        rank: index + 1,
        rankingBasis,
        rankingAlgorithmVersion: LAUNCH_RANKING_ALGORITHM_VERSION,
        evidenceCompleteness,
        caveats: buildCaveats(candidate, rankingBasis),
      }
    })
}

function deduplicateCandidates(
  candidates: LaunchOpportunityCandidate[]
): LaunchOpportunityCandidate[] {
  const byEntity = new Map<string, LaunchOpportunityCandidate>()
  for (const candidate of candidates) {
    const existing = byEntity.get(candidate.entityId)
    if (!existing || compareCandidates(candidate, existing) < 0) {
      byEntity.set(candidate.entityId, candidate)
    }
  }
  return [...byEntity.values()]
}

function compareCandidates(
  left: LaunchOpportunityCandidate,
  right: LaunchOpportunityCandidate
): number {
  const providerRank = compareOptionalAscending(
    left.providerRank,
    right.providerRank
  )
  if (providerRank !== 0) return providerRank

  const affinity = compareOptionalDescending(left.affinity, right.affinity)
  if (affinity !== 0) return affinity

  const popularity = compareOptionalDescending(left.popularity, right.popularity)
  if (popularity !== 0) return popularity

  return left.entityId.localeCompare(right.entityId)
}

function readRankingBasis(
  candidate: LaunchOpportunityCandidate
): LaunchRankingBasis {
  if (candidate.providerRank !== undefined) return "provider_rank"
  if (candidate.affinity !== undefined) return "affinity"
  if (candidate.popularity !== undefined) return "popularity"
  return "stable_entity_id"
}

function calculateEvidenceCompleteness(
  candidate: LaunchOpportunityCandidate
): number {
  const observableFields = [
    candidate.types.length > 0,
    candidate.affinity !== undefined,
    candidate.popularity !== undefined,
  ]
  const available = observableFields.filter(Boolean).length
  return Number((available / observableFields.length).toFixed(2))
}

function buildCaveats(
  candidate: LaunchOpportunityCandidate,
  rankingBasis: LaunchRankingBasis
): string[] {
  const caveats = [
    "Qloo relevance does not establish partnership availability or commercial fit.",
    rankingBasis === "provider_rank"
      ? "Ordering follows the provider result rank; its business meaning remains provider-reported."
      : "No provider rank was available, so ordering uses the strongest available provider signal.",
  ]
  if (candidate.affinity === undefined)
    caveats.push("Provider affinity is unavailable for this opportunity.")
  if (candidate.popularity === undefined)
    caveats.push("Provider popularity is unavailable for this opportunity.")
  if (candidate.types.length === 0)
    caveats.push("Provider entity type is unavailable for this opportunity.")
  return [...new Set(caveats)]
}

function compareOptionalAscending(
  left: number | undefined,
  right: number | undefined
): number {
  if (left === undefined && right === undefined) return 0
  if (left === undefined) return 1
  if (right === undefined) return -1
  return left - right
}

function compareOptionalDescending(
  left: number | undefined,
  right: number | undefined
): number {
  if (left === undefined && right === undefined) return 0
  if (left === undefined) return 1
  if (right === undefined) return -1
  return right - left
}
