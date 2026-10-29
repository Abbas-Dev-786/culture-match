import { z } from "zod"
import {
  ProviderError,
  classifyProviderError,
  type ProviderErrorCode,
} from "../provider-errors.ts"
import {
  qlooEntitySearchResponseSchema,
  qlooInsightsResponseSchema,
  qlooTagSearchResponseSchema,
} from "../../validation/provider-payloads.ts"

type JsonFetcher = (input: string, init?: RequestInit) => Promise<Response>

export interface QlooWeightedEntity {
  id: string
  weight?: number
}

export interface QlooWeightedTag {
  tag: string
  weight?: number
}

export interface QlooInsightsInput {
  filterType: string
  requestMethod?: "GET" | "POST"
  locationQuery?: string
  locationId?: string
  entitySignals?: QlooWeightedEntity[]
  tagSignals?: QlooWeightedTag[]
  tagOperator?: "union" | "intersection"
  filterTagsOperator?: "union" | "intersection"
  audienceIds?: string[]
  audienceWeight?: number
  ageRange?:
    | "24_and_younger"
    | "25_to_29"
    | "25_to_34"
    | "30_to_34"
    | "35_and_younger"
    | "35_to_44"
    | "45_to_54"
    | "36_to_55"
    | "55_and_older"
  gender?: "male" | "female"
  filterTags?: string[]
  tagTypes?: string[]
  filterResultsEntitiesQuery?: string
  biasTrends?: "low" | "medium" | "high"
  popularityMin?: number
  take: number
  explainability?: boolean
}

export interface QlooComparisonInput {
  filterType?: string
  groupAEntityIds: string[]
  groupBEntityIds: string[]
  locationQuery?: string
  take?: number
}

export interface QlooHeatmapInput {
  locationQuery: string
  boundary?: "geohash" | "city" | "neighborhood"
  entityIds?: string[]
  tagIds?: string[]
  audienceIds?: string[]
  audienceWeight?: number
  ageRange?:
    | "24_and_younger"
    | "25_to_29"
    | "25_to_34"
    | "30_to_34"
    | "35_and_younger"
    | "35_to_44"
    | "45_to_54"
    | "36_to_55"
    | "55_and_older"
  gender?: "male" | "female"
  take?: number
}

export interface QlooClient {
  searchEntities(input: {
    query: string
    types: string
    take: number
  }): Promise<unknown>
  searchTags(input: {
    query: string
    take: number
  }): Promise<unknown>
  getInsights(input: QlooInsightsInput): Promise<unknown>
  compareInsights(input: QlooComparisonInput): Promise<unknown>
  getHeatmap(input: QlooHeatmapInput): Promise<unknown>
  getLocationTaste(input: {
    locationQuery: string
    filterType: "urn:tag"
    take: number
    entityIds?: string[]
  }): Promise<unknown>
}

interface QlooClientOptions {
  baseUrl?: string
  searchUrl?: string
  insightsUrl?: string
  compareUrl?: string
  tagsUrl?: string
  apiKey?: string
  fetchImpl?: JsonFetcher
  timeoutMs?: number
  onRequest?: () => void
}

const DEFAULT_TIMEOUT_MS = 20_000
const QLOO_TAG_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1_000
const QLOO_INSIGHTS_CACHE_TTL_MS = 24 * 60 * 60 * 1_000
type QlooCache = Map<string, { expiresAt: number; value: unknown }>

export function createQlooClient(options: QlooClientOptions = {}): QlooClient {
  const config = readQlooConfig(options)
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const cache = new Map<string, { expiresAt: number; value: unknown }>()

  return {
    async searchEntities(input) {
      const url = new URL(config.searchUrl)
      url.searchParams.set("query", input.query)
      url.searchParams.set("types", input.types)
      url.searchParams.set("take", String(input.take))
      return requestProviderJson(
        fetchImpl,
        url,
        config.apiKey,
        config.timeoutMs,
        "qloo",
        qlooEntitySearchResponseSchema,
        {},
        QLOO_TAG_CACHE_TTL_MS,
        cache,
        options.onRequest
      )
    },
    async searchTags(input) {
      const url = new URL(config.tagsUrl)
      url.searchParams.set("filter.query", input.query)
      url.searchParams.set("feature.typo_tolerance", "true")
      url.searchParams.set("feature.semantic_search", "true")
      url.searchParams.set("take", String(input.take))
      return requestProviderJson(
        fetchImpl,
        url,
        config.apiKey,
        config.timeoutMs,
        "qloo",
        qlooTagSearchResponseSchema,
        {},
        QLOO_TAG_CACHE_TTL_MS,
        cache,
        options.onRequest
      )
    },
    async getInsights(input) {
      const url = new URL(config.insightsUrl)
      const usePost =
        input.requestMethod === "POST" ||
        requiresWeightedPost(input.entitySignals) ||
        requiresWeightedPost(input.tagSignals)
      if (!usePost) setInsightsParams(url, input)
      return requestProviderJson(
        fetchImpl,
        url,
        config.apiKey,
        config.timeoutMs,
        "qloo",
        qlooInsightsResponseSchema,
        usePost
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(buildInsightsBody(input)),
            }
          : {},
        QLOO_INSIGHTS_CACHE_TTL_MS,
        cache,
        options.onRequest
      )
    },
    async compareInsights(input) {
      const url = new URL(config.compareUrl)
      url.searchParams.set(
        "a.signal.interests.entities",
        input.groupAEntityIds.join(",")
      )
      url.searchParams.set(
        "b.signal.interests.entities",
        input.groupBEntityIds.join(",")
      )
      if (input.filterType)
        url.searchParams.set("filter.type", input.filterType)
      if (input.locationQuery)
        url.searchParams.set("filter.location.query", input.locationQuery)
      if (input.take !== undefined)
        url.searchParams.set("take", String(input.take))
      return requestProviderJson(
        fetchImpl,
        url,
        config.apiKey,
        config.timeoutMs,
        "qloo",
        z.unknown(),
        {},
        QLOO_INSIGHTS_CACHE_TTL_MS,
        cache,
        options.onRequest
      )
    },
    async getHeatmap(input) {
      const url = new URL(config.insightsUrl)
      url.searchParams.set("filter.type", "urn:heatmap")
      url.searchParams.set("filter.location.query", input.locationQuery)
      url.searchParams.set(
        "output.heatmap.boundary",
        input.boundary ?? "geohash"
      )
      if (input.entityIds && input.entityIds.length > 0)
        url.searchParams.set(
          "signal.interests.entities",
          input.entityIds.join(",")
        )
      if (input.tagIds && input.tagIds.length > 0)
        url.searchParams.set("signal.interests.tags", input.tagIds.join(","))
      if (input.audienceIds && input.audienceIds.length > 0)
        url.searchParams.set(
          "signal.demographics.audiences",
          input.audienceIds.join(",")
        )
      if (input.audienceWeight !== undefined)
        url.searchParams.set(
          "signal.demographics.audiences.weight",
          String(input.audienceWeight)
        )
      if (input.ageRange)
        url.searchParams.set(
          "signal.demographics.age",
          serializeQlooAgeRange(input.ageRange)
        )
      if (input.gender)
        url.searchParams.set("signal.demographics.gender", input.gender)
      if (input.take !== undefined)
        url.searchParams.set("take", String(input.take))
      return requestProviderJson(
        fetchImpl,
        url,
        config.apiKey,
        config.timeoutMs,
        "qloo",
        z.unknown(),
        {},
        QLOO_INSIGHTS_CACHE_TTL_MS,
        cache,
        options.onRequest
      )
    },
    async getLocationTaste(input) {
      if (input.filterType !== "urn:tag") {
        throw new ProviderError({
          provider: "qloo",
          code: "INVALID_PARAMETERS",
          message: "Qloo location research only supports urn:tag filters",
          retryable: false,
        })
      }

      const url = new URL(config.insightsUrl)
      url.searchParams.set("filter.type", input.filterType)
      url.searchParams.set("signal.location.query", input.locationQuery)
      url.searchParams.set("take", String(input.take))
      if (input.entityIds && input.entityIds.length > 0) {
        url.searchParams.set(
          "signal.interests.entities",
          input.entityIds.join(",")
        )
      }
      return requestProviderJson(
        fetchImpl,
        url,
        config.apiKey,
        config.timeoutMs,
        "qloo",
        qlooInsightsResponseSchema,
        {},
        QLOO_INSIGHTS_CACHE_TTL_MS,
        cache,
        options.onRequest
      )
    },
  }
}

function readQlooConfig(options: QlooClientOptions): {
  baseUrl: string
  searchUrl: string
  insightsUrl: string
  compareUrl: string
  tagsUrl: string
  apiKey: string
  timeoutMs: number
} {
  const baseUrl = options.baseUrl ?? process.env.QLOO_BASE_URL
  const searchUrl = options.searchUrl ?? process.env.QLOO_SEARCH_URL
  const insightsUrl = options.insightsUrl ?? process.env.QLOO_INSIGHTS_URL
  const compareUrl = options.compareUrl ?? process.env.QLOO_COMPARE_URL
  const tagsUrl = options.tagsUrl ?? process.env.QLOO_TAGS_URL
  const apiKey = options.apiKey ?? process.env.QLOO_API_KEY

  if (!baseUrl || !searchUrl || !insightsUrl || !apiKey) {
    throw new ProviderError({
      provider: "qloo",
      code: "AUTHENTICATION_FAILED",
      message: "Qloo server configuration is incomplete",
      retryable: false,
    })
  }

  const parsedBase = parseProviderUrl(baseUrl, "Qloo base URL")
  const parsedSearch = parseProviderUrl(searchUrl, "Qloo search URL")
  const parsedInsights = parseProviderUrl(insightsUrl, "Qloo insights URL")
  const parsedCompare = parseProviderUrl(
    compareUrl ?? new URL("/v2/analysis/compare", parsedBase).toString(),
    "Qloo comparison URL"
  )
  const parsedTags = parseProviderUrl(
    tagsUrl ?? new URL("/v2/tags", parsedBase).toString(),
    "Qloo tags URL"
  )
  if (
    parsedSearch.origin !== parsedBase.origin ||
    parsedInsights.origin !== parsedBase.origin ||
    parsedCompare.origin !== parsedBase.origin ||
    parsedTags.origin !== parsedBase.origin
  ) {
    throw new ProviderError({
      provider: "qloo",
      code: "INVALID_PARAMETERS",
      message: "Qloo endpoints must use the configured base URL host",
      retryable: false,
    })
  }

  return {
    baseUrl: parsedBase.toString(),
    searchUrl: parsedSearch.toString(),
    insightsUrl: parsedInsights.toString(),
    compareUrl: parsedCompare.toString(),
    tagsUrl: parsedTags.toString(),
    apiKey,
    timeoutMs: readPositiveInteger(
      options.timeoutMs ?? Number(process.env.QLOO_TIMEOUT_MS),
      DEFAULT_TIMEOUT_MS
    ),
  }
}

function setInsightsParams(url: URL, input: QlooInsightsInput): void {
  url.searchParams.set("filter.type", input.filterType)
  url.searchParams.set("take", String(input.take))
  if (input.filterTags && input.filterTags.length > 0)
    url.searchParams.set("filter.tags", input.filterTags.join(","))
  if (input.filterTagsOperator && input.filterTags && input.filterTags.length > 0)
    url.searchParams.set("operator.filter.tags", input.filterTagsOperator)
  if (input.tagTypes && input.tagTypes.length > 0)
    url.searchParams.set("filter.tag.types", input.tagTypes.join(","))
  if (input.filterResultsEntitiesQuery)
    url.searchParams.set(
      "filter.results.entities.query",
      input.filterResultsEntitiesQuery
    )
  if (input.biasTrends) url.searchParams.set("bias.trends", input.biasTrends)
  if (input.popularityMin !== undefined)
    url.searchParams.set("filter.popularity.min", String(input.popularityMin))
  if (input.locationQuery)
    url.searchParams.set("signal.location.query", input.locationQuery)
  if (input.locationId)
    url.searchParams.set("signal.location", input.locationId)
  if (input.entitySignals && input.entitySignals.length > 0) {
    url.searchParams.set(
      "signal.interests.entities",
      input.entitySignals.map((signal) => signal.id).join(",")
    )
    const weight = sharedWeight(input.entitySignals)
    if (weight !== undefined)
      url.searchParams.set("signal.interests.entities.weight", String(weight))
  }
  if (input.tagSignals && input.tagSignals.length > 0) {
    url.searchParams.set(
      "signal.interests.tags",
      input.tagSignals.map((signal) => signal.tag).join(",")
    )
  }
  if (input.tagOperator && input.tagSignals && input.tagSignals.length > 0)
    url.searchParams.set("operator.signal.interests.tags", input.tagOperator)
  if (input.audienceIds && input.audienceIds.length > 0)
    url.searchParams.set(
      "signal.demographics.audiences",
      input.audienceIds.join(",")
    )
  if (input.audienceWeight !== undefined)
    url.searchParams.set(
      "signal.demographics.audiences.weight",
      String(input.audienceWeight)
    )
  if (input.ageRange)
    url.searchParams.set(
      "signal.demographics.age",
      serializeQlooAgeRange(input.ageRange)
    )
  if (input.gender)
    url.searchParams.set("signal.demographics.gender", input.gender)
  if (input.explainability !== undefined)
    url.searchParams.set("feature.explainability", String(input.explainability))
}

export function serializeQlooAgeRange(
  ageRange: NonNullable<QlooInsightsInput["ageRange"]>
): string {
  if (ageRange === "25_to_34") return "25_to_29,30_to_34"
  return ageRange
}

function requiresWeightedPost(
  signals: QlooWeightedEntity[] | QlooWeightedTag[] | undefined
): boolean {
  return hasDistinctWeights(signals)
}

function hasDistinctWeights(
  signals: QlooWeightedEntity[] | QlooWeightedTag[] | undefined
): boolean {
  if (!signals || signals.length === 0) return false
  const weights = signals.map((signal) => signal.weight)
  return (
    weights.every((weight): weight is number => weight !== undefined) &&
    new Set(weights).size > 1
  )
}

function sharedWeight(signals: QlooWeightedEntity[]): number | undefined {
  const weights = signals.map((signal) => signal.weight)
  if (
    weights.length === 0 ||
    !weights.every((weight): weight is number => weight !== undefined) ||
    new Set(weights).size !== 1
  )
    return undefined
  return weights[0]
}

function buildInsightsBody(input: QlooInsightsInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    "filter.type": input.filterType,
    take: input.take,
  }
  if (input.filterTags && input.filterTags.length > 0)
    body["filter.tags"] = input.filterTags
  if (input.filterTagsOperator)
    body["operator.filter.tags"] = input.filterTagsOperator
  if (input.tagTypes && input.tagTypes.length > 0)
    body["filter.tag.types"] = input.tagTypes
  if (input.filterResultsEntitiesQuery)
    body["filter.results.entities.query"] = [input.filterResultsEntitiesQuery]
  if (input.biasTrends) body["bias.trends"] = input.biasTrends
  if (input.popularityMin !== undefined)
    body["filter.popularity.min"] = input.popularityMin
  if (input.locationQuery)
    body["signal.location.query"] = input.locationQuery
  if (input.locationId) body["signal.location"] = input.locationId
  if (input.entitySignals && input.entitySignals.length > 0)
    body["signal.interests.entities"] = input.entitySignals.map((signal) => ({
      entity: signal.id,
      ...(signal.weight !== undefined ? { weight: signal.weight } : {}),
    }))
  if (input.tagSignals && input.tagSignals.length > 0)
    body["signal.interests.tags"] = input.tagSignals.map((signal) => ({
      tag: signal.tag,
      ...(signal.weight !== undefined ? { weight: signal.weight } : {}),
    }))
  if (input.tagOperator)
    body["operator.signal.interests.tags"] = input.tagOperator
  if (input.audienceIds && input.audienceIds.length > 0)
    body["signal.demographics.audiences"] = input.audienceIds
  if (input.audienceWeight !== undefined)
    body["signal.demographics.audiences.weight"] = input.audienceWeight
  if (input.ageRange)
    body["signal.demographics.age"] = serializeQlooAgeRange(input.ageRange)
  if (input.gender) body["signal.demographics.gender"] = input.gender
  if (input.explainability !== undefined)
    body["feature.explainability"] = input.explainability
  return body
}

function parseProviderUrl(value: string, label: string): URL {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:")
      throw new Error("unsupported protocol")
    return url
  } catch {
    throw new ProviderError({
      provider: "qloo",
      code: "INVALID_PARAMETERS",
      message: `${label} must be an absolute HTTP URL`,
      retryable: false,
    })
  }
}

async function requestProviderJson<T>(
  fetchImpl: JsonFetcher,
  url: URL,
  apiKey: string,
  timeoutMs: number,
  provider: "qloo" | "apify",
  schema: z.ZodType<T>,
  init: RequestInit = {},
  cacheTtlMs = 0,
  cache: QlooCache,
  onRequest?: () => void
): Promise<T> {
  const cacheKey = `${provider}:${url.toString()}:${String(init.body ?? "")}`
  if (cacheTtlMs > 0) {
    const cached = cache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) return cached.value as T
    if (cached) cache.delete(cacheKey)
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    onRequest?.()
    const response = await fetchImpl(url.toString(), {
      ...init,
      headers: {
        Accept: "application/json",
        "X-Api-Key": apiKey,
        ...init.headers,
      },
      signal: controller.signal,
    })
    const body = await readJson(response)

    if (!response.ok) throw providerHttpError(provider, response.status, body)

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      throw new ProviderError({
        provider,
        code: "SCHEMA_MISMATCH",
        message: `${provider} returned an unsupported response shape`,
        retryable: false,
        cause: parsed.error,
      })
    }

    if (cacheTtlMs > 0) {
      cache.set(cacheKey, {
        expiresAt: Date.now() + cacheTtlMs,
        value: parsed.data,
      })
    }
    return parsed.data
  } catch (error) {
    throw classifyProviderError(error, provider)
  } finally {
    clearTimeout(timeout)
  }
}

function providerHttpError(
  provider: "qloo" | "apify",
  status: number,
  body: unknown
): ProviderError {
  const mapping: Record<
    number,
    { code: ProviderErrorCode; retryable: boolean }
  > = {
    400: { code: "INVALID_PARAMETERS", retryable: false },
    401: { code: "AUTHENTICATION_FAILED", retryable: false },
    403: { code: "AUTHENTICATION_FAILED", retryable: false },
    422: { code: "INVALID_PARAMETERS", retryable: false },
    429: { code: "RATE_LIMITED", retryable: true },
  }
  const mapped =
    mapping[status] ??
    (status >= 500
      ? { code: "UPSTREAM_FAILURE" as const, retryable: true }
      : { code: "UPSTREAM_FAILURE" as const, retryable: false })
  return new ProviderError({
    provider,
    code: mapped.code,
    status,
    retryable: mapped.retryable,
    message: `${provider} returned HTTP ${status}${providerErrorDetail(body)}`,
  })
}

function providerErrorDetail(body: unknown): string {
  if (!isRecord(body)) return ""
  const errors = body.errors
  if (Array.isArray(errors)) {
    const messages = errors.flatMap((error) => {
      if (!isRecord(error) || typeof error.message !== "string") return []
      return [error.message.trim()]
    })
    if (messages.length > 0) return `: ${messages.slice(0, 3).join("; ")}`
  }
  return typeof body.message === "string" && body.message.trim()
    ? `: ${body.message.trim()}`
    : ""
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function readPositiveInteger(value: number, fallback: number): number {
  return Number.isInteger(value) && value > 0 ? value : fallback
}
