import type {
  CampaignBrief,
  CultureSignal,
  JsonObject,
} from "../../domain/types.ts"
import { ProviderError } from "../provider-errors.ts"
import type { QlooClient } from "./client.ts"
import {
  entitySignals,
  resolveEntities,
  type ResolvedEntity,
} from "./resolve-entities.ts"

export interface CultureResearchResult {
  signals: CultureSignal[]
  resolvedReferences: ResolvedEntity[]
  location: {
    name: string
    entityId?: string
    disambiguation?: string
  }
  providerSummary: JsonObject
  rawPayload?: JsonObject
}

export async function analyzeCulture(
  brief: CampaignBrief,
  client: QlooClient,
  observedAt = new Date().toISOString()
): Promise<CultureResearchResult> {
  const resolvedReferences = await resolveEntities(
    brief.culturalReferences,
    client,
    observedAt
  )
  const locationQuery = buildLocationQuery(brief)
  const payload = await client.getLocationTaste({
    locationQuery,
    filterType: "urn:tag",
    take: readTake(),
    entityIds: resolvedReferences.flatMap((entity) =>
      entity.status === "resolved" && entity.entityId ? [entity.entityId] : []
    ),
  })
  const parsed = parseTasteResponse(payload, observedAt)
  const signals = [...entitySignals(resolvedReferences), ...parsed.signals]

  if (parsed.signals.length === 0) {
    throw new ProviderError({
      provider: "qloo",
      code: "EMPTY_RESULT",
      message: "Qloo returned no usable cultural signals for the target market",
      retryable: false,
    })
  }

  const rawPayload =
    shouldRetainRaw() && isJsonObject(payload)
      ? {
          entityResolution: resolvedReferences.map((entity) => ({
            reference: entity.reference,
            status: entity.status,
            ...(entity.entityId ? { entityId: entity.entityId } : {}),
            ...(entity.name ? { name: entity.name } : {}),
            candidates: entity.candidates.map((candidate) => ({
              entityId: candidate.entityId,
              name: candidate.name,
              types: candidate.types,
            })),
          })),
          locationTaste: payload,
        }
      : undefined

  return {
    signals,
    resolvedReferences,
    location: parsed.location,
    providerSummary: {
      locationQuery,
      resolvedReferences: resolvedReferences.map((entity) => ({
        reference: entity.reference,
        status: entity.status,
        entityId: entity.entityId ?? null,
        name: entity.name ?? null,
      })),
      unresolvedReferences: resolvedReferences
        .filter((entity) => entity.status !== "resolved")
        .map((entity) => entity.reference),
      signalCount: signals.length,
      observedAt,
    },
    ...(rawPayload ? { rawPayload } : {}),
  }
}

function parseTasteResponse(
  payload: unknown,
  observedAt: string
): {
  signals: CultureSignal[]
  location: CultureResearchResult["location"]
} {
  if (
    !isRecord(payload) ||
    !isRecord(payload.results) ||
    !Array.isArray(payload.results.tags)
  ) {
    throw new ProviderError({
      provider: "qloo",
      code: "SCHEMA_MISMATCH",
      message: "Qloo taste analysis did not contain tag results",
      retryable: false,
    })
  }

  const location = parseLocation(
    payload.localities ??
      payload.results.localities ??
      (isRecord(payload.query) ? payload.query.localities : undefined)
  )
  const signals = payload.results.tags.flatMap((tag) =>
    parseSignal(tag, observedAt)
  )
  return { signals, location }
}

function parseSignal(value: unknown, observedAt: string): CultureSignal[] {
  if (!isRecord(value)) return []
  const signalId = readString(value.tag_id)
  const name = readString(value.name)
  const types = readStringArray(value.types)
  const query = isRecord(value.query) ? value.query : undefined
  const affinity =
    query && typeof query.affinity === "number" ? query.affinity : undefined

  if (!signalId || !name || types.length === 0) return []
  return [
    {
      provider: "qloo",
      signalId,
      name,
      types,
      ...(affinity !== undefined ? { affinity } : {}),
      evidence: {
        source: "qloo",
        fieldPath: "$.results.tags[]",
        observedAt,
        verification: "provider_reported",
        excerpt: name,
      },
    },
  ]
}

function parseLocation(value: unknown): CultureResearchResult["location"] {
  if (!isRecord(value) || !isRecord(value.signal)) {
    throw new ProviderError({
      provider: "qloo",
      code: "SCHEMA_MISMATCH",
      message: "Qloo taste analysis did not resolve the requested locality",
      retryable: false,
    })
  }
  const entityId = readString(value.signal.entity_id)
  const name = readString(value.signal.name)
  if (!name) {
    throw new ProviderError({
      provider: "qloo",
      code: "SCHEMA_MISMATCH",
      message: "Qloo locality response is missing a name",
      retryable: false,
    })
  }
  const disambiguation = readString(value.signal.disambiguation)
  return {
    name,
    ...(entityId ? { entityId } : {}),
    ...(disambiguation ? { disambiguation } : {}),
  }
}

function buildLocationQuery(brief: CampaignBrief): string {
  return [
    brief.targetMarket.city,
    brief.targetMarket.region,
    brief.targetMarket.country,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(", ")
}

function readTake(): number {
  const value = Number(process.env.QLOO_INSIGHTS_TAKE)
  return Number.isInteger(value) && value > 0 && value <= 100 ? value : 10
}

function shouldRetainRaw(): boolean {
  return process.env.PROVIDER_RETAIN_RAW === "true"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isJsonObject(value: unknown): value is JsonObject {
  return isRecord(value)
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
