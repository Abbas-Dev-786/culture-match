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
  locationQuery?: string
  locationId?: string
  entitySignals?: QlooWeightedEntity[]
  tagSignals?: QlooWeightedTag[]
  tagOperator?: "union" | "intersection"
  audienceIds?: string[]
  audienceWeight?: number
  ageRange?: "35_and_younger" | "36_to_55" | "55_and_older"
  gender?: "male" | "female"
  take: number
  explainability?: boolean
}

export interface QlooRecommendationInput
  extends Omit<QlooInsightsInput, "filterType"> {
  filterType: string
}

export interface QlooComparisonInput {
  filterType: string
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
  ageRange?: "35_and_younger" | "36_to_55" | "55_and_older"
  gender?: "male" | "female"
  take?: number
}

export interface QlooClient {
  searchEntities(input: {
    query: string
    types: string
    take: number
  }): Promise<unknown>
  searchTags(input: { query: string; take: number }): Promise<unknown>
  getInsights(input: QlooInsightsInput): Promise<unknown>
  getRecommendations(input: QlooRecommendationInput): Promise<unknown>
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
}

const DEFAULT_TIMEOUT_MS = 60_000
export function createQlooClient(options: QlooClientOptions = {}): QlooClient {
  const config = readQlooConfig(options)
  const fetchImpl = options.fetchImpl ?? globalThis.fetch

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
        qlooEntitySearchResponseSchema
      )
    },
    async searchTags(input) {
      const url = new URL(config.tagsUrl)
      // Qloo's tag search route uses the Insights-style filter namespace.
      // `query` is accepted by entity search but returns HTTP 400 here.
      url.searchParams.set("filter.query", input.query)
      url.searchParams.set("take", String(input.take))
      return requestProviderJson(
        fetchImpl,
        url,
        config.apiKey,
        config.timeoutMs,
        "qloo",
        qlooTagSearchResponseSchema
      )
    },
    async getInsights(input) {
      const body: Record<string, unknown> = {
        "filter.type": input.filterType,
        take: input.take,
        ...(input.locationQuery
          ? { "filter.location.query": input.locationQuery }
          : {}),
        ...(input.locationId ? { "signal.location": input.locationId } : {}),
        ...(input.entitySignals && input.entitySignals.length > 0
          ? { "signal.interests.entities": input.entitySignals }
          : {}),
        ...(input.tagSignals && input.tagSignals.length > 0
          ? { "signal.interests.tags": input.tagSignals }
          : {}),
        ...(input.tagOperator && input.tagSignals && input.tagSignals.length > 0
          ? { "operator.signal.interests.tags": input.tagOperator }
          : {}),
        ...(input.audienceIds && input.audienceIds.length > 0
          ? { "signal.demographics.audiences": input.audienceIds.join(",") }
          : {}),
        ...(input.audienceWeight !== undefined
          ? { "signal.demographics.audiences.weight": input.audienceWeight }
          : {}),
        ...(input.ageRange
          ? { "signal.demographics.age": input.ageRange }
          : {}),
        ...(input.gender
          ? { "signal.demographics.gender": input.gender }
          : {}),
        ...(input.explainability !== undefined
          ? { "feature.explainability": input.explainability }
          : {}),
      }
      return requestProviderJson(
        fetchImpl,
        new URL(config.insightsUrl),
        config.apiKey,
        config.timeoutMs,
        "qloo",
        qlooInsightsResponseSchema,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      )
    },
    async getRecommendations(input) {
      const body: Record<string, unknown> = {
        "filter.type": input.filterType,
        take: input.take,
        ...(input.locationQuery
          ? { "filter.location.query": input.locationQuery }
          : {}),
        ...(input.locationId ? { "filter.location": input.locationId } : {}),
        ...(input.entitySignals && input.entitySignals.length > 0
          ? { "signal.interests.entities": input.entitySignals }
          : {}),
        ...(input.tagSignals && input.tagSignals.length > 0
          ? { "signal.interests.tags": input.tagSignals }
          : {}),
        ...(input.tagOperator && input.tagSignals && input.tagSignals.length > 0
          ? { "operator.signal.interests.tags": input.tagOperator }
          : {}),
        ...(input.audienceIds && input.audienceIds.length > 0
          ? { "signal.demographics.audiences": input.audienceIds.join(",") }
          : {}),
        ...(input.audienceWeight !== undefined
          ? { "signal.demographics.audiences.weight": input.audienceWeight }
          : {}),
        ...(input.ageRange
          ? { "signal.demographics.age": input.ageRange }
          : {}),
        ...(input.gender
          ? { "signal.demographics.gender": input.gender }
          : {}),
        ...(input.explainability !== undefined
          ? { "feature.explainability": input.explainability }
          : {}),
      }
      return requestProviderJson(
        fetchImpl,
        new URL(config.insightsUrl),
        config.apiKey,
        config.timeoutMs,
        "qloo",
        z.unknown(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
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
      url.searchParams.set("filter.type", input.filterType)
      if (input.locationQuery)
        url.searchParams.set("filter.location.query", input.locationQuery)
      if (input.take !== undefined) url.searchParams.set("take", String(input.take))
      return requestProviderJson(
        fetchImpl,
        url,
        config.apiKey,
        config.timeoutMs,
        "qloo",
        z.unknown()
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
        url.searchParams.set("signal.interests.entities", input.entityIds.join(","))
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
        url.searchParams.set("signal.demographics.age", input.ageRange)
      if (input.gender)
        url.searchParams.set("signal.demographics.gender", input.gender)
      if (input.take !== undefined) url.searchParams.set("take", String(input.take))
      return requestProviderJson(
        fetchImpl,
        url,
        config.apiKey,
        config.timeoutMs,
        "qloo",
        z.unknown()
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
      url.searchParams.set("filter.location.query", input.locationQuery)
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
        qlooInsightsResponseSchema
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
    compareUrl ?? new URL("/v2/insights/compare", parsedBase).toString(),
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
  init: RequestInit = {}
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
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
