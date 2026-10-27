import { NextResponse } from "next/server"
import { errorResponse } from "@/lib/api/response"
import { requireAuthenticatedUser } from "@/lib/db/auth"
import { createQlooClient } from "@/lib/tools/qloo/client"
import { getTrendingPublicFigures } from "@/lib/tools/qloo/trending"

export async function GET(request: Request): Promise<Response> {
  try {
    await requireAuthenticatedUser()
    const rawTake = Number(new URL(request.url).searchParams.get("take") ?? 20)
    const take = Number.isInteger(rawTake) ? Math.min(Math.max(rawTake, 1), 50) : 20
    const locationQuery = new URL(request.url).searchParams.get("location")?.trim() || undefined
    const trending = await getTrendingPublicFigures(createQlooClient(), take, locationQuery)
    return NextResponse.json({
      trending,
      sourceNote: "Qloo trending returns public cultural entities. It does not verify Instagram handles or campaign performance.",
      observedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    return errorResponse(error)
  }
}
