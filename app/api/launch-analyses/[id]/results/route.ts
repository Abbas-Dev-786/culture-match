import { NextResponse } from "next/server"
import { errorResponse } from "@/lib/api/response"
import { parseCampaignId } from "@/lib/api/params"
import { getLaunchWorkflowContext } from "@/lib/db/launch-analyses"
import {
  getLaunchCulturalProfile,
  getLaunchActivationReport,
  getLaunchOpportunities,
} from "@/lib/db/launch-results"
import {
  serializeLaunchAnalysis,
  serializeLaunchActivationReport,
  serializeLaunchOpportunity,
  serializeLaunchRun,
} from "@/lib/db/launch-serializers"
import { readFingerprint } from "@/lib/db/results"

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
    const profile = await getLaunchCulturalProfile(
      result.client,
      result.userId,
      result.run.id
    )
    const report = await getLaunchActivationReport(
      result.client,
      result.userId,
      result.run.id
    )
    const opportunities = await getLaunchOpportunities(
      result.client,
      result.userId,
      result.run.id
    )
    const fingerprint = profile ? readFingerprint(profile.fingerprint) : undefined
    return NextResponse.json({
      analysis: serializeLaunchAnalysis(result.analysis),
      run: serializeLaunchRun(result.run),
      culturalProfile: profile
        ? fingerprint
          ? {
            fingerprint,
            providerSummary: profile.provider_summary,
            observedAt: profile.observed_at,
          }
          : null
        : null,
      opportunities: opportunities.map(serializeLaunchOpportunity),
      activationReport: report
        ? serializeLaunchActivationReport(report) ?? null
        : null,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
