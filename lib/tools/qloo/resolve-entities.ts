import type { CultureSignal, EvidenceRef } from "../../domain/types.ts"
import { ProviderError } from "../provider-errors.ts"
import type { QlooClient } from "./client.ts"
import { TAG_SEARCH_TYPES } from "./query-config.ts"
import { parseTagCandidates } from "./resolve-tags.ts"

export interface EntityTagFallback {
  tagId: string
  name: string
  types: string[]
  evidence: EvidenceRef
}

export interface ResolvedEntity {
  reference: string
  status: "resolved" | "ambiguous" | "unresolved"
  entityId?: string
  name?: string
  types?: string[]
  candidates: Array<{ entityId: string; name: string; types: string[] }>
  evidence?: EvidenceRef
  tagFallback?: EntityTagFallback
}

export async function resolveEntities(
  references: string[],
  client: QlooClient,
  observedAt = new Date().toISOString(),
  types = "urn:entity:brand"
): Promise<ResolvedEntity[]> {
  const results: ResolvedEntity[] = []

  for (const reference of references) {
    const candidates = []
    let exactMatches: Array<{
      entityId: string
      name: string
      types: string[]
    }> = []
    for (const query of entitySearchQueries(reference)) {
      try {
        const payload = await client.searchEntities({
          query,
          types,
          take: 5,
        })
        const searchCandidates = parseEntityCandidates(payload)
        candidates.push(...searchCandidates)
        if (exactMatches.length === 0) {
          exactMatches = searchCandidates.filter(
            (candidate) => normalize(candidate.name) === normalize(reference)
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
        all.findIndex((item) => item.entityId === candidate.entityId) === index
    )

    if (exactMatches.length === 1) {
      const match = exactMatches[0]
      results.push({
        reference,
        status: "resolved",
        entityId: match.entityId,
        name: match.name,
        types: match.types,
        candidates: uniqueCandidates,
        evidence: {
          source: "qloo",
          fieldPath: "$.results[].entity_id",
          observedAt,
          verification: "verified",
          excerpt: match.name,
        },
      })
      continue
    }

    const tagFallback = await resolveTagFallback(reference, client, observedAt)
    results.push({
      reference,
      status: exactMatches.length > 1 ? "ambiguous" : "unresolved",
      candidates: uniqueCandidates,
      ...(tagFallback ? { tagFallback } : {}),
    })
  }

  return results
}

export function parseEntityCandidates(
  payload: unknown
): Array<{ entityId: string; name: string; types: string[] }> {
  if (!isRecord(payload)) {
    throw new ProviderError({
      provider: "qloo",
      code: "SCHEMA_MISMATCH",
      message: "Qloo entity search did not contain results",
      retryable: false,
    })
  }

  const resultItems = Array.isArray(payload.results)
    ? payload.results
    : isRecord(payload.results) && Array.isArray(payload.results.entities)
      ? payload.results.entities
      : undefined
  if (!resultItems) {
    throw new ProviderError({
      provider: "qloo",
      code: "SCHEMA_MISMATCH",
      message: "Qloo entity search did not contain results",
      retryable: false,
    })
  }

  return resultItems.flatMap((value) => {
    if (!isRecord(value)) return []
    const entityId = readString(value.entity_id)
    const name = readString(value.name) ?? readString(value.title)
    const types = readStringArray(value.types)
    if (!entityId || !name || types.length === 0) return []
    return [{ entityId, name, types }]
  })
}

async function resolveTagFallback(
  reference: string,
  client: QlooClient,
  observedAt: string
): Promise<EntityTagFallback | undefined> {
  try {
    const payload = await client.searchTags({
      query: reference,
      tagTypes: TAG_SEARCH_TYPES,
      take: 5,
    })
    const candidates = parseTagCandidates(payload)
    const exactMatch = candidates.find(
      (candidate) => normalizeTag(candidate.name) === normalizeTag(reference)
    )
    const match = exactMatch ?? candidates[0]
    if (!match) return undefined
    return {
      tagId: match.tagId,
      name: match.name,
      types: match.types,
      evidence: {
        source: "qloo",
        fieldPath: "$.results[]",
        observedAt,
        verification: exactMatch ? "verified" : "provider_reported",
        providerEntityId: match.tagId,
        excerpt: match.name,
      },
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
    )
      return undefined
    throw error
  }
}

function normalizeTag(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/\beye[\s-]?wears?\b/g, "eyewear")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/ies$/, "y")
    .replace(/s$/, "")
}

function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
}

function entitySearchQueries(reference: string): string[] {
  const queries = [reference]
  if (normalize(reference) === "rayban") queries.push("Ray-Ban")
  return [...new Set(queries)]
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

export function entitySignals(entities: ResolvedEntity[]): CultureSignal[] {
  return entities.flatMap((entity) => {
    if (
      entity.status !== "resolved" ||
      !entity.entityId ||
      !entity.name ||
      !entity.evidence
    )
      return []
    return [
      {
        provider: "qloo" as const,
        signalId: entity.entityId,
        name: entity.name,
        types: entity.types ?? [],
        evidence: entity.evidence,
        kind: "entity" as const,
        sourceGroup: "reference" as const,
      },
    ]
  })
}
