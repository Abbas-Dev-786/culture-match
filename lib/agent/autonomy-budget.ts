import { z } from "zod"
import type { JsonObject } from "../domain/types.ts"

export const autonomyBudgetSchema = z
  .object({
    maxActions: z.number().int().positive(),
    actionsUsed: z.number().int().nonnegative(),
    maxProviderCalls: z.number().int().positive(),
    providerCallsUsed: z.number().int().nonnegative(),
    maxProviderRequests: z.number().int().positive(),
    providerRequestsUsed: z.number().int().nonnegative(),
    maxModelCalls: z.number().int().positive(),
    modelCallsUsed: z.number().int().nonnegative(),
  })
  .strict()

export type AutonomyBudget = z.infer<typeof autonomyBudgetSchema>

export class AutonomyBudgetExceededError extends Error {
  readonly code = "AGENT_BUDGET_EXCEEDED"

  constructor(message: string) {
    super(message)
    this.name = "AutonomyBudgetExceededError"
  }
}

export function initialAutonomyBudget(): AutonomyBudget {
  return {
    maxActions: readPositiveEnv("AGENT_MAX_ACTIONS", 24),
    actionsUsed: 0,
    maxProviderCalls: readPositiveEnv("AGENT_MAX_PROVIDER_CALLS", 24),
    providerCallsUsed: 0,
    maxProviderRequests: readPositiveEnv("AGENT_MAX_PROVIDER_REQUESTS", 6000),
    providerRequestsUsed: 0,
    maxModelCalls: readPositiveEnv("AGENT_MAX_MODEL_CALLS", 16),
    modelCallsUsed: 0,
  }
}

export function readAutonomyBudget(summary: JsonObject): AutonomyBudget {
  const value = summary.autonomyBudget
  const compatible =
    value && typeof value === "object" && !Array.isArray(value)
      ? {
          ...value,
          maxProviderRequests:
            "maxProviderRequests" in value
              ? value.maxProviderRequests
              : readPositiveEnv("AGENT_MAX_PROVIDER_REQUESTS", 6000),
          providerRequestsUsed:
            "providerRequestsUsed" in value ? value.providerRequestsUsed : 0,
        }
      : value
  const parsed = autonomyBudgetSchema.safeParse(compatible)
  if (!parsed.success) return initialAutonomyBudget()
  return upgradeLegacyAutonomyBudget(parsed.data)
}

function upgradeLegacyAutonomyBudget(budget: AutonomyBudget): AutonomyBudget {
  const currentDefaults = initialAutonomyBudget()
  return {
    ...budget,
    maxActions:
      budget.maxActions === 12 ? currentDefaults.maxActions : budget.maxActions,
    maxProviderCalls:
      budget.maxProviderCalls === 12
        ? currentDefaults.maxProviderCalls
        : budget.maxProviderCalls,
    maxProviderRequests:
      budget.maxProviderRequests === 3000
        ? currentDefaults.maxProviderRequests
        : budget.maxProviderRequests,
    maxModelCalls:
      budget.maxModelCalls === 8
        ? currentDefaults.maxModelCalls
        : budget.maxModelCalls,
  }
}

export function reserveAutonomyBudget(
  budget: AutonomyBudget,
  reservation: {
    actions?: number
    providerCalls?: number
    providerRequests?: number
    modelCalls?: number
  }
): AutonomyBudget {
  const next = autonomyBudgetSchema.parse({
    ...budget,
    actionsUsed: budget.actionsUsed + (reservation.actions ?? 0),
    providerCallsUsed:
      budget.providerCallsUsed + (reservation.providerCalls ?? 0),
    providerRequestsUsed:
      budget.providerRequestsUsed + (reservation.providerRequests ?? 0),
    modelCallsUsed: budget.modelCallsUsed + (reservation.modelCalls ?? 0),
  })
  if (next.actionsUsed > next.maxActions)
    throw new AutonomyBudgetExceededError(
      "The campaign exceeded its maximum autonomous action budget"
    )
  if (next.providerCallsUsed > next.maxProviderCalls)
    throw new AutonomyBudgetExceededError(
      "The campaign exceeded its maximum provider-call budget"
    )
  if (next.providerRequestsUsed > next.maxProviderRequests)
    throw new AutonomyBudgetExceededError(
      "The campaign exceeded its maximum provider-request budget"
    )
  if (next.modelCallsUsed > next.maxModelCalls)
    throw new AutonomyBudgetExceededError(
      "The campaign exceeded its maximum model-call budget"
    )
  return next
}

export function autonomyBudgetToJson(budget: AutonomyBudget): JsonObject {
  return { ...autonomyBudgetSchema.parse(budget) }
}

function readPositiveEnv(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value > 0 ? value : fallback
}
