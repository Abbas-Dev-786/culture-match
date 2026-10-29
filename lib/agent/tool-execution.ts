import { z } from "zod"
import type { ProviderName } from "./provider-usage.ts"

export interface AgentToolDefinition<Input, Output> {
  name: string
  provider: ProviderName | "internal"
  inputSchema: z.ZodType<Input>
  outputSchema: z.ZodType<Output>
  execute(input: Input): Promise<Output> | Output
}

export interface AgentToolExecution<Input, Output> {
  input: Input
  output: Output
  provider: AgentToolDefinition<Input, Output>["provider"]
  toolName: string
}

export async function executeAgentTool<Input, Output>(
  definition: AgentToolDefinition<Input, Output>,
  rawInput: unknown
): Promise<AgentToolExecution<Input, Output>> {
  const input = definition.inputSchema.parse(rawInput)
  const output = definition.outputSchema.parse(await definition.execute(input))
  return {
    input,
    output,
    provider: definition.provider,
    toolName: definition.name,
  }
}

