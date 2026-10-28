import assert from "node:assert/strict"
import test from "node:test"
import {
  createApprovalKey,
  validateAgentActionTrace,
} from "./action-trace.ts"

test("approval keys are stable for the same validated action", () => {
  const first = createApprovalKey({
    action: "add_cultural_signals",
    plan: { query: "streetwear Mumbai", maxResults: 5 },
    signalIds: ["signal-b", "signal-a"],
    refinementCount: 0,
  })
  const second = createApprovalKey({
    action: "add_cultural_signals",
    plan: { maxResults: 5, query: "streetwear Mumbai" },
    signalIds: ["signal-a", "signal-b"],
    refinementCount: 0,
  })

  assert.equal(first, second)
  assert.equal(first.length, 64)
})

test("action traces reject unvalidated fields", () => {
  assert.throws(() =>
    validateAgentActionTrace({
      toolName: "apify_creator_search",
      action: "refine_search",
      decisionMode: "model",
      unexpected: "not allowed",
    } as never)
  )
})
