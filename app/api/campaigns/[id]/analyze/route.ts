import { NextResponse } from "next/server"
import { errorResponse } from "@/lib/api/response"
import { getOwnedCampaign } from "@/lib/db/campaigns"
import { getLatestRunForCampaign } from "@/lib/db/runs"
import { serializeAnalysisRun, serializeCampaign } from "@/lib/db/serializers"
import { parseCampaignId } from "@/lib/api/params"
import { runCampaignAnalysis } from "@/lib/workflow/run-campaign-analysis"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(
  _request: Request,
  context: RouteContext
): Promise<Response> {
  try {
    const { id } = await context.params
    const campaignId = parseCampaignId(id)
    const current = await getOwnedCampaign(campaignId)
    const latest = await getLatestRunForCampaign(campaignId)
    if (
      latest.run.status === "running" &&
      latest.run.stage !== "searching_creators"
    ) {
      return NextResponse.json({
        campaign: serializeCampaign(current.campaign),
        run: serializeAnalysisRun(latest.run),
      })
    }
    const run = await runCampaignAnalysis(campaignId)

    return NextResponse.json({
      campaign: serializeCampaign({
        ...current.campaign,
        status: run.status === "failed" ? "failed" : run.stage,
      }),
      run: serializeAnalysisRun(run),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
