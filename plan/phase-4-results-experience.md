# Phase 4 — Focused Product Experience

**Purpose:** Turn the pivoted workflow into a clear, narrow product experience for a beauty/wellness market-entry decision.

**Depends on:** Phase 3 result contracts

**Exit condition:** A new user can complete an analysis and understand the top opportunities, evidence, limitations, and activation brief without developer assistance.

## P4-01 — Replace the campaign form

The form should ask only for:

- Brand name.
- Product.
- Target city.
- Opportunity type.
- Two to five cultural references.
- Launch intent.

Add concise guidance that the result is cultural decision support, not proof of partnership availability or commercial success.

Do not expose follower ranges, creator fees, raw Qloo audience IDs, or advanced demographic fields in the MVP form.

## P4-02 — Build progress and recovery states

Show these stages:

1. Resolving inputs.
2. Researching city culture.
3. Discovering opportunities.
4. Preparing activation brief.
5. Complete or failed.

Polling must read the application status endpoint only. Refreshing the page must not create duplicate Qloo work.

## P4-03 — Build the market fingerprint view

Show:

- Resolved city.
- Resolved brand, product tags, and references.
- Market, brand, product, reference, and combined layers.
- Signal labels, types, IDs, and affinity/rank where documented.
- Operators and weights used.
- Unresolved inputs and limitations.

Use clear labels for user input, provider-reported, derived, and hypothesis content.

## P4-04 — Build opportunity cards

Each card should show:

- Entity name, type, and public metadata.
- Qloo rank or affinity where available.
- Related campaign signals.
- “Why it appeared.”
- Evidence references.
- Commercial questions to validate.
- No unsupported claims about popularity, availability, or expected performance.

## P4-05 — Build the activation brief

Render the structured brief in separate sections:

- Evidence-backed cultural territory.
- Suggested launch context.
- Activation directions.
- Hypotheses.
- Open validation questions.

The UI should make it impossible to confuse an AI suggestion with a Qloo fact.

## P4-06 — Add optional visual layers

Only after the core results are usable:

- Add a Qloo heatmap with a clear “cultural signal concentration” label.
- Add an entity comparison panel.
- Add print view or CSV export.

## Tests and acceptance evidence

- A user can submit the focused brief without developer help.
- Invalid city, opportunity type, or missing references are actionable.
- Progress survives refresh.
- Fingerprint layers render only stored Qloo results.
- Opportunity cards expose evidence and unknowns.
- Activation briefs clearly label hypotheses.
- Export contains no secrets or raw internal payloads.
- Keyboard, mobile, loading, empty, partial, and error states work.

## Deliverables

- Focused analysis form.
- Progress and retry UI.
- Market fingerprint component.
- Opportunity card/list view.
- Activation brief component.
- Optional comparison, heatmap, and export views.
