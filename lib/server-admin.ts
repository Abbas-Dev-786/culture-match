import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/db/database.types"
import { ApplicationError } from "@/lib/errors"

export function createServiceRoleClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    throw new ApplicationError(
      "INTERNAL_CONFIGURATION_ERROR",
      500,
      "Privileged database access is not configured"
    )
  }

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}
