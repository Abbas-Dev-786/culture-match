import { NextResponse } from "next/server"
import { errorResponse } from "@/lib/api/response"
import { parseCampaignId } from "@/lib/api/params"
import { getLaunchWorkflowContext } from "@/lib/db/launch-analyses"
import {
  getLaunchActivationReport,
  getLaunchCulturalProfile,
  getLaunchOpportunities,
} from "@/lib/db/launch-results"
import {
  serializeLaunchActivationReport,
  serializeLaunchAnalysis,
  serializeLaunchOpportunity,
} from "@/lib/db/launch-serializers"
import { ApplicationError } from "@/lib/errors"
import { launchResultsToCsv } from "@/lib/export/launch-csv"
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
    if (result.run.status !== "completed") {
      throw new ApplicationError(
        "RESULTS_NOT_READY",
        409,
        "Launch results are not ready to export"
      )
    }
    const profile = await getLaunchCulturalProfile(
      result.client,
      result.userId,
      result.run.id
    )
    const fingerprint = profile ? readFingerprint(profile.fingerprint) : undefined
    if (!fingerprint) {
      throw new ApplicationError(
        "RESULTS_NOT_READY",
        409,
        "The launch cultural fingerprint is not ready to export"
      )
    }
    const [opportunityRows, reportRow] = await Promise.all([
      getLaunchOpportunities(result.client, result.userId, result.run.id),
      getLaunchActivationReport(result.client, result.userId, result.run.id),
    ])
    const csv = launchResultsToCsv({
      analysis: serializeLaunchAnalysis(result.analysis),
      fingerprint,
      opportunities: opportunityRows.map(serializeLaunchOpportunity),
      activationReport: reportRow
        ? serializeLaunchActivationReport(reportRow)
        : undefined,
    })
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="culturematch-launch-${result.analysis.id}.csv"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
