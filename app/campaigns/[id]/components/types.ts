export interface EvidenceView {
  source: "qloo" | "apify" | "user_input" | "derived"
  label?: string
  fieldPath: string
  providerEntityId?: string
  observedAt: string
  verification: "verified" | "provider_reported" | "unverified"
  excerpt?: string
}

export interface ScoreComponentView {
  key: string
  label: string
  score?: number
  weight: number
  availability: "supported" | "conditional" | "unavailable"
  rationale: string
  evidence: EvidenceView[]
}

export interface CultureProfileView {
  signals: Array<{
    name: string
    affinity?: number
    types: string[]
    evidence: EvidenceView
  }>
  locationQuery?: string
  location?: { name: string; disambiguation?: string }
  resolvedReferences: Array<{
    reference: string
    status: "resolved" | "ambiguous" | "unresolved"
    name?: string
    candidates?: Array<{ entityId: string; name: string; types: string[] }>
  }>
  unresolvedReferences: string[]
  signalCount: number
  searchPlanSource?: "deterministic" | "model"
  researchTrace?: ResearchTraceView[]
  creatorSearchTrace?: Array<{
    toolName: string
    action: string
    decision?: string
    resultCount?: number
    evidenceCount?: number
    nextAction?: string
    rejectedActions?: string[]
    rationale?: string
  }>
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
    pendingApproval?: {
      action: "broaden_creator_search" | "request_enrichment"
      reason: string
      requestedAction?: string
    }
  }
  fingerprint?: {
    locationQuery: string
    location: { name: string; entityId?: string; disambiguation?: string }
    signals: Array<{
      signalId: string
      kind: "entity" | "tag" | "audience" | "locality"
      name: string
      types: string[]
      affinity?: number
      inputWeight?: number
      sourceGroup: "market" | "brand" | "product" | "reference" | "combined" | "creator"
    }>
    layers: Array<{
      group: "market" | "brand" | "product" | "reference" | "combined"
      label: string
      signals: Array<{
        signalId: string
        kind: "entity" | "tag" | "audience" | "locality"
        name: string
        types: string[]
        affinity?: number
        inputWeight?: number
        sourceGroup: "market" | "brand" | "product" | "reference" | "combined" | "creator"
      }>
      unresolvedInputs: string[]
      operator?: "union" | "intersection"
      entitySignalCount: number
      tagSignalCount: number
    }>
    unresolvedInputs: string[]
    conditioning?: {
      audienceIds: string[]
      audienceWeight?: number
      ageRange?: "25_to_34" | "35_and_younger" | "36_to_55" | "55_and_older"
      gender?: "male" | "female"
    }
    tagOperator?: "union" | "intersection"
    explainabilityRequested: boolean
    comparison?: {
      groupA: string
      groupB: string
      resultCount: number
      topResults: Array<{ signalId: string; name?: string; types: string[]; affinity?: number }>
    }
    heatmap?: {
      boundary: "geohash" | "city" | "neighborhood"
      points: Array<{ latitude: number; longitude: number; geohash?: string; affinity?: number; affinityRank?: number; popularity?: number }>
    }
  }
}

export interface ResearchTraceView {
  step: number
  action:
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
  focus: "campaign_fingerprint" | "market_context" | "product_context"
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

export interface CampaignMatchView {
  id: string
  providerCreatorId: string
  variant: "baseline" | "culture_informed"
  name: string
  platform: string
  username?: string
  profileUrl?: string
  bio?: string
  followers?: number
  engagementRate?: number
  monthlyGrowthRate?: number
  postingFrequency?: number
  estimatedFee?: number
  languages?: string[]
  audienceRegions?: string[]
  qlooAffinity?: number
  qlooPopularity?: number
  creatorTier: string
  regionalMatch: "matched" | "not_matched" | "unverified"
  languageMatch: "matched" | "not_matched" | "unverified"
  matchReasons: string[]
  isVerified?: boolean
  locationUnverified: boolean
  rank: number
  campaignFitScore: number | null
  evidenceCompleteness: number
  scoreComponents: ScoreComponentView[]
  evidence: EvidenceView[]
  caveats: string[]
  contentSignals?: Array<{ text: string; sourceField: string }>
  qlooSignals?: Array<{ name: string; affinity?: number; sourceGroup: string }>
  reportSummary?: string
  campaignConcept?: {
    title: string
    idea: string
    rationale: string
    hypothesis: true
  }
}

export interface ComparisonView {
  overlapCount: number
  baselineCount: number
  cultureInformedCount: number
  overlapRate: number
  materiallyChanged: boolean
  baselineOnlyIds: string[]
  cultureInformedOnlyIds: string[]
  rankChanges: Array<{
    providerCreatorId: string
    baselineRank?: number
    cultureInformedRank?: number
    scoreDelta?: number
  }>
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

export interface CampaignResultsResponse {
  matches?: CampaignMatchView[]
  comparison?: ComparisonView
  cultureProfile?: CultureProfileView
}

export interface CampaignStatusResponse {
  campaign?: {
    id: string
    brandName: string
    productCategory: string
    objective: string
    status: string
    targetMarket?: {
      country: string
      region?: string
      city?: string
      marketScope: "country" | "region" | "city"
    }
    creatorLimit?: number
  }
  run?: {
    id: string
    attempt: number
    status: "queued" | "running" | "completed" | "failed" | "cancelled"
    stage: "queued" | "researching_culture" | "searching_creators" | "scoring" | "generating_report"
    stageMessage?: string
    errorCode?: string
    errorMessage?: string
    retryAvailable?: boolean
    createdAt: string
    startedAt?: string
    completedAt?: string
  }
  error?: { message: string }
}
