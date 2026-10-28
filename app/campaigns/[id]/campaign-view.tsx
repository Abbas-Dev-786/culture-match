"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { AnalysisProgress } from "./components/analysis-progress"
import { CreatorCard } from "./components/creator-card"
import { CultureProfile } from "./components/culture-profile"
import { CultureLift } from "./components/culture-lift"
import type {
  CampaignResultsResponse,
  CampaignStatusResponse,
} from "./components/types"

interface CampaignViewProps {
  campaignId: string
}

const MAX_STATUS_POLLS = 360
const POLL_INTERVAL_MS = 5000

export function CampaignView({ campaignId }: CampaignViewProps) {
  const [data, setData] = useState<CampaignStatusResponse>()
  const [results, setResults] = useState<CampaignResultsResponse>()
  const [error, setError] = useState<string>()
  const [actionMessage, setActionMessage] = useState<string>()
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [pausedCampaignId, setPausedCampaignId] = useState<string>()
  const pollCount = useRef(0)

  useEffect(() => {
    let active = true
    pollCount.current = 0

    function stopPolling(): void {
      window.clearInterval(interval)
    }

    async function loadStatus(): Promise<void> {
      try {
        const response = await fetch(`/api/campaigns/${campaignId}/status`, {
          cache: "no-store",
        })
        const body = (await response.json()) as CampaignStatusResponse
        if (!active) return
        if (!response.ok) {
          setError(body.error?.message ?? "Unable to load campaign")
          return
        }
        setData(body)
        if (body.run?.status === "completed") {
          const completedResults = await fetchCampaignResults(campaignId)
          if (active) setResults(completedResults)
        }
        if (
          body.run?.status === "completed" ||
          body.run?.status === "failed" ||
          body.run?.status === "cancelled"
        ) {
          stopPolling()
        }
        if (
          process.env.NODE_ENV === "development" &&
          body.run?.status === "running"
        ) {
          void fetch(`/api/campaigns/${campaignId}/advance`, { method: "POST" })
        }
        setError(undefined)
      } catch {
        if (active) setError("Unable to reach the campaign service. Try again.")
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadStatus()
    const interval = window.setInterval(() => {
      pollCount.current += 1
      if (pollCount.current > MAX_STATUS_POLLS) {
        setPausedCampaignId(campaignId)
        return
      }
      void loadStatus()
    }, POLL_INTERVAL_MS)

    return () => {
      active = false
      stopPolling()
    }
  }, [campaignId])

  async function runAction(action: "analyze" | "retry"): Promise<void> {
    setIsMutating(true)
    setActionMessage(undefined)

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/${action}`, {
        method: "POST",
      })
      const body = (await response.json()) as CampaignStatusResponse
      if (!response.ok) {
        setActionMessage(body.error?.message ?? "Unable to update the campaign")
        return
      }
      setData(body)
      if (body.run?.status === "completed") {
        setResults(await fetchCampaignResults(campaignId))
      }
    } catch {
      setActionMessage("Unable to reach the campaign service. Try again.")
    } finally {
      setIsMutating(false)
    }
  }

  async function downloadCsv(): Promise<void> {
    setIsExporting(true)
    setActionMessage(undefined)
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/export`, {
        cache: "no-store",
      })
      if (!response.ok) throw new Error("Export failed")
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `culturematch-${campaignId}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setActionMessage("Unable to export the campaign results.")
    } finally {
      setIsExporting(false)
    }
  }

  const baselineMatches = results?.matches?.filter((match) => match.variant === "baseline") ?? []
  const cultureMatches = results?.matches?.filter((match) => match.variant === "culture_informed") ?? []

  return (
    <main className="min-h-svh bg-muted/30 p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <div className="no-print mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">CultureMatch / Campaign report</p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              {data?.campaign?.brandName ?? "Campaign"}
            </h1>
          </div>
          <Button variant="ghost" nativeButton={false} render={<Link href="/campaigns/new" />}>
            New campaign
          </Button>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : isLoading ? (
          <div className="grid gap-5">
            <Skeleton className="h-52 w-full rounded-2xl" />
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
        ) : (
          <div className="grid gap-5">
            <Card className="print-break-inside-avoid">
              <CardHeader>
                  <CardTitle>{data?.campaign?.productCategory ?? "Campaign"}</CardTitle>
                  <CardDescription>{data?.campaign?.objective ?? "Saved campaign brief"}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <SummaryItem label="Market" value={marketLabel(data?.campaign?.targetMarket)} />
                  <SummaryItem label="Market scope" value={data?.campaign?.targetMarket?.marketScope ?? "Unavailable"} />
                  <SummaryItem label="Creator sample" value={data?.campaign?.creatorLimit ? `${data.campaign.creatorLimit} per search` : "Unavailable"} />
                  <SummaryItem label="Analysis timestamp" value={formatTimestamp(data?.run?.completedAt ?? data?.run?.startedAt ?? data?.run?.createdAt)} />
                </dl>
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <SummaryItem label="Qloo research" value={results?.cultureProfile ? "Complete" : "Pending or unavailable"} />
                  <SummaryItem label="Creator search" value={results?.matches && results.matches.length > 0 ? "Complete" : data?.run?.stage === "searching_creators" ? "In progress" : "Pending"} />
                </dl>
                <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                  The selected market is a research target. It is not proof that a creator’s audience lives in that market.
                </div>
                <div className="no-print flex flex-wrap gap-2">
                  {data?.run?.status === "completed" ? (
                    <>
                      <Button variant="outline" onClick={() => void downloadCsv()} disabled={isExporting}>
                        {isExporting ? <><Spinner /> Exporting...</> : "Download CSV"}
                      </Button>
                      <Button variant="outline" onClick={() => window.print()}>Save PDF / print</Button>
                    </>
                  ) : null}
                </div>
                {actionMessage ? <Alert variant="destructive"><AlertDescription>{actionMessage}</AlertDescription></Alert> : null}
              </CardContent>
            </Card>

            <AnalysisProgress
              run={data?.run}
              pollingPaused={pausedCampaignId === campaignId}
              isMutating={isMutating}
              onStart={() => void runAction("analyze")}
              onRetry={() => void runAction("retry")}
            />

            {results?.cultureProfile ? <CultureProfile profile={results.cultureProfile} /> : null}

            {results?.comparison ? (
              <CultureLift
                comparison={results.comparison}
                baseline={baselineMatches}
                cultureInformed={cultureMatches}
              />
            ) : cultureMatches.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>CultureMatch shortlist</CardTitle>
                  <CardDescription>Ranked with provider-reported evidence and Qloo cultural signals. This report demonstrates discovery and ranking changes, not guaranteed campaign performance.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {cultureMatches.map((match) => <CreatorCard key={match.id} match={match} />)}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Recommendations</CardTitle>
                  <CardDescription>Results will appear after creator discovery and scoring complete.</CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium capitalize">{value}</dd>
    </div>
  )
}

function marketLabel(
  market?: NonNullable<CampaignStatusResponse["campaign"]>["targetMarket"]
): string {
  if (!market) return "Unavailable"
  return [market.city, market.region, market.country].filter(Boolean).join(", ")
}

function formatTimestamp(value?: string): string {
  if (!value) return "Unavailable"
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? "Unavailable" : timestamp.toLocaleString()
}

async function fetchCampaignResults(campaignId: string): Promise<CampaignResultsResponse> {
  const response = await fetch(`/api/campaigns/${campaignId}/results`, { cache: "no-store" })
  if (!response.ok) return {}
  return (await response.json()) as CampaignResultsResponse
}
