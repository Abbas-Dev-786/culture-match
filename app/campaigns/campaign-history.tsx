"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Bookmark, BookmarkCheck } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { SafeCampaign } from "@/lib/domain/types"

interface CampaignHistoryResponse {
  campaigns?: SafeCampaign[]
  error?: { message: string }
}

export function CampaignHistory() {
  const [campaigns, setCampaigns] = useState<SafeCampaign[]>([])
  const [savedOnly, setSavedOnly] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>()

  useEffect(() => {
    void loadCampaigns(savedOnly)
  }, [savedOnly])

  async function loadCampaigns(filterSaved: boolean): Promise<void> {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/campaigns?saved=${filterSaved}`, { cache: "no-store" })
      const body = (await response.json()) as CampaignHistoryResponse
      if (!response.ok || !body.campaigns) {
        setError(body.error?.message ?? "Unable to load campaign history")
        return
      }
      setCampaigns(body.campaigns)
      setError(undefined)
    } catch {
      setError("Unable to reach the campaign service.")
    } finally {
      setIsLoading(false)
    }
  }

  async function toggleSaved(campaign: SafeCampaign): Promise<void> {
    const response = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isSaved: !campaign.isSaved }),
    })
    if (response.ok) void loadCampaigns(savedOnly)
  }

  return (
    <main className="min-h-svh bg-muted/30 p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">CultureMatch / Workspace</p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">Campaign history</h1>
            <p className="mt-1 text-sm text-muted-foreground">Return to a campaign brief or keep a search saved for review.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href="/trending" />}>Trending public figures</Button>
            <Button nativeButton={false} render={<Link href="/campaigns/new" />}>New campaign <ArrowUpRight /></Button>
          </div>
        </header>
        <div className="mb-5 flex gap-2">
          <Button variant={!savedOnly ? "secondary" : "outline"} onClick={() => setSavedOnly(false)}>All campaigns</Button>
          <Button variant={savedOnly ? "secondary" : "outline"} onClick={() => setSavedOnly(true)}><Bookmark /> Saved searches</Button>
        </div>
        {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
        {isLoading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading campaign history...</CardContent></Card> : null}
        {!isLoading && !error && campaigns.length === 0 ? (
          <Card><CardHeader><CardTitle>{savedOnly ? "No saved searches yet" : "No campaigns yet"}</CardTitle><CardDescription>Create a campaign brief to start building a private history.</CardDescription></CardHeader><CardContent><Button nativeButton={false} render={<Link href="/campaigns/new" />}>Create campaign</Button></CardContent></Card>
        ) : null}
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-5 p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-medium">{campaign.brandName} · {campaign.productCategory}</h2><Badge variant="outline">{campaign.status.replaceAll("_", " ")}</Badge></div>
                  <p className="mt-1 text-sm text-muted-foreground">{marketLabel(campaign)} · Updated {formatDate(campaign.updatedAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" aria-label={campaign.isSaved ? "Remove saved search" : "Save search"} onClick={() => void toggleSaved(campaign)}>{campaign.isSaved ? <BookmarkCheck /> : <Bookmark />}</Button>
                  <Button variant="outline" nativeButton={false} render={<Link href={`/campaigns/${campaign.id}`} />}>Open report</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}

function marketLabel(campaign: SafeCampaign): string {
  return [campaign.targetMarket.city, campaign.targetMarket.region, campaign.targetMarket.country].filter(Boolean).join(", ")
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleDateString()
}
