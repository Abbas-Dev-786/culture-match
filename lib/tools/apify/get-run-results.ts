import type { ApifyClient, ApifyRun, ApifyRunStatus } from "./client.ts"
import { ProviderError } from "../provider-errors.ts"
import { loadCreatorResults } from "./search-creators.ts"

export interface ApifyResults {
  run: ApifyRun
  creators: Awaited<ReturnType<typeof loadCreatorResults>>
}

export async function getRunResults(
  client: ApifyClient,
  runId: string,
  datasetId: string | undefined,
  observedAt = new Date().toISOString(),
  maxResults = 100
): Promise<ApifyResults | undefined> {
  const run = await client.getRunStatus(runId)
  if (!isTerminal(run.status)) return undefined
  if (run.status === "FAILED") {
    throw new ProviderError({
      provider: "apify",
      code: "RUN_FAILED",
      message: "Apify creator search failed",
      retryable: false,
    })
  }
  if (run.status === "ABORTED") {
    throw new ProviderError({
      provider: "apify",
      code: "RUN_ABORTED",
      message: "Apify creator search was aborted",
      retryable: false,
    })
  }
  if (run.status === "TIMED-OUT") {
    throw new ProviderError({
      provider: "apify",
      code: "RUN_TIMED_OUT",
      message: "Apify creator search timed out",
      retryable: true,
    })
  }

  const resolvedDatasetId = run.datasetId ?? datasetId
  if (!resolvedDatasetId) {
    throw new ProviderError({
      provider: "apify",
      code: "SCHEMA_MISMATCH",
      message: "Apify succeeded without a dataset id",
      retryable: false,
    })
  }
  return {
    run,
    creators: await loadCreatorResults(
      client,
      resolvedDatasetId,
      observedAt,
      maxResults
    ),
  }
}

function isTerminal(status: ApifyRunStatus): boolean {
  return ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)
}
