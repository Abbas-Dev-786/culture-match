import type { SafeCreatorResult } from "@/lib/db/results"

const headers = [
  "variant",
  "rank",
  "name",
  "username",
  "platform",
  "profile_url",
  "followers",
  "engagement_rate",
  "is_verified",
  "campaign_fit_score",
  "evidence_completeness",
  "score_components",
  "evidence",
  "caveats",
  "report_summary",
  "campaign_concept",
] as const

export function campaignResultsToCsv(matches: SafeCreatorResult[]): string {
  const rows = matches.map((match) => [
    match.variant,
    match.rank,
    match.name,
    match.username,
    match.platform,
    match.profileUrl,
    match.followers,
    match.engagementRate,
    match.isVerified,
    match.campaignFitScore,
    match.evidenceCompleteness,
    JSON.stringify(match.scoreComponents),
    JSON.stringify(match.evidence),
    match.caveats.join("; "),
    match.reportSummary,
    match.campaignConcept ? JSON.stringify(match.campaignConcept) : undefined,
  ])

  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n")
}

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return ""
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}
