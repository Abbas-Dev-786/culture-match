import { NextResponse } from "next/server"
import { errorResponse, invalidRequest } from "@/lib/api/response"
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
    if (process.env.NODE_ENV === "production")
      throw invalidRequest("Run advancement is disabled in production")
    const { id } = await context.params
    const campaignId = parseCampaignId(id)
    const current = await getOwnedCampaign(campaignId)
    const run = await runCampaignAnalysis(campaignId)
    const latest = await getLatestRunForCampaign(campaignId)
    return NextResponse.json({
      campaign: serializeCampaign({
        ...current.campaign,
        status: latest.run.status === "failed" ? "failed" : latest.run.stage,
      }),
      run: serializeAnalysisRun(run),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
