import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { MatchBreakdown } from "./match-breakdown"
import type { CampaignMatchView } from "./types"

export function CreatorCard({ match }: { match: CampaignMatchView }) {
  return (
    <Card className="p-4 print-break-inside-avoid">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">#{match.rank} · {match.platform}</p>
          <h3 className="font-medium">{match.name}</h3>
          {match.username ? <p className="text-sm text-muted-foreground">@{match.username}</p> : null}
          {match.profileUrl ? (
            <a className="text-sm text-primary underline underline-offset-4" href={match.profileUrl} target="_blank" rel="noreferrer">Open public profile</a>
          ) : null}
        </div>
        <Badge variant="secondary">
          {match.campaignFitScore === null ? "Score unavailable" : `${match.campaignFitScore}/100`}
        </Badge>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
        <div><dt className="text-muted-foreground">Followers</dt><dd>{match.followers === undefined ? "Unavailable" : formatNumber(match.followers)}</dd></div>
        <div><dt className="text-muted-foreground">Engagement</dt><dd>{match.engagementRate === undefined ? "Unavailable" : `${(match.engagementRate * 100).toFixed(2)}%`}</dd></div>
        <div><dt className="text-muted-foreground">Verification</dt><dd>{match.isVerified === undefined ? "Unavailable" : match.isVerified ? "Verified" : "Not verified"}</dd></div>
        <div><dt className="text-muted-foreground">Evidence</dt><dd>{Math.round(match.evidenceCompleteness * 100)}% complete</dd></div>
      </dl>
      {match.locationUnverified ? <p className="mt-3 text-xs text-muted-foreground">Audience geography was not verified by the provider.</p> : null}
      {match.bio ? <p className="mt-3 text-sm text-muted-foreground">{match.bio}</p> : null}
      {match.reportSummary ? <p className="mt-3 text-sm">{match.reportSummary}</p> : null}
      <MatchBreakdown match={match} />
      {match.campaignConcept ? (
        <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">
          <p className="font-medium">{match.campaignConcept.title} · AI hypothesis</p>
          <p className="mt-1">{match.campaignConcept.idea}</p>
          <p className="mt-2 text-xs text-muted-foreground">{match.campaignConcept.rationale}</p>
        </div>
      ) : null}
      {match.caveats.length > 0 ? <p className="mt-3 text-xs text-muted-foreground">Caveats: {match.caveats.join("; ")}</p> : null}
    </Card>
  )
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value)
}
