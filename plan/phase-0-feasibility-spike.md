# Phase 0 — Vertical and Qloo Feasibility

**Purpose:** Prove that the focused beauty/wellness market-entry problem produces useful Qloo results before changing the application.

**Depends on:** None

**Exit condition:** Three representative briefs across validated Indian cities produce usable fingerprints and at least one supported opportunity type with traceable results.

## P0-01 — Lock the product decision

Document:

- Vertical: premium beauty and wellness.
- User: brand strategist, growth marketer, or boutique agency.
- Decision: find culturally aligned launch partners and places.
- First cities to test: Mumbai, Bengaluru, and Delhi, subject to provider results.
- First opportunity type: Qloo-supported brand or place entities.

Do not retain creator matching as a required Phase 0 dependency.

## P0-02 — Define representative briefs

Create three sanitized briefs, for example:

1. Premium sunscreen entering Mumbai.
2. Natural skincare entering Bengaluru.
3. Wellness subscription entering Delhi.

Each brief must include a brand, product, city, launch intent, and two to five cultural references. Record which values are user inputs and which values come from Qloo.

## P0-03 — Validate Qloo entity and tag resolution

For every brief:

1. Resolve the brand and cultural references.
2. Search supported tags for the product category.
3. Record exact IDs, names, types, ambiguity, and unresolved inputs.
4. Confirm locality behavior for the selected city.

Save only sanitized request summaries and fixtures. Never commit credentials or unrestricted private payloads.

## P0-04 — Validate layered Insights requests

Test the smallest useful set of layers:

- Market: city-only taste signals.
- Brand: brand signals within the city.
- Product: product/tag signals within the city.
- Combined: brand, product, and references with documented weights/operators.

For each request, record the exact method, endpoint, parameters, response fields, affinity/rank semantics, empty-result behavior, and rate-limit behavior if observable. Verify the active environment rather than assuming the public API shape.

## P0-05 — Validate opportunity discovery

Test Qloo recommendations for one supported target type, such as `urn:entity:brand` or `urn:entity:place`, using the validated signal set and location.

The opportunity type is valid only if:

- The API accepts the request.
- Returned entities have stable IDs and names.
- Results can be tied to the selected city and campaign signals.
- The response has enough metadata for a useful recommendation card.

If the preferred type fails, select the next supported type and record the decision.

## P0-06 — Validate optional capabilities

Test entity comparison and heatmaps separately. They are optional for the first release and must not block the core workflow.

## Deliverables

- `lib/phase-0/fixtures/qloo/` sanitized fixtures.
- `lib/phase-0/provider-field-matrix.md` updated for the opportunity workflow.
- `lib/phase-0/decision-log.md` updated with the pivot.
- Three representative briefs and expected outcomes.
- Validated city and opportunity-type configuration.
- Qloo request and response notes.

## Acceptance checklist

- [ ] The vertical, user, city scope, and decision are written down.
- [ ] Three representative briefs are defined.
- [ ] Entity and tag resolution works for the chosen inputs.
- [ ] Location-conditioned Insights returns usable signals.
- [ ] At least one opportunity type returns usable entities.
- [ ] Provider rank/affinity semantics are documented or marked unavailable.
- [ ] Empty, ambiguous, and invalid results are represented safely.
- [ ] No creator or Apify dependency is required for the MVP path.
