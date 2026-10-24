import { z } from "zod"

const jsonObjectSchema = z.record(z.string(), z.unknown())

export const qlooEntitySearchResponseSchema = z.object({
  results: z.array(jsonObjectSchema),
})

export const qlooInsightsResponseSchema = z.object({
  results: z.object({
    tags: z.array(jsonObjectSchema),
  }),
  localities: jsonObjectSchema.optional(),
  query: jsonObjectSchema.optional(),
})

export const apifyRunResponseSchema = z.object({
  id: z.string().trim().min(1),
  defaultDatasetId: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).optional(),
})

export const apifyDatasetResponseSchema = z.array(jsonObjectSchema)

export type QlooEntitySearchResponse = z.infer<
  typeof qlooEntitySearchResponseSchema
>
export type QlooInsightsResponse = z.infer<typeof qlooInsightsResponseSchema>
export type ApifyRunResponse = z.infer<typeof apifyRunResponseSchema>
