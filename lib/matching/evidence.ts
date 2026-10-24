import type { EvidenceRef, VerificationState } from "@/lib/domain/types"

export function providerFieldEvidence(input: {
  source: "qloo" | "apify"
  fieldPath: string
  observedAt: string
  excerpt?: string
  label?: string
  providerEntityId?: string
  verification?: VerificationState
}): EvidenceRef {
  return {
    source: input.source,
    fieldPath: input.fieldPath,
    observedAt: input.observedAt,
    verification: input.verification ?? "provider_reported",
    ...(input.label ? { label: input.label } : {}),
    ...(input.providerEntityId
      ? { providerEntityId: input.providerEntityId }
      : {}),
    ...(input.excerpt ? { excerpt: input.excerpt.slice(0, 200) } : {}),
  }
}

export function derivedEvidence(
  label: string,
  fieldPath: string,
  observedAt: string,
  excerpt?: string
): EvidenceRef {
  return {
    source: "derived",
    label,
    fieldPath,
    observedAt,
    verification: "unverified",
    ...(excerpt ? { excerpt: excerpt.slice(0, 200) } : {}),
  }
}

export function userInputEvidence(
  label: string,
  fieldPath: string,
  observedAt: string,
  excerpt?: string
): EvidenceRef {
  return {
    source: "user_input",
    label,
    fieldPath,
    observedAt,
    verification: "verified",
    ...(excerpt ? { excerpt: excerpt.slice(0, 200) } : {}),
  }
}

export function evidenceKey(evidence: EvidenceRef): string {
  return `${evidence.source}:${evidence.fieldPath}`
}

export function evidenceCompleteness(
  availableWeight: number,
  totalWeight: number
): number {
  if (totalWeight <= 0) return 0
  return Math.round((availableWeight / totalWeight) * 10000) / 10000
}
