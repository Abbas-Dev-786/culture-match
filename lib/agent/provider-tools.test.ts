import assert from "node:assert/strict"
import test from "node:test"
import { executeAgentTool } from "./tool-execution.ts"
import {
  actorPlanForTool,
  createCreatorSearchTool,
} from "./provider-tools.ts"
import type { ApifyClient } from "../tools/apify/client.ts"
import type { SearchPlan } from "../workflow/search-plan.ts"

test("creator search tool excludes internal search-plan metadata", async () => {
  let receivedInput: Record<string, unknown> | undefined
  const client: ApifyClient = {
    async startRun(input) {
      receivedInput = input
      return { id: "run-1", datasetId: "dataset-1", status: "READY" }
    },
    async getRunStatus() {
      return { id: "run-1", status: "READY" }
    },
    async getDatasetItems() {
      return []
    },
  }
  const plan: SearchPlan = {
    variant: "culture_informed",
    query: "beauty creators in Mumbai",
    platforms: ["instagram"],
    maxResults: 10,
  }

  const result = await executeAgentTool(createCreatorSearchTool(client), {
    plan: actorPlanForTool(plan),
    idempotencyKey: "run-1:culture",
  })

  assert.deepEqual(result.output, { runId: "run-1", datasetId: "dataset-1" })
  assert.deepEqual(receivedInput, {
    query: "beauty creators in Mumbai",
    platforms: ["instagram"],
    maxResults: 10,
  })
})
