import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { QlooComparisonSummary } from "@/lib/domain/types"

interface LaunchComparisonProps {
  comparison: QlooComparisonSummary | undefined
}

export function LaunchComparison({ comparison }: LaunchComparisonProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Qloo entity comparison</CardTitle>
            <CardDescription>Signals shared by the brand and the selected cultural references in this city.</CardDescription>
          </div>
          <Badge variant={comparison ? "secondary" : "outline"}>{comparison ? `${comparison.resultCount} shared signals` : "Unavailable"}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {comparison ? <>
          <p className="mb-4 text-sm text-muted-foreground">{comparison.groupA} compared with {comparison.groupB}. This is cultural adjacency evidence, not a partnership or performance prediction.</p>
          {comparison.topResults.length > 0 ? <div className="grid gap-2 sm:grid-cols-2">{comparison.topResults.map((result, index) => <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3" key={`${result.signalId}-${index}`}><div><p className="text-sm font-medium">{result.name ?? result.signalId}</p><p className="mt-1 text-xs text-muted-foreground">{result.types.join(" · ") || "Qloo signal"}</p></div>{result.affinity !== undefined ? <Badge variant="outline">{result.affinity.toFixed(2)}</Badge> : null}</div>)}</div> : <p className="text-sm text-muted-foreground">Qloo returned no comparable signals.</p>}
        </> : <p className="text-sm text-muted-foreground">Comparison data was not returned for this analysis.</p>}
      </CardContent>
    </Card>
  )
}
