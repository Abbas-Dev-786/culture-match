# Phase 2 workflow

`runCampaignAnalysis` advances one bounded server-side step for the latest campaign attempt:

1. Resolve campaign references and location signals through Qloo.
2. Persist normalized Qloo signals before creating creator-search plans.
3. Persist a broad discovery plan before starting Apify. The culture-informed slot is reserved for an agent-approved refinement.
4. Acquire a durable database claim, start one broad Apify run, and persist the same run and dataset IDs for the baseline and initial culture-informed comparison slots.
5. Poll the broad Apify status per advancement request. Dataset items are loaded only after `SUCCEEDED`.
6. Persist normalized creators, let the creator-search critic decide whether one refinement is justified, and hand the run to scoring.
7. Persist score components and baseline comparison metadata, optionally generate evidence-grounded concepts, and complete the run.

`GET /api/campaigns/:id/status` only reads persisted state. In development, `POST /api/campaigns/:id/advance` advances one bounded step so a local process can recover a run without exposing provider calls to the browser. In production, Apify sends terminal run events to `POST /api/internal/apify/webhook`; the route authenticates the request, finds the persisted provider run, and advances exactly one workflow step. Duplicate webhook deliveries are safe because the workflow and database transitions are guarded.

Broad discovery is the default. Optional agent-selected refinement is enabled with `ENABLE_AGENTIC_CREATOR_REFINEMENT=true`; it is limited to one additional search and must preserve campaign constraints. Result counts, Apify run timeout, maximum charge, retry elapsed time, and total analysis runtime are server-enforced.

Provider secrets are read only in server modules. Raw provider payloads are not retained unless `PROVIDER_RETAIN_RAW=true`; retained payloads receive a short expiry timestamp.

Configure the Apify webhook for the deployed URL with `ACTOR.RUN.SUCCEEDED`, `ACTOR.RUN.FAILED`, `ACTOR.RUN.ABORTED`, and `ACTOR.RUN.TIMED_OUT`. Set its `Authorization` header to `Bearer <APIFY_WEBHOOK_SECRET>` and leave the default event payload enabled. Store the same secret only in Apify and the deployment environment.
