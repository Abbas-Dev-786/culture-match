import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { CampaignMatchView } from "./types"

export function MatchBreakdown({ match }: { match: CampaignMatchView }) {
  return (
    <Tabs defaultValue="score" className="mt-4 border-t pt-3">
      <TabsList className="w-full sm:w-auto">
        <TabsTrigger value="score">Score breakdown</TabsTrigger>
        <TabsTrigger value="evidence">Evidence ({match.evidence.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="score" className="mt-3 grid gap-3">
        {match.scoreComponents.map((component) => (
          <div key={component.key} className="rounded-lg bg-muted/40 p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium">{component.label}</span>
              <span>
                {component.score === undefined ? "Unavailable" : `${component.score}/100`} · {Math.round(component.weight * 100)}% weight
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={component.availability === "unavailable" ? "outline" : "secondary"}>
                {availabilityLabel(component.availability)}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{component.rationale}</p>
          </div>
        ))}
      </TabsContent>
      <TabsContent value="evidence" className="mt-3">
        <ul className="grid gap-2 text-xs text-muted-foreground">
          {match.evidence.length === 0 ? <li>No evidence was available.</li> : null}
          {match.evidence.map((item, index) => (
            <li key={`${item.source}-${item.fieldPath}-${index}`}>
              <span className="font-medium text-foreground">{sourceLabel(item.source)}</span> · {item.label ?? item.fieldPath} · {verificationLabel(item.verification)}{item.excerpt ? ` — ${item.excerpt}` : ""}
            </li>
          ))}
        </ul>
      </TabsContent>
    </Tabs>
  )
}

function availabilityLabel(value: CampaignMatchView["scoreComponents"][number]["availability"]): string {
  if (value === "supported") return "Provider-supported"
  if (value === "conditional") return "Conditionally scored"
  return "Unavailable"
}

function sourceLabel(value: CampaignMatchView["evidence"][number]["source"]): string {
  if (value === "qloo") return "Qloo"
  if (value === "apify") return "Apify"
  if (value === "user_input") return "User input"
  return "Derived"
}

function verificationLabel(value: CampaignMatchView["evidence"][number]["verification"]): string {
  if (value === "verified") return "Verified"
  if (value === "provider_reported") return "Provider-reported"
  return "Derived / unverified"
}
