# CultureMatch
## Product Requirements Document

**Version:** 2.0
**Status:** Pivoted MVP specification
**Date:** 26 October 2026
**Initial vertical:** Premium beauty and wellness brands entering Indian cities

> **Product promise:** Discover the cultural signals, partnerships, and launch environments that can help a beauty or wellness brand feel native in a new city.

## 1. Executive summary

CultureMatch is a cultural launch intelligence product for premium beauty and wellness brands. A brand or agency enters a product, a target Indian city, and a small set of cultural references. CultureMatch uses Qloo to resolve those inputs, build a location-conditioned cultural fingerprint, discover related entities, and produce an evidence-backed launch brief.

The MVP is not an influencer marketplace, audience-demographic estimator, or ROI predictor. Qloo is used for the work it is best suited to do: entity resolution, taste relationships, cross-domain recommendations, locality intelligence, comparisons, and optional heatmaps. Creator discovery may become a later activation channel, but it is not the source of truth for the first product.

The first release answers one decision:

> Which culturally aligned partners, places, or creative references should a premium beauty or wellness brand consider when entering a specific city?

Each analysis selects one opportunity type. The default type is **brand and place partnerships**.

## 2. Product direction

### Target customer

The primary user is a brand strategist, growth marketer, or boutique agency planning a regional launch for a premium beauty or wellness product.

### Initial scenario

- Category: premium skincare, beauty, or wellness.
- Geography: one Indian city per analysis.
- Example cities: Mumbai, Bengaluru, or Delhi, subject to live Qloo validation.
- Decision: identify culturally aligned partner brands, places, or creative references.

The domain remains globally extensible, but the MVP will not claim support for every market or category before live validation.

### Product positioning

CultureMatch is a decision-support tool for cultural market entry. It is not a general cultural chatbot, a generic recommendation engine, or a guarantee that a launch will perform.

## 3. Problem statement

A brand entering a new city often knows its product and target customer but does not know which local cultural contexts will make the launch feel relevant. Teams commonly rely on broad demographic reports, intuition, or manual research across unrelated sources.

They need a faster way to answer:

1. What interests and cultural signals define the selected market?
2. How does the brand or product relate to those signals?
3. Which partner types, places, and references are culturally adjacent?
4. What evidence supports the recommendation?
5. What remains unknown and requires human validation?

Qloo can answer the affinity and relationship portions of this problem. It cannot verify commercial availability, partnership willingness, audience reach, or business results. Those limitations are part of the product contract.

## 4. Why Qloo

Qloo provides the core intelligence layer for:

- Entity and tag resolution.
- Location-conditioned taste analysis.
- Weighted entity and tag signals.
- Union and intersection operators.
- Cross-domain recommendations across supported entity types.
- Entity comparison.
- Demographic conditioning only when explicitly supplied.
- Geographic heatmaps as optional cultural-signal visualizations.

The product should use Qloo outputs as structured evidence, not flatten them into generic keywords. See the [Qloo capabilities](https://www.qloo.com/capabilities), [Insights parameters](https://docs.qloo.com/reference/parameters), and [official API use cases](https://docs.qloo.com/reference/use-cases).

## 5. Goals and non-goals

### MVP goals

1. Accept a focused beauty/wellness market-entry brief in under three minutes.
2. Resolve a brand, product category, city, and cultural references through Qloo where supported.
3. Build a transparent cultural fingerprint for the selected city and campaign inputs.
4. Return a ranked list of culturally related opportunities for one selected opportunity type.
5. Explain every recommendation with provider evidence and query scope.
6. Generate a short activation brief containing facts, derived observations, hypotheses, and open validation questions.
7. Persist the analysis so the user can refresh, resume, inspect, and export it.

### Non-goals

- Predicting sales, conversions, campaign ROI, or partnership success.
- Inferring a person’s identity, ethnicity, income, or cultural identity.
- Verifying creator audience geography, language, fees, or performance.
- Running a creator marketplace, outreach system, CRM, payment flow, or contract workflow.
- Supporting multiple industries, countries, or cities in one analysis.
- Treating Qloo affinity as proof of universal preference in a population.
- Using an LLM to invent entities, rankings, provider facts, or market claims.

## 6. Core user journey

1. **Create analysis:** enter brand, product, target city, opportunity type, and two to five cultural references.
2. **Confirm resolution:** review Qloo’s entity/tag matches and resolve ambiguity before analysis continues.
3. **Research market:** retrieve a location-conditioned market fingerprint.
4. **Analyze brand context:** compare the brand/product/reference signals with the selected market.
5. **Discover opportunities:** request Qloo results for the selected opportunity type using the validated signal set.
6. **Review recommendations:** inspect ranked opportunities, affinity or rank where documented, evidence, and caveats.
7. **Generate launch brief:** create a grounded activation direction with clearly labeled hypotheses.
8. **Export/share:** download a client-safe report or use print view.

## 7. MVP input contract

| Input | Required | Notes |
|---|---:|---|
| Brand name | Yes | Resolved through Qloo when possible. |
| Product | Yes | Specific product, such as vitamin C serum or wellness subscription. |
| Target city | Yes | One city per analysis. |
| Opportunity type | Yes | One of the validated Qloo target types for the release. |
| Cultural references | Yes, 2–5 | Brands, artists, places, media, or other supported entities. |
| Launch intent | Yes | A short statement such as “enter the premium urban skincare market.” |
| Audience conditioning | No | Only explicit, validated Qloo audience inputs; never inferred. |

The first release should expose only opportunity types validated during the feasibility phase. Do not expose raw Qloo audience IDs or advanced parameters to ordinary users unless the product has a tested UX for them.

## 8. MVP output contract

### Market fingerprint

- Resolved city and query scope.
- Top returned Qloo tags/entities.
- Signal kind, label, ID, affinity or rank when documented.
- Source group: market, brand, product, reference, or combined.
- Unresolved inputs and provider limitations.

### Opportunity recommendations

Each opportunity includes:

- Name, entity ID, entity type, and public metadata returned by Qloo.
- Qloo rank or affinity when available and semantically documented.
- Related market and campaign signals.
- Explanation of why the opportunity appeared.
- Evidence references and observed timestamp.
- Commercial validation questions, such as availability or partnership willingness.

### Activation brief

- Recommended cultural territory.
- Suggested partnership or launch context.
- Two or three activation directions.
- Evidence-backed rationale.
- Explicit hypotheses and open questions.

The activation brief is strategic inspiration, not a factual claim about the market or a forecast of performance.

## 9. Functional requirements

| ID | Requirement | Priority |
|---|---|---:|
| FR-01 | Validate the focused analysis brief client-side and server-side. | P0 |
| FR-02 | Resolve brand, product tags, references, and city through Qloo. | P0 |
| FR-03 | Surface ambiguous and unresolved matches for user review. | P0 |
| FR-04 | Build and persist layered market, brand, product, reference, and combined fingerprints. | P0 |
| FR-05 | Discover opportunities for exactly one validated opportunity type. | P0 |
| FR-06 | Store provider request summaries, normalized results, and evidence references. | P0 |
| FR-07 | Rank opportunities deterministically using documented Qloo signals. | P0 |
| FR-08 | Generate schema-validated activation briefs from selected evidence. | P0 |
| FR-09 | Display facts, provider signals, derived observations, hypotheses, and unknowns separately. | P0 |
| FR-10 | Persist progress, support refresh recovery, and provide bounded retry behavior. | P0 |
| FR-11 | Provide a print-friendly or CSV client-safe export. | P1 |
| FR-12 | Provide an optional heatmap when the live API contract and UI are validated. | P1 |
| FR-13 | Provide an optional Qloo comparison view for two brands, markets, or reference groups. | P1 |

## 10. Evidence and ranking rules

The product must distinguish four evidence classes:

1. **User input:** what the customer supplied.
2. **Provider-reported:** what Qloo returned.
3. **Derived:** deterministic calculations from inputs and provider data.
4. **AI hypothesis:** generated strategic language that still requires human validation.

Ranking rules:

- Prefer Qloo’s documented rank or affinity over arbitrary application weights.
- If affinity semantics are not validated, display provider rank and do not convert it into a fabricated 0–100 score.
- If a derived score is introduced, version the algorithm and expose its inputs.
- Missing data reduces evidence completeness, not silently the opportunity’s quality.
- The model may summarize and propose hypotheses, but it may not select numeric rankings.

## 11. Technical and privacy requirements

- Keep Qloo credentials server-side.
- Validate Qloo requests against the active API contract before sending them.
- Keep raw provider responses redacted and retention-limited.
- Use RLS and owner-scoped access for persisted analyses.
- Treat provider text as untrusted input in model prompts.
- Never infer sensitive personal attributes from location, names, images, or cultural references.
- Display the exact city/query scope so users do not confuse local affinity with universal preference.
- Make provider failures and empty results visible and actionable.

## 12. Success metrics

The MVP is successful when:

- 10 test analyses complete successfully across the validated city/category scenarios.
- At least 80% of displayed recommendations have traceable Qloo evidence.
- A user can understand why the top three opportunities were returned without developer help.
- At least three beauty/wellness practitioners judge the output useful for forming a launch hypothesis.
- The product never presents audience geography, partnership availability, or ROI as verified without supporting data.
- A complete analysis can be reproduced from stored inputs, provider summaries, and algorithm versions.

## 13. Future expansion

Only after the focused MVP is validated:

1. Add fashion or food as separate vertical configurations.
2. Add retail assortment and pop-up location planning.
3. Add creator discovery as an optional activation channel using separate audience/performance providers.
4. Add multi-city comparison.
5. Add outcome feedback and calibration only when real campaign data is available.

## 14. Release acceptance scenario

The demo scenario should be:

1. Enter a premium skincare brand, a specific product, one validated Indian city, and three cultural references.
2. Confirm Qloo resolutions.
3. Show the city and brand cultural fingerprints.
4. Select brand/place partnership opportunities.
5. Inspect the top five recommendations and their evidence.
6. Generate an activation brief with facts and hypotheses separated.
7. Export the report.
8. State clearly that commercial availability, audience reach, and ROI require external validation.

## 15. Decision log

The creator-marketing concept is retained as a possible future channel, not as the MVP product definition. The MVP is intentionally narrow because Qloo’s strongest defensible value is cultural relationship and locality intelligence.
