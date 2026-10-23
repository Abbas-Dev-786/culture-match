import { NextResponse } from "next/server"
import { errorResponse } from "@/lib/api/response"
import { getOwnedCampaign } from "@/lib/db/campaigns"
import { createRetryRun } from "@/lib/db/runs"
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
    const run = await createRetryRun(campaignId)

    return NextResponse.json({
      campaign: serializeCampaign({ ...current.campaign, status: "queued" }),
      run: serializeAnalysisRun(run),
    }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
