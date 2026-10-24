import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { createApifyClient } from "./client.ts"
import { getRunResults } from "./get-run-results.ts"
import { loadCreatorResults } from "./search-creators.ts"
import { ProviderError } from "../provider-errors.ts"

const startFixture = JSON.parse(
  await readFile(
    new URL("../../phase-0/fixtures/apify/run-start.json", import.meta.url),
    "utf8"
  )
) as unknown
const terminalFixture = JSON.parse(
  await readFile(
    new URL("../../phase-0/fixtures/apify/run-terminal.json", import.meta.url),
    "utf8"
  )
) as unknown
const datasetFixture = JSON.parse(
  await readFile(
    new URL("../../phase-0/fixtures/apify/dataset-items.json", import.meta.url),
    "utf8"
  )
) as unknown[]

test("Apify normalizes only observed creator fields", async () => {
  const client = createApifyClient({
    token: "test-token",
    apiBaseUrl: "https://apify.test/v2",
    fetchImpl: async (input) => {
      if (input.includes("/actor-runs/"))
        return new Response(JSON.stringify(terminalFixture), { status: 200 })
      return new Response(JSON.stringify(datasetFixture), { status: 200 })
    },
  })
  const result = await getRunResults(
    client,
    "dbIdSXek8DRllcZPr",
    "4ZkfiX1qjbgStaxPg"
  )
  assert.equal(result?.creators.length, 5)
  assert.equal(result?.creators[0]?.platform, "instagram")
  assert.equal(result?.creators[0]?.followers, 161499)
  assert.equal(result?.creators[0]?.locationUnverified, true)
  assert.equal(
    result?.creators[0]?.evidence.some((item) =>
      item.fieldPath.includes("followers")
    ),
    true
  )
})

test("Apify persists the run identifiers from the start response", async () => {
  let receivedIdempotencyKey: string | null = null
  const client = createApifyClient({
    token: "test-token",
    apiBaseUrl: "https://apify.test/v2",
    fetchImpl: async (_input, init) => {
      receivedIdempotencyKey = new Headers(init?.headers).get(
        "X-Idempotency-Key"
      )
      return new Response(JSON.stringify(startFixture), { status: 201 })
    },
  })
  const run = await client.startRun(
    {
      query: "streetwear creators in India",
      platforms: ["instagram"],
      maxResults: 5,
    },
    "run-key"
  )
  assert.equal(run.id, "dbIdSXek8DRllcZPr")
  assert.equal(run.datasetId, "4ZkfiX1qjbgStaxPg")
  assert.equal(receivedIdempotencyKey, "run-key")
})

test("Apify classifies payment-required responses without retrying", async () => {
  const client = createApifyClient({
    token: "test-token",
    apiBaseUrl: "https://apify.test/v2",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          error: {
            type: "usage-limit-exceeded",
            message: "Usage limit exceeded",
          },
        }),
        { status: 402 }
      ),
  })

  await assert.rejects(
    () => client.startRun({ query: "creators", platforms: ["instagram"] }),
    (error: unknown) =>
      error instanceof ProviderError &&
      error.code === "PAYMENT_REQUIRED" &&
      error.retryable === false &&
      error.message.includes("available credits")
  )
})

test("Apify rejects unusable dataset items", async () => {
  const client: Parameters<typeof loadCreatorResults>[0] = {
    startRun: async () => ({ id: "run", status: "READY" }),
    getRunStatus: async () => ({ id: "run", status: "READY" }),
    getDatasetItems: async () => [{ creator: {} }],
  }
  await assert.rejects(
    () => loadCreatorResults(client, "dataset"),
    /without usable creator results/
  )
})

test("Apify deduplicates creators and enforces the result limit", async () => {
  const client: Parameters<typeof loadCreatorResults>[0] = {
    startRun: async () => ({ id: "run", status: "READY" }),
    getRunStatus: async () => ({ id: "run", status: "READY" }),
    getDatasetItems: async () => [datasetFixture[0], datasetFixture[0]],
  }
  const creators = await loadCreatorResults(client, "dataset", undefined, 1)
  assert.equal(creators.length, 1)
})

test("Apify keeps non-terminal runs resumable and classifies terminal failures", async () => {
  const runningClient: Parameters<typeof getRunResults>[0] = {
    startRun: async () => ({ id: "run", status: "READY" }),
    getRunStatus: async () => ({ id: "run", status: "RUNNING" }),
    getDatasetItems: async () => [],
  }
  assert.equal(await getRunResults(runningClient, "run", undefined), undefined)

  for (const status of ["FAILED", "ABORTED", "TIMED-OUT"] as const) {
    const client: Parameters<typeof getRunResults>[0] = {
      startRun: async () => ({ id: "run", status: "READY" }),
      getRunStatus: async () => ({ id: "run", status }),
      getDatasetItems: async () => [],
    }
    await assert.rejects(
      () => getRunResults(client, "run", undefined),
      (error: unknown) =>
        error instanceof ProviderError && error.provider === "apify"
    )
  }
})
