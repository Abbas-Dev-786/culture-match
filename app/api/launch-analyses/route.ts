import { NextResponse } from "next/server"
import { errorResponse } from "@/lib/api/response"
import { createLaunchAnalysisWithRun } from "@/lib/db/launch-analyses"
import {
  serializeLaunchAnalysis,
  serializeLaunchRun,
} from "@/lib/db/launch-serializers"
import { createLaunchAnalysisRequestSchema } from "@/lib/validation/launch-analysis"

export async function POST(request: Request): Promise<Response> {
  try {
    const input = createLaunchAnalysisRequestSchema.parse(await request.json())
    const result = await createLaunchAnalysisWithRun(input)
    return NextResponse.json(
      {
        analysis: serializeLaunchAnalysis(result.analysis),
        run: serializeLaunchRun(result.run),
      },
      { status: 201 }
    )
  } catch (error) {
    return errorResponse(error)
  }
}
