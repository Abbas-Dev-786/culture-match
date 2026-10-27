import { NextResponse } from "next/server"
import { errorResponse } from "@/lib/api/response"
import { createCampaignWithRun } from "@/lib/db/campaigns"
import { serializeAnalysisRun, serializeCampaign } from "@/lib/db/serializers"
import { createCampaignRequestSchema } from "@/lib/validation/campaign"
import { listOwnedCampaigns } from "@/lib/db/campaigns"

export async function GET(request: Request): Promise<Response> {
  try {
    const savedOnly = new URL(request.url).searchParams.get("saved") === "true"
    const campaigns = await listOwnedCampaigns({ savedOnly })
    return NextResponse.json({ campaigns: campaigns.map(serializeCampaign) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const input = createCampaignRequestSchema.parse(await request.json())
    const result = await createCampaignWithRun(input)

    return NextResponse.json(
      {
        campaign: serializeCampaign(result.campaign),
        run: serializeAnalysisRun(result.run),
      },
      { status: 201 },
    )
  } catch (error) {
    return errorResponse(error)
  }
}
