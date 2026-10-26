import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { QlooFingerprint } from "@/lib/domain/types"

interface LaunchFingerprintProps {
  fingerprint: QlooFingerprint
}

export function LaunchFingerprint({ fingerprint }: LaunchFingerprintProps) {
  const signals = fingerprint.layers.flatMap((layer) => layer.signals)
  return (
    <Card>
      <CardHeader>
        <CardTitle>City cultural fingerprint</CardTitle>
        <CardDescription>{fingerprint.location.name} · {signals.length} signals across {fingerprint.layers.length} cultural layers</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="flex flex-wrap gap-2">{fingerprint.layers.map((layer) => <Badge key={layer.group} variant="secondary">{layer.label} · {layer.signals.length}</Badge>)}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {signals.slice(0, 12).map((signal) => <div className="rounded-xl border bg-muted/20 p-3" key={`${signal.sourceGroup}-${signal.signalId}`}>
            <div className="flex items-start justify-between gap-3"><p className="text-sm font-medium">{signal.name}</p><Badge variant="outline">Qloo</Badge></div>
            <p className="mt-1 text-xs text-muted-foreground">{signal.sourceGroup} {signal.affinity !== undefined ? `· affinity ${signal.affinity.toFixed(2)}` : ""}</p>
          </div>)}
        </div>
        {fingerprint.unresolvedInputs.length > 0 ? <p className="text-sm text-muted-foreground">Unresolved references: {fingerprint.unresolvedInputs.join(", ")}</p> : null}
      </CardContent>
    </Card>
  )
}
