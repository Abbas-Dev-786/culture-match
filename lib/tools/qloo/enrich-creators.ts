import type {
  CultureSignal,
  NormalizedCreator,
  QlooAgeRange,
  QlooGender,
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

export async function enrichCreatorsWithQloo(
  creators: NormalizedCreator[],
  locationQuery: string,
  client: QlooClient,
  campaignSignals: CultureSignal[] = [],
  conditioning: QlooCreatorConditioning = {}
): Promise<NormalizedCreator[]> {
  const limit = readCreatorLimit()
  const enriched = new Map<string, NormalizedCreator>()
  const cache = new Map<string, QlooSignalRecord[]>()
  const personMatches = await discoverPersonMatches(
    creators.slice(0, limit),
    campaignSignals,
    conditioning,
    client
  )

  for (const [index, creator] of creators.entries()) {
    if (index >= limit || creator.contentSignals.length === 0) {
      enriched.set(
        creator.providerCreatorId,
        applyPersonMatch(creator, personMatches)
      )
      continue
    }

    const cacheKey = creator.contentSignals
      .map((signal) => signal.text.trim().toLocaleLowerCase())
      .join("|")
    const cached = cache.get(cacheKey)
    if (cached) {
      enriched.set(
        creator.providerCreatorId,
        applyPersonMatch({ ...creator, qlooSignals: cached }, personMatches)
      )
      continue
    }

    try {
      const resolved = await resolveTags(
        extractCreatorTagQueries(creator.contentSignals).slice(0, 10),
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
        continue
      }

      const payload = await client.getInsights({
        filterType: "urn:tag",
        locationQuery,
        tagTypes: CULTURAL_TAG_TYPES,
        tagSignals: resolvedTags.map(({ tag, weight }) => ({ tag, weight })),
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
    } catch {
      enriched.set(creator.providerCreatorId, creator)
    }
  }

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
}

async function discoverPersonMatches(
  creators: NormalizedCreator[],
  campaignSignals: CultureSignal[],
  conditioning: QlooCreatorConditioning,
  client: QlooClient
): Promise<Map<string, QlooPersonMatch>> {
  const matches = new Map<string, QlooPersonMatch>()
  for (const creator of creators) {
    if (!creator.name.trim()) continue
    try {
      const payload = await client.getInsights({
        filterType: "urn:entity:person",
        requestMethod: "POST",
        filterTags: ["urn:tag:genre:person:influencer"],
        filterResultsEntitiesQuery: creator.name,
        biasTrends: "high",
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
        take: 1,
        explainability: true,
      })
      const person = readPersonMatches(payload)[0]
      if (person) matches.set(creator.providerCreatorId, person)
    } catch {
      continue
    }
  }
  return matches
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

function readPersonMatches(payload: unknown): QlooPersonMatch[] {
  if (!isRecord(payload) || !isRecord(payload.results)) return []
  const values = Array.isArray(payload.results.entities)
    ? payload.results.entities
    : []
  return values.flatMap((value) => {
    if (!isRecord(value)) return []
    const entityId = readString(value.entity_id) ?? readString(value.id)
    const name = readString(value.name)
    if (!entityId || !name) return []
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

function readCreatorLimit(): number {
  const value = Number(process.env.QLOO_CREATOR_ENRICH_LIMIT)
  return Number.isInteger(value) && value > 0 ? Math.min(value, 50) : 20
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

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}
