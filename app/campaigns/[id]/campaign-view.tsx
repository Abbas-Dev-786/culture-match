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

interface EvidenceView {
  source: "qloo" | "apify" | "user_input" | "derived"
  label?: string
  fieldPath: string
  observedAt: string
  verification: "verified" | "provider_reported" | "unverified"
  excerpt?: string
}

interface ScoreComponentView {
  key: string
  label: string
  score?: number
  weight: number
  availability: "supported" | "conditional" | "unavailable"
  rationale: string
  evidence: EvidenceView[]
}

interface CultureProfileView {
  signals: Array<{
    name: string
    affinity?: number
    types: string[]
    evidence: EvidenceView
  }>
  locationQuery?: string
  location?: { name: string; disambiguation?: string }
  resolvedReferences: Array<{
    reference: string
    status: "resolved" | "ambiguous" | "unresolved"
    name?: string
  }>
  unresolvedReferences: string[]
  signalCount: number
  searchPlanSource?: "deterministic" | "model"
}

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
    locationUnverified: boolean
    rank: number
    campaignFitScore: number | null
    evidenceCompleteness: number
    scoreComponents: ScoreComponentView[]
    evidence: EvidenceView[]
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
    rankChanges: Array<{
      providerCreatorId: string
      baselineRank?: number
      cultureInformedRank?: number
      scoreDelta?: number
    }>
  }
  cultureProfile?: CultureProfileView
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
  const [isExporting, setIsExporting] = useState(false)

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
      if (body.run?.status === "completed") await loadResults()
    } catch {
      setActionMessage("Unable to reach the campaign service. Try again.")
    } finally {
      setIsMutating(false)
    }
  }

  async function loadResults(): Promise<void> {
    const response = await fetch(`/api/campaigns/${campaignId}/results`, {
      cache: "no-store",
    })
    if (response.ok) setResults((await response.json()) as CampaignResultsResponse)
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

  const showStartAction = data?.run?.status === "queued"
  const showRetryAction =
    data?.run?.status === "failed" && data.run.retryAvailable !== false
  const cultureMatches =
    results?.matches?.filter((match) => match.variant === "culture_informed") ?? []

  return (
    <main className="min-h-svh bg-muted/30 p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <div className="no-print mb-8 flex items-center justify-between gap-4">
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
            <Card className="print-break-inside-avoid">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>{data?.campaign?.productCategory ?? "Campaign"}</CardTitle>
                    <CardDescription>
                      {data?.campaign?.objective ?? "Saved campaign brief"}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">{data?.campaign?.status ?? "unknown"}</Badge>
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
                  <p className="text-sm text-muted-foreground">{data.run.stageMessage}</p>
                ) : null}
                {data?.run?.errorMessage ? (
                  <Alert variant="destructive">
                    <AlertTitle>{data.run.errorCode ?? "Analysis failure"}</AlertTitle>
                    <AlertDescription>{data.run.errorMessage}</AlertDescription>
                  </Alert>
                ) : null}
                <div className="no-print flex flex-wrap gap-2">
                  {showStartAction ? (
                    <Button onClick={() => void runAction("analyze")} disabled={isMutating}>
                      {isMutating ? <><Spinner /> Starting...</> : "Start analysis"}
                    </Button>
                  ) : null}
                  {showRetryAction ? (
                    <Button onClick={() => void runAction("retry")} disabled={isMutating}>
                      {isMutating ? <><Spinner /> Retrying...</> : "Retry analysis"}
                    </Button>
                  ) : null}
                  {data?.run?.status === "completed" ? (
                    <>
                      <Button variant="outline" onClick={() => void downloadCsv()} disabled={isExporting}>
                        {isExporting ? <><Spinner /> Exporting...</> : "Download CSV"}
                      </Button>
                      <Button variant="outline" onClick={() => window.print()}>
                        Print report
                      </Button>
                    </>
                  ) : null}
                </div>
                {actionMessage ? (
                  <Alert variant="destructive">
                    <AlertDescription>{actionMessage}</AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
            </Card>

            {results?.cultureProfile ? (
              <CultureProfileCard profile={results.cultureProfile} />
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Results</CardTitle>
                <CardDescription>
                  Provider facts, derived signals, and missing data are shown separately.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {cultureMatches.length > 0 ? (
                  <div className="grid gap-4">
                    {results?.comparison ? <ComparisonCard comparison={results.comparison} /> : null}
                    {cultureMatches.map((match) => <CreatorMatchCard key={match.id} match={match} />)}
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

function CultureProfileCard({ profile }: { profile: CultureProfileView }) {
  return (
    <Card className="print-break-inside-avoid">
      <CardHeader>
        <CardTitle>Regional culture profile</CardTitle>
        <CardDescription>
          {profile.location?.name ?? profile.locationQuery ?? "Target market"} · {profile.signalCount} Qloo signals
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="flex flex-wrap gap-2">
          {profile.signals.map((signal) => (
            <Badge key={`${signal.name}-${signal.evidence.fieldPath}`} variant="secondary">
              {signal.name}{signal.affinity !== undefined ? ` · ${signal.affinity.toFixed(2)}` : ""}
            </Badge>
          ))}
        </div>
        <div className="grid gap-2 text-sm">
          <p className="font-medium">Reference resolution</p>
          {profile.resolvedReferences.length === 0 ? (
            <p className="text-muted-foreground">No cultural references were supplied.</p>
          ) : (
            profile.resolvedReferences.map((reference) => (
              <p key={reference.reference} className="text-muted-foreground">
                <span className="text-foreground">{reference.reference}</span>: {reference.status}{reference.name ? ` (${reference.name})` : ""}
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

function ComparisonCard({ comparison }: { comparison: NonNullable<CampaignResultsResponse["comparison"]> }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-4 text-sm print-break-inside-avoid">
      <p className="font-medium">Baseline comparison</p>
      <p className="text-muted-foreground">
        {comparison.overlapCount} of {comparison.baselineCount} baseline creators also appear in the culture-informed shortlist ({Math.round(comparison.overlapRate * 100)}% overlap).
        {comparison.materiallyChanged ? " The cultural signals changed the shortlist or ranking." : " The shortlist remained materially similar."}
      </p>
      {comparison.rankChanges.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer font-medium">View rank changes</summary>
          <ul className="mt-2 grid gap-1 text-muted-foreground">
            {comparison.rankChanges.map((change) => (
              <li key={change.providerCreatorId}>
                {change.providerCreatorId}: baseline #{change.baselineRank ?? "-"} → culture-informed #{change.cultureInformedRank ?? "-"}{change.scoreDelta !== undefined ? ` (${change.scoreDelta > 0 ? "+" : ""}${change.scoreDelta} score)` : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

function CreatorMatchCard({ match }: { match: NonNullable<CampaignResultsResponse["matches"]>[number] }) {
  return (
    <article className="rounded-xl border p-4 print-break-inside-avoid">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">#{match.rank} · {match.platform}</p>
          <h3 className="font-medium">{match.name}</h3>
          {match.username ? <p className="text-sm text-muted-foreground">@{match.username}</p> : null}
          {match.profileUrl ? (
            <a className="text-sm text-primary underline underline-offset-4" href={match.profileUrl} target="_blank" rel="noreferrer">Open profile</a>
          ) : null}
        </div>
        <Badge variant="secondary">
          {match.campaignFitScore === null ? "Score unavailable" : `${match.campaignFitScore}/100`}
        </Badge>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-muted-foreground">Followers</dt><dd>{match.followers === undefined ? "Unavailable" : formatNumber(match.followers)}</dd></div>
        <div><dt className="text-muted-foreground">Engagement</dt><dd>{match.engagementRate === undefined ? "Unavailable" : `${(match.engagementRate * 100).toFixed(2)}%`}</dd></div>
        <div><dt className="text-muted-foreground">Evidence</dt><dd>{Math.round(match.evidenceCompleteness * 100)}% complete</dd></div>
      </dl>
      {match.locationUnverified ? <p className="mt-3 text-xs text-muted-foreground">Audience geography was not verified by the provider.</p> : null}
      {match.bio ? <p className="mt-3 text-sm text-muted-foreground">{match.bio}</p> : null}
      {match.reportSummary ? <p className="mt-3 text-sm">{match.reportSummary}</p> : null}
      <details className="mt-4 border-t pt-3">
        <summary className="cursor-pointer text-sm font-medium">Score breakdown</summary>
        <div className="mt-3 grid gap-3">
          {match.scoreComponents.map((component) => (
            <div key={component.key} className="rounded-lg bg-muted/40 p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-medium">{component.label}</span>
                <span>{component.score === undefined ? "Unavailable" : `${component.score}/100`} · {Math.round(component.weight * 100)}% weight</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{component.rationale}</p>
            </div>
          ))}
        </div>
      </details>
      <details className="mt-3 border-t pt-3">
        <summary className="cursor-pointer text-sm font-medium">Evidence ({match.evidence.length})</summary>
        <ul className="mt-3 grid gap-2 text-xs text-muted-foreground">
          {match.evidence.length === 0 ? <li>No evidence was available.</li> : null}
          {match.evidence.map((item, index) => (
            <li key={`${item.source}-${item.fieldPath}-${index}`}>
              <span className="font-medium text-foreground">{item.source}</span> · {item.label ?? item.fieldPath} · {item.verification}{item.excerpt ? ` — ${item.excerpt}` : ""}
            </li>
          ))}
        </ul>
      </details>
      {match.campaignConcept ? (
        <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">
          <p className="font-medium">{match.campaignConcept.title} · hypothesis</p>
          <p className="mt-1">{match.campaignConcept.idea}</p>
          <p className="mt-2 text-xs text-muted-foreground">{match.campaignConcept.rationale}</p>
        </div>
      ) : null}
      {match.caveats.length > 0 ? <p className="mt-3 text-xs text-muted-foreground">Caveats: {match.caveats.join("; ")}</p> : null}
    </article>
  )
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value)
}
