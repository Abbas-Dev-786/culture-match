import { NextResponse } from "next/server"
import { errorResponse } from "@/lib/api/response"
import { getOwnedCampaign } from "@/lib/db/campaigns"
import { serializeCampaign } from "@/lib/db/serializers"
import { parseCampaignId } from "@/lib/api/params"
import { updateCampaignSavedState } from "@/lib/db/campaigns"
import { campaignPreferenceSchema } from "@/lib/validation/campaign"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { id } = await context.params
    const campaign = await getOwnedCampaign(parseCampaignId(id))
    return NextResponse.json({ campaign: serializeCampaign(campaign.campaign) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { id } = await context.params
    const input = campaignPreferenceSchema.parse(await request.json())
    const campaign = await updateCampaignSavedState(parseCampaignId(id), input.isSaved)
    return NextResponse.json({ campaign: serializeCampaign(campaign) })
  } catch (error) {
    return errorResponse(error)
  }
}
