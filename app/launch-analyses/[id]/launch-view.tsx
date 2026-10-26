"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import type { SafeLaunchRun } from "@/lib/domain/types"
import type { LaunchApiError, LaunchResultsResponse, LaunchStatusResponse } from "../types"
import { LaunchActivationBrief } from "./launch-activation-brief"
import { LaunchComparison } from "./launch-comparison"
import { LaunchFingerprint } from "./launch-fingerprint"
import { LaunchHeatmap } from "./launch-heatmap"
import { LaunchOpportunityCard } from "./launch-opportunity-card"
import { LaunchProgress } from "./launch-progress"

interface LaunchViewProps {
  analysisId: string
}

export function LaunchView({ analysisId }: LaunchViewProps) {
  const [status, setStatus] = useState<LaunchStatusResponse | undefined>()
  const [results, setResults] = useState<LaunchResultsResponse | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const advancedRunId = useRef<string | undefined>(undefined)

  const loadResults = useCallback(async () => {
    const response = await fetch(`/api/launch-analyses/${analysisId}/results`, { cache: "no-store" })
    const payload = (await response.json()) as LaunchResultsResponse & LaunchApiError
    if (!response.ok) throw new Error(payload.error?.message ?? "Unable to load launch results.")
    setResults(payload)
    setStatus({ analysis: payload.analysis, run: payload.run })
  }, [analysisId])

  const loadStatus = useCallback(async () => {
    const response = await fetch(`/api/launch-analyses/${analysisId}/status`, { cache: "no-store" })
    const payload = (await response.json()) as LaunchStatusResponse & LaunchApiError
    if (!response.ok) throw new Error(payload.error?.message ?? "Unable to load launch analysis.")
    setStatus(payload)
    if (payload.run.status === "completed") await loadResults()
  }, [analysisId, loadResults])

  const advance = useCallback(async () => {
    if (isAdvancing) return
    setError(undefined)
    setIsAdvancing(true)
    try {
      const response = await fetch(`/api/launch-analyses/${analysisId}/advance`, { method: "POST" })
      const payload = (await response.json()) as LaunchStatusResponse & LaunchApiError
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to advance the launch analysis.")
      setStatus(payload)
      if (payload.run.status === "completed") await loadResults()
    } catch (advanceError) {
      setError(advanceError instanceof Error ? advanceError.message : "Unable to advance the launch analysis.")
      try { await loadStatus() } catch { return }
    } finally {
      setIsAdvancing(false)
    }
  }, [analysisId, isAdvancing, loadResults, loadStatus])

  const retry = useCallback(async () => {
    setError(undefined)
    setIsAdvancing(true)
    try {
      const response = await fetch(`/api/launch-analyses/${analysisId}/retry`, { method: "POST" })
      const payload = (await response.json()) as { run?: SafeLaunchRun } & LaunchApiError
      if (!response.ok || !payload.run) throw new Error(payload.error?.message ?? "Unable to retry the launch analysis.")
      advancedRunId.current = undefined
      await loadStatus()
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Unable to retry the launch analysis.")
    } finally {
      setIsAdvancing(false)
    }
  }, [analysisId, loadStatus])

  async function downloadResults(): Promise<void> {
    setIsExporting(true)
    setError(undefined)
    try {
      const response = await fetch(`/api/launch-analyses/${analysisId}/export`, { cache: "no-store" })
      if (!response.ok) {
        const payload = (await response.json()) as LaunchApiError
        throw new Error(payload.error?.message ?? "Unable to export launch results.")
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `culturematch-launch-${analysisId}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Unable to export launch results.")
    } finally {
      setIsExporting(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const initialLoad = window.setTimeout(() => {
      void loadStatus().catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load the launch analysis.")
      })
    }, 0)
    const interval = window.setInterval(() => {
      if (!cancelled) void loadStatus().catch(() => undefined)
    }, 5000)
    return () => { cancelled = true; window.clearTimeout(initialLoad); window.clearInterval(interval) }
  }, [loadStatus])

  useEffect(() => {
    const run = status?.run
    if (!run || run.status === "completed" || run.status === "failed" || advancedRunId.current === run.id) return
    advancedRunId.current = run.id
    void advance()
  }, [advance, status?.run])

  if (!status) {
    return <main className="grid min-h-svh place-items-center bg-muted/30 p-6"><Spinner className="size-6" /></main>
  }

  const { analysis, run } = status
  return <main className="min-h-svh bg-muted/30 px-6 py-8 md:px-10">
    <div className="mx-auto grid w-full max-w-6xl gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-2"><Button className="w-fit px-0" variant="link" nativeButton={false} render={<Link href="/launch-analyses/new" />}>← New analysis</Button><p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">{analysis.city}, {analysis.country}</p><h1 className="font-heading text-4xl font-semibold tracking-tight">{analysis.brandName} · {analysis.product}</h1><p className="max-w-2xl text-muted-foreground">{analysis.launchIntent}</p></div>
        <div className="flex flex-wrap items-center justify-end gap-3"><div className="rounded-2xl border bg-background px-4 py-3 text-right text-sm"><p className="text-muted-foreground">Run {run.attempt}</p><p className="mt-1 font-medium">{run.status === "completed" ? "Ready to validate" : run.status === "failed" ? "Needs attention" : "Working"}</p></div>{run.status === "completed" ? <Button variant="outline" onClick={() => void downloadResults()} disabled={isExporting}>{isExporting ? "Preparing CSV" : "Export results"}</Button> : null}</div>
      </header>
      {error ? <Alert variant="destructive"><AlertTitle>Something needs attention</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      <LaunchProgress run={run} isAdvancing={isAdvancing} onStart={() => void advance()} onRetry={() => void retry()} />
      {run.status === "completed" && results?.culturalProfile ? <LaunchFingerprint fingerprint={results.culturalProfile.fingerprint} /> : null}
      {run.status === "completed" && results?.culturalProfile ? <div className="grid gap-6 lg:grid-cols-2"><LaunchComparison comparison={results.culturalProfile.fingerprint.comparison} /><LaunchHeatmap heatmap={results.culturalProfile.fingerprint.heatmap} /></div> : null}
      {run.status === "completed" && results ? <section className="grid gap-4"><div><p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Opportunity map</p><h2 className="mt-2 font-heading text-3xl font-semibold">What belongs in this cultural territory?</h2></div>{results.opportunities.length > 0 ? <div className="grid gap-4 md:grid-cols-2">{results.opportunities.map((opportunity) => <LaunchOpportunityCard key={opportunity.id} opportunity={opportunity} />)}</div> : <EmptyState message="No opportunities were returned for this brief." />}</section> : null}
      {run.status === "completed" && results?.activationReport ? <LaunchActivationBrief report={results.activationReport} /> : null}
      {run.status === "completed" && !results ? <Card><CardHeader><CardTitle>Loading your results</CardTitle></CardHeader><CardContent><Spinner /></CardContent></Card> : null}
    </div>
  </main>
}

function EmptyState({ message }: { message: string }) {
  return <Card><CardContent className="py-8 text-sm text-muted-foreground">{message}</CardContent></Card>
}

