import type { BaselineComparison } from "@/lib/domain/types"
import type { ScoredCreator } from "./score-creators"

export interface RankedCreator {
  providerCreatorId: string
  rank: number
  score: number | null
}

export function compareRuns(
  baseline: RankedCreator[],
  cultureInformed: RankedCreator[]
): BaselineComparison {
  const baselineMap = new Map(baseline.map((item) => [item.providerCreatorId, item]))
  const cultureMap = new Map(cultureInformed.map((item) => [item.providerCreatorId, item]))
  const overlapIds = [...baselineMap.keys()].filter((id) => cultureMap.has(id))
  const rankChanges = [...new Set([...baselineMap.keys(), ...cultureMap.keys()])]
    .map((providerCreatorId) => {
      const baselineItem = baselineMap.get(providerCreatorId)
      const cultureItem = cultureMap.get(providerCreatorId)
      return {
        providerCreatorId,
        ...(baselineItem ? { baselineRank: baselineItem.rank } : {}),
        ...(cultureItem ? { cultureInformedRank: cultureItem.rank } : {}),
      }
    })
    .filter(
      (item) =>
        item.baselineRank !== item.cultureInformedRank
    )
  const denominator = Math.max(baseline.length, cultureInformed.length, 1)
  return {
    overlapCount: overlapIds.length,
    baselineCount: baseline.length,
    cultureInformedCount: cultureInformed.length,
    overlapRate: round(overlapIds.length / denominator),
    baselineOnlyIds: baseline.filter((item) => !cultureMap.has(item.providerCreatorId)).map((item) => item.providerCreatorId),
    cultureInformedOnlyIds: cultureInformed.filter((item) => !baselineMap.has(item.providerCreatorId)).map((item) => item.providerCreatorId),
    rankChanges,
    materiallyChanged: rankChanges.length > 0,
  }
}

export function rankedCreators(
  results: ScoredCreator[]
): RankedCreator[] {
  return results.map((result, index) => ({
    providerCreatorId: result.creator.providerCreatorId,
    rank: index + 1,
    score: result.campaignFitScore,
  }))
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000
}
