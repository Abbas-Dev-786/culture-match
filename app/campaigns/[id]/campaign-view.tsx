"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

interface CampaignStatusResponse {
  campaign?: {
    id: string
    brandName: string
    productCategory: string
    objective: string
    status: string
  }
  run?: {
    id: string
    attempt: number
    status: string
    stage: string
    stageMessage?: string
    errorCode?: string
    errorMessage?: string
    retryAvailable?: boolean
    createdAt: string
  }
  error?: { message: string }
}

interface CampaignResultsResponse {
  matches?: Array<{
    id: string
    variant: "baseline" | "culture_informed"
    name: string
    platform: string
    username?: string
    profileUrl?: string
    bio?: string
    followers?: number
    engagementRate?: number
    isVerified?: boolean
    rank: number
    campaignFitScore: number | null
    evidenceCompleteness: number
    caveats: string[]
    reportSummary?: string
    campaignConcept?: {
      title: string
      idea: string
      rationale: string
      hypothesis: true
    }
  }>
  comparison?: {
    overlapCount: number
    baselineCount: number
    cultureInformedCount: number
    overlapRate: number
    materiallyChanged: boolean
  }
}

interface CampaignViewProps {
  campaignId: string
}

export function CampaignView({ campaignId }: CampaignViewProps) {
  const [data, setData] = useState<CampaignStatusResponse>()
  const [results, setResults] = useState<CampaignResultsResponse>()
  const [error, setError] = useState<string>()
  const [actionMessage, setActionMessage] = useState<string>()
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)

  useEffect(() => {
    let active = true

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
          const resultsResponse = await fetch(
            `/api/campaigns/${campaignId}/results`,
            { cache: "no-store" }
          )
          if (resultsResponse.ok && active) {
            setResults((await resultsResponse.json()) as CampaignResultsResponse)
          }
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
      if (
        process.env.NODE_ENV === "development" &&
        data?.run?.status === "running"
      ) {
        void fetch(`/api/campaigns/${campaignId}/advance`, { method: "POST" })
      }
      void loadStatus()
    }, 5000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [campaignId, data?.run?.status])

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
        const resultsResponse = await fetch(
          `/api/campaigns/${campaignId}/results`,
          { cache: "no-store" }
        )
        if (resultsResponse.ok) {
          setResults((await resultsResponse.json()) as CampaignResultsResponse)
        }
      }
    } catch {
      setActionMessage("Unable to reach the campaign service. Try again.")
    } finally {
      setIsMutating(false)
    }
  }

  const showStartAction = data?.run?.status === "queued"
  const showRetryAction =
    data?.run?.status === "failed" && data.run.retryAvailable !== false

  return (
    <main className="min-h-svh bg-muted/30 p-6 md:p-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Campaign status</p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              {data?.campaign?.brandName ?? "Campaign"}
            </h1>
          </div>
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/campaigns/new" />}
          >
            New campaign
          </Button>
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Campaign unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : isLoading ? (
          <div className="grid gap-5">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-36 w-full rounded-2xl" />
          </div>
        ) : (
          <div className="grid gap-5">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>
                      {data?.campaign?.productCategory ?? "Campaign"}
                    </CardTitle>
                    <CardDescription>
                      {data?.campaign?.objective ?? "Saved campaign brief"}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    {data?.campaign?.status ?? "unknown"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5">
                <dl className="grid gap-4 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">Run attempt</dt>
                    <dd className="font-medium">{data?.run?.attempt ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Stage</dt>
                    <dd className="font-medium">{data?.run?.stage ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Run status</dt>
                    <dd className="font-medium">{data?.run?.status ?? "-"}</dd>
                  </div>
                </dl>
                {data?.run?.stageMessage ? (
                  <p className="text-sm text-muted-foreground">
                    {data.run.stageMessage}
                  </p>
                ) : null}
                {data?.run?.errorMessage ? (
                  <Alert variant="destructive">
                    <AlertTitle>
                      {data.run.errorCode ?? "Analysis failure"}
                    </AlertTitle>
                    <AlertDescription>{data.run.errorMessage}</AlertDescription>
                  </Alert>
                ) : null}
                {showStartAction ? (
                  <Button
                    className="w-fit"
                    onClick={() => void runAction("analyze")}
                    disabled={isMutating}
                  >
                    {isMutating ? (
                      <>
                        <Spinner /> Starting...
                      </>
                    ) : (
                      "Start analysis"
                    )}
                  </Button>
                ) : null}
                {showRetryAction ? (
                  <Button
                    className="w-fit"
                    onClick={() => void runAction("retry")}
                    disabled={isMutating}
                  >
                    {isMutating ? (
                      <>
                        <Spinner /> Retrying...
                      </>
                    ) : (
                      "Retry analysis"
                    )}
                  </Button>
                ) : null}
                {actionMessage ? (
                  <Alert variant="destructive">
                    <AlertDescription>{actionMessage}</AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Results</CardTitle>
                <CardDescription>
                  Deterministic matches keep provider facts, derived signals, and
                  missing data clearly separated.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {results?.matches?.some(
                  (match) => match.variant === "culture_informed"
                ) ? (
                  <div className="grid gap-4">
                    {results.comparison ? (
                      <div className="rounded-xl border bg-muted/30 p-4 text-sm">
                        <p className="font-medium">Baseline comparison</p>
                        <p className="text-muted-foreground">
                          {results.comparison.overlapCount} of {results.comparison.baselineCount} baseline creators also appear in the culture-informed shortlist ({Math.round(results.comparison.overlapRate * 100)}% overlap).
                          {results.comparison.materiallyChanged
                            ? " The cultural signals changed the shortlist or ranking."
                            : " The shortlist remained materially similar."}
                        </p>
                      </div>
                    ) : null}
                    {results.matches
                      .filter((match) => match.variant === "culture_informed")
                      .map((match) => (
                        <div key={match.id} className="rounded-xl border p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm text-muted-foreground">
                                #{match.rank} · {match.platform}
                              </p>
                              <h3 className="font-medium">{match.name}</h3>
                              {match.username ? (
                                <p className="text-sm text-muted-foreground">
                                  @{match.username}
                                </p>
                              ) : null}
                            </div>
                            <Badge variant="secondary">
                              {match.campaignFitScore === null
                                ? "Score unavailable"
                                : `${match.campaignFitScore}/100`}
                            </Badge>
                          </div>
                          <p className="mt-3 text-sm text-muted-foreground">
                            Evidence completeness: {Math.round(match.evidenceCompleteness * 100)}%
                          </p>
                          {match.reportSummary ? (
                            <p className="mt-3 text-sm">{match.reportSummary}</p>
                          ) : null}
                          {match.campaignConcept ? (
                            <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">
                              <p className="font-medium">
                                {match.campaignConcept.title} · hypothesis
                              </p>
                              <p className="mt-1">{match.campaignConcept.idea}</p>
                            </div>
                          ) : null}
                          {match.caveats.length > 0 ? (
                            <p className="mt-3 text-xs text-muted-foreground">
                              Caveats: {match.caveats.join("; ")}
                            </p>
                          ) : null}
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Results will appear after creator discovery and deterministic scoring complete.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  )
}
