import type { CreateCampaignRequest } from "@/lib/validation/campaign"
import { ApplicationError, isUniqueViolation } from "@/lib/errors"
import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  AnalysisRunRow,
  CampaignInsert,
  CampaignRow,
} from "@/lib/db/database.types"
import { requireAuthenticatedUser } from "@/lib/db/auth"
import type { Database } from "@/lib/db/database.types"
import { SCORE_ALGORITHM_VERSION } from "@/lib/matching/score-creators"

function toCampaignInsert(
  input: CreateCampaignRequest["brief"],
  userId: string,
): CampaignInsert {
  return {
    user_id: userId,
    brand_name: input.brandName,
    product_category: input.productCategory,
    product_description: input.productDescription,
    objective: input.objective,
    market_country: input.targetMarket.country,
    market_region: input.targetMarket.region ?? null,
    market_city: input.targetMarket.city ?? null,
    market_scope: input.targetMarket.marketScope,
    cultural_references: input.culturalReferences,
    preferred_languages: input.preferredLanguages,
    min_followers: input.minFollowers ?? null,
    max_followers: input.maxFollowers ?? null,
    min_budget: input.minBudget ?? null,
    max_budget: input.maxBudget ?? null,
    currency: input.currency ?? null,
    qloo_audience_ids: input.qlooAudienceIds ?? [],
    qloo_audience_weight: input.qlooAudienceWeight ?? null,
    qloo_age_range: input.qlooAgeRange ?? null,
    qloo_gender: input.qlooGender ?? null,
    creator_limit: input.creatorLimit,
    status: "queued",
  }
}

export async function createCampaignWithRun(
  input: CreateCampaignRequest,
): Promise<{ campaign: CampaignRow; run: AnalysisRunRow }> {
  const { client, user } = await requireAuthenticatedUser()
  const existing = await client
    .from("analysis_runs")
    .select("*")
    .eq("user_id", user.id)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle()

  if (existing.error) {
    throw new ApplicationError("DATABASE_ERROR", 500, "Unable to check request idempotency")
  }

  if (existing.data) {
    const campaign = await getCampaignById(client, user.id, existing.data.campaign_id)
    return { campaign, run: existing.data }
  }

  const campaignResult = await client
    .from("campaigns")
    .insert(toCampaignInsert(input.brief, user.id))
    .select("*")
    .single()

  if (campaignResult.error || !campaignResult.data) {
    throw new ApplicationError("DATABASE_ERROR", 500, "Unable to create campaign")
  }

  const runResult = await client
    .from("analysis_runs")
    .insert({
      campaign_id: campaignResult.data.id,
      user_id: user.id,
      attempt: 1,
      idempotency_key: input.idempotencyKey,
      status: "queued",
      stage: "queued",
      score_algorithm_version: SCORE_ALGORITHM_VERSION,
    })
    .select("*")
    .single()

  if (runResult.error || !runResult.data) {
    if (isUniqueViolation(runResult.error)) {
      const retryExisting = await client
        .from("analysis_runs")
        .select("*")
        .eq("user_id", user.id)
        .eq("idempotency_key", input.idempotencyKey)
        .single()

      await client.from("campaigns").delete().eq("id", campaignResult.data.id).eq("user_id", user.id)

      if (!retryExisting.error && retryExisting.data) {
        const campaign = await getCampaignById(client, user.id, retryExisting.data.campaign_id)
        return { campaign, run: retryExisting.data }
      }
    }

    await client.from("campaigns").delete().eq("id", campaignResult.data.id).eq("user_id", user.id)
    throw new ApplicationError("DATABASE_ERROR", 500, "Unable to create analysis run")
  }

  return { campaign: campaignResult.data, run: runResult.data }
}

export async function getCampaignById(
  client: SupabaseClient<Database>,
  userId: string,
  campaignId: string,
): Promise<CampaignRow> {
  const result = await client
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("user_id", userId)
    .maybeSingle()

  if (result.error || !result.data) {
    throw new ApplicationError("CAMPAIGN_NOT_FOUND", 404, "Campaign was not found")
  }

  return result.data
}

export async function listOwnedCampaigns(input: {
  savedOnly?: boolean
} = {}): Promise<CampaignRow[]> {
  const { client, user } = await requireAuthenticatedUser()
  let query = client
    .from("campaigns")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50)
  if (input.savedOnly) query = query.eq("is_saved", true)
  const result = await query
  if (result.error) {
    throw new ApplicationError("DATABASE_ERROR", 500, "Unable to load campaign history")
  }
  return result.data
}

export async function updateCampaignSavedState(
  campaignId: string,
  isSaved: boolean
): Promise<CampaignRow> {
  const { client, user } = await requireAuthenticatedUser()
  const result = await client
    .from("campaigns")
    .update({ is_saved: isSaved })
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle()
  if (result.error || !result.data) {
    throw new ApplicationError("CAMPAIGN_NOT_FOUND", 404, "Campaign was not found")
  }
  return result.data
}

export async function getOwnedCampaign(campaignId: string): Promise<{
  client: SupabaseClient<Database>
  userId: string
  campaign: CampaignRow
}> {
  const { client, user } = await requireAuthenticatedUser()
  const campaign = await getCampaignById(client, user.id, campaignId)
  return { client, userId: user.id, campaign }
}
