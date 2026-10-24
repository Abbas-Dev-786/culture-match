import type {
  CreatorCandidateRow,
  Json,
} from "@/lib/db/database.types"
import type { EvidenceRef, NormalizedCreator, JsonObject } from "@/lib/domain/types"

export function normalizeStoredCreator(
  row: CreatorCandidateRow
): NormalizedCreator {
  const payload = isJsonObject(row.normalized_payload)
    ? row.normalized_payload
    : {}
  const evidence = readEvidence(row.evidence)
  return {
    provider: "apify",
    providerCreatorId: row.provider_creator_id,
    name: row.name,
    platform: row.platform,
    ...(row.username ? { username: row.username } : {}),
    ...(row.profile_url ? { profileUrl: row.profile_url } : {}),
    ...(row.bio ? { bio: row.bio } : {}),
    ...(row.followers !== null ? { followers: row.followers } : {}),
    ...(row.engagement_rate !== null
      ? { engagementRate: row.engagement_rate }
      : {}),
    ...(row.is_verified !== null ? { isVerified: row.is_verified } : {}),
    ...(row.location_unverified !== null
      ? { locationUnverified: row.location_unverified }
      : {}),
    ...(row.provider_match_score !== null
      ? { providerMatchScore: row.provider_match_score }
      : {}),
    missingFields: readStringArray(payload.missingFields),
    sourceFields: isJsonObject(payload.sourceFields) ? payload.sourceFields : {},
    evidence,
  }
}

function readEvidence(value: Json): EvidenceRef[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isJsonObject(item)) return []
    if (
      typeof item.source !== "string" ||
      typeof item.fieldPath !== "string" ||
      typeof item.observedAt !== "string" ||
      !isVerification(item.verification)
    )
      return []
    return [
      {
        source: isEvidenceSource(item.source) ? item.source : "derived",
        fieldPath: item.fieldPath,
        observedAt: item.observedAt,
        verification: item.verification,
        ...(typeof item.label === "string" ? { label: item.label } : {}),
        ...(typeof item.providerEntityId === "string"
          ? { providerEntityId: item.providerEntityId }
          : {}),
        ...(typeof item.excerpt === "string" ? { excerpt: item.excerpt } : {}),
      },
    ]
  })
}

function isJsonObject(value: Json): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readStringArray(value: Json | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
}

function isEvidenceSource(
  value: string
): value is EvidenceRef["source"] {
  return ["qloo", "apify", "user_input", "derived"].includes(value)
}

function isVerification(value: Json | undefined): value is EvidenceRef["verification"] {
  return (
    value === "verified" ||
    value === "provider_reported" ||
    value === "unverified"
  )
}
