import { NextResponse } from "next/server"
import { createClient } from "@/lib/server"

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const next = url.searchParams.get("next")
  const redirectPath = next?.startsWith("/") ? next : "/campaigns/new"

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL(redirectPath, url.origin))
}
