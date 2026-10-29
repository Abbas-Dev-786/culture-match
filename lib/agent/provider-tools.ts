import { z } from "zod"
import type { AgentToolDefinition } from "./tool-execution.ts"
import type { ApifyClient } from "../tools/apify/client.ts"
import { startCreatorSearch } from "../tools/apify/search-creators.ts"
import { searchPlanSchema, type SearchPlan } from "../workflow/search-plan.ts"
import type {
  CultureSignal,
  NormalizedCreator,
} from "../domain/types.ts"
import type { QlooClient } from "../tools/qloo/client.ts"
import {
  enrichCreatorsWithQloo,
  type QlooCreatorConditioning,
} from "../tools/qloo/enrich-creators.ts"

const creatorSearchToolInputSchema = z.object({
  plan: searchPlanSchema,
  idempotencyKey: z.string().trim().min(1).max(200),
})

const creatorSearchToolOutputSchema = z.object({
  runId: z.string().trim().min(1),
  datasetId: z.string().trim().min(1).optional(),
})

export function createCreatorSearchTool(
  client: ApifyClient
): AgentToolDefinition<
  { plan: Omit<SearchPlan, "variant">; idempotencyKey: string },
  { runId: string; datasetId?: string }
> {
  return {
    name: "apify_creator_search",
    provider: "apify",
    inputSchema: creatorSearchToolInputSchema,
    outputSchema: creatorSearchToolOutputSchema,
    execute: async ({ plan, idempotencyKey }) => {
      const result = await startCreatorSearch(
        client,
        { ...plan, variant: "culture_informed" },
        idempotencyKey
      )
      return {
        runId: result.runId,
        ...(result.datasetId ? { datasetId: result.datasetId } : {}),
      }
    },
  }
}

export function actorPlanForTool(plan: SearchPlan): Omit<SearchPlan, "variant"> {
  const { variant, ...actorPlan } = plan
  void variant
  return actorPlan
}

export interface QlooEnrichmentToolInput {
  creators: NormalizedCreator[]
  locationQuery: string
  campaignSignals: CultureSignal[]
  conditioning: QlooCreatorConditioning
  creatorIds?: string[]
  maxCreators?: number
}

const normalizedCreatorSchema = z.custom<NormalizedCreator>(isNormalizedCreator)

const qlooEnrichmentToolInputSchema = z.object({
  creators: z.array(normalizedCreatorSchema).max(200),
  locationQuery: z.string().trim().min(1).max(300),
  campaignSignals: z.array(z.custom<CultureSignal>(isCultureSignal)).max(100),
  conditioning: z.custom<QlooCreatorConditioning>(isConditioning),
  creatorIds: z.array(z.string().trim().min(1)).max(200).optional(),
  maxCreators: z.number().int().min(1).max(200).optional(),
})

export function createQlooCreatorEnrichmentTool(
  client: QlooClient,
  onProgress?: (creator: NormalizedCreator) => Promise<void> | void
): AgentToolDefinition<QlooEnrichmentToolInput, NormalizedCreator[]> {
  return {
    name: "qloo_creator_enrichment",
    provider: "qloo",
    inputSchema: qlooEnrichmentToolInputSchema,
    outputSchema: z.array(normalizedCreatorSchema),
    execute: async (input) =>
      enrichCreatorsWithQloo(
        input.creators,
        input.locationQuery,
        client,
        input.campaignSignals,
        input.conditioning,
        {
          ...(input.creatorIds ? { creatorIds: input.creatorIds } : {}),
          ...(input.maxCreators ? { maxCreators: input.maxCreators } : {}),
          ...(onProgress ? { onProgress } : {}),
        }
      ),
  }
}

function isNormalizedCreator(value: unknown): value is NormalizedCreator {
  if (!isRecord(value)) return false
  return (
    typeof value.providerCreatorId === "string" &&
    typeof value.name === "string" &&
    Array.isArray(value.contentSignals) &&
    Array.isArray(value.evidence) &&
    Array.isArray(value.missingFields)
  )
}

function isCultureSignal(value: unknown): value is CultureSignal {
  if (!isRecord(value)) return false
  return (
    typeof value.signalId === "string" &&
    typeof value.name === "string" &&
    (value.kind === "tag" || value.kind === "entity") &&
    typeof value.evidence === "object" &&
    value.evidence !== null
  )
}

function isConditioning(value: unknown): value is QlooCreatorConditioning {
  if (!isRecord(value)) return false
  return (
    (value.audienceIds === undefined || Array.isArray(value.audienceIds)) &&
    (value.audienceWeight === undefined || typeof value.audienceWeight === "number") &&
    (value.ageRange === undefined || typeof value.ageRange === "string") &&
    (value.gender === undefined || value.gender === "male" || value.gender === "female")
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

