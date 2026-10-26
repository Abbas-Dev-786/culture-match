import assert from "node:assert/strict"
import test from "node:test"
import type { QlooFingerprint, SafeLaunchAnalysis } from "../domain/types.ts"
import { launchResultsToCsv } from "./launch-csv.ts"

const analysis: SafeLaunchAnalysis = {
  id: "analysis-1",
  brandName: "Aesop",
  product: "Facial cleanser",
  country: "India",
  city: "Mumbai",
  opportunityType: "urn:entity:brand",
  culturalReferences: ["Tata", "The Bombay Canteen"],
  launchIntent: "Find culturally adjacent launch partners",
  status: "completed",
  createdAt: "2026-10-27T00:00:00.000Z",
  updatedAt: "2026-10-27T00:00:00.000Z",
}

const fingerprint: QlooFingerprint = {
  locationQuery: "Mumbai, India",
  location: { name: "Mumbai" },
  signals: [],
  layers: [],
  unresolvedInputs: [],
  explainabilityRequested: true,
}

test("launch CSV exports safe analysis records without raw provider payloads", () => {
  const csv = launchResultsToCsv({
    analysis,
    fingerprint,
    opportunities: [],
    activationReport: undefined,
  })

  assert.match(csv, /record_type,analysis_id/)
  assert.match(csv, /analysis,analysis-1,Aesop/)
  assert.doesNotMatch(csv, /rawPayload|api_key|Authorization/i)
})
