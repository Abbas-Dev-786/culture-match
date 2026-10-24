import { z } from "zod"

const nonEmptyText = (max: number) => z.string().trim().min(1).max(max)

const targetMarketSchema = z
  .object({
    country: nonEmptyText(100),
    region: z.string().trim().min(1).max(100).optional(),
    city: z.string().trim().min(1).max(100).optional(),
    marketScope: z.enum(["country", "region", "city"]),
  })
  .superRefine((market, context) => {
    if (market.marketScope === "country" && (market.region || market.city)) {
      context.addIssue({
        code: "custom",
        path: ["marketScope"],
        message: "Country markets cannot include region or city values",
      })
    }

    if (market.marketScope === "region" && !market.region) {
      context.addIssue({
        code: "custom",
        path: ["region"],
        message: "Region markets require a region",
      })
    }

    if (market.marketScope === "city" && !market.city) {
      context.addIssue({
        code: "custom",
        path: ["city"],
        message: "City markets require a city",
      })
    }
  })

export const campaignBriefSchema = z
  .object({
    brandName: nonEmptyText(120),
    productCategory: nonEmptyText(120),
    targetMarket: targetMarketSchema,
    objective: nonEmptyText(500),
    culturalReferences: z.array(nonEmptyText(120)).max(10),
    preferredLanguages: z.array(nonEmptyText(80)).max(8),
    minFollowers: z.number().int().nonnegative().max(1_000_000_000).optional(),
    maxFollowers: z.number().int().positive().max(1_000_000_000).optional(),
    maxBudget: z.number().finite().positive().max(1_000_000_000).optional(),
    currency: z.string().trim().regex(/^[A-Z]{3}$/).optional(),
    qlooAudienceIds: z.array(nonEmptyText(160)).max(10).optional(),
    qlooAudienceWeight: z.number().finite().positive().max(100).optional(),
    qlooAgeRange: z
      .enum(["35_and_younger", "36_to_55", "55_and_older"])
      .optional(),
    qlooGender: z.enum(["male", "female"]).optional(),
    creatorLimit: z.number().int().min(1).max(100),
  })
  .superRefine((brief, context) => {
    if (
      brief.minFollowers !== undefined &&
      brief.maxFollowers !== undefined &&
      brief.minFollowers > brief.maxFollowers
    ) {
      context.addIssue({
        code: "custom",
        path: ["minFollowers"],
        message: "Minimum followers cannot exceed maximum followers",
      })
    }

    if (brief.maxBudget !== undefined && !brief.currency) {
      context.addIssue({
        code: "custom",
        path: ["currency"],
        message: "Currency is required when a maximum budget is provided",
      })
    }
  })

export const createCampaignRequestSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/),
  brief: campaignBriefSchema,
})

export const campaignIdSchema = z.string().uuid()

export type CreateCampaignRequest = z.infer<typeof createCampaignRequestSchema>
