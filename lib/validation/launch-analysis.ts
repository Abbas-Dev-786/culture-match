import { z } from "zod"
import { launchOpportunityTypes } from "../domain/types.ts"

const nonEmptyText = (max: number) => z.string().trim().min(1).max(max)

export const launchOpportunityTypeSchema = z.enum(launchOpportunityTypes)

export const launchAnalysisBriefSchema = z.object({
  brandName: nonEmptyText(120),
  product: nonEmptyText(160),
  country: nonEmptyText(100),
  city: nonEmptyText(100),
  opportunityType: launchOpportunityTypeSchema,
  culturalReferences: z.array(nonEmptyText(120)).min(2).max(5),
  launchIntent: nonEmptyText(500),
})

export const createLaunchAnalysisRequestSchema = z.object({
  idempotencyKey: z
    .string()
    .trim()
    .min(8)
    .max(128)
    .regex(/^[A-Za-z0-9._:-]+$/),
  brief: launchAnalysisBriefSchema,
})

export const launchAnalysisIdSchema = z.string().uuid()

export type CreateLaunchAnalysisRequest = z.infer<
  typeof createLaunchAnalysisRequestSchema
>
