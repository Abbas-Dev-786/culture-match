import { NextResponse } from "next/server"
import { errorResponse } from "@/lib/api/response"
import { createCampaignWithRun } from "@/lib/db/campaigns"
import { serializeAnalysisRun, serializeCampaign } from "@/lib/db/serializers"
import { createCampaignRequestSchema } from "@/lib/validation/campaign"

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
