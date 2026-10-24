import assert from "node:assert/strict"
import test from "node:test"
import {
  isTerminalApifyWebhookEvent,
  parseApifyWebhookEvent,
} from "./apify-webhook.ts"

test("parses the documented Apify actor run event payload", () => {
  const event = parseApifyWebhookEvent({
    eventType: "ACTOR.RUN.SUCCEEDED",
    eventData: {
      actorId: "influship~influencer-search",
      actorRunId: "run-123",
    },
  })

  assert.deepEqual(event, {
    eventType: "ACTOR.RUN.SUCCEEDED",
    actorId: "influship~influencer-search",
    actorRunId: "run-123",
  })
})

test("accepts resource-based Apify payloads and rejects incomplete payloads", () => {
  assert.deepEqual(
    parseApifyWebhookEvent({
      eventType: "ACTOR.RUN.TIMED_OUT",
      resource: { id: "run-456", actId: "actor-123" },
    }),
    {
      eventType: "ACTOR.RUN.TIMED_OUT",
      actorId: "actor-123",
      actorRunId: "run-456",
    }
  )
  assert.equal(parseApifyWebhookEvent({ eventType: "TEST" }), undefined)
  assert.equal(isTerminalApifyWebhookEvent("ACTOR.RUN.SUCCEEDED"), true)
  assert.equal(isTerminalApifyWebhookEvent("ACTOR.RUN.CREATED"), false)
})
