import type { SupabaseClient, User } from "@supabase/supabase-js"
import { ApplicationError } from "@/lib/errors"
import type { Database } from "@/lib/db/database.types"
import { createClient } from "@/lib/server"

export async function requireAuthenticatedUser(
  client?: SupabaseClient<Database>,
): Promise<{ client: SupabaseClient<Database>; user: User }> {
  const supabase = client ?? (await createClient())
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    throw new ApplicationError("AUTH_REQUIRED", 401, "Authentication is required")
  }

  return { client: supabase, user: data.user }
}
