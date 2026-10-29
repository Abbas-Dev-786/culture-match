import type {
  CultureSignal,
  NormalizedCreator,
  QlooAgeRange,
  QlooGender,
  QlooComparisonSummary,
  QlooSignalRecord,
} from "../../domain/types.ts"
import type { QlooClient } from "./client.ts"
import { CULTURAL_TAG_TYPES } from "./query-config.ts"
import { resolveTags } from "./resolve-tags.ts"

export interface QlooCreatorConditioning {
  audienceIds?: string[]
  audienceWeight?: number
  ageRange?: QlooAgeRange
  gender?: QlooGender
}

export interface QlooCreatorEnrichmentOptions {
  creatorIds?: string[]
  maxCreators?: number
  concurrency?: number
  onProgress?: (creator: NormalizedCreator) => Promise<void> | void
}

export async function enrichCreatorsWithQloo(
  creators: NormalizedCreator[],
  locationQuery: string,
  client: QlooClient,
  campaignSignals: CultureSignal[] = [],
  conditioning: QlooCreatorConditioning = {},
  options: QlooCreatorEnrichmentOptions = {}
): Promise<NormalizedCreator[]> {
  const limit = Math.min(
    options.maxCreators ?? creators.length,
    200
  )
  const targetIds = options.creatorIds
    ? new Set(options.creatorIds)
    : undefined
  const targetCreators = targetIds
    ? creators.filter((creator) => targetIds.has(creator.providerCreatorId))
    : creators
  const eligibleIds = new Set(
    targetCreators.slice(0, limit).map((creator) => creator.providerCreatorId)
  )
  const enriched = new Map<string, NormalizedCreator>()
  const cache = new Map<string, QlooSignalRecord[]>()
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 6, 12))
  const reportProgress = async (creatorId: string): Promise<void> => {
    const completed = enriched.get(creatorId)
    if (completed) await options.onProgress?.(completed)
  }
  const personMatches = await discoverPersonMatches(
    targetCreators.slice(0, limit),
    locationQuery,
    campaignSignals,
    conditioning,
    client,
    concurrency
  )

  await mapWithConcurrency(creators, concurrency, async (creator) => {
    if (!eligibleIds.has(creator.providerCreatorId)) {
      enriched.set(creator.providerCreatorId, creator)
      return
    }
    const postContentSignals = creator.contentSignals.filter(
      (signal) => signal.evidenceKind !== "bio" && signal.sourceField !== "$.creator.bio"
    )
    if (postContentSignals.length === 0) {
      enriched.set(
        creator.providerCreatorId,
        applyPersonMatch(creator, personMatches)
      )
      await reportProgress(creator.providerCreatorId)
      return
    }

    const cacheKey = postContentSignals
      .map((signal) => signal.text.trim().toLocaleLowerCase())
      .join("|")
    const cached = cache.get(cacheKey)
    if (cached) {
      enriched.set(
        creator.providerCreatorId,
        applyPersonMatch({ ...creator, qlooSignals: cached }, personMatches)
      )
      await reportProgress(creator.providerCreatorId)
      return
    }

    try {
      const resolved = await resolveTags(
        extractCreatorTagQueries(postContentSignals).slice(0, 10),
        client
      )
      const resolvedTags = resolved.flatMap((tag) =>
        tag.status === "resolved" && tag.tagId && tag.name && tag.evidence
          ? [
              {
                tag: tag.tagId,
                weight: 10,
                name: tag.name,
                types: tag.types ?? [],
                evidence: tag.evidence,
              },
            ]
          : []
      )
      if (resolvedTags.length === 0) {
        cache.set(cacheKey, [])
        enriched.set(
          creator.providerCreatorId,
          applyPersonMatch(creator, personMatches)
        )
        await reportProgress(creator.providerCreatorId)
        return
      }

      const campaignTagSignals = buildCampaignTagSignals(campaignSignals)
      const campaignEntitySignals = campaignSignals
        .filter((signal) => signal.kind === "entity")
        .slice(0, 12)
        .map((signal) => ({
          id: signal.signalId,
          weight: signal.inputWeight ?? 20,
        }))
      const campaignSignalIds = campaignSignals
        .filter((signal) => signal.sourceGroup !== "creator")
        .map((signal) => signal.signalId)
      const payload = await client.getInsights({
        filterType: "urn:tag",
        locationQuery,
        tagTypes: CULTURAL_TAG_TYPES,
        ...(campaignEntitySignals.length > 0
          ? { entitySignals: campaignEntitySignals }
          : {}),
        tagSignals:
          campaignTagSignals.length > 0
            ? campaignTagSignals
            : resolvedTags.map(({ tag, weight }) => ({ tag, weight })),
        filterTags: resolvedTags.map(({ tag }) => tag),
        filterTagsOperator: "union" as const,
        tagOperator: "union",
        take: Math.min(20, resolvedTags.length),
        explainability: true,
      })
      const affinities = readTagAffinities(payload)
      const qlooSignals = resolvedTags.map((tag) => ({
        signalId: tag.tag,
        kind: "tag" as const,
        name: tag.name,
        types: tag.types,
        ...(affinities.get(tag.tag) !== undefined
          ? { affinity: affinities.get(tag.tag) }
          : {}),
        inputWeight: tag.weight,
        sourceGroup: "creator" as const,
        ...(campaignSignalIds.length > 0 ? { campaignSignalIds } : {}),
        evidence: {
          ...tag.evidence,
          fieldPath: "$.creator.contentSignals[]",
          excerpt: tag.name,
        },
      }))
      cache.set(cacheKey, qlooSignals)
      enriched.set(
        creator.providerCreatorId,
        applyPersonMatch(
          {
            ...creator,
            qlooSignals,
          },
          personMatches
        )
      )
      await reportProgress(creator.providerCreatorId)
    } catch {
      enriched.set(creator.providerCreatorId, creator)
      await reportProgress(creator.providerCreatorId)
    }
  })

  return creators.map(
    (creator) => enriched.get(creator.providerCreatorId) ?? creator
  )
}

interface QlooPersonMatch {
  name: string
  entityId: string
  affinity?: number
  popularity?: number
  signals: QlooSignalRecord[]
  campaignComparison?: QlooComparisonSummary
}

async function discoverPersonMatches(
  creators: NormalizedCreator[],
  locationQuery: string,
  campaignSignals: CultureSignal[],
  conditioning: QlooCreatorConditioning,
  client: QlooClient,
  concurrency: number
): Promise<Map<string, QlooPersonMatch>> {
  const matches = new Map<string, QlooPersonMatch>()
  await mapWithConcurrency(creators, concurrency, async (creator) => {
    if (!creator.name.trim()) return
    try {
      const payload = await client.getInsights({
        filterType: "urn:entity:person",
        requestMethod: "POST",
        filterResultsEntitiesQuery: creator.name,
        entitySignals: campaignSignals
          .filter((signal) => signal.kind === "entity")
          .slice(0, 10)
          .map((signal) => ({
            id: signal.signalId,
            weight: signal.inputWeight ?? 20,
          })),
        tagSignals: campaignSignals
          .filter(
            (signal) =>
              signal.kind === "tag" || signal.signalId.startsWith("urn:tag:")
          )
          .slice(0, 10)
          .map((signal) => ({
            tag: signal.signalId,
            weight: signal.inputWeight ?? 10,
          })),
        ...conditioning,
        biasTrends: "high" as const,
        take: 1,
        explainability: true,
      })
      const person = readPersonMatches(payload, creator.name)[0]
      if (person) {
        const campaignEntityIds = campaignSignals
          .filter((signal) => signal.kind === "entity")
          .map((signal) => signal.signalId)
        const campaignComparison =
          campaignEntityIds.length > 0
            ? await compareCreatorToCampaign(
                person.entityId,
                campaignEntityIds,
                locationQuery,
                client
              )
            : undefined
        matches.set(creator.providerCreatorId, {
          ...person,
          ...(campaignComparison ? { campaignComparison } : {}),
        })
      }
    } catch {
      return
    }
  })
  return matches
}

async function mapWithConcurrency<Input>(
  values: Input[],
  concurrency: number,
  worker: (value: Input) => Promise<void>
): Promise<void> {
  let nextIndex = 0
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex
        nextIndex += 1
        await worker(values[index])
      }
    }
  )
  await Promise.all(workers)
}

function applyPersonMatch(
  creator: NormalizedCreator,
  matches: Map<string, QlooPersonMatch>
): NormalizedCreator {
  const match = matches.get(creator.providerCreatorId)
  if (!match) return creator
  return {
    ...creator,
    qlooEntityId: match.entityId,
    ...(match.affinity !== undefined ? { qlooAffinity: match.affinity } : {}),
    ...(match.popularity !== undefined
      ? { qlooPopularity: match.popularity }
      : {}),
    qlooPersonEntityId: match.entityId,
    ...(match.affinity !== undefined
      ? { qlooPersonAffinity: match.affinity }
      : {}),
    ...(match.popularity !== undefined
      ? { qlooPersonPopularity: match.popularity }
      : {}),
    ...(match.signals.length > 0
      ? { qlooPersonSignals: match.signals }
      : {}),
    ...(match.campaignComparison
      ? { qlooCampaignComparison: match.campaignComparison }
      : {}),
    evidence: [
      ...creator.evidence,
      {
        source: "qloo",
        fieldPath: "$.results.entities[]",
        providerEntityId: match.entityId,
        observedAt: new Date().toISOString(),
        verification: "provider_reported",
        excerpt: `${match.name} person-level Qloo validation`,
      },
    ],
  }
}

async function compareCreatorToCampaign(
  creatorEntityId: string,
  campaignEntityIds: string[],
  locationQuery: string,
  client: QlooClient
): Promise<QlooComparisonSummary | undefined> {
  try {
    const payload = await client.compareInsights({
      groupAEntityIds: [creatorEntityId],
      groupBEntityIds: campaignEntityIds,
      locationQuery,
      take: 10,
    })
    return parseCreatorCampaignComparison(payload)
  } catch {
    return undefined
  }
}

function parseCreatorCampaignComparison(
  payload: unknown
): QlooComparisonSummary | undefined {
  if (!isRecord(payload)) return undefined
  const results = payload.results
  const values = Array.isArray(results)
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
    groupA: "creator",
    groupB: "campaign",
    resultCount: topResults.length,
    topResults: topResults.slice(0, 10),
  }
}

function readPersonMatches(payload: unknown, expectedName: string): QlooPersonMatch[] {
  if (!isRecord(payload) || !isRecord(payload.results)) return []
  const values = Array.isArray(payload.results.entities)
    ? payload.results.entities
    : []
  return values.flatMap((value) => {
    if (!isRecord(value)) return []
    const entityId = readString(value.entity_id) ?? readString(value.id)
    const name = readString(value.name)
    if (!entityId || !name) return []
    if (normalizeEntityName(name) !== normalizeEntityName(expectedName)) return []
    const query = isRecord(value.query) ? value.query : value
    const affinity = readNumber(value.affinity) ?? readNumber(query.affinity)
    const popularity =
      readNumber(value.popularity) ?? readNumber(query.popularity)
    const signals = Array.isArray(value.tags)
      ? value.tags.flatMap((tag) => {
          if (!isRecord(tag)) return []
          const signalId = readString(tag.id) ?? readString(tag.tag_id)
          const signalName = readString(tag.name)
          if (!signalId || !signalName) return []
          return [
            {
              signalId,
              kind: "tag" as const,
              name: signalName,
              types: [],
              sourceGroup: "creator" as const,
              evidence: {
                source: "qloo" as const,
                fieldPath: "$.results.entities[].tags[]",
                providerEntityId: entityId,
                observedAt: new Date().toISOString(),
                verification: "provider_reported" as const,
                excerpt: signalName,
              },
            },
          ]
        })
      : []
    return [
      {
        entityId,
        name,
        ...(affinity !== undefined ? { affinity } : {}),
        ...(popularity !== undefined ? { popularity } : {}),
        signals,
      },
    ]
  })
}

function normalizeEntityName(value: string): string {
  return value.trim().toLocaleLowerCase().replaceAll(/[^\p{L}\p{N}]+/gu, " ").trim()
}

function readTagAffinities(payload: unknown): Map<string, number> {
  if (!isRecord(payload) || !isRecord(payload.results)) return new Map()
  const tags = payload.results.tags
  if (!Array.isArray(tags)) return new Map()
  return new Map(
    tags.flatMap((value) => {
      if (!isRecord(value)) return []
      const id = readString(value.tag_id) ?? readString(value.tag_value)
      const query = isRecord(value.query) ? value.query : undefined
      const affinity = query?.affinity
      return id && typeof affinity === "number" ? [[id, affinity] as const] : []
    })
  )
}

function buildCampaignTagSignals(
  signals: CultureSignal[]
): Array<{ tag: string; weight: number }> {
  const preferredGroups = new Set(["combined", "product", "brand", "reference"])
  const candidates = signals.filter(
    (signal) =>
      signal.kind === "tag" &&
      signal.signalId.startsWith("urn:tag:") &&
      (!signal.sourceGroup || preferredGroups.has(signal.sourceGroup))
  )
  const unique = new Map<string, { tag: string; weight: number }>()
  for (const signal of candidates) {
    if (!unique.has(signal.signalId)) {
      unique.set(signal.signalId, {
        tag: signal.signalId,
        weight: signal.inputWeight ?? 10,
      })
    }
  }
  return [...unique.values()].slice(0, 12)
}

function extractCreatorTagQueries(
  signals: NormalizedCreator["contentSignals"]
): string[] {
  const queries = signals.flatMap((signal) => {
    const hashtags = [...signal.text.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map(
      (match) => match[1]
    )
    return hashtags.length > 0 ? hashtags : [signal.text]
  })
  return [...new Set(queries.map((query) => query.trim()).filter(Boolean))]
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
