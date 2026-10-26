import type {
  CampaignBrief,
  LaunchAnalysisBrief,
} from "../../domain/types.ts"
import {
  analyzeCulture,
  type CultureResearchResult,
} from "./analyze-culture.ts"
import type { QlooClient } from "./client.ts"

const launchReferenceTypes = [
  "urn:entity:brand",
  "urn:entity:place",
  "urn:entity:artist",
  "urn:entity:person",
  "urn:entity:podcast",
  "urn:entity:movie",
  "urn:entity:tv_show",
].join(",")

export async function analyzeLaunchCulture(
  brief: LaunchAnalysisBrief,
  client: QlooClient,
  observedAt = new Date().toISOString()
): Promise<CultureResearchResult> {
  return analyzeCulture(
    toCampaignBrief(brief),
    client,
    observedAt,
    {
      referenceEntityTypes: launchReferenceTypes,
      includeComparison: true,
    }
  )
}

function toCampaignBrief(brief: LaunchAnalysisBrief): CampaignBrief {
  return {
    brandName: brief.brandName,
    productCategory: brief.product,
    targetMarket: {
      country: brief.country,
      city: brief.city,
      marketScope: "city",
    },
    objective: brief.launchIntent,
    culturalReferences: brief.culturalReferences,
    preferredLanguages: [],
    creatorLimit: 10,
  }
}
