# Phase 5 — Hardening, Deployment, and Submission

**Purpose:** Verify the complete workflow, close security and reliability gaps, deploy the product, and prepare the public submission.

**Depends on:** Phases 1–4

**Exit condition:** The public demo works from clean setup instructions, the repository contains required source/assets/license information, and the end-to-end acceptance suite passes.

## Build order

### P5-01 — Freeze the release candidate

Stop adding product scope. Record the exact provider versions, model ID, validated market, score algorithm version, environment names, and known limitations used by the demo.

### P5-02 — Run automated verification

Run linting, type checking, unit tests, contract tests, integration tests, and the browser acceptance suite. Fix failures before deploying. Store the test result and fixture version with the release notes.

### P5-03 — Perform security and data review

Inspect the built client bundle, environment configuration, server logs, RLS policies, Data API exposure, grants, retry endpoints, and export output. Verify that every public route returns only client-safe data.

### P5-04 — Deploy database and application

Apply the approved migrations, run database advisors/security checks, execute a test query, configure deployment secrets, deploy the application, and exercise the complete workflow against the deployed environment.

### P5-05 — Prepare repository and demo

Add README instructions, license, diagrams or corrected references, provider setup notes, fixture policy, test commands, limitations, and a short demo script. Verify a clean checkout can follow the README.

### P5-06 — Perform final submission audit

Check the official rules, public demo availability, repository visibility, source/assets completeness, English description, license visibility, test access, and absence of secrets. Capture the final deployed URL and release commit/reference.

## 1. Run the complete test plan

### Unit tests

- Campaign and provider-input schemas.
- Market-scope validation.
- State-machine transitions.
- Retry classification.
- Qloo and Apify normalizers.
- Score math and weight renormalization.
- Evidence completeness.
- Broad/refinement comparison, including the no-refinement state.
- Report-output validation.

### Contract and integration tests

- Qloo success, empty, invalid, and schema-change fixtures.
- Apify actor run lifecycle and dataset fixtures.
- Database writes and foreign keys.
- Idempotent analysis start and retry.
- RLS and policy behavior.
- Safe error serialization.

### End-to-end acceptance test

1. Open the public app.
2. Submit the selected India-focused campaign.
3. Confirm a stable campaign/run ID appears.
4. Observe all persisted workflow stages.
5. Confirm Qloo signals are visible with provenance.
6. Confirm real or approved fixture-backed creator results appear.
7. Confirm deterministic score breakdowns and evidence labels.
8. Compare broad discovery with the optional refinement result, or confirm the UI honestly reports that no refinement was justified.
9. Refresh during processing and confirm no duplicate run.
10. Trigger or simulate a provider failure and confirm safe retry.
11. Export or print client-safe results.
12. Verify no secrets appear in browser requests, responses, logs, or bundles.

## 2. Security review

- Confirm all provider calls run server-side.
- Inspect the client bundle for secret names and values.
- Confirm service-role credentials are never passed to browser code.
- Confirm public environment variables contain only public configuration.
- Confirm RLS is enabled on every exposed table.
- Confirm policies are owner-scoped where authentication exists.
- Confirm unauthenticated demo mode cannot expose arbitrary private campaign rows.
- Confirm Data API grants are intentional and separate from RLS.
- Confirm no authorization logic uses editable user metadata.
- Confirm logs redact API keys, headers, raw private payloads, and sensitive campaign data.
- Confirm model prompts treat provider text as untrusted input.
- Confirm provider URLs and headers are allowlisted.

## 3. Reliability and cost review

- Set candidate, retry, token, and provider-cost limits.
- Confirm duplicate requests are idempotent.
- Confirm long Apify runs do not depend on a browser session.
- Confirm interrupted workflow recovery.
- Confirm empty Qloo results produce a transparent limitation and do not claim that refinement was Qloo-informed.
- Confirm fewer-than-requested candidates are reported as a limited sample.
- Confirm raw payload retention and cleanup behavior.
- Confirm health/status diagnostics do not expose credentials.

## 4. Observability

Log one structured, redacted event per workflow stage with:

- Campaign ID.
- Analysis run ID.
- Stage.
- Provider.
- Duration.
- Status.
- Safe error code.

Track:

- Qloo success, latency, usable-signal count, and schema errors.
- Apify run counts, completion/failure, latency, result count, and cost when available.
- Broad/refinement overlap and rank changes, including the no-refinement case.
- Component availability and evidence completeness.
- Model validation failures and token usage when available.

Do not log complete creator payloads or API keys in normal production logs.

## 5. Deployment

### Environment configuration

Configure server-side secrets in the deployment provider:

- Qloo base URL and API key.
- Apify token.
- Model provider key and model ID.
- Supabase server credentials.

For the bounded agentic path, also configure `ENABLE_AGENTIC_DECISIONS`, `ENABLE_AGENTIC_CREATOR_REFINEMENT`, and `AGENTIC_REQUIRE_APPROVAL` according to the deployment policy. Keep the creator-search refinement capped at one additional provider run per analysis.

Configure only genuinely public values with a public environment prefix. Verify preview and production environments separately.

### Database

- Apply migrations through the approved Supabase workflow.
- Run database advisors/security checks where available.
- Verify RLS, policies, grants, indexes, and retention behavior.
- Run a test query against the deployed environment.
- Confirm migration history is clean and reproducible.

### Application

- Deploy the Next.js application.
- Confirm route-handler runtime and execution limits.
- Confirm asynchronous workflow advancement works in the deployed environment.
- Confirm status polling uses the app database, not direct provider polling from the client.
- Verify public URL, error pages, and health behavior.

## 6. Documentation and repository readiness

Update the README with:

- Product summary and India-focused demo context.
- Architecture and data flow.
- Setup prerequisites.
- Environment-variable names and server/client boundaries.
- Validated-market limitation.
- Qloo and Apify provider setup.
- Database migration/setup instructions.
- Test commands.
- Deployment instructions.
- Known limitations and data-honesty rules.
- License.
- Demo credentials or test instructions only if safe and necessary.

Resolve the TDD references to `architecture.png` and `sequence.png` by adding the assets or removing the broken references.

## 7. Demo preparation

Prepare a short, repeatable walkthrough:

1. Enter a global-brand campaign brief targeting the selected India-focused market.
2. Show Qloo reference resolution and market signals.
3. Show asynchronous creator discovery.
4. Show evidence-linked ranking cards.
5. Show broad discovery versus optional refinement, including the honest no-refinement state when the critic stops.
6. Open a candidate and show missing-data labels.
7. Show an AI campaign concept explicitly marked as a hypothesis.
8. State limitations and explain that the product is globally extensible but only tested markets are supported.

Keep a fixture-backed fallback for provider outages, clearly labeled as demo data if used.

## Final release checklist

- [ ] All phase exit gates are complete.
- [ ] Public demo works from a clean browser session.
- [ ] Public repository contains source, assets, setup instructions, and license.
- [ ] No secrets are committed or exposed.
- [ ] RLS and access policies have been tested.
- [ ] Provider fixtures and live validation notes are included where appropriate.
- [ ] End-to-end acceptance test passes.
- [ ] Known limitations are visible in the UI or README.
- [ ] Demo narrative does not claim guaranteed cultural resonance, audience geography, or ROI.
- [ ] Submission dates and rules are rechecked immediately before submission.
