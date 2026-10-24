import type {
  CampaignBrief,
  CultureSignal,
  EvidenceRef,
  NormalizedCreator,
  ScoreComponent,
} from "@/lib/domain/types"
import {
  derivedEvidence,
  evidenceCompleteness,
  userInputEvidence,
} from "./evidence.ts"

export const SCORE_ALGORITHM_VERSION = "phase3-v1"
const DEFAULT_SCORE_OBSERVED_AT = "1970-01-01T00:00:00.000Z"

export const scoreWeights = {
  culturalAlignment: 0.35,
  contentFit: 0.3,
  marketRelevance: 0.15,
  engagement: 0.1,
  reachBudgetFit: 0.1,
} as const

export interface ScoredCreator {
  creator: NormalizedCreator
  campaignFitScore: number | null
  evidenceCompleteness: number
  components: ScoreComponent[]
  evidence: EvidenceRef[]
  caveats: string[]
}

export interface ScoreOptions {
  includeQlooResonance?: boolean
}

export function scoreCreators(
  brief: CampaignBrief,
  signals: CultureSignal[],
  creators: NormalizedCreator[],
  observedAt = deterministicObservedAt(creators),
  options: ScoreOptions = {}
): ScoredCreator[] {
  return creators
    .map((creator) =>
      scoreCreator(brief, signals, creator, observedAt, options)
    )
    .sort((left, right) => compareScores(left.campaignFitScore, right.campaignFitScore))
}

export function scoreCreator(
  brief: CampaignBrief,
  signals: CultureSignal[],
  creator: NormalizedCreator,
  observedAt = DEFAULT_SCORE_OBSERVED_AT,
  options: ScoreOptions = {}
): ScoredCreator {
  const components = [
    culturalComponent(
      signals,
      creator,
      observedAt,
      options.includeQlooResonance !== false
    ),
    contentComponent(brief, creator, observedAt),
    marketComponent(creator),
    engagementComponent(creator),
    reachBudgetComponent(brief, creator, observedAt),
  ]
  const available = components.filter(
    (component) => component.score !== undefined
  )
  const weightTotal = available.reduce((sum, component) => sum + component.weight, 0)
  const weightedScore =
    weightTotal > 0
      ? available.reduce(
          (sum, component) => sum + (component.score ?? 0) * component.weight,
          0
        ) / weightTotal
      : undefined
  const evidence = uniqueEvidence(components.flatMap((component) => component.evidence))
  const caveats = [...creator.missingFields.map((field) => `Missing ${field} data`)]
  if (components[2]?.score === undefined)
    caveats.push("Audience geography is unavailable; creator location is not audience evidence")
  if (brief.maxBudget !== undefined)
    caveats.push("Creator fee data is unavailable, so budget fit is not scored")

  return {
    creator,
    campaignFitScore:
      weightedScore === undefined ? null : roundScore(weightedScore),
    evidenceCompleteness: evidenceCompleteness(
      available.reduce((sum, component) => sum + component.weight, 0),
      totalWeight()
    ),
    components,
    evidence,
    caveats: [...new Set(caveats)],
  }
}

function culturalComponent(
  signals: CultureSignal[],
  creator: NormalizedCreator,
  observedAt: string,
  includeQlooResonance: boolean
): ScoreComponent {
  if (!includeQlooResonance) {
    return unavailableComponent(
      "culturalAlignment",
      "Qloo cultural resonance",
      scoreWeights.culturalAlignment,
      "Qloo resonance is excluded for the baseline or ablation comparison"
    )
  }

  const qlooSignals = (creator.qlooSignals ?? []).filter(
    (signal) => signal.affinity !== undefined
  )
  if (signals.length === 0 || qlooSignals.length === 0) {
    return unavailableComponent(
      "culturalAlignment",
      "Qloo cultural resonance",
      scoreWeights.culturalAlignment,
      "Qloo did not resolve creator content signals with a location-conditioned affinity"
    )
  }

  const totalWeight = qlooSignals.reduce(
    (sum, signal) => sum + (signal.inputWeight ?? 1),
    0
  )
  const weightedAffinity = qlooSignals.reduce(
    (sum, signal) =>
      sum + normalizeAffinity(signal.affinity ?? 0) * (signal.inputWeight ?? 1),
    0
  )
  const score = totalWeight > 0 ? weightedAffinity / totalWeight : 0
  const marketEvidence = signals
    .filter((signal) =>
      qlooSignals.some((creatorSignal) => creatorSignal.signalId === signal.signalId)
    )
    .map((signal) => signal.evidence)
  const evidence = [
    ...marketEvidence,
    ...qlooSignals.map((signal) => signal.evidence),
    ...creator.contentSignals.map((signal) => signal.evidence),
    derivedEvidence(
      "Qloo content-to-market resonance",
      "$.derived.culturalAlignment",
      observedAt,
      `Weighted ${qlooSignals.length} creator signals against the target market`
    ),
  ]
  return {
    key: "culturalAlignment",
    label: "Qloo cultural resonance",
    score: roundScore(score),
    weight: scoreWeights.culturalAlignment,
    availability: "conditional",
    rationale:
      "Location-conditioned Qloo affinity for resolved creator-content signals; this is not audience-level affinity.",
    evidence,
  }
}

function contentComponent(
  brief: CampaignBrief,
  creator: NormalizedCreator,
  observedAt: string
): ScoreComponent {
  const creatorText = [
    creator.bio,
    ...creator.contentSignals.map((signal) => signal.text),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
  if (!creatorText) {
    return unavailableComponent(
      "contentFit",
      "Content and campaign fit",
      scoreWeights.contentFit,
      "Creator bio/content text is unavailable"
    )
  }
  const targetText = `${brief.productCategory} ${brief.objective}`
  const score = lexicalSimilarity(targetText, creatorText) * 100
  return {
    key: "contentFit",
    label: "Content and campaign fit",
    score: roundScore(score),
    weight: scoreWeights.contentFit,
    availability: "conditional",
    rationale: "Derived lexical similarity between the campaign brief and the returned creator bio.",
    evidence: [
      ...creator.contentSignals.map((signal) => signal.evidence),
      derivedEvidence(
        "Lexical campaign fit",
        "$.derived.contentFit",
        observedAt,
        `${brief.productCategory} / ${brief.objective}`
      ),
    ],
  }
}

function marketComponent(creator: NormalizedCreator): ScoreComponent {
  return unavailableComponent(
    "marketRelevance",
    "Market relevance",
    scoreWeights.marketRelevance,
    creator.locationUnverified === false
      ? "The provider did not return audience geography"
      : "Audience geography is not returned by the provider"
  )
}

function engagementComponent(creator: NormalizedCreator): ScoreComponent {
  if (
    creator.engagementRate === undefined ||
    creator.engagementRate < 0 ||
    creator.engagementRate > 1
  ) {
    return unavailableComponent(
      "engagement",
      "Engagement quality",
      scoreWeights.engagement,
      "A valid provider engagement rate is unavailable"
    )
  }
  return {
    key: "engagement",
    label: "Engagement quality",
    score: roundScore(Math.min(creator.engagementRate / 0.1, 1) * 100),
    weight: scoreWeights.engagement,
    availability: "supported",
    rationale: "Provider-reported engagement rate normalized against a 10% reference ceiling.",
    evidence: creator.evidence.filter(
      (item) => item.fieldPath === "$.primary_profile.engagement_rate"
    ),
  }
}

function reachBudgetComponent(
  brief: CampaignBrief,
  creator: NormalizedCreator,
  observedAt: string
): ScoreComponent {
  if (creator.followers === undefined || (brief.minFollowers === undefined && brief.maxFollowers === undefined)) {
    return unavailableComponent(
      "reachBudgetFit",
      "Reach and budget fit",
      scoreWeights.reachBudgetFit,
      "Follower count or campaign reach bounds are unavailable"
    )
  }
  const min = brief.minFollowers ?? 0
  const max = brief.maxFollowers ?? Math.max(min, creator.followers)
  const score = creator.followers < min
    ? Math.max(0, (creator.followers / Math.max(min, 1)) * 100)
    : creator.followers > max
      ? Math.max(0, (max / creator.followers) * 100)
      : 100
  const evidence = [
    ...creator.evidence.filter((item) => item.fieldPath === "$.primary_profile.followers"),
    userInputEvidence("Campaign follower bounds", "$.brief.followerBounds", observedAt),
  ]
  return {
    key: "reachBudgetFit",
    label: "Reach and budget fit",
    score: roundScore(score),
    weight: scoreWeights.reachBudgetFit,
    availability: "conditional",
    rationale: brief.maxBudget !== undefined
      ? "Reach fit is scored from provider followers; fee-based budget fit remains unavailable."
      : "Reach fit is scored against the campaign follower bounds.",
    evidence,
  }
}

function unavailableComponent(
  key: string,
  label: string,
  weight: number,
  rationale: string
): ScoreComponent {
  return { key, label, weight, availability: "unavailable", rationale, evidence: [] }
}

function lexicalSimilarity(left: string, right: string): number {
  const leftTokens = new Set(tokens(left))
  const rightTokens = new Set(tokens(right))
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length
  return overlap / Math.max(leftTokens.size, rightTokens.size)
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 2)
}

function totalWeight(): number {
  return Object.values(scoreWeights).reduce((sum, weight) => sum + weight, 0)
}

function uniqueEvidence(evidence: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>()
  return evidence.filter((item) => {
    const key = `${item.source}:${item.fieldPath}:${item.excerpt ?? ""}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function compareScores(left: number | null, right: number | null): number {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  return right - left
}

function roundScore(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)) * 100) / 100
}

function normalizeAffinity(value: number): number {
  if (!Number.isFinite(value)) return 0
  return value <= 1 ? value * 100 : Math.min(value, 100)
}

function deterministicObservedAt(creators: NormalizedCreator[]): string {
  const observedAt = creators
    .flatMap((creator) => creator.evidence.map((evidence) => evidence.observedAt))
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort()[0]
  return observedAt ?? DEFAULT_SCORE_OBSERVED_AT
}
