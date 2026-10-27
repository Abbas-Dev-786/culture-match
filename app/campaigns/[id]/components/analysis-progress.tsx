import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Progress,
  ProgressLabel,
  ProgressTrack,
  ProgressValue,
} from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import type { CampaignStatusResponse } from "./types"

const stages: Array<{
  key: NonNullable<CampaignStatusResponse["run"]>["stage"]
  label: string
  description: string
}> = [
  { key: "queued", label: "Campaign received", description: "Waiting to start" },
  { key: "researching_culture", label: "Researching market culture", description: "Resolving references and Qloo signals" },
  { key: "searching_creators", label: "Searching creators", description: "Running baseline and culture-informed searches" },
  { key: "scoring", label: "Scoring recommendations", description: "Normalizing evidence and calculating fit" },
  { key: "generating_report", label: "Generating report", description: "Preparing explanations and hypotheses" },
]

interface AnalysisProgressProps {
  run?: CampaignStatusResponse["run"]
  pollingPaused: boolean
  isMutating: boolean
  onStart: () => void
  onRetry: () => void
}

export function AnalysisProgress({
  run,
  pollingPaused,
  isMutating,
  onStart,
  onRetry,
}: AnalysisProgressProps) {
  const currentIndex = Math.max(
    0,
    stages.findIndex((stage) => stage.key === run?.stage)
  )
  const progress = run?.status === "completed"
    ? 100
    : run?.status === "failed" || run?.status === "cancelled"
      ? Math.round((currentIndex / (stages.length - 1)) * 100)
      : Math.round((currentIndex / (stages.length - 1)) * 100)

  return (
    <Card className="print-break-inside-avoid">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Analysis progress</CardTitle>
          <Badge variant={run?.status === "failed" ? "destructive" : "outline"}>
            {run?.status ?? "unknown"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <Progress aria-label="Campaign analysis progress" value={progress}>
          <div className="flex w-full items-center">
            <ProgressLabel>{run?.stageMessage ?? "Waiting for campaign status"}</ProgressLabel>
            <ProgressValue />
          </div>
          <ProgressTrack />
        </Progress>
        <Accordion multiple defaultValue={run?.status === "running" ? ["stages"] : []} className="border-0">
          <AccordionItem value="stages" className="border-0">
            <AccordionTrigger className="px-0 py-2">
              <span>
                View analysis stages
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {run?.status === "completed" ? "All stages complete" : "Detailed progress"}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-0">
              <ol className="grid gap-3" aria-live="polite">
                {stages.map((stage, index) => {
                  const isComplete = run?.status === "completed" || index < currentIndex
                  const isCurrent = run?.status === "running" && index === currentIndex
                  return (
                    <li key={stage.key} className="flex items-start gap-3 text-sm">
                      <span
                        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium ${
                          isComplete
                            ? "border-primary bg-primary text-primary-foreground"
                            : isCurrent
                              ? "border-primary text-primary"
                              : "text-muted-foreground"
                        }`}
                        aria-label={isComplete ? "Complete" : isCurrent ? "In progress" : "Not started"}
                      >
                        {isComplete ? "✓" : index + 1}
                      </span>
                      <span className="grid gap-0.5">
                        <span className={isCurrent ? "font-medium" : ""}>{stage.label}</span>
                        <span className="text-xs text-muted-foreground">{isCurrent ? run?.stageMessage : stage.description}</span>
                      </span>
                    </li>
                  )
                })}
              </ol>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        {pollingPaused ? (
          <Alert>
            <AlertTitle>Automatic refresh paused</AlertTitle>
            <AlertDescription>Refresh the page to resume status checks. The persisted run can continue without creating another provider run.</AlertDescription>
          </Alert>
        ) : null}
        {run?.errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>{run.errorCode ?? "Analysis failure"}</AlertTitle>
            <AlertDescription>{run.errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        <div className="no-print flex flex-wrap gap-2">
          {run?.status === "queued" ? (
            <Button onClick={onStart} disabled={isMutating}>
              {isMutating ? <><Spinner /> Starting...</> : "Start analysis"}
            </Button>
          ) : null}
          {run?.status === "failed" && run.retryAvailable !== false ? (
            <Button onClick={onRetry} disabled={isMutating}>
              {isMutating ? <><Spinner /> Retrying...</> : "Retry analysis"}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
