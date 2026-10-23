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

export type RunStatus = "queued" | "running" | "completed" | "failed" | "cancelled"

export type WorkflowStage =
  | "queued"
  | "researching_culture"
  | "searching_creators"
  | "scoring"
  | "generating_report"

export type VerificationState = "verified" | "provider_reported" | "unverified"

export interface EvidenceRef {
  source: string
  fieldPath: string
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
  scoreComponents: ScoreComponent[]
  evidence: EvidenceRef[]
  reportSummary?: string
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
  createdAt: string
  updatedAt: string
}
