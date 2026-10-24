import { z } from "zod"
import {
  ProviderError,
  classifyProviderError,
  type ProviderErrorCode,
} from "../provider-errors.ts"
import {
  qlooEntitySearchResponseSchema,
  qlooInsightsResponseSchema,
} from "../../validation/provider-payloads.ts"

type JsonFetcher = (input: string, init?: RequestInit) => Promise<Response>

export interface QlooClient {
  searchEntities(input: {
    query: string
    types: string
    take: number
  }): Promise<unknown>
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
  apiKey?: string
  fetchImpl?: JsonFetcher
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 20_000
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
        qlooInsightsResponseSchema
      )
    },
  }
}

function readQlooConfig(options: QlooClientOptions): {
  baseUrl: string
  searchUrl: string
  insightsUrl: string
  apiKey: string
  timeoutMs: number
} {
  const baseUrl = options.baseUrl ?? process.env.QLOO_BASE_URL
  const searchUrl = options.searchUrl ?? process.env.QLOO_SEARCH_URL
  const insightsUrl = options.insightsUrl ?? process.env.QLOO_INSIGHTS_URL
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

  if (
    parsedSearch.origin !== parsedBase.origin ||
    parsedInsights.origin !== parsedBase.origin
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
    if (!url.protocol.startsWith("http"))
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
  schema: z.ZodType<T>
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchImpl(url.toString(), {
      headers: { Accept: "application/json", "X-Api-Key": apiKey },
      signal: controller.signal,
    })
    const body = await readJson(response)

    if (!response.ok) throw providerHttpError(provider, response.status)

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
  status: number
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
    message: `${provider} returned HTTP ${status}`,
  })
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
