import type { CampaignStatus, RunStatus, WorkflowStage } from "@/lib/domain/types"

export interface WorkflowState {
  status: RunStatus
  stage: WorkflowStage
}

export class WorkflowTransitionError extends Error {
  readonly code = "INVALID_WORKFLOW_TRANSITION"
  readonly from: WorkflowState
  readonly to: WorkflowState

  constructor(
    from: WorkflowState,
    to: WorkflowState,
  ) {
    super(`Cannot transition from ${from.status}/${from.stage} to ${to.status}/${to.stage}`)
    this.from = from
    this.to = to
    this.name = "WorkflowTransitionError"
  }
}

const stageOrder: readonly WorkflowStage[] = [
  "queued",
  "researching_culture",
  "searching_creators",
  "scoring",
  "generating_report",
]

export const workflowTransitions: Readonly<Record<WorkflowStage, readonly WorkflowStage[]>> = {
  queued: ["researching_culture"],
  researching_culture: ["searching_creators"],
  searching_creators: ["scoring"],
  scoring: ["generating_report"],
  generating_report: [],
}

export function transitionWorkflow(
  current: WorkflowState,
  nextStage: WorkflowStage,
): WorkflowState {
  if (current.status !== "queued" && current.status !== "running") {
    throw new WorkflowTransitionError(current, {
      status: current.status,
      stage: nextStage,
    })
  }

  if (!workflowTransitions[current.stage].includes(nextStage)) {
    throw new WorkflowTransitionError(current, {
      status: "running",
      stage: nextStage,
    })
  }

  return {
    status: "running",
    stage: nextStage,
  }
}

export function completeWorkflow(current: WorkflowState): WorkflowState {
  if (current.status !== "running" || current.stage !== "generating_report") {
    throw new WorkflowTransitionError(current, {
      status: "completed",
      stage: "generating_report",
    })
  }

  return { status: "completed", stage: "generating_report" }
}

export function failWorkflow(current: WorkflowState): WorkflowState {
  if (current.status !== "queued" && current.status !== "running") {
    throw new WorkflowTransitionError(current, {
      status: "failed",
      stage: current.stage,
    })
  }

  return { status: "failed", stage: current.stage }
}

export function cancelWorkflow(current: WorkflowState): WorkflowState {
  if (current.status !== "queued" && current.status !== "running") {
    throw new WorkflowTransitionError(current, {
      status: "cancelled",
      stage: current.stage,
    })
  }

  return { status: "cancelled", stage: current.stage }
}

export function campaignStatusForRunState(state: WorkflowState): CampaignStatus {
  if (state.status === "completed") return "completed"
  if (state.status === "failed") return "failed"
  if (state.status === "cancelled") return "cancelled"
  return state.stage
}

export function isWorkflowStage(value: string): value is WorkflowStage {
  return stageOrder.includes(value as WorkflowStage)
}
