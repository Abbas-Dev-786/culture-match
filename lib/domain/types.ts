export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
export type JsonObject = { [key: string]: JsonValue }

export const launchOpportunityTypes = [
  "urn:entity:brand",
  "urn:entity:place",
  "urn:entity:artist",
  "urn:entity:person",
  "urn:entity:podcast",
  "urn:entity:movie",
  "urn:entity:tv_show",
  "urn:entity:destination",
  "urn:entity:book",
  "urn:entity:videogame",
] as const

export type LaunchOpportunityType = (typeof launchOpportunityTypes)[number]

export type LaunchAnalysisStatus =
  | "queued"
  | "resolving_inputs"
  | "researching_market"
  | "discovering_opportunities"
  | "generating_brief"
  | "completed"
  | "failed"

export type LaunchRunStatus = "queued" | "running" | "completed" | "failed"

export type LaunchWorkflowStage =
  | "queued"
  | "resolving_inputs"
  | "researching_market"
  | "discovering_opportunities"
  | "generating_brief"

export interface LaunchAnalysisBrief {
  brandName: string
  product: string
  country: string
  city: string
  opportunityType: LaunchOpportunityType
  culturalReferences: string[]
  launchIntent: string
}

export interface LaunchOpportunityCandidate {
  provider: "qloo"
  entityId: string
  name: string
  types: string[]
  providerRank?: number
  affinity?: number
  popularity?: number
  relatedSignalIds: string[]
  metadata: JsonObject
  evidence: EvidenceRef[]
  missingFields: string[]
}

export interface SafeLaunchAnalysis {
  id: string
  brandName: string
  product: string
  country: string
  city: string
  opportunityType: LaunchOpportunityType
  culturalReferences: string[]
  launchIntent: string
  status: LaunchAnalysisStatus
  createdAt: string
  updatedAt: string
}

export interface SafeLaunchRun {
  id: string
  analysisId: string
  attempt: number
  status: LaunchRunStatus
  stage: LaunchWorkflowStage
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

export interface SafeLaunchOpportunity {
  id: string
  entityId: string
  name: string
  types: string[]
  providerRank?: number
  affinity?: number
  popularity?: number
  relatedSignalIds: string[]
  evidence: EvidenceRef[]
  metadata: JsonObject
  missingFields: string[]
  rank: number
  rankingBasis: "provider_rank" | "affinity" | "popularity" | "stable_entity_id"
  rankingAlgorithmVersion: string
  evidenceCompleteness: number
  caveats: string[]
}

export interface LaunchActivationDirection {
  title: string
  description: string
  rationale: string
  evidenceKeys: string[]
  hypothesis: true
}

export interface LaunchActivationBrief {
  schemaVersion: "phase3-v1"
  culturalTerritory: {
    title: string
    description: string
    evidenceKeys: string[]
  }
  recommendedLaunchContext: string
  activationDirections: LaunchActivationDirection[]
  hypotheses: Array<{
    statement: string
    evidenceKeys: string[]
    hypothesis: true
  }>
  openQuestions: string[]
  caveats: string[]
}

export interface SafeLaunchActivationReport {
  schemaVersion: "phase3-v1"
  generationMode: "deterministic" | "openrouter"
  modelProvider?: string
  modelId?: string
  promptVersion: string
  generatedAt: string
  brief: LaunchActivationBrief
}

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

export type QlooSignalKind = "entity" | "tag" | "audience" | "locality"

export type QlooSignalGroup =
  | "market"
  | "brand"
  | "product"
  | "reference"
  | "combined"
  | "creator"

export type QlooAgeRange =
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
