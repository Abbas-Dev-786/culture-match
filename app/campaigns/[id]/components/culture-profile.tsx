import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { CultureProfileView } from "./types"

export function CultureProfile({ profile }: { profile: CultureProfileView }) {
  return (
    <Card className="print-break-inside-avoid">
      <CardHeader>
        <CardTitle>Regional culture profile</CardTitle>
        <CardDescription>
          {profile.location?.name ?? profile.locationQuery ?? "Target market"} · {profile.signalCount} Qloo signals
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-2" aria-label="Returned Qloo signals">
          {profile.signals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Qloo signals were returned.</p>
          ) : (
            profile.signals.map((signal) => (
              <div key={`${signal.name}-${signal.evidence.fieldPath}`} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{signal.name}{signal.affinity !== undefined ? ` · ${signal.affinity.toFixed(2)}` : ""}</Badge>
                  <span className="text-xs text-muted-foreground">{signal.types.join(", ")}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Source: Qloo · {signal.evidence.label ?? signal.evidence.fieldPath}</p>
              </div>
            ))
          )}
        </div>
        <div className="grid gap-2 text-sm">
          <p className="font-medium">Reference resolution</p>
          {profile.resolvedReferences.length === 0 ? (
            <p className="text-muted-foreground">No cultural references were supplied.</p>
          ) : (
            profile.resolvedReferences.map((reference) => (
              <p key={reference.reference} className="text-muted-foreground">
                <span className="text-foreground">{reference.reference}</span>: {reference.status}{reference.name ? ` (${reference.name})` : ""}
                {reference.candidates && reference.candidates.length > 0 ? ` — candidates: ${reference.candidates.map((candidate) => candidate.name).join(", ")}` : ""}
              </p>
            ))
          )}
          {profile.unresolvedReferences.length > 0 ? (
            <p className="text-amber-700 dark:text-amber-300">
              Unresolved references: {profile.unresolvedReferences.join(", ")}
            </p>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Search plan: {profile.searchPlanSource ?? "deterministic"}. Qloo signals are provider-reported inputs, not audience guarantees.
        </p>
      </CardContent>
    </Card>
  )
}
