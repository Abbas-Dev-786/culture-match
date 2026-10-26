import type {
  LaunchAnalysisRow,
  LaunchAnalysisRunRow,
  LaunchOpportunityRow,
  LaunchActivationReportRow,
  Json,
} from "@/lib/db/database.types"
import type {
  EvidenceRef,
  JsonObject,
  LaunchWorkflowStage,
  SafeLaunchAnalysis,
  SafeLaunchActivationReport,
  SafeLaunchOpportunity,
  SafeLaunchRun,
} from "@/lib/domain/types"
import { launchActivationBriefSchema } from "@/lib/launch/activation-brief"

export function serializeLaunchAnalysis(
  analysis: LaunchAnalysisRow
): SafeLaunchAnalysis {
  return {
    id: analysis.id,
    brandName: analysis.brand_name,
    product: analysis.product,
    country: analysis.country,
    city: analysis.city,
    opportunityType: analysis.opportunity_type,
    culturalReferences: analysis.cultural_references,
    launchIntent: analysis.launch_intent,
    status: analysis.status,
    createdAt: analysis.created_at,
    updatedAt: analysis.updated_at,
  }
}

export function serializeLaunchRun(run: LaunchAnalysisRunRow): SafeLaunchRun {
  return {
    id: run.id,
    analysisId: run.analysis_id,
    attempt: run.attempt,
    status: run.status,
    stage: run.stage,
    ...(run.error_code ? { errorCode: run.error_code } : {}),
    ...(run.error_message ? { errorMessage: run.error_message } : {}),
    queuedAt: run.queued_at,
    ...(run.started_at ? { startedAt: run.started_at } : {}),
    ...(run.completed_at ? { completedAt: run.completed_at } : {}),
    stageMessage: launchStageMessage(run.stage, run.status),
    retryAvailable: run.status === "failed" && run.attempt < readMaxAttempts(),
    createdAt: run.created_at,
    updatedAt: run.updated_at,
  }
}

export function serializeLaunchOpportunity(
  row: LaunchOpportunityRow
): SafeLaunchOpportunity {
  const normalized = isJsonObject(row.normalized_payload)
    ? row.normalized_payload
    : {}
  return {
    id: row.id,
    entityId: row.entity_id,
    name: row.name,
    types: row.types,
    ...(row.provider_rank !== null ? { providerRank: row.provider_rank } : {}),
    ...(row.affinity !== null ? { affinity: row.affinity } : {}),
    ...(row.popularity !== null ? { popularity: row.popularity } : {}),
    relatedSignalIds: row.related_signal_ids,
    evidence: readEvidence(row.evidence),
    metadata: isJsonObject(normalized.metadata) ? normalized.metadata : {},
    missingFields: Array.isArray(normalized.missingFields)
      ? normalized.missingFields.filter(isString)
      : [],
    rank: row.opportunity_rank,
    rankingBasis: row.ranking_basis,
    rankingAlgorithmVersion: row.ranking_algorithm_version,
    evidenceCompleteness: row.evidence_completeness,
    caveats: readStringArray(row.caveats),
  }
}

export function serializeLaunchActivationReport(
  row: LaunchActivationReportRow
): SafeLaunchActivationReport | undefined {
  const parsed = launchActivationBriefSchema.safeParse(row.report)
  if (!parsed.success) return undefined
  return {
    schemaVersion: row.schema_version,
    generationMode: row.generation_mode,
    ...(row.model_provider ? { modelProvider: row.model_provider } : {}),
    ...(row.model_id ? { modelId: row.model_id } : {}),
    promptVersion: row.prompt_version,
    generatedAt: row.generated_at,
    brief: parsed.data,
  }
}

function launchStageMessage(
  stage: LaunchWorkflowStage,
  status: SafeLaunchRun["status"]
): string {
  if (status === "completed") return "Launch analysis complete"
  if (status === "failed") return "Launch analysis failed; retry is available"
  const messages: Record<LaunchWorkflowStage, string> = {
    queued: "Waiting to start",
    resolving_inputs: "Resolving brand, product, city, and references",
    researching_market: "Building the city cultural fingerprint",
    discovering_opportunities: "Finding culturally adjacent opportunities",
    generating_brief: "Preparing the evidence-backed activation brief",
  }
  return messages[stage]
}

function readEvidence(value: Json): EvidenceRef[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isJsonObject(item)) return []
    if (
      !isEvidenceSource(item.source) ||
      !isString(item.fieldPath) ||
      !isString(item.observedAt) ||
      !isVerificationState(item.verification)
    )
      return []
    return [
      {
        source: item.source,
        fieldPath: item.fieldPath,
        observedAt: item.observedAt,
        verification: item.verification,
        ...(isString(item.label) ? { label: item.label } : {}),
        ...(isString(item.providerEntityId)
          ? { providerEntityId: item.providerEntityId }
          : {}),
        ...(isString(item.excerpt) ? { excerpt: item.excerpt } : {}),
      },
    ]
  })
}

function isJsonObject(value: Json | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isString(value: Json | undefined): value is string {
  return typeof value === "string"
}

function readStringArray(value: Json | undefined): string[] {
  return Array.isArray(value) ? value.filter(isString) : []
}

function isEvidenceSource(
  value: Json | undefined
): value is EvidenceRef["source"] {
  return value === "qloo" || value === "apify" || value === "user_input" || value === "derived"
}

function isVerificationState(
  value: Json | undefined
): value is EvidenceRef["verification"] {
  return value === "verified" || value === "provider_reported" || value === "unverified"
}

function readMaxAttempts(): number {
  const value = Number(process.env.MAX_ANALYSIS_ATTEMPTS)
  return Number.isInteger(value) && value > 0 ? value : 3
}
