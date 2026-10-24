import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreatorCard } from "./creator-card"
import type { CampaignMatchView, ComparisonView } from "./types"

interface BaselineComparisonProps {
  comparison: ComparisonView
  baseline: CampaignMatchView[]
  cultureInformed: CampaignMatchView[]
}

export function BaselineComparison({
  comparison,
  baseline,
  cultureInformed,
}: BaselineComparisonProps) {
  return (
    <Card className="print-break-inside-avoid">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Baseline vs culture-informed</CardTitle>
            <CardDescription>
              {comparison.overlapCount} of {comparison.baselineCount} baseline creators also appear in the culture-informed shortlist ({Math.round(comparison.overlapRate * 100)}% overlap).
            </CardDescription>
          </div>
          <Badge variant={comparison.materiallyChanged ? "secondary" : "outline"}>
            {comparison.materiallyChanged ? "Shortlist changed" : "Little or no material change"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          {comparison.materiallyChanged
            ? "Cultural signals changed the shortlist or ranking. Review the movement and evidence below."
            : "The cultural signals did not materially change this shortlist; that is a valid result for this brief."}
        </p>
        <Tabs defaultValue="culture" className="w-full">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="culture">Culture-informed ({cultureInformed.length})</TabsTrigger>
            <TabsTrigger value="baseline">Baseline ({baseline.length})</TabsTrigger>
            <TabsTrigger value="changes">Changes ({comparison.rankChanges.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="culture" className="mt-4 grid gap-3">
            {cultureInformed.length > 0 ? cultureInformed.map((match) => <CreatorCard key={match.id} match={match} />) : <EmptyMessage label="No culture-informed creators were returned." />}
          </TabsContent>
          <TabsContent value="baseline" className="mt-4 grid gap-3">
            {baseline.length > 0 ? baseline.map((match) => <CreatorCard key={match.id} match={match} />) : <EmptyMessage label="No baseline creators were returned." />}
          </TabsContent>
          <TabsContent value="changes" className="mt-4">
            <div className="grid gap-4">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <ChangeList label="Only in baseline" values={comparison.baselineOnlyIds} />
                <ChangeList label="Only in culture-informed" values={comparison.cultureInformedOnlyIds} />
              </div>
              {comparison.rankChanges.length > 0 ? (
                <ul className="grid gap-2 text-sm text-muted-foreground">
                  {comparison.rankChanges.map((change) => (
                    <li key={change.providerCreatorId} className="rounded-lg border p-3">
                      <span className="font-medium text-foreground">{change.providerCreatorId}</span>: baseline #{change.baselineRank ?? "-"} → culture-informed #{change.cultureInformedRank ?? "-"}{change.scoreDelta !== undefined ? ` (${change.scoreDelta > 0 ? "+" : ""}${change.scoreDelta} score)` : ""}
                    </li>
                  ))}
                </ul>
              ) : <EmptyMessage label="No rank or score changes were detected." />}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function EmptyMessage({ label }: { label: string }) {
  return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{label}</p>
}

function ChangeList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="font-medium">{label}</p>
      {values.length > 0 ? <ul className="mt-2 grid gap-1 text-muted-foreground">{values.map((value) => <li key={value}>{value}</li>)}</ul> : <p className="mt-2 text-muted-foreground">None</p>}
    </div>
  )
}
