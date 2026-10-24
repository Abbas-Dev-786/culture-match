import { errorResponse, invalidRequest } from "@/lib/api/response"
import { requireInternalBearer } from "@/lib/api/internal-auth"
import {
  isTerminalApifyWebhookEvent,
  parseApifyWebhookEvent,
} from "@/lib/workflow/apify-webhook"
import { runCampaignAnalysisForProviderRun } from "@/lib/workflow/run-campaign-analysis"
import { serializeAnalysisRun } from "@/lib/db/serializers"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(request: Request): Promise<Response> {
  try {
    requireInternalBearer(request, "APIFY_WEBHOOK_SECRET")
    const body = await readWebhookBody(request)
    const event = parseApifyWebhookEvent(body)
    if (!event) throw invalidRequest("The Apify webhook payload is invalid")

    const configuredActorId = process.env.APIFY_ACTOR_ID?.trim()
    if (event.actorId && configuredActorId && event.actorId !== configuredActorId) {
      throw invalidRequest("The Apify webhook actor is not configured for this app")
    }

    if (!isTerminalApifyWebhookEvent(event.eventType)) {
      return NextResponse.json({ accepted: true, ignored: true })
    }

    const run = await runCampaignAnalysisForProviderRun(event.actorRunId)
    if (!run) {
      return NextResponse.json({ accepted: true, ignored: true })
    }

    return NextResponse.json({
      accepted: true,
      run: serializeAnalysisRun(run),
    })
  } catch (error) {
    return errorResponse(error)
  }
}

async function readWebhookBody(request: Request): Promise<unknown> {
  const body = await request.text()
  if (!body || body.length > 64_000) {
    throw invalidRequest("The Apify webhook payload is invalid")
  }
  try {
    return JSON.parse(body) as unknown
  } catch {
    throw invalidRequest("The Apify webhook payload is invalid")
  }
}
