"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import type { SafeLaunchRun } from "@/lib/domain/types"

const stages: Array<{ key: SafeLaunchRun["stage"]; label: string }> = [
  { key: "resolving_inputs", label: "Resolve inputs" },
  { key: "researching_market", label: "Map city culture" },
  { key: "discovering_opportunities", label: "Find opportunities" },
  { key: "generating_brief", label: "Shape activation brief" },
]

interface LaunchProgressProps {
  run: SafeLaunchRun
  isAdvancing: boolean
  onStart: () => void
  onRetry: () => void
}

export function LaunchProgress({ run, isAdvancing, onStart, onRetry }: LaunchProgressProps) {
  const activeIndex = stages.findIndex((stage) => stage.key === run.stage)
  const isQueued = run.status === "queued" && run.stage === "queued"
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center justify-between gap-4"><span>Analysis progress</span>{run.status === "completed" ? <span className="text-sm font-normal text-primary">Complete</span> : null}</CardTitle></CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-3 sm:grid-cols-4">
          {stages.map((stage, index) => {
            const complete = run.status === "completed" || (activeIndex >= 0 && index < activeIndex)
            const active = activeIndex === index && run.status !== "failed"
            return <div className="grid gap-2" key={stage.key}>
              <div className={`h-1.5 rounded-full ${complete ? "bg-primary" : active ? "bg-primary/50" : "bg-muted"}`} />
              <p className={`text-xs ${active ? "font-medium text-foreground" : "text-muted-foreground"}`}>{stage.label}</p>
            </div>
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{run.stageMessage}</p>
          {isQueued ? <Button onClick={onStart} disabled={isAdvancing}>{isAdvancing ? <><Spinner /> Starting</> : "Start analysis"}</Button> : null}
          {run.status === "failed" && run.retryAvailable ? <Button onClick={onRetry} disabled={isAdvancing}>{isAdvancing ? <><Spinner /> Retrying</> : "Retry analysis"}</Button> : null}
        </div>
        {run.status === "failed" && run.errorMessage ? <p className="text-sm text-destructive">{run.errorMessage}</p> : null}
      </CardContent>
    </Card>
  )
}
