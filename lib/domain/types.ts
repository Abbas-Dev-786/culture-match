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
  targetMarket: TargetMarket
  objective: string
  culturalReferences: string[]
  preferredLanguages: string[]
  minFollowers?: number
  maxFollowers?: number
  maxBudget?: number
  currency?: string
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

export type QlooSignalKind = "entity" | "tag" | "audience" | "locality"

export type QlooSignalGroup =
  | "market"
  | "brand"
  | "product"
  | "reference"
  | "combined"
  | "creator"

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
  unresolvedInputs: string[]
  tagOperator?: "union" | "intersection"
  explainabilityRequested: boolean
}

export interface CreatorContentSignal {
  text: string
  sourceField: string
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
  isVerified?: boolean
  locationUnverified?: boolean
  providerMatchScore?: number
  contentSignals: CreatorContentSignal[]
  qlooSignals?: QlooSignalRecord[]
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
}

export interface SafeCampaign {
  id: string
  brandName: string
  productCategory: string
  objective: string
  targetMarket: TargetMarket
  creatorLimit: number
  status: CampaignStatus
  createdAt: string
  updatedAt: string
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
