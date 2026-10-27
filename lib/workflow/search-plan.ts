import { z } from "zod"
import type {
  CampaignBrief,
  CultureSignal,
  JsonObject,
} from "../domain/types.ts"

export const searchPlanSchema = z
  .object({
    query: z
      .string()
      .trim()
      .min(3)
      .max(500)
      .refine(
        (value) => !/https?:\/\//i.test(value),
        "URLs are not supported in creator queries"
      ),
    platforms: z.array(z.literal("instagram")).length(1),
    minFollowers: z.number().int().nonnegative().max(1_000_000_000).optional(),
    maxFollowers: z.number().int().positive().max(1_000_000_000).optional(),
    minEngagementRate: z.number().finite().nonnegative().max(100).optional(),
    maxEngagementRate: z.number().finite().nonnegative().max(100).optional(),
    verified: z.boolean().optional(),
    maxResults: z.number().int().min(1).max(100),
  })
  .strict()
  .superRefine((plan, context) => {
    if (
      plan.minFollowers !== undefined &&
      plan.maxFollowers !== undefined &&
      plan.minFollowers > plan.maxFollowers
    ) {
      context.addIssue({
        code: "custom",
        path: ["minFollowers"],
        message: "Minimum followers cannot exceed maximum followers",
      })
    }
    if (
      plan.minEngagementRate !== undefined &&
      plan.maxEngagementRate !== undefined &&
      plan.minEngagementRate > plan.maxEngagementRate
    ) {
      context.addIssue({
        code: "custom",
        path: ["minEngagementRate"],
        message: "Minimum engagement cannot exceed maximum engagement",
      })
    }
  })

export type ActorSearchPlan = z.infer<typeof searchPlanSchema>

export interface SearchPlan extends ActorSearchPlan {
  variant: "baseline" | "culture_informed"
}

export interface SearchPlans {
  baseline: SearchPlan
  cultureInformed: SearchPlan
  source: "deterministic" | "model"
}

export function createDeterministicSearchPlans(
  brief: CampaignBrief,
  signals: CultureSignal[]
): SearchPlans {
  const baseline = buildPlan("baseline", brief, [
    brief.productCategory,
    brief.productDescription,
    brief.objective,
    ...audienceTerms(brief),
  ].join(" "))
  const terms = signals
    .filter((signal) => signal.evidence.verification !== "unverified")
    .sort((left, right) => (right.affinity ?? 0) - (left.affinity ?? 0))
    .slice(0, 3)
    .map((signal) => signal.name)
  const languageTerms = brief.preferredLanguages.slice(0, 3)
  const culturalQuery = [
    brief.productCategory,
    brief.productDescription,
    brief.objective,
    ...terms,
    ...languageTerms,
    ...audienceTerms(brief),
  ].join(" ")
  const cultureInformed = buildPlan("culture_informed", brief, culturalQuery)
  return { baseline, cultureInformed, source: "deterministic" }
}

export function validateSearchPlanAgainstCampaign(
  plan: ActorSearchPlan,
  brief: CampaignBrief
): ActorSearchPlan {
  const parsed = searchPlanSchema.parse(plan)
  if (
    brief.minFollowers !== undefined &&
    (parsed.minFollowers === undefined ||
      parsed.minFollowers < brief.minFollowers)
  ) {
    throw new Error("Search plan weakened the minimum follower constraint")
  }
  if (
    brief.maxFollowers !== undefined &&
    (parsed.maxFollowers === undefined ||
      parsed.maxFollowers > brief.maxFollowers)
  ) {
    throw new Error("Search plan weakened the maximum follower constraint")
  }
  if (parsed.maxResults !== brief.creatorLimit) {
    throw new Error("Search plan changed the campaign result limit")
  }
  return parsed
}

export function actorPlanToJson(plan: SearchPlan): JsonObject {
  return { ...plan }
}

function buildPlan(
  variant: SearchPlan["variant"],
  brief: CampaignBrief,
  query: string
): SearchPlan {
  const actorPlan = searchPlanSchema.parse({
    query: `${query} creators in ${marketName(brief)}`.replace(/\s+/g, " ").trim().slice(0, 500),
    platforms: ["instagram"],
    ...(brief.minFollowers !== undefined
      ? { minFollowers: brief.minFollowers }
      : {}),
    ...(brief.maxFollowers !== undefined
      ? { maxFollowers: brief.maxFollowers }
      : {}),
    maxResults: brief.creatorLimit,
  })
  return { ...actorPlan, variant }
}

function audienceTerms(brief: CampaignBrief): string[] {
  return [
    brief.qlooAgeRange === "25_to_34" ? "audience aged 25 to 34" : undefined,
    brief.qlooAgeRange === "35_and_younger" ? "younger audience aged 35 and younger" : undefined,
    brief.qlooAgeRange === "36_to_55" ? "audience aged 36 to 55" : undefined,
    brief.qlooAgeRange === "55_and_older" ? "audience aged 55 and older" : undefined,
    brief.qlooGender ? `${brief.qlooGender} audience` : undefined,
  ].filter((value): value is string => Boolean(value))
}

function marketName(brief: CampaignBrief): string {
  return [
    brief.targetMarket.city,
    brief.targetMarket.region,
    brief.targetMarket.country,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(", ")
}
