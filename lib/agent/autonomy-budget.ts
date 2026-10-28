import { z } from "zod"
import type { JsonObject } from "../domain/types.ts"

export const autonomyBudgetSchema = z
  .object({
    maxActions: z.number().int().positive(),
    actionsUsed: z.number().int().nonnegative(),
    maxProviderCalls: z.number().int().positive(),
    providerCallsUsed: z.number().int().nonnegative(),
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
    maxActions: readPositiveEnv("AGENT_MAX_ACTIONS", 12),
    actionsUsed: 0,
    maxProviderCalls: readPositiveEnv("AGENT_MAX_PROVIDER_CALLS", 12),
    providerCallsUsed: 0,
    maxModelCalls: readPositiveEnv("AGENT_MAX_MODEL_CALLS", 8),
    modelCallsUsed: 0,
  }
}

export function readAutonomyBudget(summary: JsonObject): AutonomyBudget {
  const parsed = autonomyBudgetSchema.safeParse(summary.autonomyBudget)
  return parsed.success ? parsed.data : initialAutonomyBudget()
}

export function reserveAutonomyBudget(
  budget: AutonomyBudget,
  reservation: {
    actions?: number
    providerCalls?: number
    modelCalls?: number
  }
): AutonomyBudget {
  const next = autonomyBudgetSchema.parse({
    ...budget,
    actionsUsed: budget.actionsUsed + (reservation.actions ?? 0),
    providerCallsUsed:
      budget.providerCallsUsed + (reservation.providerCalls ?? 0),
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
