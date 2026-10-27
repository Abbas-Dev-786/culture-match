import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { MatchBreakdown } from "./match-breakdown"
import type { CampaignMatchView } from "./types"

export function CreatorCard({ match }: { match: CampaignMatchView }) {
  return (
    <Card className="p-4 print-break-inside-avoid">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">#{match.rank} · {match.platform}</p>
          <h3 className="truncate font-medium">{match.name}</h3>
          {match.username ? <p className="text-sm text-muted-foreground">@{match.username}</p> : null}
          {match.profileUrl ? (
            <a className="text-sm text-primary underline underline-offset-4" href={match.profileUrl} target="_blank" rel="noreferrer">Open public profile</a>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={scoreVariant(match.campaignFitScore)}>
            {scoreLabel(match.campaignFitScore)}
          </Badge>
          {match.campaignFitScore !== null ? (
            <span className="text-2xl font-semibold tracking-tight">{match.campaignFitScore}</span>
          ) : null}
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
        <Metric label="Tier" value={match.creatorTier} />
        <Metric label="Followers" value={match.followers === undefined ? "Unavailable" : formatNumber(match.followers)} />
        <Metric label="Engagement" value={match.engagementRate === undefined ? "Unavailable" : `${(match.engagementRate * 100).toFixed(2)}%`} />
        <Metric label="Qloo affinity" value={match.qlooAffinity === undefined ? "Unavailable" : `${(match.qlooAffinity * 100).toFixed(0)}/100`} />
      </dl>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <p><span className="text-muted-foreground">Regional match:</span> {formatConstraint(match.regionalMatch)}</p>
        <p><span className="text-muted-foreground">Language match:</span> {formatConstraint(match.languageMatch)}</p>
      </div>

      {match.matchReasons.length > 0 ? (
        <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-medium">Why they match</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
            {match.matchReasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </div>
      ) : null}

      {match.locationUnverified ? <p className="mt-3 text-xs text-muted-foreground">Audience geography was not verified by the provider.</p> : null}

      <Accordion multiple className="mt-4">
        <AccordionItem value="details">
          <AccordionTrigger>Creator details and observed signals</AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-4">
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <Metric label="Growth" value={match.monthlyGrowthRate === undefined ? "Unavailable" : formatRate(match.monthlyGrowthRate)} />
                <Metric label="Posts / month" value={match.postingFrequency === undefined ? "Unavailable" : match.postingFrequency} />
                <Metric label="Verification" value={match.isVerified === undefined ? "Unavailable" : match.isVerified ? "Verified" : "Not verified"} />
                <Metric label="Evidence" value={`${Math.round(match.evidenceCompleteness * 100)}% complete`} />
                <Metric label="Estimated fee" value={match.estimatedFee === undefined ? "Unavailable" : formatNumber(match.estimatedFee)} />
              </dl>
              {match.bio ? <p className="text-sm text-muted-foreground">{match.bio}</p> : null}
              {match.contentSignals && match.contentSignals.length > 0 ? (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="font-medium">Observed content signals</p>
                  <p className="mt-1 text-muted-foreground">
                    {match.contentSignals.slice(0, 3).map((signal) => signal.text).join(" · ")}
                  </p>
                  {match.qlooSignals && match.qlooSignals.length > 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Qloo-resolved: {match.qlooSignals.map((signal) => `${signal.name}${signal.affinity !== undefined ? ` (${signal.affinity.toFixed(2)})` : ""}`).join(", ")}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">No creator-content signal was resolved by Qloo.</p>
                  )}
                </div>
              ) : null}
              {match.reportSummary ? <p className="text-sm">{match.reportSummary}</p> : null}
              {match.campaignConcept ? (
                <div className="rounded-lg bg-muted/40 p-3 text-sm">
                  <p className="font-medium">{match.campaignConcept.title} · AI hypothesis</p>
                  <p className="mt-1">{match.campaignConcept.idea}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{match.campaignConcept.rationale}</p>
                </div>
              ) : null}
              {match.caveats.length > 0 ? <p className="text-xs text-muted-foreground">Caveats: {match.caveats.join("; ")}</p> : null}
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="scoring">
          <AccordionTrigger>Scoring evidence and audit trail</AccordionTrigger>
          <AccordionContent>
            <MatchBreakdown match={match} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value)
}

function formatRate(value: number): string {
  return `${(value <= 1 ? value * 100 : value).toFixed(1)}%`
}

function scoreLabel(value: number | null): string {
  if (value === null) return "Score unavailable"
  if (value >= 85) return "Top match"
  if (value >= 70) return "Strong match"
  if (value >= 50) return "Moderate match"
  return "Weak match"
}

function scoreVariant(value: number | null): "default" | "secondary" | "outline" | "destructive" {
  if (value === null || value < 50) return "destructive"
  if (value < 70) return "outline"
  if (value < 85) return "secondary"
  return "default"
}

function formatConstraint(value: "matched" | "not_matched" | "unverified"): string {
  if (value === "matched") return "Matched"
  if (value === "not_matched") return "Not matched"
  return "Unverified"
}
