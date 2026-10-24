# Phase 2 workflow

`runCampaignAnalysis` advances one bounded server-side step for the latest campaign attempt:

1. Resolve campaign references and location signals through Qloo.
2. Persist normalized Qloo signals before creating creator-search plans.
3. Persist baseline and culture-informed plans before starting Apify.
4. Acquire a durable database claim, start one Apify run with the analysis idempotency key, and persist its run and dataset IDs immediately.
5. Poll one Apify status per advancement request. Dataset items are loaded only after `SUCCEEDED`.
6. Persist normalized creators and hand the run to the `scoring` stage.

`GET /api/campaigns/:id/status` only reads persisted state. In development, `POST /api/campaigns/:id/advance` advances one bounded step so a local process can recover a run without exposing provider calls to the browser. The production handoff point is the persisted `searching_creators` run and should be driven by a trusted scheduler or provider webhook.

The workflow keeps deterministic search planning as the fallback. Model planning is opt-in with `ENABLE_MODEL_SEARCH_PLAN=true`, and its output is validated against the actor schema and campaign constraints before it can be used. Result counts, Apify run timeout, maximum charge, retry elapsed time, and total analysis runtime are server-enforced.

Provider secrets are read only in server modules. Raw provider payloads are not retained unless `PROVIDER_RETAIN_RAW=true`; retained payloads receive a short expiry timestamp.
