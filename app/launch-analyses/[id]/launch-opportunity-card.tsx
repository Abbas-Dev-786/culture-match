import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { SafeLaunchOpportunity } from "@/lib/domain/types"

export function LaunchOpportunityCard({ opportunity }: { opportunity: SafeLaunchOpportunity }) {
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2"><span className="font-mono text-sm text-muted-foreground">#{opportunity.rank}</span>{opportunity.name}</CardTitle><CardDescription className="mt-1">{opportunity.types.join(" · ")}</CardDescription></div><Badge variant="secondary">{Math.round(opportunity.evidenceCompleteness * 100)}% evidence</Badge></div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-3 gap-2 text-sm"><Metric label="Provider rank" value={opportunity.providerRank?.toString() ?? "—"} /><Metric label="Affinity" value={formatScore(opportunity.affinity)} /><Metric label="Popularity" value={formatScore(opportunity.popularity)} /></div>
        <div className="flex flex-wrap gap-2">{opportunity.evidence.map((item) => <Badge key={`${item.fieldPath}-${item.observedAt}`} variant="outline">{item.label ?? item.source}</Badge>)}</div>
        {opportunity.caveats.length > 0 ? <p className="text-xs leading-5 text-muted-foreground">{opportunity.caveats.join(" ")}</p> : null}
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-muted/50 p-2"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 font-mono text-sm">{value}</p></div>
}

function formatScore(value: number | undefined): string {
  return value === undefined ? "—" : value.toFixed(2)
}
