export interface ApifyWebhookEvent {
  eventType: string
  actorRunId: string
  actorId?: string
}

export function parseApifyWebhookEvent(
  payload: unknown
): ApifyWebhookEvent | undefined {
  if (!isRecord(payload)) return undefined

  const eventData = isRecord(payload.eventData) ? payload.eventData : undefined
  const resource = isRecord(payload.resource) ? payload.resource : undefined
  const eventType = readString(payload.eventType)
  const actorRunId =
    readString(eventData?.actorRunId) ??
    readString(resource?.id) ??
    readString(payload.actorRunId)
  const actorId =
    readString(eventData?.actorId) ??
    readString(resource?.actId) ??
    readString(payload.actorId)

  if (!eventType || !actorRunId) return undefined
  return {
    eventType,
    actorRunId,
    ...(actorId ? { actorId } : {}),
  }
}

export function isTerminalApifyWebhookEvent(eventType: string): boolean {
  return [
    "ACTOR.RUN.SUCCEEDED",
    "ACTOR.RUN.FAILED",
    "ACTOR.RUN.ABORTED",
    "ACTOR.RUN.TIMED_OUT",
  ].includes(eventType)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}
