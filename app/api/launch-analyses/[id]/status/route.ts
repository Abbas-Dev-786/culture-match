import { NextResponse } from "next/server"
import { errorResponse } from "@/lib/api/response"
import { parseCampaignId } from "@/lib/api/params"
import { getLaunchWorkflowContext } from "@/lib/db/launch-analyses"
import {
  serializeLaunchAnalysis,
  serializeLaunchRun,
} from "@/lib/db/launch-serializers"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(
  _request: Request,
  context: RouteContext
): Promise<Response> {
  try {
    const { id } = await context.params
    const result = await getLaunchWorkflowContext(parseCampaignId(id))
    return NextResponse.json({
      analysis: serializeLaunchAnalysis(result.analysis),
      run: serializeLaunchRun(result.run),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
