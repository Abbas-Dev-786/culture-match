import type {
  CampaignStatus,
  JsonValue,
  MarketScope,
  RunStatus,
  WorkflowStage,
} from "@/lib/domain/types"

export type Json = JsonValue

export type CampaignRow = {
  id: string
  user_id: string
  brand_name: string
  product_category: string
  objective: string
  market_country: string
  market_region: string | null
  market_city: string | null
  market_scope: MarketScope
  cultural_references: string[]
  preferred_languages: string[]
  min_followers: number | null
  max_followers: number | null
  max_budget: number | null
  currency: string | null
  qloo_audience_ids: string[]
  qloo_audience_weight: number | null
  qloo_age_range: "35_and_younger" | "36_to_55" | "55_and_older" | null
  qloo_gender: "male" | "female" | null
  creator_limit: number
  status: CampaignStatus
  created_at: string
  updated_at: string
}

export type CampaignInsert = {
  id?: string
  user_id: string
  brand_name: string
  product_category: string
  objective: string
  market_country: string
  market_region?: string | null
  market_city?: string | null
  market_scope: MarketScope
  cultural_references: string[]
  preferred_languages: string[]
  min_followers?: number | null
  max_followers?: number | null
  max_budget?: number | null
  currency?: string | null
  qloo_audience_ids?: string[]
  qloo_audience_weight?: number | null
  qloo_age_range?: "35_and_younger" | "36_to_55" | "55_and_older" | null
  qloo_gender?: "male" | "female" | null
  creator_limit: number
  status?: CampaignStatus
  created_at?: string
  updated_at?: string
}

export type CampaignUpdate = Partial<CampaignInsert>

export type AnalysisRunRow = {
  id: string
  campaign_id: string
  user_id: string
  attempt: number
  idempotency_key: string
  status: RunStatus
  stage: WorkflowStage
  provider_run_id: string | null
  provider_dataset_id: string | null
  baseline_provider_run_id: string | null
  baseline_provider_dataset_id: string | null
  provider_start_claim_token: string | null
  provider_start_claimed_until: string | null
  score_algorithm_version: string
  error_code: string | null
  error_message: string | null
  queued_at: string
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type AnalysisRunInsert = {
  id?: string
  campaign_id: string
  user_id: string
  attempt?: number
  idempotency_key: string
  status?: RunStatus
  stage?: WorkflowStage
  provider_run_id?: string | null
  provider_dataset_id?: string | null
  baseline_provider_run_id?: string | null
  baseline_provider_dataset_id?: string | null
  provider_start_claim_token?: string | null
  provider_start_claimed_until?: string | null
  score_algorithm_version?: string
  error_code?: string | null
  error_message?: string | null
  queued_at?: string
  started_at?: string | null
  completed_at?: string | null
  created_at?: string
  updated_at?: string
}

export type AnalysisRunUpdate = Partial<AnalysisRunInsert>

export type CultureProfileRow = {
  id: string
  campaign_id: string
  analysis_run_id: string
  user_id: string
  market_country: string
  signals: Json
  provider_summary: Json
  raw_payload: Json | null
  observed_at: string | null
  raw_payload_expires_at: string | null
  created_at: string
  updated_at: string
}

export type CultureProfileInsert = {
  id?: string
  campaign_id: string
  analysis_run_id: string
  user_id: string
  market_country: string
  signals: Json
  provider_summary: Json
  raw_payload?: Json | null
  observed_at?: string | null
  raw_payload_expires_at?: string | null
  created_at?: string
  updated_at?: string
}

export type CultureProfileUpdate = Partial<CultureProfileInsert>

export type CreatorCandidateRow = {
  id: string
  campaign_id: string
  analysis_run_id: string
  user_id: string
  search_variant: "baseline" | "culture_informed"
  provider: string
  provider_creator_id: string
  name: string
  platform: string
  username: string | null
  profile_url: string | null
  bio: string | null
  followers: number | null
  engagement_rate: number | null
  is_verified: boolean | null
  location_unverified: boolean | null
  provider_match_score: number | null
  evidence: Json
  normalized_payload: Json
  raw_payload: Json | null
  raw_payload_expires_at: string | null
  created_at: string
  updated_at: string
}

export type CreatorCandidateInsert = {
  id?: string
  campaign_id: string
  analysis_run_id: string
  user_id: string
  search_variant?: "baseline" | "culture_informed"
  provider: string
  provider_creator_id: string
  name: string
  platform: string
  username?: string | null
  profile_url?: string | null
  bio?: string | null
  followers?: number | null
  engagement_rate?: number | null
  is_verified?: boolean | null
  location_unverified?: boolean | null
  provider_match_score?: number | null
  evidence: Json
  normalized_payload: Json
  raw_payload?: Json | null
  raw_payload_expires_at?: string | null
  created_at?: string
  updated_at?: string
}

export type CreatorCandidateUpdate = Partial<CreatorCandidateInsert>

export type CreatorMatchRow = {
  id: string
  campaign_id: string
  analysis_run_id: string
  creator_candidate_id: string
  user_id: string
  rank: number
  campaign_fit_score: number | null
  score_algorithm_version: string
  evidence_completeness: number
  score_components: Json
  evidence: Json
  caveats: Json
  report_summary: string | null
  campaign_concept: Json | null
  comparison_metadata: Json
  created_at: string
  updated_at: string
}

export type CreatorMatchInsert = {
  id?: string
  campaign_id: string
  analysis_run_id: string
  creator_candidate_id: string
  user_id: string
  rank: number
  campaign_fit_score?: number | null
  score_algorithm_version?: string
  evidence_completeness?: number
  score_components: Json
  evidence: Json
  caveats?: Json
  report_summary?: string | null
  campaign_concept?: Json | null
  comparison_metadata?: Json
  created_at?: string
  updated_at?: string
}

export type CreatorMatchUpdate = Partial<CreatorMatchInsert>

export type Database = {
  public: {
    Tables: {
      campaigns: {
        Row: CampaignRow
        Insert: CampaignInsert
        Update: CampaignUpdate
        Relationships: []
      }
      analysis_runs: {
        Row: AnalysisRunRow
        Insert: AnalysisRunInsert
        Update: AnalysisRunUpdate
        Relationships: []
      }
      culture_profiles: {
        Row: CultureProfileRow
        Insert: CultureProfileInsert
        Update: CultureProfileUpdate
        Relationships: []
      }
      creator_candidates: {
        Row: CreatorCandidateRow
        Insert: CreatorCandidateInsert
        Update: CreatorCandidateUpdate
        Relationships: []
      }
      creator_matches: {
        Row: CreatorMatchRow
        Insert: CreatorMatchInsert
        Update: CreatorMatchUpdate
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      campaign_status: CampaignStatus
      run_status: RunStatus
      workflow_stage: WorkflowStage
    }
    CompositeTypes: Record<string, never>
  }
}
