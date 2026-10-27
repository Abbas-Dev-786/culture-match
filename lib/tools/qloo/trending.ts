import type { TrendingEntity } from "../../domain/types.ts"
import type { QlooClient } from "./client.ts"

export async function getTrendingPublicFigures(
  client: QlooClient,
  take = 20,
  locationQuery?: string
): Promise<TrendingEntity[]> {
  const payload = await client.getTrending({
    filterType: "urn:entity:person",
    ...(locationQuery ? { locationQuery } : {}),
    take,
  })
  return parseTrendingEntities(payload).slice(0, take)
}

export function parseTrendingEntities(payload: unknown): TrendingEntity[] {
  const values = readValues(payload)
  return values.flatMap((value) => {
    if (!isRecord(value)) return []
    const entityId = readString(value.entity_id) ?? readString(value.id)
    const name = readString(value.name) ?? readString(value.entity_name)
    const types = readStringArray(value.types)
    if (!entityId || !name) return []
    const query = isRecord(value.query) ? value.query : value
    const affinity = readNumber(value.affinity) ?? readNumber(query.affinity)
    const popularity = readNumber(value.popularity) ?? readNumber(query.popularity)
    const trendScore = readNumber(value.trending) ?? readNumber(query.trending)
    return [{
      entityId,
      name,
      types,
      ...(affinity !== undefined ? { affinity } : {}),
      ...(popularity !== undefined ? { popularity } : {}),
      ...(trendScore !== undefined ? { trendScore } : {}),
    }]
  })
}

function readValues(payload: unknown): unknown[] {
  if (!isRecord(payload)) return []
  if (Array.isArray(payload.results)) return payload.results
  if (isRecord(payload.results)) {
    if (Array.isArray(payload.results.entities)) return payload.results.entities
    if (Array.isArray(payload.results.people)) return payload.results.people
  }
  if (Array.isArray(payload.data)) return payload.data
  return []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}
