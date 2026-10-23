import assert from "node:assert/strict"
import test from "node:test"
import {
  cancelWorkflow,
  completeWorkflow,
  failWorkflow,
  transitionWorkflow,
  WorkflowTransitionError,
} from "./state-machine.ts"
import type { WorkflowState } from "./state-machine.ts"

test("accepts the legal workflow sequence", () => {
  let state: WorkflowState = { status: "queued", stage: "queued" }
  state = transitionWorkflow(state, "researching_culture")
  state = transitionWorkflow(state, "searching_creators")
  state = transitionWorkflow(state, "scoring")
  state = transitionWorkflow(state, "generating_report")
  assert.deepEqual(completeWorkflow(state), {
    status: "completed",
    stage: "generating_report",
  })
})

test("rejects skipped and terminal-state transitions", () => {
  assert.throws(
    () => transitionWorkflow({ status: "queued", stage: "queued" }, "scoring"),
    WorkflowTransitionError,
  )
  assert.throws(
    () => completeWorkflow({ status: "completed", stage: "generating_report" }),
    WorkflowTransitionError,
  )
})

test("supports failure and cancellation only from active states", () => {
  assert.deepEqual(failWorkflow({ status: "running", stage: "scoring" }), {
    status: "failed",
    stage: "scoring",
  })
  assert.deepEqual(cancelWorkflow({ status: "queued", stage: "queued" }), {
    status: "cancelled",
    stage: "queued",
  })
})
