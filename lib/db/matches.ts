import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  CreatorCandidateRow,
  CreatorMatchInsert,
  CreatorMatchRow,
  Database,
} from "@/lib/db/database.types"
import type {
  BaselineComparison,
  JsonObject,
  ScoreComponent,
  EvidenceRef,
} from "@/lib/domain/types"
import { ApplicationError } from "@/lib/errors"
import type { ScoredCreator } from "@/lib/matching/score-creators"

export async function getCreatorCandidates(
  client: SupabaseClient<Database>,
  userId: string,
  analysisRunId: string,
  searchVariant: "baseline" | "culture_informed"
): Promise<CreatorCandidateRow[]> {
  const result = await client
    .from("creator_candidates")
    .select("*")
    .eq("analysis_run_id", analysisRunId)
    .eq("user_id", userId)
    .eq("search_variant", searchVariant)
    .order("created_at", { ascending: true })
  if (result.error)
    throw new ApplicationError("DATABASE_ERROR", 500, "Unable to load creator candidates")
  return result.data
}

export async function saveCreatorMatches(
  client: SupabaseClient<Database>,
  input: {
    campaignId: string
    analysisRunId: string
    userId: string
    searchVariant: "baseline" | "culture_informed"
    scored: ScoredCreator[]
    candidateByProviderId: Map<string, CreatorCandidateRow>
    comparison: BaselineComparison
  }
): Promise<void> {
  const rows: CreatorMatchInsert[] = input.scored.flatMap((result, index) => {
    const candidate = input.candidateByProviderId.get(result.creator.providerCreatorId)
    if (!candidate) return []
    return [
      {
        campaign_id: input.campaignId,
        analysis_run_id: input.analysisRunId,
        creator_candidate_id: candidate.id,
        user_id: input.userId,
        rank: index + 1,
        campaign_fit_score: result.campaignFitScore,
        score_algorithm_version: "phase3-v1",
        evidence_completeness: result.evidenceCompleteness,
        score_components: result.components.map(componentToJson),
        evidence: result.evidence.map(evidenceToJson),
        caveats: result.caveats,
        report_summary: deterministicSummary(result),
        comparison_metadata: comparisonToJson(input.comparison),
      },
    ]
  })
  if (rows.length === 0) return
  const result = await client
    .from("creator_matches")
    .upsert(rows, { onConflict: "analysis_run_id,creator_candidate_id" })
  if (result.error)
    throw new ApplicationError("DATABASE_ERROR", 500, "Unable to persist creator matches")
}

export async function getCreatorMatches(
  client: SupabaseClient<Database>,
  userId: string,
  analysisRunId: string
): Promise<CreatorMatchRow[]> {
  const result = await client
    .from("creator_matches")
    .select("*")
    .eq("analysis_run_id", analysisRunId)
    .eq("user_id", userId)
    .order("rank", { ascending: true })
  if (result.error)
    throw new ApplicationError("DATABASE_ERROR", 500, "Unable to load creator matches")
  return result.data
}

export async function updateCreatorMatchReport(
  client: SupabaseClient<Database>,
  matchId: string,
  userId: string,
  report: {
    summary: string
    caveats: string[]
    concept?: JsonObject
  }
): Promise<void> {
  const result = await client
    .from("creator_matches")
    .update({
      report_summary: report.summary,
      caveats: report.caveats,
      ...(report.concept ? { campaign_concept: report.concept } : {}),
    })
    .eq("id", matchId)
    .eq("user_id", userId)
  if (result.error)
    throw new ApplicationError("DATABASE_ERROR", 500, "Unable to persist match report")
}

function componentToJson(component: ScoreComponent): JsonObject {
  return {
    key: component.key,
    label: component.label,
    ...(component.score !== undefined ? { score: component.score } : {}),
    weight: component.weight,
    availability: component.availability,
    rationale: component.rationale,
    evidence: component.evidence.map(evidenceToJson),
  }
}

function evidenceToJson(evidence: EvidenceRef): JsonObject {
  return {
    source: evidence.source,
    ...(evidence.label ? { label: evidence.label } : {}),
    fieldPath: evidence.fieldPath,
    ...(evidence.providerEntityId
      ? { providerEntityId: evidence.providerEntityId }
      : {}),
    observedAt: evidence.observedAt,
    verification: evidence.verification,
    ...(evidence.excerpt ? { excerpt: evidence.excerpt } : {}),
  }
}

function comparisonToJson(comparison: BaselineComparison): JsonObject {
  return {
    overlapCount: comparison.overlapCount,
    baselineCount: comparison.baselineCount,
    cultureInformedCount: comparison.cultureInformedCount,
    overlapRate: comparison.overlapRate,
    baselineOnlyIds: comparison.baselineOnlyIds,
    cultureInformedOnlyIds: comparison.cultureInformedOnlyIds,
    rankChanges: comparison.rankChanges.map((change) => ({ ...change })),
    materiallyChanged: comparison.materiallyChanged,
    ...(comparison.qlooAblation
      ? {
          qlooAblation: {
            scoredCreatorCount: comparison.qlooAblation.scoredCreatorCount,
            averageScoreDelta: comparison.qlooAblation.averageScoreDelta,
            materiallyChanged: comparison.qlooAblation.materiallyChanged,
            rankChanges: comparison.qlooAblation.rankChanges.map((change) => ({
              ...change,
            })),
          },
        }
      : {}),
  }
}

function deterministicSummary(result: ScoredCreator): string {
  const score = result.campaignFitScore === null
    ? "No overall score is available"
    : `Deterministic fit score: ${result.campaignFitScore}/100`
  const available = result.components
    .filter((component) => component.score !== undefined)
    .map((component) => component.label)
  return `${score}. Scored components: ${available.length > 0 ? available.join(", ") : "none"}.`
}
