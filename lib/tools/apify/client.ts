import {
  apifyDatasetResponseSchema,
  apifyRunResponseSchema,
} from "../../validation/provider-payloads.ts"
import {
  ProviderError,
  classifyProviderError,
  type ProviderErrorCode,
} from "../provider-errors.ts"

type JsonFetcher = (input: string, init?: RequestInit) => Promise<Response>

export type ApifyRunStatus =
  | "READY"
  | "RUNNING"
  | "ABORTING"
  | "SUCCEEDED"
  | "FAILED"
  | "ABORTED"
  | "TIMING-OUT"
  | "TIMED-OUT"

export interface ApifyRun {
  id: string
  datasetId?: string
  status: ApifyRunStatus
}

export interface ApifyClient {
  startRun(
    input: Record<string, unknown>,
    idempotencyKey?: string
  ): Promise<ApifyRun>
  getRunStatus(runId: string): Promise<ApifyRun>
  getDatasetItems(datasetId: string): Promise<unknown[]>
}

interface ApifyClientOptions {
  token?: string
  actorId?: string
  apiBaseUrl?: string
  fetchImpl?: JsonFetcher
  timeoutMs?: number
  runTimeoutSeconds?: number
  maxItems?: number
  maxTotalChargeUsd?: number
}

const DEFAULT_ACTOR_ID = "influship~influencer-search"
const DEFAULT_TIMEOUT_MS = 30_000

export function createApifyClient(
  options: ApifyClientOptions = {}
): ApifyClient {
  const config = readApifyConfig(options)
  const fetchImpl = options.fetchImpl ?? globalThis.fetch

  return {
    async startRun(input, idempotencyKey) {
      const response = await requestJson(
        fetchImpl,
        buildRunUrl(config),
        config,
        {
          method: "POST",
          body: JSON.stringify(input),
          ...(idempotencyKey
            ? { headers: { "X-Idempotency-Key": idempotencyKey } }
            : {}),
        }
      )
      return parseRun(response)
    },
    async getRunStatus(runId) {
      validateId(runId, "run id")
      const response = await requestJson(
        fetchImpl,
        `${config.apiBaseUrl}/actor-runs/${encodeURIComponent(runId)}`,
        config
      )
      return parseRun(response)
    },
    async getDatasetItems(datasetId) {
      validateId(datasetId, "dataset id")
      const response = await requestJson(
        fetchImpl,
        `${config.apiBaseUrl}/datasets/${encodeURIComponent(datasetId)}/items`,
        config
      )
      const payload = Array.isArray(response)
        ? response
        : isRecord(response) && Array.isArray(response.items)
          ? response.items
          : undefined
      const parsed = apifyDatasetResponseSchema.safeParse(payload)
      if (!parsed.success) {
        throw new ProviderError({
          provider: "apify",
          code: "SCHEMA_MISMATCH",
          message: "Apify returned an unsupported dataset shape",
          retryable: false,
          cause: parsed.error,
        })
      }
      return parsed.data
    },
  }
}

function readApifyConfig(options: ApifyClientOptions): {
  token: string
  actorId: string
  apiBaseUrl: string
  timeoutMs: number
  runTimeoutSeconds: number
  maxItems: number
  maxTotalChargeUsd?: number
} {
  const token =
    options.token ?? process.env.APIFY_API_TOKEN ?? process.env.APIFY_TOKEN
  if (!token?.trim()) {
    throw new ProviderError({
      provider: "apify",
      code: "AUTHENTICATION_FAILED",
      message: "Apify server configuration is incomplete",
      retryable: false,
    })
  }

  const apiBaseUrl = options.apiBaseUrl ?? "https://api.apify.com/v2"
  try {
    const url = new URL(apiBaseUrl)
    if (!url.protocol.startsWith("http") || url.search || url.hash)
      throw new Error("invalid")
  } catch {
    throw new ProviderError({
      provider: "apify",
      code: "INVALID_PARAMETERS",
      message: "Apify API base URL is invalid",
      retryable: false,
    })
  }

  return {
    token,
    actorId: options.actorId ?? process.env.APIFY_ACTOR_ID ?? DEFAULT_ACTOR_ID,
    apiBaseUrl: apiBaseUrl.replace(/\/$/, ""),
    timeoutMs: readPositiveInteger(
      options.timeoutMs ?? Number(process.env.APIFY_TIMEOUT_MS),
      DEFAULT_TIMEOUT_MS
    ),
    runTimeoutSeconds: readPositiveInteger(
      options.runTimeoutSeconds ?? Number(process.env.APIFY_RUN_TIMEOUT_SECONDS),
      300
    ),
    maxItems: Math.min(
      100,
      readPositiveInteger(
        options.maxItems ?? Number(process.env.APIFY_MAX_ITEMS),
        100
      )
    ),
    ...(readPositiveNumber(
      options.maxTotalChargeUsd ?? Number(process.env.APIFY_MAX_TOTAL_CHARGE_USD)
    ) !== undefined
      ? {
          maxTotalChargeUsd: readPositiveNumber(
            options.maxTotalChargeUsd ?? Number(process.env.APIFY_MAX_TOTAL_CHARGE_USD)
          ),
        }
      : {}),
  }
}

function buildRunUrl(config: {
  apiBaseUrl: string
  actorId: string
  runTimeoutSeconds: number
  maxItems: number
  maxTotalChargeUsd?: number
}): string {
  const url = new URL(
    `${config.apiBaseUrl}/acts/${encodeURIComponent(config.actorId)}/runs`
  )
  url.searchParams.set("waitForFinish", "0")
  url.searchParams.set("timeout", String(config.runTimeoutSeconds))
  url.searchParams.set("maxItems", String(config.maxItems))
  if (config.maxTotalChargeUsd !== undefined) {
    url.searchParams.set("maxTotalChargeUsd", String(config.maxTotalChargeUsd))
  }
  return url.toString()
}

async function requestJson(
  fetchImpl: JsonFetcher,
  input: string,
  config: { token: string; timeoutMs: number },
  init: RequestInit = {}
): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetchImpl(input, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
        ...init.headers,
      },
      signal: controller.signal,
    })
    const text = await response.text()
    const body = text ? parseJson(text) : null
    if (!response.ok) throw httpError(response.status)
    return body
  } catch (error) {
    throw classifyProviderError(error, "apify")
  } finally {
    clearTimeout(timeout)
  }
}

function parseRun(payload: unknown): ApifyRun {
  if (isRecord(payload) && typeof payload.runId === "string") {
    const status =
      typeof payload.initialStatus === "string" &&
      isApifyStatus(payload.initialStatus)
        ? payload.initialStatus
        : "READY"
    return {
      id: payload.runId,
      status,
      ...(typeof payload.datasetId === "string"
        ? { datasetId: payload.datasetId }
        : {}),
    }
  }
  const data =
    isRecord(payload) && isRecord(payload.data) ? payload.data : payload
  const parsed = apifyRunResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new ProviderError({
      provider: "apify",
      code: "SCHEMA_MISMATCH",
      message: "Apify returned an unsupported run shape",
      retryable: false,
      cause: parsed.error,
    })
  }
  const status = parsed.data.status
  if (!status || !isApifyStatus(status)) {
    throw new ProviderError({
      provider: "apify",
      code: "SCHEMA_MISMATCH",
      message: "Apify run status is missing or unsupported",
      retryable: false,
    })
  }
  return {
    id: parsed.data.id,
    status,
    ...(parsed.data.defaultDatasetId
      ? { datasetId: parsed.data.defaultDatasetId }
      : {}),
  }
}

function httpError(status: number): ProviderError {
  const mapping: Record<
    number,
    { code: ProviderErrorCode; retryable: boolean }
  > = {
    400: { code: "INVALID_PARAMETERS", retryable: false },
    401: { code: "AUTHENTICATION_FAILED", retryable: false },
    403: { code: "AUTHENTICATION_FAILED", retryable: false },
    404: { code: "INVALID_PARAMETERS", retryable: false },
    422: { code: "INVALID_PARAMETERS", retryable: false },
    429: { code: "RATE_LIMITED", retryable: true },
  }
  const mapped =
    mapping[status] ??
    (status >= 500
      ? { code: "UPSTREAM_FAILURE" as const, retryable: true }
      : { code: "UPSTREAM_FAILURE" as const, retryable: false })
  return new ProviderError({
    provider: "apify",
    code: mapped.code,
    status,
    retryable: mapped.retryable,
    message: `apify returned HTTP ${status}`,
  })
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

function validateId(value: string, label: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new ProviderError({
      provider: "apify",
      code: "INVALID_PARAMETERS",
      message: `Invalid Apify ${label}`,
      retryable: false,
    })
  }
}

function isApifyStatus(value: string): value is ApifyRunStatus {
  return [
    "READY",
    "RUNNING",
    "ABORTING",
    "SUCCEEDED",
    "FAILED",
    "ABORTED",
    "TIMING-OUT",
    "TIMED-OUT",
  ].includes(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readPositiveInteger(value: number, fallback: number): number {
  return Number.isInteger(value) && value > 0 ? value : fallback
}

function readPositiveNumber(value: number): number | undefined {
  return Number.isFinite(value) && value > 0 ? value : undefined
}
