# Phase 2 workflow

`runCampaignAnalysis` advances one bounded server-side step for the latest campaign attempt:

1. Resolve campaign references and location signals through Qloo.
2. Persist normalized Qloo signals before creating creator-search plans.
3. Persist baseline and culture-informed plans before starting Apify.
4. Acquire a durable database claim, start baseline and culture-informed Apify runs with distinct idempotency keys, and persist their run and dataset IDs immediately.
5. Poll one Apify status per advancement request. Dataset items are loaded only after `SUCCEEDED`.
6. Persist normalized creators for both search variants and hand the run to deterministic scoring.
7. Persist score components and baseline comparison metadata, optionally generate evidence-grounded concepts, and complete the run.

`GET /api/campaigns/:id/status` only reads persisted state. In development, `POST /api/campaigns/:id/advance` advances one bounded step so a local process can recover a run without exposing provider calls to the browser. In production, Apify sends terminal run events to `POST /api/internal/apify/webhook`; the route authenticates the request, finds the persisted provider run, and advances exactly one workflow step. Duplicate webhook deliveries are safe because the workflow and database transitions are guarded.

The workflow keeps deterministic search planning as the fallback. Model planning is opt-in with `ENABLE_MODEL_SEARCH_PLAN=true`, and its output is validated against the actor schema and campaign constraints before it can be used. Result counts, Apify run timeout, maximum charge, retry elapsed time, and total analysis runtime are server-enforced.

Provider secrets are read only in server modules. Raw provider payloads are not retained unless `PROVIDER_RETAIN_RAW=true`; retained payloads receive a short expiry timestamp.

Configure the Apify webhook for the deployed URL with `ACTOR.RUN.SUCCEEDED`, `ACTOR.RUN.FAILED`, `ACTOR.RUN.ABORTED`, and `ACTOR.RUN.TIMED_OUT`. Set its `Authorization` header to `Bearer <APIFY_WEBHOOK_SECRET>` and leave the default event payload enabled. Store the same secret only in Apify and the deployment environment.
