export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
export type JsonObject = { [key: string]: JsonValue }

export type MarketScope = "country" | "region" | "city"

export interface TargetMarket {
  country: string
  region?: string
  city?: string
  marketScope: MarketScope
}

export interface CampaignBrief {
  brandName: string
  productCategory: string
  productDescription: string
  targetMarket: TargetMarket
  objective: string
  culturalReferences: string[]
  preferredLanguages: string[]
  minFollowers?: number
  maxFollowers?: number
  minBudget?: number
  maxBudget?: number
  currency?: string
  qlooAudienceIds?: string[]
  qlooAudienceWeight?: number
  qlooAgeRange?: QlooAgeRange
  qlooGender?: QlooGender
  creatorLimit: number
}

export type CampaignStatus =
  | "queued"
  | "researching_culture"
  | "searching_creators"
  | "scoring"
  | "generating_report"
  | "completed"
  | "failed"
  | "cancelled"

export type RunStatus =
  "queued" | "running" | "completed" | "failed" | "cancelled"

export type WorkflowStage =
  | "queued"
  | "researching_culture"
  | "searching_creators"
  | "scoring"
  | "generating_report"

export type VerificationState = "verified" | "provider_reported" | "unverified"
export type MatchConstraintStatus = "matched" | "not_matched" | "unverified"
export type AgentDecisionMode = "model" | "deterministic_fallback"

export type QlooSignalKind = "entity" | "tag" | "audience" | "locality"

export type QlooSignalGroup =
  | "market"
  | "brand"
  | "product"
  | "reference"
  | "combined"
  | "creator"

export type QlooAgeRange =
  | "25_to_34"
  | "35_and_younger"
  | "36_to_55"
  | "55_and_older"

export type QlooGender = "male" | "female"

export type QlooFingerprintGroup = Exclude<QlooSignalGroup, "creator">

export interface QlooSignalRecord {
  signalId: string
  kind: QlooSignalKind
  name: string
  types: string[]
  affinity?: number
  inputWeight?: number
  sourceGroup: QlooSignalGroup
  evidence: EvidenceRef
}

export interface QlooFingerprint {
  locationQuery: string
  location: {
    name: string
    entityId?: string
    disambiguation?: string
  }
  signals: QlooSignalRecord[]
  layers: QlooFingerprintLayer[]
  unresolvedInputs: string[]
  conditioning?: {
    audienceIds: string[]
    audienceWeight?: number
    ageRange?: QlooAgeRange
    gender?: QlooGender
  }
  tagOperator?: "union" | "intersection"
  explainabilityRequested: boolean
  comparison?: QlooComparisonSummary
  heatmap?: QlooHeatmap
}

export interface QlooFingerprintLayer {
  group: QlooFingerprintGroup
  label: string
  signals: QlooSignalRecord[]
  unresolvedInputs: string[]
  operator?: "union" | "intersection"
  entitySignalCount: number
  tagSignalCount: number
}

export interface QlooComparisonSummary {
  groupA: string
  groupB: string
  resultCount: number
  topResults: Array<{
    signalId: string
    name?: string
    types: string[]
    affinity?: number
  }>
}

export interface QlooHeatmap {
  boundary: "geohash" | "city" | "neighborhood"
  points: Array<{
    latitude: number
    longitude: number
    geohash?: string
    affinity?: number
    affinityRank?: number
    popularity?: number
  }>
}

export interface CreatorContentSignal {
  text: string
  sourceField: string
  evidenceKind?: "bio" | "post_or_content"
  evidence: EvidenceRef
}

export interface EvidenceRef {
  source: "qloo" | "apify" | "user_input" | "derived"
  label?: string
  fieldPath: string
  providerEntityId?: string
  observedAt: string
  verification: VerificationState
  excerpt?: string
}

export interface CultureSignal {
  provider: "qloo"
  signalId: string
  name: string
  affinity?: number
  types: string[]
  evidence: EvidenceRef
  kind?: QlooSignalKind
  inputWeight?: number
  sourceGroup?: QlooSignalGroup
}

export type ResearchFocus =
  | "campaign_fingerprint"
  | "market_context"
  | "product_context"

export type ResearchAgentAction =
  | "select_research_inputs"
  | "query_qloo"
  | "inspect_evidence"
  | "refine_research_inputs"
  | "complete_research"
  | "resolve_cultural_references"
  | "query_market_culture"
  | "query_product_culture"
  | "compare_brand_and_references"
  | "request_qloo_heatmap"
  | "broaden_inputs"
  | "narrow_inputs"
  | "stop_research"

export interface ResearchTraceEntry {
  step: number
  action: ResearchAgentAction
  focus: ResearchFocus
  status: "completed"
  summary: string
  decision?: "continue" | "refine" | "stop"
  inputCounts?: {
    includesBrand: boolean
    referenceCount: number
    tagQueryCount: number
  }
  evidence?: {
    signalCount: number
    evidenceBearingSignalCount: number
    affinitySignalCount: number
    populatedLayerCount: number
    unresolvedInputCount: number
  }
  toolName?: string
  resultCount?: number
  evidenceCount?: number
  nextAction?: string
  rejectedActions?: string[]
  rationale?: string
}

export interface AgentToolTrace {
  toolName: string
  action: string
  decision?: string
  decisionMode?: AgentDecisionMode
  fallbackReason?: string
  inputHash?: string
  resultCount?: number
  evidenceCount?: number
  nextAction?: string
  rejectedActions?: string[]
  rationale?: string
}

export interface NormalizedCreator {
  provider: "apify"
  providerCreatorId: string
  name: string
  profileUrl?: string
  platform: string
  username?: string
  bio?: string
  followers?: number
  engagementRate?: number
  monthlyGrowthRate?: number
  postingFrequency?: number
  estimatedFee?: number
  languages?: string[]
  audienceRegions?: string[]
  qlooEntityId?: string
  qlooAffinity?: number
  qlooPopularity?: number
  qlooPersonEntityId?: string
  qlooPersonAffinity?: number
  qlooPersonPopularity?: number
  isVerified?: boolean
  locationUnverified?: boolean
  providerMatchScore?: number
  contentSignals: CreatorContentSignal[]
  qlooSignals?: QlooSignalRecord[]
  qlooPersonSignals?: QlooSignalRecord[]
  missingFields: string[]
  sourceFields: JsonObject
  evidence: EvidenceRef[]
}

export interface ScoreComponent {
  key: string
  label: string
  score?: number
  weight: number
  availability: "supported" | "conditional" | "unavailable"
  rationale: string
  evidence: EvidenceRef[]
}

export interface CreatorMatch {
  candidateId: string
  rank: number
  campaignFitScore?: number
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

export interface BaselineComparison {
  overlapCount: number
  baselineCount: number
  cultureInformedCount: number
  overlapRate: number
  baselineOnlyIds: string[]
  cultureInformedOnlyIds: string[]
  rankChanges: Array<{
    providerCreatorId: string
    baselineRank?: number
    cultureInformedRank?: number
    scoreDelta?: number
  }>
  materiallyChanged: boolean
  qlooAblation?: {
    scoredCreatorCount: number
    averageScoreDelta: number
    materiallyChanged: boolean
    creatorSignalCount?: number
    resolvedCreatorSignalCount?: number
    unresolvedCreatorSignalCount?: number
    creatorEvidenceCoverage?: number
    rankChanges: Array<{
      providerCreatorId: string
      withQlooRank?: number
      withoutQlooRank?: number
      scoreDelta?: number
    }>
  }
}

export interface SafeCultureReference {
  reference: string
  status: "resolved" | "ambiguous" | "unresolved"
  entityId?: string
  name?: string
  candidates?: Array<{ entityId: string; name: string; types: string[] }>
}

export interface SafeCultureProfile {
  signals: CultureSignal[]
  fingerprint?: QlooFingerprint
  locationQuery?: string
  location?: {
    name: string
    entityId?: string
    disambiguation?: string
  }
  resolvedReferences: SafeCultureReference[]
  unresolvedReferences: string[]
  signalCount: number
  searchPlanSource?: "deterministic" | "model"
  researchTrace?: ResearchTraceEntry[]
  creatorSearchTrace?: AgentToolTrace[]
  autonomyBudget?: {
    maxActions: number
    actionsUsed: number
    maxProviderCalls: number
    providerCallsUsed: number
    maxModelCalls: number
    modelCallsUsed: number
  }
  evidenceCritic?: {
    decision: "accept" | "refine_qloo" | "refine_creator_search" | "stop_with_caveats"
    verifiedQlooSignalCount: number
    representedReferenceCount: number
    populatedEvidenceLayerCount: number
    creatorEvidenceCoverage: number
    caveats: string[]
    summary: string
  }
  agentState?: {
    objective: string
    refinementCount: number
    budgetRemaining: number
    stopReason?: string
    decisionMode?: AgentDecisionMode
    fallbackReason?: string
    actionCount?: number
    modelDecisionCount?: number
    pendingApproval?: {
      action: "broaden_creator_search" | "request_enrichment"
      reason: string
      requestedAction?: string
      approvalKey?: string
      plan?: JsonObject
      signalIds?: string[]
    }
    approvedPlan?: JsonObject
    approvedSignalIds?: string[]
    approvedApprovalKey?: string
  }
}

export interface SafeCampaign {
  id: string
  brandName: string
  productCategory: string
  productDescription: string
  objective: string
  targetMarket: TargetMarket
  creatorLimit: number
  minBudget?: number
  maxBudget?: number
  currency?: string
  status: CampaignStatus
  createdAt: string
  updatedAt: string
  isSaved: boolean
}

export interface TrendingEntity {
  entityId: string
  name: string
  types: string[]
  affinity?: number
  popularity?: number
  trendScore?: number
}

export interface SafeAnalysisRun {
  id: string
  campaignId: string
  attempt: number
  status: RunStatus
  stage: WorkflowStage
  providerRunId?: string
  providerDatasetId?: string
  errorCode?: string
  errorMessage?: string
  queuedAt: string
  startedAt?: string
  completedAt?: string
  stageMessage: string
  retryAvailable: boolean
  createdAt: string
  updatedAt: string
}
