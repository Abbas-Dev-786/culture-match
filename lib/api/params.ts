import { ApplicationError } from "@/lib/errors"
import { campaignIdSchema } from "@/lib/validation/campaign"

export function parseCampaignId(value: string): string {
  const result = campaignIdSchema.safeParse(value)
  if (!result.success) {
    throw new ApplicationError("INVALID_CAMPAIGN_ID", 400, "Campaign ID is invalid")
  }
  return result.data
}
