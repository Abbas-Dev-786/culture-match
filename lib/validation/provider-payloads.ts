import { z } from "zod"

const jsonObjectSchema = z.record(z.string(), z.unknown())

export const qlooEntitySearchResponseSchema = z.object({
  results: z.array(jsonObjectSchema),
})

export const qlooTagSearchResponseSchema = z
  .object({
    results: z.union([
      z.array(jsonObjectSchema),
      z.object({ tags: z.array(jsonObjectSchema) }),
    ]),
  })
  .or(z.object({ tags: z.array(jsonObjectSchema) }))

export const qlooInsightsResponseSchema = z.object({
  results: z
    .object({
      tags: z.array(jsonObjectSchema).optional(),
      entities: z.array(jsonObjectSchema).optional(),
    })
    .refine(
      (results) => results.tags !== undefined || results.entities !== undefined,
      "Qloo insights results must contain tags or entities"
    ),
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
