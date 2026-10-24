# Qloo Cultural Resonance Plan

**Project:** CultureMatch  
**Status:** Implemented locally; live Qloo validation remains a pre-demo step  
**Purpose:** Make Qloo the core intelligence layer of CultureMatch rather than a keyword source for creator search.

## 1. Executive summary

CultureMatch should not use Qloo only to retrieve regional tags and append their names to an Apify search query. That approach produces a useful demo, but it does not demonstrate Qloo's deeper value.

The product should instead build a structured **regional cultural fingerprint** with Qloo, resolve creator-content signals into Qloo entities and tags, and calculate a transparent **cultural resonance** measure for each creator.

The central product claim becomes:

> CultureMatch identifies creators whose observed content signals overlap with the cultural affinities of a target market, and shows the Qloo evidence behind every recommendation.

This remains deliberately narrower than claiming that a creator's audience lives in a market or that a campaign will succeed. Audience geography, language, fees, and ROI must remain unavailable unless an actual provider supplies and verifies those fields.

## Implementation status

The repository now implements the core plan:

- Weighted Qloo entity and tag signals with explicit union/intersection operators.
- Qloo tag resolution for product categories and creator-content signals.
- A persisted cultural fingerprint with stable IDs, weights, affinities, unresolved inputs, and provenance.
- Bounded Apify content-signal extraction from captions, descriptions, hashtags, and text fields.
- Location-conditioned creator-content enrichment and a dedicated Qloo resonance score.
- Baseline, Qloo-informed, and Qloo ablation scoring with ranking and score deltas.
- Results-page cards for the fingerprint and measured Qloo contribution.
- Canonical Supabase migrations under `supabase/migrations` and contract coverage for the application schema.

Before the hackathon demo, configure the active Qloo endpoints, run one live campaign, capture a successful fixture, and confirm that at least one creator has a resolved content signal with a non-zero affinity. The implementation intentionally keeps unresolved or unavailable signals visible instead of fabricating a match.

## 2. Current limitation

The current Qloo flow is concentrated in:

- [`lib/tools/qloo/client.ts`](../lib/tools/qloo/client.ts)
- [`lib/tools/qloo/analyze-culture.ts`](../lib/tools/qloo/analyze-culture.ts)
- [`lib/workflow/search-plan.ts`](../lib/workflow/search-plan.ts)
- [`lib/matching/score-creators.ts`](../lib/matching/score-creators.ts)

The current behavior is:

1. Resolve cultural references.
2. Request location-based `urn:tag` results.
3. Convert Qloo signal names into text terms.
4. Append those terms to the culture-informed Apify query.
5. Compare Qloo signal names lexically with the creator bio.

This loses important Qloo information such as stable IDs, signal types, weights, affinity values, relationships, and query provenance. It also makes the cultural score dependent on wording in a short bio rather than actual creator-content evidence.

## 3. Product objective

Build a Qloo-native workflow that answers four questions:

1. What does the target market over-index on culturally?
2. How does the selected brand or product relate to those market signals?
3. Which signals are actually present in a creator's observed content?
4. Did Qloo materially change the shortlist or ranking, and why?

## 4. Qloo capabilities to use

The implementation should use the following Qloo capabilities where they are supported by the active API configuration:

- Entity search and entity retrieval
- Tag search and tag metadata
- Location-based Insights
- Weighted entity and tag signals
- Signal combination operators such as union and intersection
- Audience signals when explicitly selected by the user
- Demographic signals only when explicitly supplied and appropriate
- Entity or group comparison
- Heatmaps as an optional visualization for the final demo

Primary references:

- [Qloo Parameters](https://docs.qloo.com/reference/parameters)
- [Insights with Location](https://docs.qloo.com/reference/insights-with-location-use-case)
- [Search Entities](https://docs.qloo.com/reference/get-search)
- [Search Tags](https://docs.qloo.com/reference/get-tags-1)
- [Analysis Compare](https://docs.qloo.com/reference/analysis-compare-1)
- [Heatmaps](https://docs.qloo.com/reference/heatmaps-use-case)

The project must validate each endpoint and parameter against the active hackathon API environment before treating it as production-supported. Fixtures should be captured from successful live requests.

## 5. Target architecture

```text
Campaign brief
    |
    v
Resolve locality, brand, references, category tags
    |
    v
Build Qloo cultural fingerprint
    |
    +--> Market profile
    +--> Brand-in-market profile
    +--> Product-in-market profile
    +--> Reference-in-market profile
    |
    v
Discover creators with shared campaign constraints
    |
    v
Extract observed creator-content signals
    |
    v
Resolve creator signals to Qloo entities/tags
    |
    v
Calculate Qloo-conditioned cultural resonance
    |
    v
Compare baseline, Qloo-informed, and ablation results
    |
    v
Explain every ranking change with evidence
```

Qloo should influence both discovery and evaluation. It should not merely be called once before an otherwise generic creator search.

## 6. Structured Qloo cultural fingerprint

### 6.1 Fingerprint inputs

The fingerprint should be built from:

- Target locality, preferably a resolved Qloo locality entity
- Brand entity, when resolvable
- Product or category tags
- User-selected cultural references
- Optional user-selected audience segment
- Optional user-provided demographic constraints

Sensitive demographic attributes must never be inferred from location or creator content. They may only be used when the user explicitly supplies them and the use is appropriate for the campaign.

### 6.2 Fingerprint layers

Each campaign should store separate Qloo result groups:

| Layer | Question | Example output |
| --- | --- | --- |
| Market | What is culturally strong in the locality? | Top tags and entities for Mumbai |
| Brand-market | How does the brand relate to the locality? | Brand-associated tags with local affinity |
| Product-market | Which cultural signals connect the product to the locality? | Product/category signal intersections |
| Reference-market | How do selected references behave in the locality? | Reference-specific affinity signals |
| Combined | What is the strongest weighted campaign profile? | Ranked, weighted Qloo signal set |

### 6.3 Signal record

Do not reduce signals to names. Store a normalized record similar to:

```ts
interface QlooSignalRecord {
  signalId: string
  kind: "entity" | "tag" | "audience" | "locality"
  name: string
  types: string[]
  affinity?: number
  inputWeight?: number
  sourceGroup: "market" | "brand" | "product" | "reference" | "combined"
  evidence: {
    source: "qloo"
    endpoint: string
    fieldPath: string
    observedAt: string
    verification: "provider_reported"
  }
}
```

The stored record should retain the Qloo ID, not only the display name. Names are for presentation; IDs are for repeatable analysis.

## 7. Qloo request strategy

### 7.1 Resolve first, then analyze

Resolve user-entered references before requesting Insights. Ambiguous references must remain visible to the user and must not be silently substituted.

For locality resolution, store:

- User query
- Resolved locality ID
- Resolved name
- Disambiguation text
- Any provider warnings

For brands and references, store the same information plus the entity type.

### 7.2 Use typed and weighted signals

The Qloo adapter should support weighted entity and tag inputs rather than only comma-separated IDs in a GET query.

Weights should represent campaign intent, not fabricated confidence. For example:

- Brand entity: high weight
- Product/category tag: medium weight
- Optional cultural reference: user-controlled medium weight
- Exploratory market signal: lower weight

The exact wire format must follow the active Qloo API documentation and be verified with fixtures. The internal application contract should be independent of the wire format.

### 7.3 Use union and intersection deliberately

Use union when the campaign wants creators associated with any of several valid signals.

Use intersection when the campaign wants a narrower cultural combination, such as a creator whose observed content connects both a product category and a regional interest.

The chosen operator must be stored in the fingerprint metadata and shown in the analysis explanation.

### 7.4 Search tags instead of guessing tag names

Free-text categories such as “streetwear”, “regional food”, or “fitness” should first be mapped to supported Qloo tags where possible. The selected tag ID, type, and resolution status should be stored.

If a category cannot be resolved, the product should display that limitation and fall back to a clearly labeled text-only search component.

## 8. Creator-content enrichment

### 8.1 Required evidence

The cultural resonance score should be based on actual creator evidence, such as:

- Post captions
- Hashtags
- Mentioned brands
- Topics
- Publicly declared content categories
- Music, sport, food, fashion, or entertainment references
- Explicit language fields when provided by the source

The current normalizer primarily uses profile-level fields and bio text. That is not enough for a strong Qloo demonstration. The Apify actor output must be inspected and the normalizer extended only for fields actually returned by the provider.

### 8.2 Creator signal resolution

For each creator:

1. Extract a bounded set of observed content signals.
2. Normalize and deduplicate them.
3. Resolve them through Qloo entity/tag search where supported.
4. Preserve unresolved signals as unresolved evidence.
5. Record the source post, field path, or provider field for every resolved signal.

The product must not infer that a creator represents a culture from their name, residence, ethnicity, or appearance.

## 9. Cultural resonance score

Qloo should contribute a specific, explainable score rather than being hidden inside a general keyword score.

### 9.1 Suggested calculation

For a creator with resolved content signals `c` and campaign fingerprint signals `f`:

```text
creator resonance =
  weighted Qloo affinity of matching creator signals
  × evidence coverage
  × signal resolution confidence
```

One practical normalized form is:

```text
resonance =
  sum(signalWeight × qlooAffinity × evidenceConfidence)
  / sum(signalWeight)
```

This score must be reported as content-to-market resonance, not audience affinity.

### 9.2 Score components

Keep the overall campaign score decomposed:

| Component | Meaning | Initial status |
| --- | --- | --- |
| Qloo cultural resonance | Creator-content signals align with Qloo market signals | New primary component |
| Content and campaign fit | Creator content relates to the campaign category/objective | Existing, improve with content evidence |
| Market relevance | Verified audience geography | Unavailable until sourced |
| Engagement quality | Provider-reported engagement | Supported only when returned |
| Reach fit | Followers versus explicit campaign bounds | Supported when bounds are provided |
| Budget fit | Fee versus campaign budget | Unavailable until fee data is sourced |

Do not let unavailable components silently become zero. Preserve the current missing-data behavior.

## 10. Baseline and ablation experiment

The hackathon demo should prove Qloo’s contribution.

Run three comparable variants with the same campaign constraints and creator limit:

### Variant A: Baseline

Search using the campaign category, market, and explicit creator constraints. Do not use Qloo-derived signals.

### Variant B: Qloo-informed

Search using the same constraints plus the validated Qloo signal plan. Rank candidates using the Qloo cultural resonance component.

### Variant C: Qloo ablation

Use the Qloo-informed candidate set but remove the Qloo resonance component from scoring. This isolates whether Qloo evidence changed the ranking rather than merely changing retrieval.

### Metrics

Store and display:

- Baseline and Qloo-informed overlap
- New creators introduced by Qloo
- Rank movement
- Score movement attributable to Qloo resonance
- Number of Qloo signals used
- Number of creator signals resolved
- Evidence coverage
- Unresolved signal count
- Whether the result materially changed

The comparison should answer: “What did Qloo change?”

## 11. User experience

The results page should include the following sections.

### Market fingerprint

Show:

- Resolved locality
- Top Qloo signals
- Affinity values
- Signal types
- Input weights
- Query groups and operators

### Creator evidence

Show:

- Observed creator-content signals
- Qloo resolution status
- Source field or content reference
- Matching market signals
- Unresolved or unavailable fields

### Qloo influence

Show a compact summary such as:

```text
Qloo signals used: 8
Creator signals resolved: 5
Content-to-market resonance: 87/100
Evidence coverage: 72%
Ranking movement: #8 → #2
Audience geography: Not verified
```

### Explanation

Every explanation should follow this pattern:

> This creator moved from rank 8 to rank 2 because observed content included Qloo-resolved signals A and B. Those signals had strong affinity in the selected market. Audience geography and campaign ROI were not verified.

## 12. Optional advanced features

These features are useful only after the core fingerprint and creator-content loop works.

### Audience conditioning

Allow the marketer to select a supported Qloo audience segment when the campaign brief contains an explicit audience persona. Do not infer an audience segment from the market alone.

### Heatmap visualization

Use Qloo heatmaps to visualize where a selected signal is concentrated or how a regional signal varies spatially. This can make the demo memorable, but it must not be presented as creator audience geography.

### Entity comparison

Use comparison analysis to show relationships such as:

- Brand versus target market
- Product category versus target market
- Creator signal set versus campaign fingerprint

## 13. Implementation plan

### Phase A — Qloo contract expansion

- Add typed Qloo signal, tag, audience, locality, and comparison contracts.
- Add tag search support.
- Add entity retrieval support.
- Add weighted Insights request support.
- Add union/intersection support.
- Preserve raw request summaries and provider provenance.
- Capture live fixtures for one validated market and category.

### Phase B — Cultural fingerprint

- Resolve locality, brand, category, and references.
- Run separate market, brand, product, and reference analyses.
- Store grouped signals with IDs, affinity, weights, and evidence.
- Render the fingerprint in the results UI.

### Phase C — Creator enrichment

- Inspect actual Apify output for posts and content fields.
- Normalize only returned fields.
- Resolve creator content signals through Qloo.
- Store creator-to-Qloo signal provenance.
- Add explicit evidence coverage metrics.

### Phase D — Resonance scoring

- Implement Qloo-conditioned resonance.
- Version the algorithm.
- Keep unavailable components unavailable.
- Add unit tests for weighting, missing evidence, unresolved signals, and deterministic results.

### Phase E — Demonstration and evaluation

- Run baseline, Qloo-informed, and ablation variants.
- Add ranking-delta and Qloo-contribution views.
- Validate one complete campaign live.
- Record a short demo showing the evidence chain.

## 14. Acceptance criteria

The Qloo work is complete for the hackathon when:

- A campaign produces a structured Qloo fingerprint with stable IDs and provenance.
- At least one live market/category scenario has verified Qloo fixtures.
- Qloo uses more than one signal type or structured signal group.
- Weighted or operator-based signal composition is demonstrated where supported.
- Creator-content signals are resolved to Qloo entities or tags, or their absence is explicitly shown.
- At least one creator ranking change is explained by concrete Qloo evidence.
- Baseline, Qloo-informed, and ablation results can be compared.
- The UI clearly distinguishes Qloo provider signals, creator evidence, derived scores, and hypotheses.
- No screen claims verified audience geography, cultural identity, or ROI without supporting data.
- Provider failures and unresolved entities remain visible and safe.

## 15. Demo narrative

The strongest demo sequence is:

1. Enter a campaign for a validated market and product category.
2. Show Qloo resolving the locality, brand, and references.
3. Show the market’s top cultural signals and affinities.
4. Show the combined weighted campaign fingerprint.
5. Show creator content being mapped to Qloo entities/tags.
6. Show one creator’s resonance breakdown.
7. Compare baseline and Qloo-informed rankings.
8. Show the ablation result to isolate Qloo’s contribution.
9. End with the limitations: this is cultural content resonance, not audience geography or ROI prediction.

## 16. Guardrails

- Do not infer sensitive personal traits.
- Do not treat locality affinity as proof of universal regional preference.
- Do not treat creator residence as audience geography.
- Do not use provider match scores as Qloo cultural affinity unless their semantics are verified.
- Do not fabricate language, fees, audience location, or demographic fields.
- Do not expose raw provider payloads unless retention and privacy rules allow it.
- Do not claim that a ranking change proves campaign success.

## 17. Definition of success

CultureMatch stands out when a judge can inspect one recommendation and trace it through this chain:

```text
Campaign requirement
  → Qloo-resolved signal
  → Qloo market affinity
  → observed creator-content evidence
  → resonance calculation
  → ranking change
  → explanation with limitations
```

That evidence chain is the product. The creator search provider is the discovery mechanism; Qloo is the reasoning layer that makes the recommendation differentiated.
