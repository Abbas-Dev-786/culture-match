import type { CultureSignal, EvidenceRef } from "../../domain/types.ts"
import { ProviderError } from "../provider-errors.ts"
import type { QlooClient } from "./client.ts"

export interface ResolvedEntity {
  reference: string
  status: "resolved" | "ambiguous" | "unresolved"
  entityId?: string
  name?: string
  types?: string[]
  candidates: Array<{ entityId: string; name: string; types: string[] }>
  evidence?: EvidenceRef
}

export async function resolveEntities(
  references: string[],
  client: QlooClient,
  observedAt = new Date().toISOString(),
  types = "urn:entity:brand"
): Promise<ResolvedEntity[]> {
  const results: ResolvedEntity[] = []

  for (const reference of references) {
    const payload = await client.searchEntities({
      query: reference,
      types,
      take: 5,
    })
    const candidates = parseEntityCandidates(payload)
    const exactMatches = candidates.filter(
      (candidate) => normalize(candidate.name) === normalize(reference)
    )

    if (exactMatches.length === 1) {
      const match = exactMatches[0]
      results.push({
        reference,
        status: "resolved",
        entityId: match.entityId,
        name: match.name,
        types: match.types,
        candidates,
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

    results.push({
      reference,
      status: exactMatches.length > 1 ? "ambiguous" : "unresolved",
      candidates,
    })
  }

  return results
}

export function parseEntityCandidates(
  payload: unknown
): Array<{ entityId: string; name: string; types: string[] }> {
  if (!isRecord(payload) || !Array.isArray(payload.results)) {
    throw new ProviderError({
      provider: "qloo",
      code: "SCHEMA_MISMATCH",
      message: "Qloo entity search did not contain results",
      retryable: false,
    })
  }

  return payload.results.flatMap((value) => {
    if (!isRecord(value)) return []
    const entityId = readString(value.entity_id)
    const name = readString(value.name)
    const types = readStringArray(value.types)
    if (!entityId || !name) return []
    return [{ entityId, name, types }]
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
