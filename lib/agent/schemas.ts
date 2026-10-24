import { z } from "zod"

export const campaignConceptSchema = z.object({
  title: z.string().trim().min(1).max(80),
  idea: z.string().trim().min(1).max(500),
  rationale: z.string().trim().min(1).max(500),
  hypothesis: z.literal(true),
})

export const evidenceGroundedReportSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  caveats: z.array(z.string().trim().min(1).max(200)).max(5),
  evidenceKeys: z.array(z.string().trim().min(1).max(200)).max(10),
  concept: campaignConceptSchema,
})

export type EvidenceGroundedReport = z.infer<typeof evidenceGroundedReportSchema>
