import { createHash } from "node:crypto"
import { z } from "zod"
import type { AgentDecisionMode, JsonObject } from "../domain/types.ts"

export const agentActionTraceSchema = z
  .object({
    toolName: z.string().trim().min(1).max(120),
    action: z.string().trim().min(1).max(120),
    decision: z.string().trim().min(1).max(120).optional(),
    decisionMode: z.enum(["model", "deterministic_fallback"]),
    fallbackReason: z.string().trim().min(1).max(240).optional(),
    inputHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    inputSummary: z
      .record(z.string(), z.union([z.string(), z.number(), z.null()]))
      .optional(),
    resultCount: z.number().int().nonnegative().optional(),
    evidenceCount: z.number().int().nonnegative().optional(),
    nextAction: z.string().trim().min(1).max(120).optional(),
    rejectedActions: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
    rationale: z.string().trim().min(1).max(500).optional(),
  })
  .strict()

export type AgentActionTrace = z.infer<typeof agentActionTraceSchema>

export function createApprovalKey(input: {
  action: string
  plan: JsonObject
  signalIds: string[]
  refinementCount: number
}): string {
  const canonical = stableSerialize({
    action: input.action,
    plan: input.plan,
    signalIds: [...input.signalIds].sort(),
    refinementCount: input.refinementCount,
  })
  return createHash("sha256").update(canonical).digest("hex")
}

export function validateAgentActionTrace(
  trace: AgentActionTrace,
): AgentActionTrace {
  return agentActionTraceSchema.parse(trace)
}

export function decisionModeFromEnvironment(): {
  mode: AgentDecisionMode
  fallbackReason?: string
} {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  const modelId = process.env.OPENROUTER_MODEL?.trim()
  if (!apiKey || !modelId) {
    return {
      mode: "deterministic_fallback",
      fallbackReason: "agent_model_configuration_missing",
    }
  }
  return { mode: "model" }
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}
