import { NextResponse } from "next/server"
import { errorResponse } from "@/lib/api/response"
import { getLatestRunForCampaign } from "@/lib/db/runs"
import { getOwnedCampaign } from "@/lib/db/campaigns"
import { serializeAnalysisRun, serializeCampaign } from "@/lib/db/serializers"
import { parseCampaignId } from "@/lib/api/params"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { id } = await context.params
    const campaignId = parseCampaignId(id)
    const campaign = await getOwnedCampaign(campaignId)
    const latest = await getLatestRunForCampaign(campaignId)

    return NextResponse.json({
      campaign: serializeCampaign(campaign.campaign),
      run: serializeAnalysisRun(latest.run),
      results: [],
      resultsAvailable: latest.run.status === "completed",
    })
  } catch (error) {
    return errorResponse(error)
  }
}
