import { NextResponse } from "next/server"
import { errorResponse } from "@/lib/api/response"
import { parseCampaignId } from "@/lib/api/params"
import { createLaunchRetryRun } from "@/lib/db/launch-runs"
import { serializeLaunchRun } from "@/lib/db/launch-serializers"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(
  _request: Request,
  context: RouteContext
): Promise<Response> {
  try {
    const { id } = await context.params
    const run = await createLaunchRetryRun(parseCampaignId(id))
    return NextResponse.json({ run: serializeLaunchRun(run) }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
