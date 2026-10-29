import assert from "node:assert/strict"
import test from "node:test"
import { createProviderRequestMeter } from "./provider-usage.ts"

test("provider request meter separates provider and model usage", () => {
  const meter = createProviderRequestMeter()
  meter.record("qloo")
  meter.record("qloo")
  meter.record("apify")
  meter.recordModelCall()

  assert.deepEqual(meter.snapshot(), {
    qlooRequests: 2,
    apifyRequests: 1,
    modelRequests: 1,
  })
})
