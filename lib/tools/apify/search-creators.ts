import type {
  CreatorContentSignal,
  NormalizedCreator,
  JsonObject,
  EvidenceRef,
} from "../../domain/types.ts"
import type { ApifyClient } from "./client.ts"
import { ProviderError } from "../provider-errors.ts"
import {
  searchPlanSchema,
  type ActorSearchPlan,
  type SearchPlan,
} from "../../workflow/search-plan.ts"

export async function startCreatorSearch(
  client: ApifyClient,
  plan: SearchPlan,
  idempotencyKey: string
): Promise<{ runId: string; datasetId?: string }> {
  const input = searchPlanSchema.parse({
    query: plan.query,
    platforms: plan.platforms,
    ...(plan.minFollowers !== undefined
      ? { minFollowers: plan.minFollowers }
      : {}),
    ...(plan.maxFollowers !== undefined
      ? { maxFollowers: plan.maxFollowers }
      : {}),
    ...(plan.minEngagementRate !== undefined
      ? { minEngagementRate: plan.minEngagementRate }
      : {}),
    ...(plan.maxEngagementRate !== undefined
      ? { maxEngagementRate: plan.maxEngagementRate }
      : {}),
    ...(plan.verified !== undefined ? { verified: plan.verified } : {}),
    maxResults: plan.maxResults,
  })
  const run = await client.startRun(toActorInput(input), idempotencyKey)
  return {
    runId: run.id,
    ...(run.datasetId ? { datasetId: run.datasetId } : {}),
  }
}

export function toActorInput(plan: ActorSearchPlan): JsonObject {
  const input: JsonObject = {
    query: plan.query,
    platforms: plan.platforms,
    maxResults: plan.maxResults,
  }
  if (plan.minFollowers !== undefined) input.minFollowers = plan.minFollowers
  if (plan.maxFollowers !== undefined) input.maxFollowers = plan.maxFollowers
  if (plan.minEngagementRate !== undefined)
    input.minEngagementRate = plan.minEngagementRate
  if (plan.maxEngagementRate !== undefined)
    input.maxEngagementRate = plan.maxEngagementRate
  if (plan.verified !== undefined) input.verified = plan.verified
  return input
}

export async function loadCreatorResults(
  client: ApifyClient,
  datasetId: string,
  observedAt = new Date().toISOString(),
  maxResults = 100
): Promise<NormalizedCreator[]> {
  const items = await client.getDatasetItems(datasetId)
  const uniqueCreators = new Map<string, NormalizedCreator>()
  for (const item of items) {
    for (const creator of normalizeCreator(item, observedAt)) {
      if (!uniqueCreators.has(creator.providerCreatorId)) {
        uniqueCreators.set(creator.providerCreatorId, creator)
      }
    }
  }
  const creators = [...uniqueCreators.values()].slice(0, maxResults)
  if (creators.length === 0) {
    throw new ProviderError({
      provider: "apify",
      code: "EMPTY_RESULT",
      message: "Apify completed without usable creator results",
      retryable: false,
    })
  }
  return creators
}

function normalizeCreator(
  value: unknown,
  observedAt: string
): NormalizedCreator[] {
  if (!isRecord(value)) return []
  const creator = isRecord(value.creator) ? value.creator : undefined
  const profile = isRecord(value.primary_profile)
    ? value.primary_profile
    : isRecord(value.relevant_profile)
      ? value.relevant_profile
      : undefined
  if (!creator || !profile) return []

  const providerCreatorId = readString(profile.id) ?? readString(creator.id)
  const name = readString(creator.name)
  const platform = readString(profile.platform)
  if (!providerCreatorId || !name || !platform) return []

  const evidence: EvidenceRef[] = []
  const bio = readString(creator.bio)
  const contentSignals = extractContentSignals(value, bio, observedAt)
  const username = readString(profile.username)
  const profileUrl = readString(profile.url)
  const followers = readNonNegativeNumber(profile.followers)
  const engagementRate = readNonNegativeNumber(profile.engagement_rate)
  const isVerified =
    typeof profile.is_verified === "boolean" ? profile.is_verified : undefined
  const locationUnverified =
    typeof value.location_unverified === "boolean"
      ? value.location_unverified
      : true
  const providerMatchScore = isRecord(value.match)
    ? readUnitNumber(value.match.score)
    : undefined
  const missingFields = [
    followers === undefined ? "followers" : undefined,
    engagementRate === undefined ? "engagementRate" : undefined,
    isVerified === undefined ? "isVerified" : undefined,
    bio === undefined ? "bio" : undefined,
    contentSignals.length === 0 ? "contentSignals" : undefined,
    locationUnverified ? "audienceLocations" : undefined,
    "languages",
    "fees",
  ].filter((field): field is string => field !== undefined)

  if (bio) evidence.push(fieldEvidence("$.creator.bio", observedAt, bio))
  if (username)
    evidence.push(
      fieldEvidence("$.primary_profile.username", observedAt, username)
    )
  if (profileUrl)
    evidence.push(
      fieldEvidence("$.primary_profile.url", observedAt, profileUrl)
    )
  if (followers !== undefined)
    evidence.push(
      fieldEvidence(
        "$.primary_profile.followers",
        observedAt,
        String(followers)
      )
    )
  if (engagementRate !== undefined)
    evidence.push(
      fieldEvidence(
        "$.primary_profile.engagement_rate",
        observedAt,
        String(engagementRate)
      )
    )
  if (isVerified !== undefined)
    evidence.push(
      fieldEvidence(
        "$.primary_profile.is_verified",
        observedAt,
        String(isVerified)
      )
    )
  if (typeof value.location_unverified === "boolean")
    evidence.push(
      fieldEvidence(
        "$.location_unverified",
        observedAt,
        String(locationUnverified)
      )
    )
  if (providerMatchScore !== undefined)
    evidence.push(
      fieldEvidence("$.match.score", observedAt, String(providerMatchScore))
    )

  return [
    {
      provider: "apify",
      providerCreatorId,
      name,
      platform,
      ...(username ? { username } : {}),
      ...(profileUrl ? { profileUrl } : {}),
      ...(bio ? { bio } : {}),
      ...(followers !== undefined ? { followers } : {}),
      ...(engagementRate !== undefined ? { engagementRate } : {}),
      ...(isVerified !== undefined ? { isVerified } : {}),
      locationUnverified,
      ...(providerMatchScore !== undefined ? { providerMatchScore } : {}),
      missingFields,
      contentSignals,
      sourceFields: {
        ...(bio ? { bio } : {}),
        ...(username ? { username } : {}),
        ...(profileUrl ? { profileUrl } : {}),
        ...(followers !== undefined ? { followers } : {}),
        ...(engagementRate !== undefined ? { engagementRate } : {}),
        ...(isVerified !== undefined ? { isVerified } : {}),
        locationUnverified,
        ...(providerMatchScore !== undefined ? { providerMatchScore } : {}),
        contentSignals: contentSignals.map((signal) => signal.text),
      },
      evidence,
    },
  ]
}

function extractContentSignals(
  value: Record<string, unknown>,
  bio: string | undefined,
  observedAt: string
): CreatorContentSignal[] {
  const signals: CreatorContentSignal[] = []
  if (bio) {
    signals.push({
      text: bio,
      sourceField: "$.creator.bio",
      evidence: fieldEvidence("$.creator.bio", observedAt, bio),
    })
  }

  for (const collectionKey of ["posts", "recent_posts", "content"]) {
    const collection = value[collectionKey]
    if (!Array.isArray(collection)) continue
    for (const [index, item] of collection.entries()) {
      if (!isRecord(item)) continue
      const text =
        readString(item.caption) ??
        readString(item.text) ??
        readString(item.description)
      const hashtags = readStringArray(item.hashtags)
      const content = [text, ...hashtags].filter(
        (part): part is string => Boolean(part)
      )
      if (content.length === 0) continue
      const excerpt = content.join(" ").slice(0, 500)
      signals.push({
        text: excerpt,
        sourceField: `$.${collectionKey}[${index}]`,
        evidence: fieldEvidence(
          `$.${collectionKey}[${index}]`,
          observedAt,
          excerpt
        ),
      })
      if (signals.length >= 20) return signals
    }
  }
  return signals
}

function fieldEvidence(
  fieldPath: string,
  observedAt: string,
  excerpt: string
): EvidenceRef {
  return {
    source: "apify",
    label: fieldPath.replace(/^\$\./, "").replaceAll(".", " "),
    fieldPath,
    observedAt,
    verification: "provider_reported",
    excerpt: excerpt.slice(0, 200),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0
      )
    : []
}

function readNonNegativeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined
}

function readUnitNumber(value: unknown): number | undefined {
  const number = readNonNegativeNumber(value)
  return number !== undefined && number <= 1 ? number : undefined
}
