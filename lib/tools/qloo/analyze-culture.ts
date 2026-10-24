import type {
  CampaignBrief,
  CultureSignal,
  JsonObject,
  QlooFingerprint,
  QlooSignalRecord,
} from "../../domain/types.ts"
import { ProviderError } from "../provider-errors.ts"
import type { QlooClient } from "./client.ts"
import {
  entitySignals,
  resolveEntities,
  type ResolvedEntity,
} from "./resolve-entities.ts"
import { resolveTags, type ResolvedTag } from "./resolve-tags.ts"

export interface CultureResearchResult {
  signals: CultureSignal[]
  resolvedReferences: ResolvedEntity[]
  resolvedTags: ResolvedTag[]
  location: {
    name: string
    entityId?: string
    disambiguation?: string
  }
  fingerprint: QlooFingerprint
  providerSummary: JsonObject
  rawPayload?: JsonObject
}

export async function analyzeCulture(
  brief: CampaignBrief,
  client: QlooClient,
  observedAt = new Date().toISOString()
): Promise<CultureResearchResult> {
  const resolvedReferences = await resolveEntities(
    [...new Set([brief.brandName, ...brief.culturalReferences])],
    client,
    observedAt
  )
  const resolvedTags = await resolveTags(
    [brief.productCategory],
    client,
    observedAt
  )
  const locationQuery = buildLocationQuery(brief)
  const payload = await client.getInsights({
    filterType: "urn:tag",
    locationQuery,
    entitySignals: resolvedReferences.flatMap((entity) =>
      entity.status === "resolved" && entity.entityId
        ? [
            {
              entity: entity.entityId,
              weight: entity.reference === brief.brandName ? 30 : 20,
            },
          ]
        : []
    ),
    tagSignals: resolvedTags.flatMap((tag) =>
      tag.status === "resolved" && tag.tagId
        ? [{ tag: tag.tagId, weight: 15 }]
        : []
    ),
    tagOperator: "intersection",
    take: readTake(),
    explainability: true,
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

  const fingerprint = createFingerprint(
    locationQuery,
    parsed.location,
    signals,
    resolvedReferences,
    resolvedTags
  )
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
          tagResolution: resolvedTags.map(resolvedTagToJson),
          locationTaste: payload,
        }
      : undefined

  return {
    signals,
    resolvedReferences,
    resolvedTags,
    location: parsed.location,
    fingerprint,
    providerSummary: {
      locationQuery,
      location: parsed.location,
      resolvedReferences: resolvedReferences.map((entity) => ({
        reference: entity.reference,
        status: entity.status,
        entityId: entity.entityId ?? null,
        name: entity.name ?? null,
        candidates: entity.candidates,
      })),
      unresolvedReferences: resolvedReferences
        .filter((entity) => entity.status !== "resolved")
        .map((entity) => entity.reference),
      resolvedTags: resolvedTags.map(resolvedTagToJson),
      signalCount: signals.length,
      fingerprint: fingerprintToJson(fingerprint),
      insightRequest: {
        filterType: "urn:tag",
        locationQuery,
        entitySignalCount: resolvedReferences.filter(
          (entity) => entity.status === "resolved"
        ).length,
        tagSignalCount: resolvedTags.filter(
          (tag) => tag.status === "resolved"
        ).length,
        tagOperator: "intersection",
        explainability: true,
      },
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
      (isRecord(payload.query)
        ? payload.query.localities ?? payload.query.locality
        : undefined)
  )
  const signals = payload.results.tags.flatMap((tag) =>
    parseSignal(tag, observedAt)
  )
  return { signals, location }
}

function parseSignal(value: unknown, observedAt: string): CultureSignal[] {
  if (!isRecord(value)) return []
  const signalId = readString(value.tag_id) ?? readString(value.tag_value)
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
        providerEntityId: signalId,
        excerpt: name,
      },
      kind: "tag",
      sourceGroup: "market",
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

function createFingerprint(
  locationQuery: string,
  location: CultureResearchResult["location"],
  signals: CultureSignal[],
  references: ResolvedEntity[],
  tags: ResolvedTag[]
): QlooFingerprint {
  const unresolvedInputs = [
    ...references
      .filter((reference) => reference.status !== "resolved")
      .map((reference) => reference.reference),
    ...tags
      .filter((tag) => tag.status !== "resolved")
      .map((tag) => tag.query),
  ]
  const tagInputSignals = tags.flatMap((tag) => {
    if (tag.status !== "resolved" || !tag.tagId || !tag.name || !tag.evidence)
      return []
    return [
      {
        signalId: tag.tagId,
        kind: "tag" as const,
        name: tag.name,
        types: tag.types ?? [],
        inputWeight: 15,
        sourceGroup: "product" as const,
        evidence: tag.evidence,
      },
    ]
  })

  return {
    locationQuery,
    location,
    signals: [...signals.map(signalToRecord), ...tagInputSignals],
    unresolvedInputs,
    tagOperator: "intersection",
    explainabilityRequested: true,
  }
}

function signalToRecord(signal: CultureSignal): QlooSignalRecord {
  return {
    signalId: signal.signalId,
    kind: signal.kind ?? "tag",
    name: signal.name,
    types: signal.types,
    ...(signal.affinity !== undefined ? { affinity: signal.affinity } : {}),
    ...(signal.inputWeight !== undefined
      ? { inputWeight: signal.inputWeight }
      : {}),
    sourceGroup: signal.sourceGroup ?? "market",
    evidence: signal.evidence,
  }
}

function fingerprintToJson(fingerprint: QlooFingerprint): JsonObject {
  return {
    locationQuery: fingerprint.locationQuery,
    location: {
      name: fingerprint.location.name,
      ...(fingerprint.location.entityId
        ? { entityId: fingerprint.location.entityId }
        : {}),
      ...(fingerprint.location.disambiguation
        ? { disambiguation: fingerprint.location.disambiguation }
        : {}),
    },
    signals: fingerprint.signals.map((signal) => ({
      signalId: signal.signalId,
      kind: signal.kind,
      name: signal.name,
      types: signal.types,
      ...(signal.affinity !== undefined ? { affinity: signal.affinity } : {}),
      ...(signal.inputWeight !== undefined
        ? { inputWeight: signal.inputWeight }
        : {}),
      sourceGroup: signal.sourceGroup,
      evidence: {
        source: signal.evidence.source,
        fieldPath: signal.evidence.fieldPath,
        observedAt: signal.evidence.observedAt,
        verification: signal.evidence.verification,
        ...(signal.evidence.label
          ? { label: signal.evidence.label }
          : {}),
        ...(signal.evidence.providerEntityId
          ? { providerEntityId: signal.evidence.providerEntityId }
          : {}),
        ...(signal.evidence.excerpt
          ? { excerpt: signal.evidence.excerpt }
          : {}),
      },
    })),
    unresolvedInputs: fingerprint.unresolvedInputs,
    ...(fingerprint.tagOperator
      ? { tagOperator: fingerprint.tagOperator }
      : {}),
    explainabilityRequested: fingerprint.explainabilityRequested,
  }
}

function resolvedTagToJson(tag: ResolvedTag): JsonObject {
  return {
    query: tag.query,
    status: tag.status,
    ...(tag.tagId ? { tagId: tag.tagId } : {}),
    ...(tag.name ? { name: tag.name } : {}),
    ...(tag.types ? { types: tag.types } : {}),
    candidates: tag.candidates.map((candidate) => ({
      tagId: candidate.tagId,
      name: candidate.name,
      types: candidate.types,
    })),
    ...(tag.evidence
      ? {
          evidence: {
            source: tag.evidence.source,
            fieldPath: tag.evidence.fieldPath,
            observedAt: tag.evidence.observedAt,
            verification: tag.evidence.verification,
            ...(tag.evidence.providerEntityId
              ? { providerEntityId: tag.evidence.providerEntityId }
              : {}),
            ...(tag.evidence.excerpt
              ? { excerpt: tag.evidence.excerpt }
              : {}),
          },
        }
      : {}),
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
