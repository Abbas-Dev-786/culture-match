import { NextResponse } from "next/server"
import { z } from "zod"
import { errorResponse, invalidRequest } from "@/lib/api/response"
import { parseCampaignId } from "@/lib/api/params"
import { getOwnedCampaign } from "@/lib/db/campaigns"
import { getLatestRunForCampaign } from "@/lib/db/runs"
import {
  getCultureProfile,
  updateCultureProfileSummary,
} from "@/lib/db/provider-results"
import { serializeAnalysisRun, serializeCampaign } from "@/lib/db/serializers"
import { runCampaignAnalysis } from "@/lib/workflow/run-campaign-analysis"
import type { JsonObject } from "@/lib/domain/types"

const approvalSchema = z.object({ approved: z.literal(true) }).strict()

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(
  request: Request,
  context: RouteContext
): Promise<Response> {
  try {
    const { id } = await context.params
    const campaignId = parseCampaignId(id)
    approvalSchema.parse(await request.json())
    const owned = await getOwnedCampaign(campaignId)
    const latest = await getLatestRunForCampaign(campaignId)
    const culture = await getCultureProfile(
      owned.client,
      owned.userId,
      latest.run.id
    )
    if (!culture) throw invalidRequest("Agent state is not available")

    const state = isJsonObject(culture.providerSummary.creatorSearchAgentState)
      ? culture.providerSummary.creatorSearchAgentState
      : undefined
    const pending = state && isJsonObject(state.pendingApproval)
      ? state.pendingApproval
      : undefined
    if (!pending || typeof pending.requestedAction !== "string")
      throw invalidRequest("There is no pending agent approval")

    await updateCultureProfileSummary(owned.client, owned.userId, latest.run.id, {
      ...culture.providerSummary,
      creatorSearchAgentState: {
        ...state,
        approvedAction: pending.requestedAction,
        ...(typeof pending.approvalKey === "string"
          ? { approvedApprovalKey: pending.approvalKey }
          : {}),
        ...(isJsonObject(pending.plan)
          ? { approvedPlan: pending.plan }
          : {}),
        ...(Array.isArray(pending.signalIds) &&
        pending.signalIds.every((value): value is string => typeof value === "string")
          ? { approvedSignalIds: pending.signalIds }
          : {}),
        pendingApproval: null,
      },
    })
    const run = await runCampaignAnalysis(campaignId)
    return NextResponse.json({
      campaign: serializeCampaign(owned.campaign),
      run: serializeAnalysisRun(run),
    })
  } catch (error) {
    return errorResponse(error)
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
