import { z } from "zod"
import type {
  CultureSignal,
  NormalizedCreator,
} from "@/lib/domain/types"

export const evidenceCriticDecisionSchema = z
  .object({
    decision: z.enum([
      "accept",
      "refine_qloo",
      "refine_creator_search",
      "stop_with_caveats",
    ]),
    verifiedQlooSignalCount: z.number().int().nonnegative(),
    representedReferenceCount: z.number().int().nonnegative(),
    populatedEvidenceLayerCount: z.number().int().nonnegative(),
    creatorEvidenceCoverage: z.number().min(0).max(1),
    caveats: z.array(z.string().trim().min(1).max(200)).max(5),
    summary: z.string().trim().min(1).max(240),
  })
  .strict()

export type EvidenceCriticDecision = z.infer<
  typeof evidenceCriticDecisionSchema
>

export function critiqueEvidence(input: {
  signals: CultureSignal[]
  culturalReferences: string[]
  populatedLayerCount: number
  creators: NormalizedCreator[]
  refinementCount: number
}): EvidenceCriticDecision {
  const verifiedQlooSignalCount = input.signals.filter(
    (signal) => signal.evidence.verification !== "unverified"
  ).length
  const normalizedReferences = input.culturalReferences.map(normalizeLabel)
  const representedReferenceCount = normalizedReferences.filter((reference) =>
    input.signals.some((signal) => normalizeLabel(signal.name).includes(reference))
  ).length
  const evidenceBearingCreators = input.creators.filter((creator) =>
    creator.evidence.some((evidence) => evidence.verification !== "unverified")
  ).length
  const creatorEvidenceCoverage = input.creators.length
    ? Math.min(1, evidenceBearingCreators / input.creators.length)
    : 0

  if (verifiedQlooSignalCount < 3 && input.refinementCount === 0) {
    return evidenceCriticDecisionSchema.parse({
      decision: "refine_qloo",
      verifiedQlooSignalCount,
      representedReferenceCount,
      populatedEvidenceLayerCount: input.populatedLayerCount,
      creatorEvidenceCoverage,
      caveats: ["Qloo evidence is too sparse to support a confident cultural match."],
      summary: "Refine Qloo inputs before treating the cultural profile as sufficient.",
    })
  }
  if (
    input.creators.length > 0 &&
    creatorEvidenceCoverage < 0.5 &&
    input.refinementCount === 0
  ) {
    return evidenceCriticDecisionSchema.parse({
      decision: "refine_creator_search",
      verifiedQlooSignalCount,
      representedReferenceCount,
      populatedEvidenceLayerCount: input.populatedLayerCount,
      creatorEvidenceCoverage,
      caveats: ["Creator evidence is sparse or concentrated in a small subset of results."],
      summary: "Refine creator discovery or request enrichment before scoring.",
    })
  }
  const caveats = [
    representedReferenceCount < normalizedReferences.length
      ? "Some cultural references are not directly represented in returned signals."
      : undefined,
    input.populatedLayerCount < 2
      ? "Evidence is concentrated in fewer than two cultural layers."
      : undefined,
    creatorEvidenceCoverage < 1
      ? "Some creator records remain provider-reported or incomplete."
      : undefined,
  ].filter((value): value is string => Boolean(value))
  return evidenceCriticDecisionSchema.parse({
    decision: caveats.length > 0 ? "stop_with_caveats" : "accept",
    verifiedQlooSignalCount,
    representedReferenceCount,
    populatedEvidenceLayerCount: input.populatedLayerCount,
    creatorEvidenceCoverage,
    caveats,
    summary:
      caveats.length > 0
        ? "Evidence is usable for deterministic scoring with explicit caveats."
        : "Evidence is sufficiently verified and distributed for deterministic scoring.",
  })
}

function normalizeLabel(value: string): string {
  return value.trim().toLocaleLowerCase().replaceAll(/[^\p{L}\p{N}]+/gu, " ")
}
