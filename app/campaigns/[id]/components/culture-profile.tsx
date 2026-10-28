import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, GitBranch, Search, Sparkles } from "lucide-react"
import {
  Trace,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"
import type { CultureProfileView } from "./types"

export function CultureProfile({
  profile,
  onApprove,
  isApproving = false,
}: {
  profile: CultureProfileView
  onApprove?: () => void
  isApproving?: boolean
}) {
  return (
    <Card className="print-break-inside-avoid">
      <CardHeader>
        <CardTitle>Regional culture profile</CardTitle>
        <CardDescription>
          {profile.location?.name ?? profile.locationQuery ?? "Target market"} · {profile.signalCount} Qloo signals
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryMetric label="Signals" value={profile.signalCount} detail="Returned by Qloo" />
          <SummaryMetric label="References" value={profile.resolvedReferences.length} detail={`${profile.unresolvedReferences.length} unresolved`} />
          <SummaryMetric label="Search plan" value={profile.searchPlanSource ?? "deterministic"} detail="Recommendation strategy" />
        </div>

        {profile.agentState?.pendingApproval && onApprove ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30">
            <div>
              <p className="font-medium">Agent approval needed</p>
              <p className="mt-1 text-muted-foreground">
                {profile.agentState.pendingApproval.reason}
              </p>
            </div>
            <Button onClick={onApprove} disabled={isApproving}>
              {isApproving ? "Approving..." : "Approve next search"}
            </Button>
          </div>
        ) : null}

        <div className="rounded-xl border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">Cultural signals in use</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The strongest signals shaping the culture-informed search.
              </p>
            </div>
            {profile.fingerprint?.conditioning ? (
              <Badge variant="outline">
                {conditioningLabel(profile.fingerprint.conditioning)}
              </Badge>
            ) : null}
          </div>
          {profile.signals.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.signals.slice(0, 8).map((signal) => (
                <Badge key={`${signal.name}-${signal.evidence.fieldPath}`} variant="secondary">
                  {signal.name}
                  {signal.affinity !== undefined ? ` · ${signal.affinity.toFixed(2)}` : ""}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No Qloo signals were returned.</p>
          )}
        </div>

        <Accordion multiple>
          {profile.researchTrace && profile.researchTrace.length > 0 ? (
            <AccordionItem value="agent-trace">
              <AccordionTrigger>
                <span>
                  Cultural research agent trace
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {profile.researchTrace.length} actions · bounded refinement loop
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <Trace>
                  {profile.researchTrace.map((entry) => (
                    <TraceLine key={`${entry.step}-${entry.action}`}>
                      <TraceIcon>{traceIcon(entry.action)}</TraceIcon>
                      <TraceTitle>{entry.summary}</TraceTitle>
                      <TraceDescription>
                        {entry.action.replaceAll("_", " ")}
                      </TraceDescription>
                      {entry.evidence ? (
                        <TraceDescription>
                          {entry.evidence.evidenceBearingSignalCount} evidence-bearing · {entry.evidence.signalCount} signals
                        </TraceDescription>
                      ) : null}
                    </TraceLine>
                  ))}
                </Trace>
                <p className="mt-3 text-xs text-muted-foreground">
                  The supervisor selected bounded tools and inputs, inspected Qloo evidence, and refined only within the configured budget. Creator scoring remains deterministic.
                </p>
              </AccordionContent>
            </AccordionItem>
          ) : null}

          {profile.creatorSearchTrace && profile.creatorSearchTrace.length > 0 ? (
            <AccordionItem value="creator-agent-trace">
              <AccordionTrigger>
                <span>
                  Creator search agent trace
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {profile.creatorSearchTrace.length} tool outcomes
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-2">
                  {profile.creatorSearchTrace.map((entry, index) => (
                    <div key={`${entry.toolName}-${index}`} className="rounded-lg border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{entry.action.replaceAll("_", " ")}</span>
                        {entry.decision ? <Badge variant="outline">{entry.decision.replaceAll("_", " ")}</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.resultCount ?? 0} results · {entry.evidenceCount ?? 0} evidence signals · next: {entry.nextAction ?? "stop"}
                      </p>
                      {entry.rationale ? <p className="mt-1 text-xs text-muted-foreground">{entry.rationale}</p> : null}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ) : null}

          {profile.evidenceCritic ? (
            <AccordionItem value="evidence-critic">
              <AccordionTrigger>Evidence critic</AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground">{profile.evidenceCritic.summary}</p>
                {profile.evidenceCritic.caveats.length > 0 ? (
                  <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                    {profile.evidenceCritic.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
                  </ul>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          ) : null}

          {profile.fingerprint ? (
            <AccordionItem value="fingerprint">
              <AccordionTrigger>
                <span>
                  Qloo fingerprint
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {profile.fingerprint.signals.length} signals · {profile.fingerprint.layers.length} layers
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <FingerprintDetails fingerprint={profile.fingerprint} />
              </AccordionContent>
            </AccordionItem>
          ) : null}

          <AccordionItem value="signals">
            <AccordionTrigger>
              <span>
                Returned Qloo signals
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {profile.signals.length} available
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-2">
                {profile.signals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No Qloo signals were returned.</p>
                ) : (
                  profile.signals.map((signal) => (
                    <div key={`${signal.name}-${signal.evidence.fieldPath}`} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">
                          {signal.name}{signal.affinity !== undefined ? ` · ${signal.affinity.toFixed(2)}` : ""}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{signal.types.join(", ")}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Source: Qloo · {signal.evidence.label ?? signal.evidence.fieldPath}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="references">
            <AccordionTrigger>
              <span>
                Reference resolution
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {profile.resolvedReferences.length} supplied
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-2 text-sm">
                {profile.resolvedReferences.length === 0 ? (
                  <p className="text-muted-foreground">No cultural references were supplied.</p>
                ) : (
                  profile.resolvedReferences.map((reference) => (
                    <p key={reference.reference} className="text-muted-foreground">
                      <span className="text-foreground">{reference.reference}</span>: {reference.status}
                      {reference.name ? ` (${reference.name})` : ""}
                      {reference.candidates && reference.candidates.length > 0
                        ? ` — candidates: ${reference.candidates.map((candidate) => candidate.name).join(", ")}`
                        : ""}
                    </p>
                  ))
                )}
                {profile.unresolvedReferences.length > 0 ? (
                  <p className="text-amber-700 dark:text-amber-300">
                    Unresolved references: {profile.unresolvedReferences.join(", ")}
                  </p>
                ) : null}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="methodology">
            <AccordionTrigger>Methodology and limitations</AccordionTrigger>
            <AccordionContent>
              <p className="text-sm text-muted-foreground">
                Search plan: {profile.searchPlanSource ?? "deterministic"}. Qloo signals are provider-reported inputs, not audience guarantees. The selected market is a research target and does not verify creator audience geography.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  )
}

function traceIcon(
  action: NonNullable<CultureProfileView["researchTrace"]>[number]["action"]
) {
  if (action === "query_qloo") return <Search className="size-4" />
  if (action === "refine_research_inputs") return <GitBranch className="size-4" />
  if (action === "complete_research") return <CheckCircle2 className="size-4" />
  if (action === "inspect_evidence") return <Sparkles className="size-4" />
  return <Sparkles className="size-4" />
}

function SummaryMetric({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold capitalize">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function conditioningLabel(conditioning: NonNullable<NonNullable<CultureProfileView["fingerprint"]>["conditioning"]>): string {
  if (!conditioning) return ""
  const parts = [
    conditioning.ageRange ? `age ${conditioning.ageRange}` : undefined,
    conditioning.gender ? conditioning.gender : undefined,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(" · ") : `${conditioning.audienceIds.length} audience IDs`
}

function FingerprintDetails({ fingerprint }: { fingerprint: NonNullable<CultureProfileView["fingerprint"]> }) {
  return (
    <div className="grid gap-4 text-sm">
      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <p>Signals: <span className="font-medium text-foreground">{fingerprint.signals.length}</span></p>
        <p>Unresolved inputs: <span className="font-medium text-foreground">{fingerprint.unresolvedInputs.length}</span></p>
        <p>Explainability: <span className="font-medium text-foreground">{fingerprint.explainabilityRequested ? "Requested" : "Not requested"}</span></p>
      </div>
      <div className="grid gap-2">
        {fingerprint.signals.slice(0, 8).map((signal) => (
          <div key={`${signal.signalId}-${signal.sourceGroup}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-2">
            <span>{signal.name}</span>
            <span className="text-xs text-muted-foreground">
              {signal.sourceGroup} · {signal.kind}
              {signal.affinity !== undefined ? ` · affinity ${signal.affinity.toFixed(2)}` : ""}
            </span>
          </div>
        ))}
      </div>
      {fingerprint.unresolvedInputs.length > 0 ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Unresolved Qloo inputs: {fingerprint.unresolvedInputs.join(", ")}
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {fingerprint.layers.map((layer) => (
          <div key={layer.group} className="rounded-lg border bg-background p-2 text-xs">
            <p className="font-medium">{layer.label}</p>
            <p className="mt-1 text-muted-foreground">{layer.signals.length} signals · {layer.unresolvedInputs.length} unresolved</p>
          </div>
        ))}
      </div>
      {fingerprint.comparison ? (
        <div className="rounded-lg border bg-background p-3 text-xs">
          <p className="font-medium">Qloo entity comparison</p>
          <p className="mt-1 text-muted-foreground">
            {fingerprint.comparison.groupA} vs {fingerprint.comparison.groupB}: {fingerprint.comparison.resultCount} returned comparison signals.
          </p>
        </div>
      ) : null}
      {fingerprint.heatmap && fingerprint.heatmap.points.length > 0 ? (
        <div className="rounded-lg border bg-background p-3 text-xs">
          <p className="font-medium">Qloo signal heatmap</p>
          <p className="mt-1 text-muted-foreground">{fingerprint.heatmap.points.length} geospatial points · {fingerprint.heatmap.boundary} boundary</p>
          <div className="mt-3 flex flex-wrap gap-1" aria-label="Qloo signal heatmap points">
            {fingerprint.heatmap.points.slice(0, 40).map((point, index) => {
              const intensity = Math.max(0.15, Math.min(1, point.affinity ?? point.popularity ?? 0.5))
              return <span key={`${point.geohash ?? index}-${point.latitude}`} title={`${point.latitude.toFixed(3)}, ${point.longitude.toFixed(3)}`} className="h-4 w-4 rounded-full bg-emerald-500" style={{ opacity: intensity }} />
            })}
          </div>
          <p className="mt-2 text-muted-foreground">This visualizes Qloo signal concentration, not creator audience geography.</p>
        </div>
      ) : null}
    </div>
  )
}
