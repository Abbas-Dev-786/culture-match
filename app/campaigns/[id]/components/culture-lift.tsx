import type { ReactNode } from "react"
import {
  ArrowDown,
  ArrowUp,
  GitCompareArrows,
  ListPlus,
  Minus,
  Sparkles,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { CreatorCard } from "./creator-card"
import type { CampaignMatchView, ComparisonView } from "./types"

interface CultureLiftProps {
  comparison: ComparisonView
  baseline: CampaignMatchView[]
  cultureInformed: CampaignMatchView[]
}

export function CultureLift({
  comparison,
  baseline,
  cultureInformed,
}: CultureLiftProps) {
  const creators = new Map(
    [...baseline, ...cultureInformed].map((match) => [
      match.providerCreatorId,
      match,
    ])
  )
  const newDiscoveries = comparison.cultureInformedOnlyIds
  const rankShifts = comparison.rankChanges.filter(
    (change) =>
      change.baselineRank !== undefined &&
      change.cultureInformedRank !== undefined
  )
  const qlooLift = comparison.qlooAblation?.averageScoreDelta
  const cultureDiscoveryRan = comparison.cultureDiscoveryRan === true
  const refinementRan = comparison.refinementRan === true

  return (
    <Card className="print-break-inside-avoid overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card shadow-sm">
      <CardHeader className="border-b border-primary/10 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="size-5" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                Signature comparison
              </span>
            </div>
            <div>
              <CardTitle className="text-2xl sm:text-3xl">
                Culture Lift
              </CardTitle>
              <CardDescription className="mt-2 max-w-2xl text-sm leading-6">
                {refinementRan
                  ? "See what changed when Qloo cultural intelligence informed creator discovery, refinement and ranking."
                  : cultureDiscoveryRan
                    ? "See what changed when Qloo cultural intelligence informed creator discovery and ranking."
                    : "See how Qloo enriched and ranked the broad creator shortlist. No second discovery search ran for this campaign."}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant={comparison.materiallyChanged ? "secondary" : "outline"}
            className="self-start"
          >
            {comparison.materiallyChanged
              ? "Measurable change"
              : "No material change"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="grid gap-5 pt-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <LiftStat
            icon={<Users className="size-4" aria-hidden="true" />}
            label="Baseline"
            value={comparison.baselineCount}
            detail="Category and market search"
          />
          <LiftStat
            icon={<Sparkles className="size-4" aria-hidden="true" />}
            label={refinementRan ? "Qloo-guided refinement" : cultureDiscoveryRan ? "Qloo-guided discovery" : "Qloo-enriched shortlist"}
            value={comparison.cultureInformedCount}
            detail={refinementRan ? "Broad results plus Qloo-guided refinement" : cultureDiscoveryRan ? "Broad results plus Qloo-guided discovery" : "Same broad results, ranked with campaign resonance"}
            emphasis
          />
          <LiftStat
            icon={<GitCompareArrows className="size-4" aria-hidden="true" />}
            label="Shared"
            value={comparison.overlapCount}
            detail={`${Math.round(comparison.overlapRate * 100)}% of the larger shortlist`}
          />
          <LiftStat
            icon={<ListPlus className="size-4" aria-hidden="true" />}
            label="New discoveries"
            value={newDiscoveries.length}
            detail={refinementRan ? "Only found by Qloo-guided refinement" : cultureDiscoveryRan ? "Only found by Qloo-guided discovery" : "No second search ran; this should be zero"}
            emphasis={newDiscoveries.length > 0}
          />
          <LiftStat
            icon={
              qlooLift === undefined ? (
                <Minus className="size-4" aria-hidden="true" />
              ) : qlooLift >= 0 ? (
                <ArrowUp className="size-4" aria-hidden="true" />
              ) : (
                <ArrowDown className="size-4" aria-hidden="true" />
              )
            }
            label="Fixed score delta"
            value={qlooLift === undefined ? "—" : formatDelta(qlooLift)}
            detail="Same creators · fixed denominator"
            emphasis={qlooLift !== undefined && qlooLift !== 0}
          />
        </div>

        <div className="rounded-2xl border border-primary/15 bg-background/70 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">What did Qloo change?</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {cultureDiscoveryRan
                  ? comparison.materiallyChanged
                    ? `${refinementRan ? "Refinement" : "Discovery"} changed the shortlist: Qloo introduced ${newDiscoveries.length} new ${newDiscoveries.length === 1 ? "creator" : "creators"}. Ranking changed for ${rankShifts.length} shared ${rankShifts.length === 1 ? "creator" : "creators"}.`
                    : `The Qloo-guided ${refinementRan ? "refinement" : "discovery"} did not materially change this shortlist. That is a valid result for this campaign.`
                  : `No second discovery search ran. Qloo enriched observed creator content and ranked the same broad candidate pool; ${rankShifts.length} shared ${rankShifts.length === 1 ? "creator changed" : "creators changed"} rank.`}
              </p>
            </div>
            <Badge variant="outline" className="w-fit">
              {rankShifts.length} rank {rankShifts.length === 1 ? "shift" : "shifts"}
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="shortlist" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:flex sm:w-auto">
            <TabsTrigger value="shortlist">
              Shortlist ({cultureInformed.length})
            </TabsTrigger>
            <TabsTrigger value="changes">
              What changed ({newDiscoveries.length + rankShifts.length})
            </TabsTrigger>
            <TabsTrigger value="baseline">
              Baseline ({baseline.length})
            </TabsTrigger>
            <TabsTrigger value="impact">
              Qloo impact
            </TabsTrigger>
          </TabsList>
          <TabsContent value="shortlist" className="mt-4 grid gap-3">
            {cultureInformed.length > 0 ? (
              cultureInformed.map((match) => (
                <CreatorCard key={match.id} match={match} />
              ))
            ) : (
              <EmptyMessage label="No culture-informed creators were returned." />
            )}
          </TabsContent>
          <TabsContent value="changes" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <DiscoveryList
                title="New cultural discoveries"
                description={refinementRan ? "Creators introduced by the Qloo-guided refinement search." : cultureDiscoveryRan ? "Creators introduced by the Qloo-guided discovery search." : "No second discovery search ran for this campaign."}
                ids={newDiscoveries}
                creators={creators}
                emptyLabel={cultureDiscoveryRan ? "No creators were unique to the Qloo-guided search." : "No creators can be unique to a second search because discovery did not run."}
              />
              <RankShiftList
                changes={rankShifts}
                creators={creators}
                emptyLabel="No shared creators changed rank."
              />
            </div>
          </TabsContent>
          <TabsContent value="baseline" className="mt-4 grid gap-3">
            {baseline.length > 0 ? (
              baseline.map((match) => (
                <CreatorCard key={match.id} match={match} />
              ))
            ) : (
              <EmptyMessage label="No baseline creators were returned." />
            )}
          </TabsContent>
          <TabsContent value="impact" className="mt-4">
            {comparison.qlooAblation ? (
              <div className="rounded-2xl border bg-muted/30 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">Measured Qloo ranking contribution</p>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                      The same culture-informed candidates were scored with and
                      without Qloo resonance using a fixed denominator. This
                      isolates Qloo&apos;s ranking and component contribution from
                      its discovery effect; it does not prove campaign performance.
                    </p>
                  </div>
                  <Badge
                    variant={
                      comparison.qlooAblation.materiallyChanged
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {comparison.qlooAblation.materiallyChanged
                      ? "Ranking changed"
                      : comparison.qlooAblation.averageScoreDelta !== 0
                        ? "Score contribution changed"
                        : "No ranking change"}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <MiniMetric
                    label="Fixed score delta"
                    value={formatDelta(comparison.qlooAblation.averageScoreDelta)}
                  />
                  <MiniMetric
                    label="Creators scored"
                    value={comparison.qlooAblation.scoredCreatorCount}
                  />
                  <MiniMetric
                    label="Evidence coverage"
                    value={
                      comparison.qlooAblation.creatorEvidenceCoverage === undefined
                        ? "—"
                        : `${Math.round(comparison.qlooAblation.creatorEvidenceCoverage * 100)}%`
                    }
                  />
                </div>
                <AblationRankShiftList
                  changes={comparison.qlooAblation.rankChanges}
                  creators={creators}
                />
                <p className="mt-4 text-xs text-muted-foreground">
                  Open a creator&apos;s scoring evidence in the shortlist to inspect each component&apos;s contribution and availability. Missing provider fields remain unavailable rather than being estimated.
                </p>
              </div>
            ) : (
              <EmptyMessage label="No Qloo ablation data was recorded for this campaign." />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function LiftStat({
  icon,
  label,
  value,
  detail,
  emphasis = false,
}: {
  icon: ReactNode
  label: string
  value: number | string
  detail: string
  emphasis?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        emphasis ? "border-primary/25 bg-primary/5" : "bg-background/65"
      }`}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border bg-background/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function DiscoveryList({
  title,
  description,
  ids,
  creators,
  emptyLabel,
}: {
  title: string
  description: string
  ids: string[]
  creators: Map<string, CampaignMatchView>
  emptyLabel: string
}) {
  return (
    <div className="rounded-2xl border bg-background/55 p-4 sm:p-5">
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {ids.length > 0 ? (
        <ul className="mt-4 grid gap-2">
          {ids.map((id) => {
            const creator = creators.get(id)
            return (
              <li
                key={id}
                className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {creatorLabel(creator, id)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {creator?.username ? `@${creator.username}` : creator?.platform ?? "Creator"}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  New
                </Badge>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      )}
    </div>
  )
}

function RankShiftList({
  changes,
  creators,
  emptyLabel,
}: {
  changes: ComparisonView["rankChanges"]
  creators: Map<string, CampaignMatchView>
  emptyLabel: string
}) {
  return (
    <div className="rounded-2xl border bg-background/55 p-4 sm:p-5">
      <div>
        <p className="font-medium">Rank shifts</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Shared creators whose position changed between the two discovery shortlists.
        </p>
      </div>
      {changes.length > 0 ? (
        <ul className="mt-4 grid gap-2">
          {changes.map((change) => {
            const creator = creators.get(change.providerCreatorId)
            const movedUp =
              (change.cultureInformedRank ?? 0) < (change.baselineRank ?? 0)
            return (
              <li
                key={change.providerCreatorId}
                className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {creatorLabel(creator, change.providerCreatorId)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {creator?.username ? `@${creator.username}` : "Shared candidate"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    #{change.baselineRank}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-semibold">#{change.cultureInformedRank}</span>
                  {movedUp ? (
                    <ArrowUp className="size-4 text-emerald-600" aria-label="Moved up" />
                  ) : (
                    <ArrowDown className="size-4 text-amber-600" aria-label="Moved down" />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      )}
    </div>
  )
}

function AblationRankShiftList({
  changes,
  creators,
}: {
  changes: NonNullable<ComparisonView["qlooAblation"]>["rankChanges"]
  creators: Map<string, CampaignMatchView>
}) {
  return (
    <div className="mt-4 rounded-xl border bg-background/60 p-4">
      <p className="font-medium">Qloo rank shifts</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Same candidates, with and without cultural affinity enabled.
      </p>
      {changes.length > 0 ? (
        <ul className="mt-3 grid gap-2">
          {changes.map((change) => {
            const creator = creators.get(change.providerCreatorId)
            const movedUp =
              (change.withQlooRank ?? 0) < (change.withoutQlooRank ?? 0)
            return (
              <li key={change.providerCreatorId} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <span className="min-w-0 truncate text-sm font-medium">
                  {creatorLabel(creator, change.providerCreatorId)}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-sm">
                  <span className="text-muted-foreground">#{change.withoutQlooRank}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-semibold">#{change.withQlooRank}</span>
                  {movedUp ? (
                    <ArrowUp className="size-4 text-emerald-600" aria-label="Moved up with Qloo" />
                  ) : (
                    <ArrowDown className="size-4 text-amber-600" aria-label="Moved down with Qloo" />
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          No creator changed rank when Qloo affinity was enabled.
        </p>
      )}
    </div>
  )
}

function creatorLabel(creator: CampaignMatchView | undefined, fallback: string): string {
  return creator?.name ?? creator?.username ?? fallback
}

function formatDelta(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`
}

function EmptyMessage({ label }: { label: string }) {
  return (
    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      {label}
    </p>
  )
}
