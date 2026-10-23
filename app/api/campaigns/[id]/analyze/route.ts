import { NextResponse } from "next/server"
import { errorResponse } from "@/lib/api/response"
import { getOwnedCampaign } from "@/lib/db/campaigns"
import { advanceAnalysisRun, getLatestRunForCampaign } from "@/lib/db/runs"
import { serializeAnalysisRun, serializeCampaign } from "@/lib/db/serializers"
import { parseCampaignId } from "@/lib/api/params"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { id } = await context.params
    const campaignId = parseCampaignId(id)
    const current = await getOwnedCampaign(campaignId)
    const latest = await getLatestRunForCampaign(campaignId)
    if (latest.run.status === "running") {
      return NextResponse.json({
        campaign: serializeCampaign(current.campaign),
        run: serializeAnalysisRun(latest.run),
      })
    }
    const run = await advanceAnalysisRun(campaignId, "researching_culture")

    return NextResponse.json({
      campaign: serializeCampaign({ ...current.campaign, status: "researching_culture" }),
      run: serializeAnalysisRun(run),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
