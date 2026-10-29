import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import process from "node:process"
import { phase0DemoBrief } from "./markets.ts"
import { sanitizeErrorMessage, sanitizeForFixture } from "./redaction.ts"
import { analyzeCulture } from "../tools/qloo/analyze-culture.ts"
import { createQlooClient } from "../tools/qloo/client.ts"

type JsonObject = Record<string, unknown>

interface ProviderResponse {
  status: number
  body: unknown
}

interface FieldObservation {
  path: string
  types: string[]
  occurrences: number
}

const rootDirectory = join(process.cwd(), "lib", "phase-0")
const fixtureDirectory = join(rootDirectory, "fixtures")
const qlooFixtureDirectory = join(fixtureDirectory, "qloo")
const apifyFixtureDirectory = join(fixtureDirectory, "apify")

const qlooBaseUrl = process.env.QLOO_BASE_URL?.trim()
const qlooApiKey = process.env.QLOO_API_KEY?.trim()
const qlooSearchUrl = process.env.QLOO_SEARCH_URL?.trim()
const qlooInsightsUrl = process.env.QLOO_INSIGHTS_URL?.trim()
const qlooSearchQuery = process.env.QLOO_SEARCH_QUERY?.trim() || "Nike"
const qlooSearchTypes =
  process.env.QLOO_SEARCH_TYPES?.trim() || "urn:entity:brand"
const qlooSearchTake = readPositiveInteger(process.env.QLOO_SEARCH_TAKE, 5)
const qlooInsightsFilterType =
  process.env.QLOO_INSIGHTS_FILTER_TYPE?.trim() || "urn:tag"
const qlooInsightsLocationQuery =
  process.env.QLOO_INSIGHTS_LOCATION_QUERY?.trim() ||
  phase0DemoBrief.targetMarket.country
const qlooInsightsTake = readPositiveInteger(
  process.env.QLOO_INSIGHTS_TAKE,
  10,
)
const apifyToken = (process.env.APIFY_API_TOKEN ?? process.env.APIFY_TOKEN)?.trim()
const apifyTimeoutSeconds = readPositiveInteger(
  process.env.PHASE0_APIFY_TIMEOUT_SECONDS,
  180,
)

async function main(): Promise<void> {
  await mkdir(qlooFixtureDirectory, { recursive: true })
  await mkdir(apifyFixtureDirectory, { recursive: true })

  const summary: JsonObject = {
    generatedAt: new Date().toISOString(),
    scenario: phase0DemoBrief,
    configuration: {
      qlooBaseUrlConfigured: Boolean(qlooBaseUrl),
      qlooApiKeyConfigured: Boolean(qlooApiKey),
      qlooSearchUrlConfigured: Boolean(qlooSearchUrl),
      qlooInsightsUrlConfigured: Boolean(qlooInsightsUrl),
      qlooTagsUrlConfigured: Boolean(process.env.QLOO_TAGS_URL?.trim()),
      qlooCompareUrlConfigured: Boolean(process.env.QLOO_COMPARE_URL?.trim()),
      qlooHeatmapRequested: true,
      apifyTokenConfigured: Boolean(apifyToken),
      apifyTimeoutSeconds,
    },
    qloo: await runSafely("qloo", runQlooSpike),
    apify: await runSafely("apify", runApifySpike),
  }

  await writeJson(join(fixtureDirectory, "phase-0-run-summary.json"), summary)
  await writeFieldMatrix(summary)

  const hasFailure = [summary.qloo, summary.apify].some(
    (result) => isRecord(result) && result.status === "failed",
  )
  const hasMissingConfiguration = [summary.qloo, summary.apify].some(
    (result) =>
      isRecord(result) && result.status === "blocked_missing_configuration",
  )

  if (hasFailure || hasMissingConfiguration) {
    process.exitCode = 2
  }
}

async function runQlooSpike(): Promise<JsonObject> {
  const missing = [
    !qlooBaseUrl && "QLOO_BASE_URL",
    !qlooApiKey && "QLOO_API_KEY",
    !qlooSearchUrl && "QLOO_SEARCH_URL",
    !qlooInsightsUrl && "QLOO_INSIGHTS_URL",
  ].filter((value): value is string => Boolean(value))

  if (missing.length > 0) {
    return {
      status: "blocked_missing_configuration",
      missing,
      note: "Use the exact Qloo URLs and parameters verified against the active API documentation.",
    }
  }

  const hostMismatch = validateQlooHosts(
    qlooBaseUrl as string,
    [qlooSearchUrl as string, qlooInsightsUrl as string],
  )
  if (hostMismatch) {
    return {
      status: "blocked_invalid_configuration",
      error: hostMismatch,
    }
  }

  const requestUrls = buildQlooRequestUrls({
    searchUrl: qlooSearchUrl as string,
    insightsUrl: qlooInsightsUrl as string,
  })

  const headers = {
    Accept: "application/json",
    "X-Api-Key": qlooApiKey as string,
  }
  const requests = [
    { name: "entity_search", url: requestUrls.searchUrl },
    { name: "location_taste", url: requestUrls.insightsUrl },
  ]
  const observations: JsonObject[] = []

  for (const request of requests) {
    const startedAt = Date.now()
    try {
      const response = await requestJson(request.url, { headers })
      const fixtureName = `${request.name}-response.json`
      await writeJson(
        join(qlooFixtureDirectory, fixtureName),
        sanitizeForFixture(response.body),
      )
      observations.push({
        name: request.name,
        status: "captured",
        httpStatus: response.status,
        durationMs: Date.now() - startedAt,
        urlPath: new URL(request.url).pathname,
        fields: inspectFields(response.body),
      })
    } catch (error) {
      observations.push({
        name: request.name,
        status: "failed",
        error: safeError(error),
      })
    }
  }

  const hasFailure = observations.some((item) => item.status === "failed")
  let fingerprintValidation: JsonObject
  try {
    const analysis = await analyzeCulture(
      phase0DemoBrief,
      createQlooClient(),
      new Date().toISOString()
    )
    fingerprintValidation = {
      status: "validated",
      location: analysis.location,
      signalCount: analysis.signals.length,
      layerCount: analysis.fingerprint.layers.length,
      resolvedReferenceCount: analysis.resolvedReferences.filter(
        (reference) => reference.status === "resolved"
      ).length,
      resolvedTagCount: analysis.resolvedTags.filter(
        (tag) => tag.status === "resolved"
      ).length,
      hasComparison: Boolean(analysis.fingerprint.comparison),
      hasHeatmap: Boolean(analysis.fingerprint.heatmap),
      fingerprint: sanitizeForFixture(analysis.fingerprint),
    }
    await writeJson(
      join(qlooFixtureDirectory, "cultural-fingerprint.json"),
      fingerprintValidation
    )
  } catch (error) {
    fingerprintValidation = {
      status: "failed",
      error: safeError(error),
    }
  }
  return {
    status:
      hasFailure || fingerprintValidation.status === "failed"
        ? "failed"
        : "response_captured_needs_manual_review",
    requests: observations,
    fingerprintValidation,
    notes: [
      "Confirm the selected filter.type and location parameters are documented and compatible.",
      "Confirm returned score semantics before using any score in matching.",
      "Confirm at least one resolved entity and one usable regional signal.",
    ],
  }
}

function buildQlooRequestUrls(input: {
  searchUrl: string
  insightsUrl: string
}): { searchUrl: string; insightsUrl: string } {
  const searchUrl = new URL(input.searchUrl)
  setSearchParameter(searchUrl, "query", qlooSearchQuery)
  setSearchParameter(searchUrl, "types", qlooSearchTypes)
  setSearchParameter(searchUrl, "take", String(qlooSearchTake))

  const insightsUrl = new URL(input.insightsUrl)
  setSearchParameter(insightsUrl, "filter.type", qlooInsightsFilterType)
  setSearchParameter(
    insightsUrl,
    "signal.location.query",
    qlooInsightsLocationQuery,
  )
  setSearchParameter(insightsUrl, "take", String(qlooInsightsTake))

  return {
    searchUrl: searchUrl.toString(),
    insightsUrl: insightsUrl.toString(),
  }
}

function setSearchParameter(url: URL, name: string, value: string): void {
  if (!url.searchParams.has(name)) {
    url.searchParams.set(name, value)
  }
}

async function runApifySpike(): Promise<JsonObject> {
  if (!apifyToken) {
    return {
      status: "blocked_missing_configuration",
      missing: ["APIFY_API_TOKEN"],
      note: "APIFY_TOKEN is accepted as a local compatibility alias but should be renamed before implementation.",
    }
  }

  const input = {
    query:
      process.env.PHASE0_APIFY_QUERY ??
      "Instagram streetwear creators in India with engaged audiences",
    platforms: ["instagram"],
    maxResults: 5,
  }
  const actorId = "influship~influencer-search"
  const actorUrl = `https://api.apify.com/v2/acts/${actorId}?token=${encodeURIComponent(apifyToken)}`
  const startUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${encodeURIComponent(apifyToken)}&waitForFinish=0`

  try {
    const actorResponse = await requestJson(actorUrl)
    await writeJson(
      join(apifyFixtureDirectory, "actor-response.json"),
      sanitizeForFixture(actorResponse.body),
    )

    const startedAt = Date.now()
    const startResponse = await requestJson(startUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input),
    })
    const run = extractDataObject(startResponse.body)
    const runId = readString(run?.id)
    const datasetId = readString(run?.defaultDatasetId)

    if (!runId) {
      throw new Error("Apify start response did not contain a run id")
    }

    await writeJson(
      join(apifyFixtureDirectory, "run-start.json"),
      sanitizeForFixture({
        actorId,
        input,
        runId,
        datasetId,
        initialStatus: run?.status,
        startedAt: new Date().toISOString(),
      }),
    )

    const finalRun = await pollApifyRun(runId, apifyToken)
    await writeJson(
      join(apifyFixtureDirectory, "run-terminal.json"),
      sanitizeForFixture(finalRun),
    )

    if (readString(finalRun.status) !== "SUCCEEDED") {
      return {
        status: "failed",
        actorId,
        runId,
        terminalStatus: finalRun.status,
        durationMs: Date.now() - startedAt,
      }
    }

    const finalDatasetId = readString(finalRun.defaultDatasetId) ?? datasetId
    if (!finalDatasetId) {
      throw new Error("Apify succeeded without a default dataset id")
    }

    const datasetUrl = `https://api.apify.com/v2/datasets/${encodeURIComponent(finalDatasetId)}/items?token=${encodeURIComponent(apifyToken)}`
    const datasetResponse = await requestJson(datasetUrl)
    const items = extractArray(datasetResponse.body)
    const sanitizedItems = items.map((item) => sanitizeForFixture(item))
    await writeJson(join(apifyFixtureDirectory, "dataset-items.json"), sanitizedItems)

    return {
      status: "response_captured_needs_manual_review",
      actorId,
      runId,
      datasetId: finalDatasetId,
      durationMs: Date.now() - startedAt,
      itemCount: sanitizedItems.length,
      fields: inspectFields(sanitizedItems),
      notes: [
        "Inspect actual fields before marking any normalized field as supported.",
        "Confirm match.score is not reused as an independent cultural score.",
        "Confirm language, audience geography, fees, and content evidence availability.",
      ],
    }
  } catch (error) {
    return {
      status: "failed",
      actorId,
      error: safeError(error),
    }
  }
}

async function pollApifyRun(runId: string, token: string): Promise<JsonObject> {
  const deadline = Date.now() + apifyTimeoutSeconds * 1000
  const terminalStatuses = new Set(["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"])

  while (Date.now() < deadline) {
    const statusUrl = `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}?token=${encodeURIComponent(token)}`
    const response = await requestJson(statusUrl)
    const run = extractDataObject(response.body)
    if (run && terminalStatuses.has(readString(run.status) ?? "")) {
      return run
    }
    await delay(5000)
  }

  throw new Error(`Apify run ${runId} exceeded the ${apifyTimeoutSeconds}s spike timeout`)
}

async function requestJson(
  url: string,
  init: RequestInit = {},
): Promise<ProviderResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const text = await response.text()
    const body = parseJson(text)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${safeErrorMessage(body)}`)
    }
    return { status: response.status, body }
  } finally {
    clearTimeout(timeout)
  }
}

async function runSafely(
  provider: string,
  operation: () => Promise<JsonObject>,
): Promise<JsonObject> {
  try {
    return await operation()
  } catch (error) {
    return { status: "failed", provider, error: safeError(error) }
  }
}

async function writeFieldMatrix(summary: JsonObject): Promise<void> {
  const qloo = isRecord(summary.qloo) ? summary.qloo : undefined
  const apify = isRecord(summary.apify) ? summary.apify : undefined
  const lines = [
    "# Phase 0 provider field matrix",
    "",
    `Generated: ${String(summary.generatedAt)}`,
    "",
    "This file is generated from sanitized spike output. A field is not considered supported until the live response has been reviewed and mapped to an application contract.",
    "",
    "## Qloo",
    "",
    `Status: ${String(qloo?.status ?? "not_run")}`,
    "",
    ...formatObservedFields(qloo?.requests),
    "",
    "## Apify / Influship",
    "",
    `Status: ${String(apify?.status ?? "not_run")}`,
    "",
    "Documented actor input contract from the current public schema:",
    "",
    "| Field | Documented shape |",
    "| --- | --- |",
    "| query | required string |",
    "| platforms | optional string array; `instagram` is currently documented |",
    "| minFollowers / maxFollowers | optional non-negative integers |",
    "| minEngagementRate / maxEngagementRate | optional percentage numbers |",
    "| verified | optional boolean |",
    "| maxResults | optional integer from 1 to 100; spike uses 5 |",
    "",
    "Documented actor output areas:",
    "",
    "| Area | Live classification |",
    "| --- | --- |",
    "| creator | Documented; live unverified |",
    "| match | Documented; live unverified and not an independent cultural score |",
    "| primary_profile | Documented; live unverified |",
    "| relevant_profile | Documented; live unverified |",
    "",
    ...formatObservedFields(apify?.fields),
    "",
    "## Product fields requiring explicit classification",
    "",
    "| Field | Classification | Evidence requirement |",
    "| --- | --- | --- |",
    ...formatProductFieldMatrix(apify?.fields),
  ]
  await writeFile(join(rootDirectory, "provider-field-matrix.md"), lines.join("\n"), "utf8")
}

function formatObservedFields(value: unknown): string[] {
  const values = Array.isArray(value) ? value : isRecord(value) ? [value] : []
  const fields = values.flatMap((item) => {
    if (isRecord(item) && Array.isArray(item.fields)) {
      return item.fields
    }
    return [item]
  }).filter(isRecord)
  if (fields.length === 0) {
    return ["No live field observations captured."]
  }
  return [
    "| Path | Types | Occurrences |",
    "| --- | --- | --- |",
    ...fields.map(
      (field) =>
        `| ${String(field.path ?? "") } | ${String(field.types ?? "") } | ${String(field.occurrences ?? "") } |`,
    ),
  ]
}

function formatProductFieldMatrix(value: unknown): string[] {
  const fields = Array.isArray(value) ? value.filter(isRecord) : []
  const paths = new Set(
    fields
      .map((field) => field.path)
      .filter((path): path is string => typeof path === "string"),
  )
  const hasAny = (...candidates: string[]) => candidates.some((path) => paths.has(path))
  const classification = (supported: boolean, fallback: string) =>
    supported ? "supported" : fallback

  return [
    `| creator identity | ${classification(hasAny("$[].creator.id", "$[].primary_profile.url"), "pending live review")} | Stable creator id or profile URL |`,
    `| bio/content evidence | ${classification(hasAny("$[].creator.bio", "$[].match.evidence[].text"), "pending live review")} | Actual provider field path; inferred evidence remains labeled |`,
    `| follower count | ${classification(hasAny("$[].primary_profile.followers", "$[].relevant_profile.followers"), "pending live review")} | Numeric provider field |`,
    `| engagement rate | ${classification(hasAny("$[].primary_profile.engagement_rate", "$[].relevant_profile.engagement_rate"), "pending live review")} | Numeric provider field with documented percentage units |`,
    "| language | unavailable | Never infer from market or query |",
    `| audience geography | ${hasAny("$[].location_unverified") ? "unavailable; provider explicitly marks location as unverified" : "unavailable until observed"} | Creator residence is insufficient |`,
    "| fees/budget fit | unavailable | Never infer a fee from follower count |",
    `| provider match score | ${classification(hasAny("$[].match.score"), "unavailable")} / provider-derived signal | Do not double-count when Qloo terms feed the query |`,
  ]
}

function inspectFields(value: unknown): FieldObservation[] {
  const observations = new Map<string, { types: Set<string>; occurrences: number }>()
  visit(value, "$", observations)
  return [...observations.entries()]
    .map(([path, observation]) => ({
      path,
      types: [...observation.types].sort(),
      occurrences: observation.occurrences,
    }))
    .sort((left, right) => left.path.localeCompare(right.path))
}

function visit(
  value: unknown,
  path: string,
  observations: Map<string, { types: Set<string>; occurrences: number }>,
): void {
  const observation = observations.get(path) ?? {
    types: new Set<string>(),
    occurrences: 0,
  }
  observation.types.add(valueType(value))
  observation.occurrences += 1
  observations.set(path, observation)

  if (Array.isArray(value)) {
    value.forEach((item) => visit(item, `${path}[]`, observations))
    return
  }

  if (isRecord(value)) {
    Object.entries(value).forEach(([key, nestedValue]) => {
      visit(nestedValue, `${path}.${key}`, observations)
    })
  }
}

function valueType(value: unknown): string {
  if (Array.isArray(value)) return "array"
  if (value === null) return "null"
  return typeof value
}

function parseJson(text: string): unknown {
  if (text.length === 0) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function extractDataObject(value: unknown): JsonObject | undefined {
  if (!isRecord(value)) return undefined
  if (isRecord(value.data)) return value.data
  return value
}

function extractArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (isRecord(value) && Array.isArray(value.items)) return value.items
  return []
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function validateQlooHosts(baseUrl: string, requestUrls: string[]): string | undefined {
  try {
    const expectedHost = new URL(baseUrl).host
    const mismatchedHosts = requestUrls
      .map((value) => new URL(value).host)
      .filter((host) => host !== expectedHost)

    if (mismatchedHosts.length > 0) {
      return `Qloo request URLs must use ${expectedHost}; found ${[...new Set(mismatchedHosts)].join(", ")}`
    }
  } catch {
    return "Qloo base or request URL is not a valid absolute URL"
  }

  return undefined
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const cause = error instanceof Error ? error.cause : undefined
  const causeMessage = isRecord(cause)
    ? [readString(cause.code), readString(cause.message)].filter(Boolean).join(": ")
    : cause instanceof Error
      ? cause.message
      : undefined
  const details = causeMessage ? `${message} (${causeMessage})` : message
  return sanitizeErrorMessage(details)
}

function safeErrorMessage(value: unknown): string {
  if (typeof value === "string") return sanitizeErrorMessage(value)
  return sanitizeErrorMessage(JSON.stringify(sanitizeForFixture(value)))
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

await main()
