import type {
  NormalizedCreator,
  QlooSignalRecord,
} from "../../domain/types.ts"
import type { QlooClient } from "./client.ts"
import { resolveTags } from "./resolve-tags.ts"

export async function enrichCreatorsWithQloo(
  creators: NormalizedCreator[],
  locationQuery: string,
  client: QlooClient
): Promise<NormalizedCreator[]> {
  const limit = readCreatorLimit()
  const enriched = new Map<string, NormalizedCreator>()
  const cache = new Map<string, QlooSignalRecord[]>()

  for (const [index, creator] of creators.entries()) {
    if (index >= limit || creator.contentSignals.length === 0) {
      enriched.set(creator.providerCreatorId, creator)
      continue
    }

    const cacheKey = creator.contentSignals
      .map((signal) => signal.text.trim().toLocaleLowerCase())
      .join("|")
    const cached = cache.get(cacheKey)
    if (cached) {
      enriched.set(creator.providerCreatorId, {
        ...creator,
        qlooSignals: cached,
      })
      continue
    }

    try {
      const resolved = await resolveTags(
        creator.contentSignals.slice(0, 5).map((signal) => signal.text),
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
        enriched.set(creator.providerCreatorId, creator)
        continue
      }

      const payload = await client.getInsights({
        filterType: "urn:tag",
        locationQuery,
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
      enriched.set(creator.providerCreatorId, {
        ...creator,
        qlooSignals,
      })
    } catch {
      enriched.set(creator.providerCreatorId, creator)
    }
  }

  return creators.map((creator) => enriched.get(creator.providerCreatorId) ?? creator)
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}
