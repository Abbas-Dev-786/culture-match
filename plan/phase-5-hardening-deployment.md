# Phase 5 — Hardening, Deployment, and Validation

**Purpose:** Verify the focused product, deploy it safely, and prepare a credible demo and feedback loop.

**Depends on:** Phases 1–4

**Exit condition:** The public demo completes the release scenario from a clean setup, with tested security, provider contracts, limitations, and documentation.

## P5-01 — Freeze the product scope

Record the exact:

- Vertical and validated cities.
- Supported opportunity types.
- Qloo base URL and API contract version.
- Ranking algorithm version.
- Activation brief schema and model version.
- Known limitations.

Do not add creator discovery, new industries, or multi-city analysis during release hardening.

## P5-02 — Run verification

Run:

- Type checking.
- Linting.
- Unit tests.
- Qloo contract tests.
- Database and RLS tests.
- Workflow recovery tests.
- UI/component tests.
- End-to-end acceptance test.

The acceptance test should create a premium beauty/wellness analysis, inspect the fingerprint, review opportunities, generate the activation brief, refresh during processing, and export safe results.

## P5-03 — Security and privacy review

Verify:

- Qloo credentials are server-only.
- No secrets appear in client bundles, logs, errors, or exports.
- RLS is enabled and owner-scoped.
- Provider payload retention is limited.
- Model prompts contain only selected evidence.
- User and provider text cannot alter workflow behavior.
- Sensitive demographic traits are not inferred.

## P5-04 — Cost and reliability review

Set and test:

- Maximum Qloo requests per run.
- Request timeout and retry count.
- Opportunity result limit.
- Overall analysis timeout.
- Model token budget.
- Raw payload retention window.

Test empty, partial, rate-limited, timeout, invalid-parameter, and schema-mismatch paths.

## P5-05 — Deploy and document

Update the README with:

- The focused product promise.
- Supported vertical and cities.
- Qloo setup and validated request behavior.
- Environment variables and secret boundaries.
- Database migrations.
- Test commands.
- Known limitations.
- Demo instructions.
- License.

Deploy the database and application, then run the complete release scenario against the deployed environment.

## P5-06 — Conduct practitioner validation

Show the product to at least three beauty/wellness strategists or agency users. Ask:

1. Is the launch decision clear?
2. Are the recommendations understandable?
3. Which recommendations would you validate commercially?
4. What information is missing before acting?
5. Would this replace any manual research step?

Record feedback as product decisions, not as unsupported success claims.

## Final release checklist

- [ ] All phase exit gates are complete.
- [ ] The public demo uses one focused release scenario.
- [ ] Qloo evidence is visible for recommendations.
- [ ] Facts, derived observations, and hypotheses are separated.
- [ ] No audience, availability, or ROI claims are unsupported.
- [ ] Security and RLS review passes.
- [ ] A clean checkout follows the README.
- [ ] Practitioner feedback is recorded.
- [ ] Deferred creator functionality remains out of the MVP.
