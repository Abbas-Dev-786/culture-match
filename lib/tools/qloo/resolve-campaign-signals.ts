import type {
  CampaignBrief,
  JsonObject,
  ResearchFocus,
} from "../../domain/types.ts"
import { ProviderError } from "../provider-errors.ts"
import type { QlooClient } from "./client.ts"
import { resolveEntities, type ResolvedEntity } from "./resolve-entities.ts"
import {
  expandTagQueries,
  resolveTags,
  type ResolvedTag,
} from "./resolve-tags.ts"

export interface CampaignSignalResolution {
  resolvedReferences: ResolvedEntity[]
  resolvedTags: ResolvedTag[]
  locationQuery: string
}

export interface CampaignResearchSelection {
  focus: ResearchFocus
  includeBrand: boolean
  references: string[]
  tagQueries: string[]
}

export async function resolveCampaignSignals(
  brief: CampaignBrief,
  client: QlooClient,
  observedAt = new Date().toISOString(),
  selection?: CampaignResearchSelection
): Promise<CampaignSignalResolution> {
  const referenceInputs = selection
    ? [
        ...(selection.includeBrand ? [brief.brandName] : []),
        ...selection.references,
      ]
    : [brief.brandName, ...brief.culturalReferences]
  const resolvedReferences = await resolveEntities(
    [...new Set(referenceInputs)],
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
  const tagQueries = selection
    ? selection.tagQueries
    : [
        brief.productCategory,
        brief.productDescription,
        ...brief.culturalReferences.filter(
          (reference) =>
            !resolvedReferenceNames.has(reference) &&
            !tagFallbackReferences.has(reference)
        ),
      ]
  const searchedTags = await resolveTagsWithFallback(
    expandTagQueries(tagQueries.filter(
      (query, index, queries) =>
        Boolean(query.trim()) && queries.indexOf(query) === index
    )),
    client,
    observedAt
  )

  return {
    resolvedReferences,
    resolvedTags: mergeResolvedTags(fallbackTags, searchedTags),
    locationQuery: buildLocationQuery(brief),
  }
}

export function isCoveredByResolvedTag(
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

export function buildLocationQuery(brief: CampaignBrief): string {
  return [
    brief.targetMarket.city,
    brief.targetMarket.region,
    brief.targetMarket.country,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(", ")
}

export function resolvedTagToJson(tag: ResolvedTag): JsonObject {
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
    ) {
      throw error
    }
    return queries.map((query) => ({
      query,
      status: "unresolved" as const,
      candidates: [],
    }))
  }
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
