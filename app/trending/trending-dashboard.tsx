"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { ArrowLeft, TrendingUp } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { TrendingEntity } from "@/lib/domain/types"

interface TrendingResponse {
  trending?: TrendingEntity[]
  sourceNote?: string
  error?: { message: string }
}

export function TrendingDashboard() {
  const [entities, setEntities] = useState<TrendingEntity[]>([])
  const [sourceNote, setSourceNote] = useState<string>()
  const [error, setError] = useState<string>()
  const [isLoading, setIsLoading] = useState(true)
  const [location, setLocation] = useState("")
  const [submittedLocation, setSubmittedLocation] = useState("")

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const query = submittedLocation ? `&location=${encodeURIComponent(submittedLocation)}` : ""
        const response = await fetch(`/api/trending?take=20${query}`, { cache: "no-store" })
        const body = (await response.json()) as TrendingResponse
        if (!response.ok || !body.trending) {
          setError(body.error?.message ?? "Unable to load Qloo trends")
          return
        }
        setEntities(body.trending)
        setSourceNote(body.sourceNote)
      } catch {
        setError("Unable to reach the trend service.")
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [submittedLocation])

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setIsLoading(true)
    setSubmittedLocation(location.trim())
  }

  return (
    <main className="min-h-svh bg-muted/30 p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm text-muted-foreground">CultureMatch / Trends</p><h1 className="font-heading text-3xl font-semibold tracking-tight">Trending public figures</h1><p className="mt-1 text-sm text-muted-foreground">A directional Qloo view of current cultural momentum.</p></div>
          <Button variant="ghost" nativeButton={false} render={<Link href="/campaigns" />}><ArrowLeft /> Campaign history</Button>
        </div>
        <Alert><AlertDescription>{sourceNote ?? "Qloo trends are directional cultural evidence, not Instagram reach or campaign-performance data."}</AlertDescription></Alert>
        <form className="mt-4 flex flex-wrap gap-2" onSubmit={handleSubmit}>
          <Input className="max-w-sm" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Optional region, e.g. Berlin" aria-label="Trend region" />
          <Button type="submit">Load regional trends</Button>
        </form>
        {error ? <Alert className="mt-4" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
        {isLoading ? <Card className="mt-5"><CardContent className="p-6 text-sm text-muted-foreground">Loading Qloo trends...</CardContent></Card> : null}
        {!isLoading && !error && entities.length === 0 ? <Card className="mt-5"><CardContent className="p-6 text-sm text-muted-foreground">Qloo returned no trend entities for this category.</CardContent></Card> : null}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entities.map((entity, index) => <Card key={entity.entityId}><CardHeader><div className="flex items-start justify-between gap-3"><Badge variant="outline">#{index + 1}</Badge><TrendingUp className="size-4 text-muted-foreground" /></div><CardTitle className="text-lg">{entity.name}</CardTitle><CardDescription>{entity.types.length > 0 ? entity.types.join(", ") : "Qloo public entity"}</CardDescription></CardHeader><CardContent className="grid gap-2 text-sm"><Metric label="Trend score" value={formatScore(entity.trendScore)} /><Metric label="Affinity" value={formatScore(entity.affinity)} /><Metric label="Popularity" value={formatScore(entity.popularity)} /></CardContent></Card>)}
        </div>
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }): React.ReactNode {
  return <div className="flex items-center justify-between border-t pt-2"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>
}

function formatScore(value?: number): string {
  return value === undefined ? "Unavailable" : `${(value <= 1 ? value * 100 : value).toFixed(0)}/100`
}
