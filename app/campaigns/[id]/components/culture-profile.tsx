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
        {profile.fingerprint ? (
          <div className="grid gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">Qloo cultural fingerprint</p>
              <Badge variant="outline">
                {profile.fingerprint.tagOperator ?? "default"} signal operator
              </Badge>
            </div>
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
              <p>Signals: <span className="font-medium text-foreground">{profile.fingerprint.signals.length}</span></p>
              <p>Unresolved inputs: <span className="font-medium text-foreground">{profile.fingerprint.unresolvedInputs.length}</span></p>
              <p>Explainability: <span className="font-medium text-foreground">{profile.fingerprint.explainabilityRequested ? "Requested" : "Not requested"}</span></p>
            </div>
            {profile.fingerprint.conditioning ? (
              <p className="text-xs text-muted-foreground">
                Explicit conditioning: {profile.fingerprint.conditioning.audienceIds.length} audience IDs{profile.fingerprint.conditioning.ageRange ? ` · age ${profile.fingerprint.conditioning.ageRange}` : ""}{profile.fingerprint.conditioning.gender ? ` · gender ${profile.fingerprint.conditioning.gender}` : ""}.
              </p>
            ) : null}
            <div className="grid gap-2">
              {profile.fingerprint.signals.slice(0, 8).map((signal) => (
                <div key={`${signal.signalId}-${signal.sourceGroup}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-2">
                  <span>{signal.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {signal.sourceGroup} · {signal.kind}
                    {signal.affinity !== undefined ? ` · affinity ${signal.affinity.toFixed(2)}` : ""}
                  </span>
                </div>
              ))}
            </div>
            {profile.fingerprint.unresolvedInputs.length > 0 ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Unresolved Qloo inputs: {profile.fingerprint.unresolvedInputs.join(", ")}
              </p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {profile.fingerprint.layers.map((layer) => (
                <div key={layer.group} className="rounded-lg border bg-background p-2 text-xs">
                  <p className="font-medium">{layer.label}</p>
                  <p className="mt-1 text-muted-foreground">{layer.signals.length} signals · {layer.unresolvedInputs.length} unresolved</p>
                </div>
              ))}
            </div>
            {profile.fingerprint.comparison ? (
              <div className="rounded-lg border bg-background p-3 text-xs">
                <p className="font-medium">Qloo entity comparison</p>
                <p className="mt-1 text-muted-foreground">
                  {profile.fingerprint.comparison.groupA} vs {profile.fingerprint.comparison.groupB}: {profile.fingerprint.comparison.resultCount} returned comparison signals.
                </p>
              </div>
            ) : null}
            {profile.fingerprint.heatmap && profile.fingerprint.heatmap.points.length > 0 ? (
              <div className="rounded-lg border bg-background p-3 text-xs">
                <p className="font-medium">Qloo signal heatmap</p>
                <p className="mt-1 text-muted-foreground">{profile.fingerprint.heatmap.points.length} geospatial points · {profile.fingerprint.heatmap.boundary} boundary</p>
                <div className="mt-3 flex flex-wrap gap-1" aria-label="Qloo signal heatmap points">
                  {profile.fingerprint.heatmap.points.slice(0, 40).map((point, index) => {
                    const intensity = Math.max(0.15, Math.min(1, point.affinity ?? point.popularity ?? 0.5))
                    return <span key={`${point.geohash ?? index}-${point.latitude}`} title={`${point.latitude.toFixed(3)}, ${point.longitude.toFixed(3)}`} className="h-4 w-4 rounded-full bg-emerald-500" style={{ opacity: intensity }} />
                  })}
                </div>
                <p className="mt-2 text-muted-foreground">This visualizes Qloo signal concentration, not creator audience geography.</p>
              </div>
            ) : null}
          </div>
        ) : null}
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
