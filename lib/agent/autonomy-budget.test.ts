import assert from "node:assert/strict"
import test from "node:test"
import {
  AutonomyBudgetExceededError,
  initialAutonomyBudget,
  reserveAutonomyBudget,
} from "./autonomy-budget.ts"

test("autonomy budget reserves actions and provider calls", () => {
  const budget = initialAutonomyBudget()
  const next = reserveAutonomyBudget(budget, {
    actions: 2,
    providerCalls: 1,
    modelCalls: 1,
  })

  assert.equal(next.actionsUsed, 2)
  assert.equal(next.providerCallsUsed, 1)
  assert.equal(next.modelCallsUsed, 1)
})

test("autonomy budget stops work before the configured limit is exceeded", () => {
  const budget = {
    ...initialAutonomyBudget(),
    maxActions: 1,
  }

  assert.throws(
    () => reserveAutonomyBudget(budget, { actions: 2 }),
    AutonomyBudgetExceededError
  )
})
