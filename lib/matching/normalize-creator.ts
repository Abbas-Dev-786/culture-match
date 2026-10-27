import type {
  CreatorCandidateRow,
  Json,
} from "@/lib/db/database.types"
import type { EvidenceRef, NormalizedCreator, JsonObject } from "@/lib/domain/types"
import type { CreatorContentSignal, QlooSignalRecord } from "@/lib/domain/types"

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
    ...(readNonNegativeNumber(payload.monthlyGrowthRate) !== undefined
      ? { monthlyGrowthRate: readNonNegativeNumber(payload.monthlyGrowthRate) }
      : {}),
    ...(readNonNegativeNumber(payload.postingFrequency) !== undefined
      ? { postingFrequency: readNonNegativeNumber(payload.postingFrequency) }
      : {}),
    ...(readNonNegativeNumber(payload.estimatedFee) !== undefined
      ? { estimatedFee: readNonNegativeNumber(payload.estimatedFee) }
      : {}),
    ...(readStringArray(payload.languages).length > 0
      ? { languages: readStringArray(payload.languages) }
      : {}),
    ...(readStringArray(payload.audienceRegions).length > 0
      ? { audienceRegions: readStringArray(payload.audienceRegions) }
      : {}),
    ...(typeof payload.qlooEntityId === "string"
      ? { qlooEntityId: payload.qlooEntityId }
      : {}),
    ...(readUnitNumber(payload.qlooAffinity) !== undefined
      ? { qlooAffinity: readUnitNumber(payload.qlooAffinity) }
      : {}),
    ...(readUnitNumber(payload.qlooPopularity) !== undefined
      ? { qlooPopularity: readUnitNumber(payload.qlooPopularity) }
      : {}),
    ...(typeof payload.qlooPersonEntityId === "string"
      ? { qlooPersonEntityId: payload.qlooPersonEntityId }
      : typeof payload.qlooEntityId === "string"
        ? { qlooPersonEntityId: payload.qlooEntityId }
        : {}),
    ...(readUnitNumber(payload.qlooPersonAffinity) !== undefined
      ? { qlooPersonAffinity: readUnitNumber(payload.qlooPersonAffinity) }
      : readUnitNumber(payload.qlooAffinity) !== undefined
        ? { qlooPersonAffinity: readUnitNumber(payload.qlooAffinity) }
        : {}),
    ...(readUnitNumber(payload.qlooPersonPopularity) !== undefined
      ? { qlooPersonPopularity: readUnitNumber(payload.qlooPersonPopularity) }
      : readUnitNumber(payload.qlooPopularity) !== undefined
        ? { qlooPersonPopularity: readUnitNumber(payload.qlooPopularity) }
        : {}),
    ...(row.is_verified !== null ? { isVerified: row.is_verified } : {}),
    ...(row.location_unverified !== null
      ? { locationUnverified: row.location_unverified }
      : {}),
    ...(row.provider_match_score !== null
      ? { providerMatchScore: row.provider_match_score }
      : {}),
    contentSignals: readContentSignals(payload.contentSignals),
    qlooSignals: readQlooSignals(payload.qlooSignals),
    qlooPersonSignals: readQlooSignals(payload.qlooPersonSignals),
    missingFields: readStringArray(payload.missingFields),
    sourceFields: isJsonObject(payload.sourceFields) ? payload.sourceFields : {},
    evidence,
  }
}

function readContentSignals(value: Json | undefined): CreatorContentSignal[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isJsonObject(item)) return []
    if (
      typeof item.text !== "string" ||
      typeof item.sourceField !== "string" ||
      !isEvidence(item.evidence)
    )
      return []
    return [
      {
        text: item.text,
        sourceField: item.sourceField,
        evidence: readEvidenceItem(item.evidence),
      },
    ]
  })
}

function readQlooSignals(value: Json | undefined): QlooSignalRecord[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isJsonObject(item)) return []
    if (
      typeof item.signalId !== "string" ||
      typeof item.name !== "string" ||
      !isQlooKind(item.kind) ||
      !Array.isArray(item.types) ||
      !isQlooGroup(item.sourceGroup) ||
      !isEvidence(item.evidence)
    )
      return []
    return [
      {
        signalId: item.signalId,
        kind: item.kind,
        name: item.name,
        types: item.types.filter(isString),
        ...(typeof item.affinity === "number"
          ? { affinity: item.affinity }
          : {}),
        ...(typeof item.inputWeight === "number"
          ? { inputWeight: item.inputWeight }
          : {}),
        sourceGroup: item.sourceGroup,
        evidence: readEvidenceItem(item.evidence),
      },
    ]
  })
}

function isEvidence(value: Json | undefined): boolean {
  return isJsonObject(value) &&
    typeof value.source === "string" &&
    typeof value.fieldPath === "string" &&
    typeof value.observedAt === "string" &&
    isVerification(value.verification)
}

function readEvidenceItem(value: Json): EvidenceRef {
  const item = value as JsonObject
  return {
    source: isEvidenceSource(item.source as string) ? item.source as EvidenceRef["source"] : "derived",
    fieldPath: item.fieldPath as string,
    observedAt: item.observedAt as string,
    verification: item.verification as EvidenceRef["verification"],
    ...(typeof item.label === "string" ? { label: item.label } : {}),
    ...(typeof item.providerEntityId === "string"
      ? { providerEntityId: item.providerEntityId }
      : {}),
    ...(typeof item.excerpt === "string" ? { excerpt: item.excerpt } : {}),
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

function isString(value: Json): value is string {
  return typeof value === "string"
}

function isQlooKind(value: Json | undefined): value is QlooSignalRecord["kind"] {
  return value === "entity" || value === "tag" || value === "audience" || value === "locality"
}

function isQlooGroup(value: Json | undefined): value is QlooSignalRecord["sourceGroup"] {
  return value === "market" || value === "brand" || value === "product" || value === "reference" || value === "combined" || value === "creator"
}

function isJsonObject(value: Json | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readStringArray(value: Json | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
}

function readNonNegativeNumber(value: Json | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined
}

function readUnitNumber(value: Json | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : undefined
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
