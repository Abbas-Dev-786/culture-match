import type {
  CampaignBrief,
  CultureSignal,
  JsonObject,
  QlooFingerprint,
  QlooFingerprintGroup,
  QlooHeatmap,
  QlooComparisonSummary,
  QlooSignalRecord,
} from "../../domain/types.ts"
import { ProviderError } from "../provider-errors.ts"
import type { QlooClient } from "./client.ts"
import { resolveEntities, type ResolvedEntity } from "./resolve-entities.ts"
import {
  expandTagQueries,
  resolveTags,
  type ResolvedTag,
} from "./resolve-tags.ts"
import { CULTURAL_TAG_TYPES, MARKET_TAG_TYPES } from "./query-config.ts"

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
  const resolvedReferenceNames = new Set(
    resolvedReferences
      .filter((reference) => reference.status === "resolved")
      .map((reference) => reference.reference)
  )
  const tagFallbackReferences = new Set(
    resolvedReferences
      .filter((reference) => reference.tagFallback)
      .map((reference) => reference.reference)
  )
  const fallbackTags = resolvedReferences.flatMap((reference) =>
    reference.tagFallback
      ? [tagFallbackToResolvedTag(reference.reference, reference.tagFallback)]
      : []
  )
  const searchedTags = await resolveTagsWithFallback(
    expandTagQueries([
      brief.productCategory,
      brief.productDescription,
      ...brief.culturalReferences.filter(
        (reference) =>
          !resolvedReferenceNames.has(reference) &&
          !tagFallbackReferences.has(reference)
      ),
    ]),
    client,
    observedAt
  )
  const resolvedTags = mergeResolvedTags(fallbackTags, searchedTags)
  const locationQuery = buildLocationQuery(brief)
  const layers = await loadFingerprintLayers(
    brief,
    locationQuery,
    resolvedReferences,
    resolvedTags,
    client,
    observedAt
  )
  const combinedLayer = layers.find((layer) => layer.group === "combined")
  const marketLayer = layers.find((layer) => layer.group === "market")
  let primaryLayer = [combinedLayer, marketLayer].find((layer) =>
    layer?.signals.some(
      (signal) => signal.evidence.fieldPath === "$.results.tags[]"
    )
  )
  if (!primaryLayer) {
    const fallbackPayload = await client.getInsights({
      filterType: "urn:tag",
      locationQuery,
      tagTypes: MARKET_TAG_TYPES,
      popularityMin: 0.9,
      take: readTake(),
      explainability: true,
    })
    const fallbackParsed = parseTasteResponse(
      fallbackPayload,
      observedAt,
      "market"
    )
    const fallbackLayer: FingerprintLayerResult = {
      group: "market",
      label: "Popular market fallback",
      signals: fallbackParsed.signals.map(signalToRecord),
      unresolvedInputs: [],
      location: fallbackParsed.location,
      payload: isJsonObject(fallbackPayload) ? fallbackPayload : {},
      entitySignalCount: 0,
      tagSignalCount: 0,
    }
    layers.push(fallbackLayer)
    primaryLayer = fallbackLayer
  }
  const signalRecords = primaryLayer ? dedupeSignals(primaryLayer.signals) : []
  const signals = signalRecords.map(recordToCultureSignal)

  if (
    !primaryLayer ||
    !primaryLayer.signals.some(
      (signal) => signal.evidence.fieldPath === "$.results.tags[]"
    )
  ) {
    throw new ProviderError({
      provider: "qloo",
      code: "EMPTY_RESULT",
      message: "Qloo returned no usable cultural signals for the target market",
      retryable: false,
    })
  }

  const comparison = await loadComparison(
    brief,
    locationQuery,
    resolvedReferences,
    client
  )
  const heatmap = await loadHeatmap(
    brief,
    locationQuery,
    resolvedReferences,
    resolvedTags,
    client
  )

  const fingerprint = createFingerprint(
    locationQuery,
    primaryLayer.location,
    signals,
    resolvedReferences,
    resolvedTags,
    layers,
    conditioningSummary(brief),
    comparison,
    heatmap
  )
  const payload = primaryLayer.payload
  const rawPayload =
    shouldRetainRaw() && isJsonObject(payload)
      ? {
          entityResolution: resolvedReferences.map((entity) => ({
            reference: entity.reference,
            status: entity.status,
            ...(entity.entityId ? { entityId: entity.entityId } : {}),
            ...(entity.name ? { name: entity.name } : {}),
            ...(entity.tagFallback
              ? {
                  tagFallback: {
                    tagId: entity.tagFallback.tagId,
                    name: entity.tagFallback.name,
                    types: entity.tagFallback.types,
                  },
                }
              : {}),
            candidates: entity.candidates.map((candidate) => ({
              entityId: candidate.entityId,
              name: candidate.name,
              types: candidate.types,
            })),
          })),
          tagResolution: resolvedTags.map(resolvedTagToJson),
          locationTaste: payload,
          layerPayloads: layers.reduce<JsonObject>(
            (result, layer) => ({ ...result, [layer.group]: layer.payload }),
            {}
          ),
        }
      : undefined

  return {
    signals,
    resolvedReferences,
    resolvedTags,
    location: primaryLayer.location,
    fingerprint,
    providerSummary: {
      locationQuery,
      location: primaryLayer.location,
      resolvedReferences: resolvedReferences.map((entity) => ({
        reference: entity.reference,
        status: entity.status,
        entityId: entity.entityId ?? null,
        name: entity.name ?? null,
        tagFallback: entity.tagFallback
          ? {
              tagId: entity.tagFallback.tagId,
              name: entity.tagFallback.name,
              types: entity.tagFallback.types,
            }
          : null,
        candidates: entity.candidates,
      })),
      unresolvedReferences: resolvedReferences
        .filter(
          (entity) =>
            entity.status !== "resolved" &&
            !isCoveredByResolvedTag(entity.reference, resolvedTags)
        )
        .map((entity) => entity.reference),
      resolvedTags: resolvedTags.map(resolvedTagToJson),
      signalCount: signals.length,
      layers: layers.map((layer) => layerToJson(layer)),
      comparison: comparison ? comparisonToJson(comparison) : null,
      heatmap: heatmap ? heatmapToJson(heatmap) : null,
      fingerprint: fingerprintToJson(fingerprint),
      fallbackUsed: primaryLayer.label === "Popular market fallback",
      insightRequest: {
        filterType: "urn:tag",
        locationQuery,
        layerCount: layers.length,
        tagOperator:
          layers.find((layer) => layer.group === "combined")?.operator ??
          "union",
        audienceIds: brief.qlooAudienceIds ?? [],
        audienceWeight: brief.qlooAudienceWeight ?? null,
        ageRange: brief.qlooAgeRange ?? null,
        gender: brief.qlooGender ?? null,
        explainability: true,
      },
      observedAt,
    },
    ...(rawPayload ? { rawPayload } : {}),
  }
}

function tagFallbackToResolvedTag(
  query: string,
  fallback: NonNullable<ResolvedEntity["tagFallback"]>
): ResolvedTag {
  return {
    query,
    status: "resolved",
    tagId: fallback.tagId,
    name: fallback.name,
    types: fallback.types,
    candidates: [
      {
        tagId: fallback.tagId,
        name: fallback.name,
        types: fallback.types,
      },
    ],
    evidence: fallback.evidence,
  }
}

function mergeResolvedTags(
  primary: ResolvedTag[],
  secondary: ResolvedTag[]
): ResolvedTag[] {
  const seen = new Set<string>()
  return [...primary, ...secondary].filter((tag) => {
    const key = tag.tagId ?? `query:${tag.query}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function resolveTagsWithFallback(
  queries: string[],
  client: QlooClient,
  observedAt: string
): Promise<ResolvedTag[]> {
  try {
    return await resolveTags(queries, client, observedAt)
  } catch (error) {
    if (
      !(error instanceof ProviderError) ||
      !["INVALID_PARAMETERS", "UPSTREAM_FAILURE", "SCHEMA_MISMATCH"].includes(
        error.code
      )
    )
      throw error
    return queries.map((query) => ({
      query,
      status: "unresolved" as const,
      candidates: [],
    }))
  }
}

interface FingerprintLayerResult {
  group: QlooFingerprintGroup
  label: string
  signals: QlooSignalRecord[]
  unresolvedInputs: string[]
  operator?: "union" | "intersection"
  entitySignalCount: number
  tagSignalCount: number
  location: CultureResearchResult["location"]
  payload: JsonObject
}

interface LayerSpec {
  group: QlooFingerprintGroup
  label: string
  entitySignals: Array<{ id: string; weight: number }>
  tagSignals: Array<{ tag: string; weight: number }>
  tagTypes: string[]
  operator?: "union" | "intersection"
  unresolvedInputs: string[]
}

async function loadFingerprintLayers(
  brief: CampaignBrief,
  locationQuery: string,
  references: ResolvedEntity[],
  tags: ResolvedTag[],
  client: QlooClient,
  observedAt: string
): Promise<FingerprintLayerResult[]> {
  const brand = references.find(
    (reference) => reference.reference === brief.brandName
  )
  const referenceEntities = references.filter(
    (reference) => reference.reference !== brief.brandName
  )
  const unresolvedReference = (reference: ResolvedEntity) =>
    reference.status !== "resolved" &&
    !isCoveredByResolvedTag(reference.reference, tags)
  const entitySignalsFor = (entities: ResolvedEntity[], weight: number) =>
    entities.flatMap((entity) =>
      entity.status === "resolved" && entity.entityId
        ? [{ id: entity.entityId, weight }]
        : []
    )
  const tagSignals = tags.flatMap((tag) =>
    tag.status === "resolved" && tag.tagId
      ? [{ tag: tag.tagId, weight: 15 }]
      : []
  )
  const unresolved = (
    items: Array<{ status: string; query?: string; reference?: string }>
  ) =>
    items.flatMap((item) =>
      item.status === "resolved"
        ? []
        : [item.query ?? item.reference ?? "unknown"]
    )
  const specs: LayerSpec[] = [
    {
      group: "market",
      label: "Market",
      entitySignals: [],
      tagSignals: [],
      tagTypes: MARKET_TAG_TYPES,
      unresolvedInputs: [],
    },
    {
      group: "brand",
      label: "Brand in market",
      entitySignals: brand ? entitySignalsFor([brand], 30) : [],
      tagSignals: [],
      tagTypes: CULTURAL_TAG_TYPES,
      unresolvedInputs:
        brand && unresolvedReference(brand) ? [brand.reference] : [],
    },
    {
      group: "product",
      label: "Product in market",
      entitySignals: [],
      tagSignals,
      tagTypes: CULTURAL_TAG_TYPES,
      operator: "union",
      unresolvedInputs: unresolved(
        tags.map((tag) => ({ status: tag.status, query: tag.query }))
      ),
    },
    {
      group: "reference",
      label: "References in market",
      entitySignals: entitySignalsFor(referenceEntities, 20),
      tagSignals: [],
      tagTypes: CULTURAL_TAG_TYPES,
      unresolvedInputs: referenceEntities
        .filter(unresolvedReference)
        .map((entity) => entity.reference),
    },
    {
      group: "combined",
      label: "Combined campaign fingerprint",
      entitySignals: entitySignalsFor(references, 20).map((signal) => ({
        ...signal,
        weight: signal.id === brand?.entityId ? 30 : signal.weight,
      })),
      tagSignals,
      tagTypes: CULTURAL_TAG_TYPES,
      operator: getTagOperator(tagSignals.length),
      unresolvedInputs: [
        ...references
          .filter(unresolvedReference)
          .map((entity) => entity.reference),
        ...unresolved(
          tags.map((tag) => ({ status: tag.status, query: tag.query }))
        ),
      ],
    },
  ]

  const results: FingerprintLayerResult[] = []
  for (const spec of specs) {
    const operator = spec.tagSignals.length > 0 ? spec.operator : undefined
    const payload = await client.getInsights({
      filterType: "urn:tag",
      locationQuery,
      entitySignals: spec.entitySignals,
      tagSignals: spec.tagSignals,
      tagTypes: spec.tagTypes,
      ...(operator ? { tagOperator: operator } : {}),
      ...conditioningInput(brief),
      take: readTake(),
      explainability: true,
    })
    const parsed = parseTasteResponse(payload, observedAt, spec.group)
    const inputSignals = [
      ...entityInputSignals(references, spec.group, spec.entitySignals),
      ...tagInputSignals(tags, spec.group, spec.tagSignals),
    ]
    results.push({
      ...spec,
      operator,
      signals: dedupeSignals([
        ...inputSignals.map(signalToRecord),
        ...parsed.signals.map(signalToRecord),
      ]),
      location: parsed.location,
      payload: isJsonObject(payload) ? payload : {},
      entitySignalCount: spec.entitySignals.length,
      tagSignalCount: spec.tagSignals.length,
    })
  }
  return results
}

function conditioningInput(brief: CampaignBrief) {
  const ageRange = brief.qlooAgeRange ?? inferAgeRange(brief)
  return {
    ...(brief.qlooAudienceIds && brief.qlooAudienceIds.length > 0
      ? { audienceIds: brief.qlooAudienceIds }
      : {}),
    ...(brief.qlooAudienceWeight !== undefined
      ? { audienceWeight: brief.qlooAudienceWeight }
      : {}),
    ...(ageRange ? { ageRange } : {}),
    ...(brief.qlooGender ? { gender: brief.qlooGender } : {}),
  }
}

function inferAgeRange(brief: CampaignBrief): "24_and_younger" | undefined {
  const input = [brief.productDescription, ...brief.culturalReferences].join(
    " "
  )
  return /\b(?:genz|gen\s*z|generation\s*z)\b/i.test(input)
    ? "24_and_younger"
    : undefined
}

export function getTagOperator(
  resolvedTagCount: number
): "union" | "intersection" {
  return resolvedTagCount >= 5 ? "intersection" : "union"
}

function entityInputSignals(
  references: ResolvedEntity[],
  group: QlooFingerprintGroup,
  inputs: Array<{ id: string; weight: number }>
): CultureSignal[] {
  return references.flatMap((reference) => {
    if (
      reference.status !== "resolved" ||
      !reference.entityId ||
      !reference.name ||
      !reference.evidence ||
      !inputs.some((input) => input.id === reference.entityId)
    )
      return []
    const input = inputs.find(
      (candidate) => candidate.id === reference.entityId
    )
    return [
      {
        provider: "qloo" as const,
        signalId: reference.entityId,
        name: reference.name,
        types: reference.types ?? [],
        kind: "entity" as const,
        inputWeight: input?.weight,
        sourceGroup: group,
        evidence: reference.evidence,
      },
    ]
  })
}

function tagInputSignals(
  tags: ResolvedTag[],
  group: QlooFingerprintGroup,
  inputs: Array<{ tag: string; weight: number }>
): CultureSignal[] {
  return tags.flatMap((tag) => {
    if (
      tag.status !== "resolved" ||
      !tag.tagId ||
      !tag.name ||
      !tag.evidence ||
      !inputs.some((input) => input.tag === tag.tagId)
    )
      return []
    const input = inputs.find((candidate) => candidate.tag === tag.tagId)
    return [
      {
        provider: "qloo" as const,
        signalId: tag.tagId,
        name: tag.name,
        types: tag.types ?? [],
        kind: "tag" as const,
        inputWeight: input?.weight,
        sourceGroup: group,
        evidence: tag.evidence,
      },
    ]
  })
}

async function loadComparison(
  brief: CampaignBrief,
  locationQuery: string,
  references: ResolvedEntity[],
  client: QlooClient
): Promise<QlooComparisonSummary | undefined> {
  const brand = references.find(
    (reference) =>
      reference.reference === brief.brandName &&
      reference.status === "resolved" &&
      reference.entityId
  )
  const referenceIds = references
    .filter(
      (reference) =>
        reference.reference !== brief.brandName &&
        reference.status === "resolved" &&
        reference.entityId
    )
    .flatMap((reference) => (reference.entityId ? [reference.entityId] : []))
  if (!brand?.entityId || referenceIds.length === 0) return undefined

  try {
    const payload = await client.compareInsights({
      groupAEntityIds: [brand.entityId],
      groupBEntityIds: referenceIds,
      locationQuery,
      take: readTake(),
    })
    return parseComparisonResponse(payload, "Brand", "Cultural references")
  } catch {
    return undefined
  }
}

async function loadHeatmap(
  brief: CampaignBrief,
  locationQuery: string,
  references: ResolvedEntity[],
  tags: ResolvedTag[],
  client: QlooClient
): Promise<QlooHeatmap | undefined> {
  if (process.env.QLOO_ENABLE_HEATMAP !== "true") return undefined
  try {
    const payload = await client.getHeatmap({
      locationQuery,
      boundary: readHeatmapBoundary(),
      entityIds: references.flatMap((reference) =>
        reference.status === "resolved" && reference.entityId
          ? [reference.entityId]
          : []
      ),
      tagIds: tags.flatMap((tag) =>
        tag.status === "resolved" && tag.tagId ? [tag.tagId] : []
      ),
      ...conditioningInput(brief),
      take: readHeatmapTake(),
    })
    return parseHeatmapResponse(payload)
  } catch {
    return undefined
  }
}

function parseComparisonResponse(
  payload: unknown,
  groupA: string,
  groupB: string
): QlooComparisonSummary {
  const results = isRecord(payload) ? payload.results : undefined
  const values: unknown[] = Array.isArray(results)
    ? results
    : isRecord(results) && Array.isArray(results.tags)
      ? results.tags
      : isRecord(results) && Array.isArray(results.entities)
        ? results.entities
        : []
  const topResults = values.flatMap((value) => {
    if (!isRecord(value)) return []
    const signalId =
      readString(value.entity_id) ??
      readString(value.tag_id) ??
      readString(value.tag_value) ??
      readString(value.id)
    if (!signalId) return []
    const query = isRecord(value.query) ? value.query : undefined
    const affinity =
      query && typeof query.affinity === "number"
        ? query.affinity
        : typeof value.affinity === "number"
          ? value.affinity
          : undefined
    return [
      {
        signalId,
        ...(readString(value.name) ? { name: readString(value.name) } : {}),
        types: readStringArray(value.types),
        ...(affinity !== undefined ? { affinity } : {}),
      },
    ]
  })
  return {
    groupA,
    groupB,
    resultCount: topResults.length,
    topResults: topResults.slice(0, 10),
  }
}

function parseHeatmapResponse(payload: unknown): QlooHeatmap | undefined {
  if (!isRecord(payload) || !isRecord(payload.results)) return undefined
  const values = payload.results.heatmap
  if (!Array.isArray(values)) return undefined
  const points = values.flatMap((value) => {
    if (!isRecord(value) || !isRecord(value.location)) return []
    const latitude = value.location.latitude
    const longitude = value.location.longitude
    if (typeof latitude !== "number" || typeof longitude !== "number") return []
    const query = isRecord(value.query) ? value.query : undefined
    return [
      {
        latitude,
        longitude,
        ...(readString(value.location.geohash)
          ? { geohash: readString(value.location.geohash) }
          : {}),
        ...(query && typeof query.affinity === "number"
          ? { affinity: query.affinity }
          : {}),
        ...(query && typeof query.affinity_rank === "number"
          ? { affinityRank: query.affinity_rank }
          : {}),
        ...(query && typeof query.popularity === "number"
          ? { popularity: query.popularity }
          : {}),
      },
    ]
  })
  return points.length > 0
    ? { boundary: readHeatmapBoundary(), points }
    : undefined
}

function layerToJson(layer: FingerprintLayerResult): JsonObject {
  return {
    group: layer.group,
    label: layer.label,
    signals: layer.signals.map(signalRecordToJson),
    unresolvedInputs: layer.unresolvedInputs,
    ...(layer.operator ? { operator: layer.operator } : {}),
    entitySignalCount: layer.entitySignalCount,
    tagSignalCount: layer.tagSignalCount,
  }
}

function comparisonToJson(comparison: QlooComparisonSummary): JsonObject {
  return {
    groupA: comparison.groupA,
    groupB: comparison.groupB,
    resultCount: comparison.resultCount,
    topResults: comparison.topResults.map((result) => ({
      signalId: result.signalId,
      ...(result.name ? { name: result.name } : {}),
      types: result.types,
      ...(result.affinity !== undefined ? { affinity: result.affinity } : {}),
    })),
  }
}

function heatmapToJson(heatmap: QlooHeatmap): JsonObject {
  return {
    boundary: heatmap.boundary,
    points: heatmap.points.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      ...(point.geohash ? { geohash: point.geohash } : {}),
      ...(point.affinity !== undefined ? { affinity: point.affinity } : {}),
      ...(point.affinityRank !== undefined
        ? { affinityRank: point.affinityRank }
        : {}),
      ...(point.popularity !== undefined
        ? { popularity: point.popularity }
        : {}),
    })),
  }
}

function signalRecordToJson(signal: QlooSignalRecord): JsonObject {
  return {
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
      ...(signal.evidence.providerEntityId
        ? { providerEntityId: signal.evidence.providerEntityId }
        : {}),
      ...(signal.evidence.excerpt ? { excerpt: signal.evidence.excerpt } : {}),
    },
  }
}

function parseTasteResponse(
  payload: unknown,
  observedAt: string,
  sourceGroup: QlooFingerprintGroup
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
        ? (payload.query.localities ?? payload.query.locality)
        : undefined)
  )
  const signals = payload.results.tags.flatMap((tag) =>
    parseSignal(tag, observedAt, sourceGroup)
  )
  return { signals, location }
}

function parseSignal(
  value: unknown,
  observedAt: string,
  sourceGroup: QlooFingerprintGroup
): CultureSignal[] {
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
      sourceGroup,
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
  tags: ResolvedTag[],
  layers: FingerprintLayerResult[],
  conditioning: QlooFingerprint["conditioning"],
  comparison?: QlooComparisonSummary,
  heatmap?: QlooHeatmap
): QlooFingerprint {
  const unresolvedInputs = [
    ...references
      .filter(
        (reference) =>
          reference.status !== "resolved" &&
          !isCoveredByResolvedTag(reference.reference, tags)
      )
      .map((reference) => reference.reference),
    ...tags.filter((tag) => tag.status !== "resolved").map((tag) => tag.query),
  ]
  const tagOperator = layers.find(
    (layer) => layer.group === "combined"
  )?.operator
  return {
    locationQuery,
    location,
    signals: signals.map(signalToRecord),
    layers: layers.map((layer) => ({
      group: layer.group,
      label: layer.label,
      signals: layer.signals,
      unresolvedInputs: layer.unresolvedInputs,
      ...(layer.operator ? { operator: layer.operator } : {}),
      entitySignalCount: layer.entitySignalCount,
      tagSignalCount: layer.tagSignalCount,
    })),
    unresolvedInputs,
    ...(conditioning ? { conditioning } : {}),
    ...(tagOperator ? { tagOperator } : {}),
    explainabilityRequested: true,
    ...(comparison ? { comparison } : {}),
    ...(heatmap ? { heatmap } : {}),
  }
}

function isCoveredByResolvedTag(
  reference: string,
  tags: ResolvedTag[]
): boolean {
  const normalizedReference = normalizeLabel(reference)
  return tags.some(
    (tag) =>
      tag.status === "resolved" &&
      normalizeLabel(tag.query) === normalizedReference
  )
}

function normalizeLabel(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/\beye[\s-]?wears?\b/g, "eyewear")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/ies$/, "y")
    .replace(/s$/, "")
}

function conditioningSummary(
  brief: CampaignBrief
): QlooFingerprint["conditioning"] {
  if (
    (!brief.qlooAudienceIds || brief.qlooAudienceIds.length === 0) &&
    brief.qlooAgeRange === undefined &&
    brief.qlooGender === undefined
  )
    return undefined
  return {
    audienceIds: brief.qlooAudienceIds ?? [],
    ...(brief.qlooAudienceWeight !== undefined
      ? { audienceWeight: brief.qlooAudienceWeight }
      : {}),
    ...(brief.qlooAgeRange ? { ageRange: brief.qlooAgeRange } : {}),
    ...(brief.qlooGender ? { gender: brief.qlooGender } : {}),
  }
}

function dedupeSignals(signals: QlooSignalRecord[]): QlooSignalRecord[] {
  const seen = new Set<string>()
  return signals.filter((signal) => {
    const key = `${signal.sourceGroup}:${signal.signalId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
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

function recordToCultureSignal(signal: QlooSignalRecord): CultureSignal {
  return {
    provider: "qloo",
    signalId: signal.signalId,
    name: signal.name,
    types: signal.types,
    ...(signal.affinity !== undefined ? { affinity: signal.affinity } : {}),
    ...(signal.inputWeight !== undefined
      ? { inputWeight: signal.inputWeight }
      : {}),
    kind: signal.kind,
    sourceGroup: signal.sourceGroup,
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
    signals: fingerprint.signals.map(signalRecordToJson),
    layers: fingerprint.layers.map((layer) => ({
      group: layer.group,
      label: layer.label,
      signals: layer.signals.map(signalRecordToJson),
      unresolvedInputs: layer.unresolvedInputs,
      ...(layer.operator ? { operator: layer.operator } : {}),
      entitySignalCount: layer.entitySignalCount,
      tagSignalCount: layer.tagSignalCount,
    })),
    unresolvedInputs: fingerprint.unresolvedInputs,
    ...(fingerprint.conditioning
      ? {
          conditioning: {
            audienceIds: fingerprint.conditioning.audienceIds,
            ...(fingerprint.conditioning.audienceWeight !== undefined
              ? { audienceWeight: fingerprint.conditioning.audienceWeight }
              : {}),
            ...(fingerprint.conditioning.ageRange
              ? { ageRange: fingerprint.conditioning.ageRange }
              : {}),
            ...(fingerprint.conditioning.gender
              ? { gender: fingerprint.conditioning.gender }
              : {}),
          },
        }
      : {}),
    ...(fingerprint.tagOperator
      ? { tagOperator: fingerprint.tagOperator }
      : {}),
    explainabilityRequested: fingerprint.explainabilityRequested,
    ...(fingerprint.comparison
      ? { comparison: comparisonToJson(fingerprint.comparison) }
      : {}),
    ...(fingerprint.heatmap
      ? { heatmap: heatmapToJson(fingerprint.heatmap) }
      : {}),
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
            ...(tag.evidence.excerpt ? { excerpt: tag.evidence.excerpt } : {}),
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

function readHeatmapTake(): number {
  const value = Number(process.env.QLOO_HEATMAP_TAKE)
  return Number.isInteger(value) && value > 0 && value <= 500 ? value : 100
}

function readHeatmapBoundary(): "geohash" | "city" | "neighborhood" {
  const value = process.env.QLOO_HEATMAP_BOUNDARY
  return value === "city" || value === "neighborhood" ? value : "geohash"
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
