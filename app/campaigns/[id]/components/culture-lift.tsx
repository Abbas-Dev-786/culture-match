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
                See what changed when Qloo cultural intelligence informed the
                creator search—not just who was recommended.
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
            label="Culture-informed"
            value={comparison.cultureInformedCount}
            detail="Same constraints plus Qloo signals"
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
            detail="Only found by cultural search"
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
            label="Qloo score lift"
            value={qlooLift === undefined ? "—" : formatDelta(qlooLift)}
            detail="Average score, same creators"
            emphasis={qlooLift !== undefined && qlooLift !== 0}
          />
        </div>

        <div className="rounded-2xl border border-primary/15 bg-background/70 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">What did Qloo change?</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {comparison.materiallyChanged
                  ? `The cultural search introduced ${newDiscoveries.length} new ${newDiscoveries.length === 1 ? "creator" : "creators"} and changed ${rankShifts.length} shared ${rankShifts.length === 1 ? "rank" : "ranks"}.`
                  : "The cultural signals did not materially change this shortlist. That is a valid result for this campaign."}
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
                description="Creators introduced by the Qloo-informed search."
                ids={newDiscoveries}
                creators={creators}
                emptyLabel="No creators were unique to the culture-informed search."
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
                    <p className="font-medium">Measured Qloo contribution</p>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                      The same culture-informed candidates were scored with and
                      without Qloo resonance. This isolates Qloo&apos;s ranking
                      effect from its discovery effect.
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
                      : "Ranking unchanged"}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <MiniMetric
                    label="Average score lift"
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
          Shared creators whose position changed after cultural reranking.
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
