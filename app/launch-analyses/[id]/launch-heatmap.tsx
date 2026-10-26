import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { QlooHeatmap } from "@/lib/domain/types"

interface LaunchHeatmapProps {
  heatmap: QlooHeatmap | undefined
}

export function LaunchHeatmap({ heatmap }: LaunchHeatmapProps) {
  const points = heatmap?.points ?? []
  const bounds = getBounds(points)
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Cultural signal concentration</CardTitle><CardDescription>Qloo heatmap points for the selected launch inputs.</CardDescription></div><Badge variant={points.length > 0 ? "secondary" : "outline"}>{points.length > 0 ? `${points.length} points` : "Unavailable"}</Badge></div>
      </CardHeader>
      <CardContent>
        {points.length > 0 && bounds ? <>
          <div className="relative h-64 overflow-hidden rounded-2xl border bg-[radial-gradient(circle_at_center,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_62%),linear-gradient(135deg,color-mix(in_oklch,var(--muted)_85%,transparent),var(--background))]" aria-label="Qloo cultural signal concentration heatmap">
            {points.map((point, index) => { const position = toPosition(point.latitude, point.longitude, bounds); return <span className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-4 ring-primary/15" key={`${point.geohash ?? index}-${point.latitude}-${point.longitude}`} style={{ left: `${position.x}%`, top: `${position.y}%`, opacity: Math.max(0.3, Math.min(1, point.affinity ?? point.popularity ?? 0.65)) }} title={`${point.latitude.toFixed(3)}, ${point.longitude.toFixed(3)}`} /> })}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{heatmap?.boundary ?? "city"} boundary · {bounds.minLatitude.toFixed(3)}–{bounds.maxLatitude.toFixed(3)} latitude</span><span>Higher opacity indicates stronger returned signal</span></div>
          <p className="mt-3 text-xs text-muted-foreground">This visualizes cultural signal concentration, not creator audience geography, footfall, or expected campaign performance.</p>
        </> : <p className="text-sm text-muted-foreground">Heatmap data was not returned for this analysis.</p>}
      </CardContent>
    </Card>
  )
}

interface HeatmapBounds { minLatitude: number; maxLatitude: number; minLongitude: number; maxLongitude: number }

function getBounds(points: QlooHeatmap["points"]): HeatmapBounds | undefined {
  if (points.length === 0) return undefined
  const latitudes = points.map((point) => point.latitude)
  const longitudes = points.map((point) => point.longitude)
  return { minLatitude: Math.min(...latitudes), maxLatitude: Math.max(...latitudes), minLongitude: Math.min(...longitudes), maxLongitude: Math.max(...longitudes) }
}

function toPosition(latitude: number, longitude: number, bounds: HeatmapBounds): { x: number; y: number } {
  const longitudeRange = Math.max(bounds.maxLongitude - bounds.minLongitude, 0.0001)
  const latitudeRange = Math.max(bounds.maxLatitude - bounds.minLatitude, 0.0001)
  return { x: ((longitude - bounds.minLongitude) / longitudeRange) * 88 + 6, y: (1 - (latitude - bounds.minLatitude) / latitudeRange) * 78 + 11 }
}
