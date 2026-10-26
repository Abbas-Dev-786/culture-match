import type {
  EvidenceRef,
  JsonObject,
  LaunchAnalysisBrief,
  LaunchOpportunityCandidate,
  QlooFingerprint,
  QlooSignalRecord,
} from "../../domain/types.ts"
import type { Json } from "../../db/database.types.ts"
import { ProviderError } from "../provider-errors.ts"
import type { QlooClient } from "./client.ts"

export interface OpportunityResearchResult {
  opportunities: LaunchOpportunityCandidate[]
  providerSummary: JsonObject
  rawPayload?: JsonObject
}

export async function discoverOpportunities(
  brief: LaunchAnalysisBrief,
  fingerprint: QlooFingerprint,
  client: QlooClient,
  observedAt = new Date().toISOString()
): Promise<OpportunityResearchResult> {
  const combinedSignals = fingerprint.layers.find(
    (layer) => layer.group === "combined"
  )?.signals ?? []
  const entitySignals = combinedSignals.flatMap((signal) =>
    signal.kind === "entity"
      ? [{ id: signal.signalId, weight: signal.inputWeight ?? 20 }]
      : []
  )
  const tagSignals = combinedSignals.flatMap((signal) =>
    signal.kind === "tag"
      ? [{ tag: signal.signalId, weight: signal.inputWeight ?? 15 }]
      : []
  )

  if (entitySignals.length === 0 && tagSignals.length === 0) {
    throw new ProviderError({
      provider: "qloo",
      code: "EMPTY_RESULT",
      message: "The combined cultural fingerprint has no usable Qloo signals",
      retryable: false,
    })
  }

  const payload = await client.getRecommendations({
    filterType: brief.opportunityType,
    locationQuery: `${brief.city}, ${brief.country}`,
    ...(entitySignals.length > 0 ? { entitySignals } : {}),
    ...(tagSignals.length > 0 ? { tagSignals } : {}),
    ...(tagSignals.length > 1 ? { tagOperator: "intersection" as const } : {}),
    take: readOpportunityTake(),
    explainability: true,
  })
  const opportunities = parseOpportunityCandidates(
    payload,
    combinedSignals,
    observedAt
  )

  if (opportunities.length === 0) {
    throw new ProviderError({
      provider: "qloo",
      code: "EMPTY_RESULT",
      message: "Qloo returned no usable opportunities for the selected type",
      retryable: false,
    })
  }

  const providerSummary: JsonObject = {
    filterType: brief.opportunityType,
    locationQuery: `${brief.city}, ${brief.country}`,
    entitySignalCount: entitySignals.length,
    tagSignalCount: tagSignals.length,
    resultCount: opportunities.length,
    observedAt,
  }

  return {
    opportunities,
    providerSummary,
    ...(shouldRetainRaw()
      ? (() => {
          const rawPayload = readJsonObject(payload)
          return rawPayload ? { rawPayload } : {}
        })()
      : {}),
  }
}

export function parseOpportunityCandidates(
  payload: unknown,
  relatedSignals: QlooSignalRecord[],
  observedAt: string
): LaunchOpportunityCandidate[] {
  const values = readResultValues(payload)
  return values.flatMap((value, index) => {
    if (!isRecord(value)) return []
    const entityId = readString(value.entity_id) ?? readString(value.id)
    const name = readString(value.name) ?? readString(value.title)
    if (!entityId || !name) return []

    const query = isRecord(value.query) ? value.query : undefined
    const affinity = readNumber(query?.affinity) ?? readNumber(value.affinity)
    const popularity =
      readNumber(query?.popularity) ?? readNumber(value.popularity)
    const types = readStringArray(value.types)
    const evidence: EvidenceRef = {
      source: "qloo",
      fieldPath: `$.results.entities[${index}]`,
      providerEntityId: entityId,
      observedAt,
      verification: "provider_reported",
      excerpt: name,
    }

    return [
      {
        provider: "qloo",
        entityId,
        name,
        types,
        providerRank: index + 1,
        ...(affinity !== undefined ? { affinity } : {}),
        ...(popularity !== undefined ? { popularity } : {}),
        relatedSignalIds: relatedSignals.map((signal) => signal.signalId),
        metadata: readJsonObject(value.properties) ?? {},
        evidence: [evidence],
        missingFields: [
          ...(types.length === 0 ? ["types"] : []),
          ...(affinity === undefined ? ["affinity"] : []),
          ...(popularity === undefined ? ["popularity"] : []),
        ],
      },
    ]
  })
}

function readResultValues(payload: unknown): unknown[] {
  if (!isRecord(payload) || !isRecord(payload.results)) {
    throw new ProviderError({
      provider: "qloo",
      code: "SCHEMA_MISMATCH",
      message: "Qloo opportunity results did not contain a results object",
      retryable: false,
    })
  }
  const results = payload.results
  if (Array.isArray(results)) return results
  for (const key of ["entities", "places", "brands"]) {
    if (Array.isArray(results[key])) return results[key]
  }
  throw new ProviderError({
    provider: "qloo",
    code: "SCHEMA_MISMATCH",
    message: "Qloo opportunity results did not contain entity results",
    retryable: false,
  })
}

function readOpportunityTake(): number {
  const value = Number(process.env.QLOO_OPPORTUNITY_TAKE)
  return Number.isInteger(value) && value > 0 ? Math.min(value, 50) : 10
}

function shouldRetainRaw(): boolean {
  return process.env.PROVIDER_RETAIN_RAW === "true"
}

function readJsonObject(value: unknown): JsonObject | undefined {
  if (!isRecord(value)) return undefined
  const output: JsonObject = {}
  for (const [key, item] of Object.entries(value)) {
    const normalized = toJson(item)
    if (normalized !== undefined) output[key] = normalized
  }
  return output
}

function toJson(value: unknown): Json | undefined {
  if (value === null) return null
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return value
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const normalized = toJson(item)
      return normalized === undefined ? [] : [normalized]
    })
  }
  if (isRecord(value)) return readJsonObject(value)
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0
      )
    : []
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}
