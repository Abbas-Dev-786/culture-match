import { NextResponse } from "next/server"
import { createClient } from "@/lib/server"

export const runtime = "nodejs"

export async function GET(): Promise<Response> {
  const supabase = await createClient()
  await supabase.auth.getClaims()

  return NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  )
}
