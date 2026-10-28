# Phase 4 — Results Experience and Export

**Purpose:** Turn the workflow and matching contracts into a clear, responsive product experience.

**Depends on:** Phase 3 result contracts

**Exit condition:** A new tester can submit a campaign, follow progress, inspect the first recommendations, understand uncertainty, inspect the agent/critic trace, and compare broad discovery with optional refinement without developer assistance.

## Build order

### P4-01 — Build the campaign form against the API schema

Create or update:

- `app/campaigns/new/page.tsx`
- `components/campaign-form.tsx`
- Shared form validation/schema mapping.

Submit only the application contract. Display validated-market limitations and preserve optional fields as absent rather than inventing defaults.

### P4-02 — Build progress and recovery states

Create `components/analysis-progress.tsx` and connect it to the status endpoint. Implement bounded polling, terminal-state handling, refresh recovery, failure messaging, and retry action.

### P4-03 — Build the results data view

Create:

- `components/culture-profile.tsx`
- `components/creator-card.tsx`
- `components/match-breakdown.tsx`
- `components/baseline-comparison.tsx` (legacy component name; it renders broad/refinement comparison).

Use client-safe results contracts only. Render explicit badges for verified, provider-derived, derived, unavailable, and hypothesis content.

### P4-04 — Build the campaign detail route

Connect `app/campaigns/[id]/page.tsx` to summary, culture profile, rankings, comparison, and creator detail data. Add loading, empty, partial, and error states.

### P4-05 — Add export after the dashboard works

Implement print view or CSV from the normalized client-safe result model. Test that secrets, raw payloads, and unsupported claims cannot enter the export.

### P4-06 — Perform accessibility and responsive pass

Test keyboard navigation, focus states, status announcements, contrast, mobile widths, long labels, and comparison layout before visual polish.

## 1. Build the campaign form

Required inputs:

- Brand name.
- Product/category.
- Country.
- Optional region/state.
- Optional city.
- Market scope.
- Campaign objective.

Optional inputs:

- Cultural references.
- Preferred content language.
- Follower range.
- Budget and currency.
- Optional refinement/approval behavior is system-controlled; no search-mode toggle is required.

Form behavior:

- Explain that country/region/city is a market research target, not proof of creator audience geography.
- Validate client-side for usability and server-side for security.
- Show the supported/validated market limitation.
- Surface ambiguous Qloo reference matches for confirmation.
- Prevent impossible follower and budget ranges.
- Show a clear consent/notice if campaign data is persisted.

## 2. Build progress and status views

Show the persisted workflow stages:

1. Campaign received.
2. Resolving references.
3. Researching market culture.
4. Preparing creator search.
5. Searching creators.
6. Waiting for provider results.
7. Critiquing evidence and optionally refining creator discovery.
8. Normalizing and scoring.
9. Generating report.
10. Complete or failed.

The UI polls only the application status endpoint with bounded intervals and stops on terminal states. It must not create duplicate runs when the page reloads.

For failures, show:

- Safe explanation.
- Whether retry is available.
- What data was preserved.
- A retry action that creates a new attempt without erasing history.

## 3. Build the campaign summary

Display:

- Brand and product/category.
- Selected market and scope.
- Campaign objective.
- Selected references.
- Analysis timestamp.
- Qloo status.
- Apify status.
- Candidate sample size.
- Data limitations.

Use explicit labels such as `Verified`, `Provider-derived`, `Derived`, `User input`, and `AI hypothesis`.

## 4. Build the regional culture profile

Show only actual returned Qloo signals:

- Signal label.
- Signal type.
- Returned score or strength only when its meaning is documented.
- Related entity ID or source reference where useful.
- Location/query scope.
- Directional-data caveat.

Do not use broad cultural stereotypes or convert a small result set into universal claims about a population.

## 5. Build creator ranking cards

Each card should contain:

- Creator name and handle.
- Public profile URL when returned.
- Platform.
- Follower count, engagement, verification, or posting information only when returned.
- Campaign Fit Score or an explicit unavailable state.
- Evidence completeness.
- Component breakdown.
- Two or three evidence-linked reasons.
- Missing/unverified fields.
- AI-generated campaign concept labeled as a hypothesis.

Do not imply that ranking equals campaign success or that a creator reaches the selected market unless audience geography is verified.

## 6. Build broad/refinement comparison

Provide either a side-by-side view or a switchable comparison containing:

- Broad-discovery ranking.
- Optional refinement ranking, or an explicit no-refinement state.
- Candidate overlap.
- Rank movement.
- Added/removed candidates.
- Evidence behind meaningful changes.
- Critic decision and refinement rationale.
- A plain-language conclusion, including “little or no material change” when appropriate.

## 7. Build creator detail view

The detail view should group information into:

- Profile facts.
- Provider metrics.
- Culture-related evidence.
- Score components.
- Unknown or unverified fields.
- Caveats.
- Campaign concept.

Evidence links should resolve to a human-readable source label and field path, not expose raw credentials or internal secrets.

## 8. Add export only after the core view works

Implement the smallest useful export first:

- Print-friendly results page, or
- CSV containing client-safe normalized fields and scores.

Never include:

- API tokens.
- Raw request headers.
- Internal provider payloads unless explicitly designed and redacted.
- Private logs.
- Unverified claims presented as facts.

PDF generation is optional and should not delay the demo path.

## 9. Accessibility and responsive behavior

- Use semantic headings, forms, tables, and status regions.
- Ensure keyboard navigation for form, tabs, cards, and retry actions.
- Provide readable contrast and visible focus states.
- Do not communicate status by color alone.
- Support narrow mobile widths and desktop result comparison.
- Provide loading, empty, partial, and error states.
- Make long evidence labels and creator names wrap safely.

## Tests and acceptance evidence

- New tester can submit a valid campaign without developer help.
- Invalid form data is rejected with actionable messages.
- Refreshing during analysis does not duplicate provider runs.
- Progress stops correctly on success and failure.
- Culture profile displays only stored Qloo signals.
- Creator cards distinguish verified, derived, missing, and hypothetical content.
- Broad/refinement comparison renders for zero, partial, and full overlap, including no refinement.
- Export contains only client-safe fields.
- Keyboard and mobile smoke tests pass.

## Deliverables

- Campaign form and validation UI.
- Progress/status UI.
- Culture profile.
- Creator cards and detail view.
- Broad/refinement comparison.
- Optional print/CSV export.
- Responsive and accessible styling.

## Exit checklist

- [ ] Complete campaign can be submitted from the UI.
- [ ] Progress and recovery are understandable.
- [ ] First three recommendations are interpretable.
- [ ] Evidence and uncertainty are visible.
- [ ] Broad/refinement comparison is honest and usable.
- [ ] No secrets or raw internal payloads appear in the UI/export.
