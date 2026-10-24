import { NextResponse } from "next/server"
import { errorResponse } from "@/lib/api/response"
import { parseCampaignId } from "@/lib/api/params"
import { getOwnedCampaign } from "@/lib/db/campaigns"
import { getLatestRunForCampaign } from "@/lib/db/runs"
import { getSafeResults } from "@/lib/db/results"
import { campaignResultsToCsv } from "@/lib/export/campaign-csv"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(
  _request: Request,
  context: RouteContext
): Promise<Response> {
  try {
    const { id } = await context.params
    const campaignId = parseCampaignId(id)
    const campaign = await getOwnedCampaign(campaignId)
    const latest = await getLatestRunForCampaign(campaignId)
    const results = await getSafeResults(
      campaign.client,
      campaign.userId,
      latest.run.id
    )
    const csv = campaignResultsToCsv(results.matches)

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="culturematch-${campaignId}.csv"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
