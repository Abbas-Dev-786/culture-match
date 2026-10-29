import assert from "node:assert/strict"
import test from "node:test"
import {
  AutonomyBudgetExceededError,
  initialAutonomyBudget,
  readAutonomyBudget,
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
  assert.equal(next.providerRequestsUsed, 0)
  assert.equal(next.modelCallsUsed, 1)
})

test("autonomy budget accounts for actual provider requests", () => {
  const budget = initialAutonomyBudget()
  const next = reserveAutonomyBudget(budget, { providerRequests: 7 })

  assert.equal(next.providerRequestsUsed, 7)
})

test("legacy autonomy budgets are upgraded to the doubled defaults", () => {
  const budget = readAutonomyBudget({
    autonomyBudget: {
      maxActions: 12,
      actionsUsed: 4,
      maxProviderCalls: 12,
      providerCallsUsed: 3,
      maxProviderRequests: 3000,
      providerRequestsUsed: 40,
      maxModelCalls: 8,
      modelCallsUsed: 2,
    },
  })

  assert.equal(budget.maxActions, 24)
  assert.equal(budget.maxProviderCalls, 24)
  assert.equal(budget.maxProviderRequests, 6000)
  assert.equal(budget.maxModelCalls, 16)
  assert.equal(budget.actionsUsed, 4)
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
