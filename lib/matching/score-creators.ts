import type {
  CampaignBrief,
  CultureSignal,
  EvidenceRef,
  NormalizedCreator,
  QlooSignalRecord,
  ScoreComponent,
} from "@/lib/domain/types"
import {
  derivedEvidence,
  evidenceCompleteness,
  userInputEvidence,
} from "./evidence.ts"
import { creatorTier, creatorTierBudgetRange } from "./creator-tier.ts"

export const SCORE_ALGORITHM_VERSION = "prd-v2-evidence-calibrated"
const DEFAULT_SCORE_OBSERVED_AT = "1970-01-01T00:00:00.000Z"

export const scoreWeights = {
  culturalAffinity: 0.35,
  engagementRate: 0.25,
  semanticRelevance: 0.2,
  growthMomentum: 0.1,
  postingConsistency: 0.05,
  budgetTierFit: 0.05,
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
  normalization?: "available" | "fixed"
}

export function scoreCreators(
  brief: CampaignBrief,
  signals: CultureSignal[],
  creators: NormalizedCreator[],
  observedAt = deterministicObservedAt(creators),
  options: ScoreOptions = {},
): ScoredCreator[] {
  return creators
    .map((creator) => scoreCreator(brief, signals, creator, observedAt, options))
    .sort((left, right) => {
      const scoreOrder = compareScores(
        left.campaignFitScore,
        right.campaignFitScore
      )
      return scoreOrder !== 0
        ? scoreOrder
        : left.creator.providerCreatorId.localeCompare(
            right.creator.providerCreatorId
          )
    })
}

export function scoreCreator(
  brief: CampaignBrief,
  signals: CultureSignal[],
  creator: NormalizedCreator,
  observedAt = DEFAULT_SCORE_OBSERVED_AT,
  options: ScoreOptions = {},
): ScoredCreator {
  const components = [
    culturalAffinityComponent(signals, creator, observedAt, options.includeQlooResonance !== false),
    engagementRateComponent(creator),
    semanticRelevanceComponent(creator),
    growthMomentumComponent(creator),
    postingConsistencyComponent(creator),
    budgetTierFitComponent(brief, creator, observedAt),
  ]
  const available = components.filter((component) => component.score !== undefined)
  const weightTotal = available.reduce((sum, component) => sum + component.weight, 0)
  const scoreDenominator = options.normalization === "fixed" ? totalWeight() : weightTotal
  const weightedScore = available.length > 0 && scoreDenominator > 0
    ? available.reduce((sum, component) => sum + (component.score ?? 0) * component.weight, 0) / scoreDenominator
    : undefined
  const evidence = uniqueEvidence(components.flatMap((component) => component.evidence))
  const caveats = [...creator.missingFields.map((field) => `Missing ${field} data`)]
  const hasPostContentEvidence = creator.contentSignals.some(
    (signal) => signal.evidenceKind !== "bio" && signal.sourceField !== "$.creator.bio"
  )
  const hasBioEvidence = creator.contentSignals.some(
    (signal) => signal.evidenceKind === "bio" || signal.sourceField === "$.creator.bio"
  )
  if (hasBioEvidence && !hasPostContentEvidence) {
    caveats.push("Cultural alignment is bio/profile-derived; no post or content evidence was available")
  }
  if ((brief.maxBudget !== undefined || brief.minBudget !== undefined) && creator.estimatedFee === undefined) {
    caveats.push("Budget fit uses follower count as a rough tier proxy; creator fee and affordability are unverified")
  }
  if (creator.locationUnverified !== false) {
    caveats.push("Audience geography is not verified; creator location is not audience evidence")
  }

  return {
    creator,
    campaignFitScore: weightedScore === undefined ? null : roundScore(weightedScore),
    evidenceCompleteness: evidenceCompleteness(
      available.reduce((sum, component) => sum + component.weight, 0),
      totalWeight(),
    ),
    components,
    evidence,
    caveats: [...new Set(caveats)],
  }
}

function culturalAffinityComponent(
  signals: CultureSignal[],
  creator: NormalizedCreator,
  observedAt: string,
  includeQlooResonance: boolean,
): ScoreComponent {
  if (!includeQlooResonance) {
    return unavailableComponent(
      "culturalAffinity",
      "Cultural affinity",
      scoreWeights.culturalAffinity,
      "Qloo cultural affinity is excluded from the baseline comparison",
    )
  }

  const postContentSignals = creator.contentSignals.filter(
    (signal) => signal.evidenceKind !== "bio" && signal.sourceField !== "$.creator.bio"
  )
  const qlooSignals = (creator.qlooSignals ?? []).filter(
    (signal) =>
      signal.affinity !== undefined &&
      (signal.campaignSignalIds?.length ?? 0) > 0
  )
  if (postContentSignals.length > 0 && signals.length > 0 && qlooSignals.length > 0) {
    const totalSignalWeight = qlooSignals.reduce(
      (sum, signal) => sum + (signal.inputWeight ?? 1) * evidenceQuality(signal),
      0
    )
    const weightedAffinity = qlooSignals.reduce(
      (sum, signal) =>
        sum +
        normalizeAffinity(signal.affinity ?? 0) *
          (signal.inputWeight ?? 1) *
          evidenceQuality(signal),
      0,
    )
    const marketEvidence = signals
      .filter((signal) => qlooSignals.some((creatorSignal) => creatorSignal.signalId === signal.signalId))
      .map((signal) => signal.evidence)

    return {
      key: "culturalAffinity",
      label: "Cultural affinity",
      score: roundScore(totalSignalWeight > 0 ? weightedAffinity / totalSignalWeight : 0),
      weight: scoreWeights.culturalAffinity,
      availability: "conditional",
       rationale: "Campaign-conditioned Qloo affinity for resolved creator-content signals in the target market; this is not audience-level affinity.",
      evidence: [
        ...marketEvidence,
        ...qlooSignals.map((signal) => signal.evidence),
        ...postContentSignals.map((signal) => signal.evidence),
        derivedEvidence(
          "Qloo content-to-market resonance",
          "$.derived.culturalAffinity",
          observedAt,
           `Weighted ${qlooSignals.length} creator signals against ${new Set(qlooSignals.flatMap((signal) => signal.campaignSignalIds ?? [])).size} campaign signals with Qloo evidence quality`,
        ),
      ],
    }
  }
  const personAffinity = creator.qlooPersonEntityId !== undefined
    ? creator.qlooPersonAffinity
    : undefined
  const personEntityId = creator.qlooPersonEntityId
  if (personAffinity !== undefined && personEntityId !== undefined) {
    return {
      key: "culturalAffinity",
      label: "Cultural affinity",
      score: roundScore(normalizeAffinity(personAffinity)),
      weight: scoreWeights.culturalAffinity,
      availability: "conditional",
      rationale: "Exact Qloo person-entity affinity; this is profile-level cultural alignment, not proof that followers share these tastes.",
      evidence: [
        ...creator.evidence.filter((item) => item.fieldPath === "$.results.entities[]"),
        derivedEvidence(
          "Qloo person-level cultural affinity fallback",
          "$.derived.qlooPersonAffinity",
          observedAt,
          `Validated Qloo entity ${personEntityId ?? "without an entity id"}`,
        ),
      ],
    }
  }
  return unavailableComponent(
    "culturalAffinity",
    "Cultural affinity",
    scoreWeights.culturalAffinity,
    "Qloo did not resolve usable post/content evidence or an exact person-entity match",
  )
}

function evidenceQuality(signal: QlooSignalRecord): number {
  if (signal.evidence.verification === "verified") return 1
  if (signal.evidence.verification === "provider_reported") return 0.85
  return 0.5
}

function engagementRateComponent(creator: NormalizedCreator): ScoreComponent {
  if (creator.engagementRate === undefined || creator.engagementRate < 0 || creator.engagementRate > 1) {
    return unavailableComponent(
      "engagementRate",
      "Engagement rate",
      scoreWeights.engagementRate,
      "A valid provider engagement rate is unavailable",
    )
  }
  return {
    key: "engagementRate",
    label: "Engagement rate",
    score: roundScore(Math.min(creator.engagementRate / 0.1, 1) * 100),
    weight: scoreWeights.engagementRate,
    availability: "supported",
    rationale: "Provider-reported engagement rate normalized against a 10% reference ceiling.",
    evidence: creator.evidence.filter((item) => item.fieldPath === "$.primary_profile.engagement_rate"),
  }
}

function semanticRelevanceComponent(creator: NormalizedCreator): ScoreComponent {
  if (creator.providerMatchScore === undefined) {
    return unavailableComponent(
      "semanticRelevance",
      "Semantic relevance",
      scoreWeights.semanticRelevance,
      "The creator-search provider did not return a semantic relevance score",
    )
  }
  return {
    key: "semanticRelevance",
    label: "Semantic relevance",
    score: roundScore(normalizeUnitScore(creator.providerMatchScore)),
    weight: scoreWeights.semanticRelevance,
    availability: "supported",
    rationale: "Provider-reported relevance for the natural-language creator search.",
    evidence: creator.evidence.filter((item) => item.fieldPath === "$.match.score"),
  }
}

function growthMomentumComponent(creator: NormalizedCreator): ScoreComponent {
  if (creator.monthlyGrowthRate === undefined) {
    return unavailableComponent(
      "growthMomentum",
      "Growth momentum",
      scoreWeights.growthMomentum,
      "Monthly growth was not returned by the provider",
    )
  }
  return {
    key: "growthMomentum",
    label: "Growth momentum",
    score: roundScore(normalizeRateScore(creator.monthlyGrowthRate, 0.2)),
    weight: scoreWeights.growthMomentum,
    availability: "supported",
    rationale: "Monthly growth normalized against a 20% reference ceiling.",
    evidence: creator.evidence.filter((item) => item.fieldPath.includes("growth")),
  }
}

function postingConsistencyComponent(creator: NormalizedCreator): ScoreComponent {
  if (creator.postingFrequency === undefined) {
    return unavailableComponent(
      "postingConsistency",
      "Posting consistency",
      scoreWeights.postingConsistency,
      "Posting frequency was not returned by the provider",
    )
  }
  return {
    key: "postingConsistency",
    label: "Posting consistency",
    score: roundScore(Math.min(creator.postingFrequency / 12, 1) * 100),
    weight: scoreWeights.postingConsistency,
    availability: "supported",
    rationale: "Monthly posting frequency normalized against a 12-post reference ceiling.",
    evidence: creator.evidence.filter((item) => item.fieldPath.includes("posting")),
  }
}

function budgetTierFitComponent(
  brief: CampaignBrief,
  creator: NormalizedCreator,
  observedAt: string,
): ScoreComponent {
  if (brief.maxBudget === undefined && brief.minBudget === undefined) {
    return unavailableComponent(
      "budgetTierFit",
      "Budget tier proxy",
      scoreWeights.budgetTierFit,
      "A provider-reported creator fee and campaign budget are required",
    )
  }
  if (creator.estimatedFee === undefined && !creatorTierBudgetRange(creatorTier(creator.followers))) {
    return unavailableComponent(
      "budgetTierFit",
      "Budget tier fit",
      scoreWeights.budgetTierFit,
      "Follower count is required for the rough budget-tier proxy when creator fee data is unavailable",
    )
  }
  const minimum = brief.minBudget ?? 0
  const maximum = brief.maxBudget ?? Number.POSITIVE_INFINITY
  const score = creator.estimatedFee !== undefined
    ? creator.estimatedFee < minimum
      ? (creator.estimatedFee / Math.max(minimum, 1)) * 100
      : creator.estimatedFee <= maximum
        ? 100
        : Number.isFinite(maximum) ? (maximum / creator.estimatedFee) * 100 : 100
    : tierBudgetScore(creator.followers, minimum, maximum)
  return {
    key: "budgetTierFit",
    label: "Budget tier proxy",
    score: roundScore(score),
    weight: scoreWeights.budgetTierFit,
    availability: "conditional",
    rationale: creator.estimatedFee !== undefined
      ? "Provider-reported creator fee compared with the campaign budget range."
      : `Follower-based ${creatorTier(creator.followers)} tier compared with the campaign budget matrix; this is not a creator fee or affordability guarantee.`,
    evidence: [
      ...creator.evidence.filter((item) => item.fieldPath.includes("fee")),
      ...creator.evidence.filter((item) => item.fieldPath.includes("followers")),
      userInputEvidence("Campaign budget", "$.brief.budget", observedAt),
    ],
  }
}

function tierBudgetScore(
  followers: number | undefined,
  minimum: number,
  maximum: number,
): number {
  const range = creatorTierBudgetRange(creatorTier(followers))
  if (!range) return 0
  const tierMaximum = range.max ?? Number.POSITIVE_INFINITY
  const overlapMinimum = Math.max(minimum, range.min)
  const overlapMaximum = Math.min(maximum, tierMaximum)
  if (overlapMinimum <= overlapMaximum) return 100
  if (maximum < range.min) return Math.max(0, (maximum / Math.max(range.min, 1)) * 100)
  if (minimum > tierMaximum) return Number.isFinite(tierMaximum) ? Math.max(0, (tierMaximum / minimum) * 100) : 0
  return 0
}

function unavailableComponent(
  key: string,
  label: string,
  weight: number,
  rationale: string,
): ScoreComponent {
  return { key, label, weight, availability: "unavailable", rationale, evidence: [] }
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

function normalizeUnitScore(value: number): number {
  return value <= 1 ? value * 100 : value
}

function normalizeRateScore(value: number, ceiling: number): number {
  const rate = value > 1 ? value / 100 : value
  return Math.min(Math.max(rate / ceiling, 0), 1) * 100
}

function deterministicObservedAt(creators: NormalizedCreator[]): string {
  const observedAt = creators
    .flatMap((creator) => creator.evidence.map((evidence) => evidence.observedAt))
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort()[0]
  return observedAt ?? DEFAULT_SCORE_OBSERVED_AT
}
