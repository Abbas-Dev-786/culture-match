import type { EvidenceRef } from "../../domain/types.ts"
import { ProviderError } from "../provider-errors.ts"
import type { QlooClient } from "./client.ts"

export interface ResolvedTag {
  query: string
  status: "resolved" | "ambiguous" | "unresolved"
  tagId?: string
  name?: string
  types?: string[]
  candidates: Array<{
    tagId: string
    name: string
    types: string[]
    confidence?: number
  }>
  evidence?: EvidenceRef
}

export async function resolveTags(
  queries: string[],
  client: QlooClient,
  observedAt = new Date().toISOString()
): Promise<ResolvedTag[]> {
  const results: ResolvedTag[] = []
  for (const query of uniqueNonEmpty(queries)) {
    const candidates = []
    let exactMatches: Array<{
      tagId: string
      name: string
      types: string[]
      confidence?: number
    }> =
      []
    for (const searchQuery of tagSearchQueries(query)) {
      try {
        const payload = await client.searchTags({
          query: searchQuery,
          take: 5,
        })
        const searchCandidates = parseTagCandidates(payload)
        candidates.push(...searchCandidates)
        if (exactMatches.length === 0) {
          exactMatches = searchCandidates.filter(
            (candidate) => normalize(candidate.name) === normalize(query)
          )
        }
      } catch (error) {
        if (
          error instanceof ProviderError &&
          [
            "INVALID_PARAMETERS",
            "EMPTY_RESULT",
            "UPSTREAM_FAILURE",
            "SCHEMA_MISMATCH",
          ].includes(error.code)
        ) {
          continue
        }
        throw error
      }
    }
    const uniqueCandidates = candidates.filter(
      (candidate, index, all) =>
        all.findIndex((item) => item.tagId === candidate.tagId) === index
    )
    if (exactMatches.length === 1) {
      const match = exactMatches[0]
      results.push({
        query,
        status: "resolved",
        tagId: match.tagId,
        name: match.name,
        types: match.types,
        candidates: uniqueCandidates,
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

    const semanticMatch = uniqueCandidates[0]
    const semanticConfidence = semanticMatch?.confidence
    const semanticResolutionAllowed =
      Boolean(semanticMatch) &&
      (uniqueCandidates.length === 1 ||
        (semanticConfidence !== undefined && semanticConfidence >= 0.75))
    if (exactMatches.length === 0 && semanticMatch && semanticResolutionAllowed) {
      results.push({
        query,
        status: "resolved",
        tagId: semanticMatch.tagId,
        name: semanticMatch.name,
        types: semanticMatch.types,
        candidates: uniqueCandidates,
        evidence: {
          source: "qloo",
          fieldPath: "$.results[]",
          observedAt,
          verification: "provider_reported",
          providerEntityId: semanticMatch.tagId,
          excerpt: semanticMatch.name,
        },
      })
      continue
    }

    results.push({
      query,
      status:
        exactMatches.length > 1 || uniqueCandidates.length > 1
          ? "ambiguous"
          : "unresolved",
      candidates: uniqueCandidates,
    })
  }
  return results
}

export function expandTagQueries(queries: string[]): string[] {
  const expanded = queries.flatMap((value) => {
    const normalized = value
      .trim()
      .replace(/\beye[\s-]?wears?\b/gi, "eyewear")
      .replace(/\b(?:generation|gen)\s*z\b/gi, "")
      .replace(/\bgenz\b/gi, "")
      .replace(/\s+/g, " ")
      .trim()
    if (!normalized || normalized.split(/\s+/).length <= 3) return [normalized]

    const salient = normalized
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter(
        (token) => !TAG_QUERY_STOP_WORDS.has(token.toLocaleLowerCase())
      )
      .slice(0, 4)
      .join(" ")
    return salient ? [normalized, salient] : [normalized]
  })
  return uniqueNonEmpty(expanded)
}

export function parseTagCandidates(
  payload: unknown
): Array<{
  tagId: string
  name: string
  types: string[]
  confidence?: number
}> {
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
      : Array.isArray(payload.tags)
        ? payload.tags
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
    const name = readString(value.name) ?? readString(value.title)
    const types = readStringArray(value.types ?? value.type)
    if (!tagId || !name) return []
    const confidence =
      readNumber(value.confidence) ??
      readNumber(value.score) ??
      readNumber(value.relevance_score)
    return [
      {
        tagId,
        name,
        types,
        ...(confidence !== undefined ? { confidence } : {}),
      },
    ]
  })
}

function normalize(value: string): string {
  const canonical = value
    .trim()
    .toLocaleLowerCase()
    .replace(/\beye[\s-]?wears?\b/g, "eyewear")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
  if (canonical.endsWith("ies") && canonical.length > 4)
    return `${canonical.slice(0, -3)}y`
  if (canonical.endsWith("s") && canonical.length > 4)
    return canonical.slice(0, -1)
  return canonical
}

function tagSearchQueries(query: string): string[] {
  const normalized = query.trim().toLocaleLowerCase()
  const aliases: Record<string, string> = {
    beaches: "beach",
    parties: "party",
    "eye-wears": "eyewear",
    "eye wears": "eyewear",
  }
  return uniqueNonEmpty([query, aliases[normalized] ?? ""])
}

const TAG_QUERY_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "in",
  "of",
  "premium",
  "the",
  "to",
  "with",
])

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
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

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}
