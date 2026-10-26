import type { EvidenceRef } from "../../domain/types.ts"
import { ProviderError } from "../provider-errors.ts"
import type { QlooClient } from "./client.ts"

export interface ResolvedTag {
  query: string
  status: "resolved" | "ambiguous" | "unresolved"
  tagId?: string
  name?: string
  types?: string[]
  candidates: Array<{ tagId: string; name: string; types: string[] }>
  evidence?: EvidenceRef
}

export async function resolveTags(
  queries: string[],
  client: QlooClient,
  observedAt = new Date().toISOString()
): Promise<ResolvedTag[]> {
  const results: ResolvedTag[] = []
  for (const query of [...new Set(queries.map((value) => value.trim()).filter(Boolean))]) {
    const payload = await client.searchTags({ query, take: 5 })
    const candidates = parseTagCandidates(payload)
    const exactMatches = candidates.filter(
      (candidate) => normalize(candidate.name) === normalize(query)
    )

    if (exactMatches.length === 1) {
      const match = exactMatches[0]
      results.push({
        query,
        status: "resolved",
        tagId: match.tagId,
        name: match.name,
        types: match.types,
        candidates,
        evidence: {
          source: "qloo",
          fieldPath: "$.results[]",
          observedAt,
          verification: "verified",
          providerEntityId: match.tagId,
          excerpt: match.name,
        },
      })
      continue
    }

    results.push({
      query,
      status: exactMatches.length > 1 ? "ambiguous" : "unresolved",
      candidates,
    })
  }
  return results
}

export function parseTagCandidates(
  payload: unknown
): Array<{ tagId: string; name: string; types: string[] }> {
  if (!isRecord(payload)) {
    throw new ProviderError({
      provider: "qloo",
      code: "SCHEMA_MISMATCH",
      message: "Qloo tag search did not contain results",
      retryable: false,
    })
  }

  const resultItems = Array.isArray(payload.results)
    ? payload.results
    : isRecord(payload.results) && Array.isArray(payload.results.tags)
      ? payload.results.tags
      : undefined
  if (!resultItems) {
    throw new ProviderError({
      provider: "qloo",
      code: "SCHEMA_MISMATCH",
      message: "Qloo tag search did not contain results",
      retryable: false,
    })
  }

  return resultItems.flatMap((value) => {
    if (!isRecord(value)) return []
    const tagId = readString(value.tag_id) ?? readString(value.id)
    const name = readString(value.name)
    const types = readStringArray(value.types ?? value.type)
    if (!tagId || !name) return []
    return [{ tagId, name, types }]
  })
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function readStringArray(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : []
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0
      )
    : []
}
