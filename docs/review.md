## Bottom line

Your concern is valid. The Qloo integration is technically substantial, but product-wise Qloo is currently more of a market-enrichment/ranking layer than the core matching engine promised by the PRD.

The app is not “fake-integrated,” but the main cultural resonance calculation is currently too weak and partially misleading.

## What is working well

- Qloo entity and tag search are implemented.
- Weighted GET/POST Insights requests are supported.
- Union/intersection operators are implemented.
- Demographic conditioning and explainability flags are wired.
- Five cultural layers are generated: market, brand, product, reference, combined.
- Creator content is resolved into Qloo tags.
- Person-level Qloo validation exists.
- Qloo ablation and ranking-delta reporting exist.
- Missing data is generally handled honestly.
- Tests, typecheck, lint, and production build all pass.

The adapter itself follows much of the current Qloo flow: resolve entities/tags first, then call Insights with signals and filters. See client.ts (/C:/Users/abbas/Desktop/culture-match/lib/tools/qloo/client.ts:130) and the current Qloo Parameters documentation.

## Main product problems

### 1. Creator resonance is not actually campaign resonance

This is the biggest issue.

Creator content is resolved to Qloo tags and queried only against the target location:

enrich-creators.ts (/C:/Users/abbas/Desktop/culture-match/lib/tools/qloo/enrich-creators.ts:109)

The campaign Qloo signals are only passed into person validation, not into the main creator-content enrichment request.

Then scoring averages all location-conditioned creator tag affinities:

score-creators.ts (/C:/Users/abbas/Desktop/culture-match/lib/matching/score-creators.ts:123)

Therefore, a creator posting about something popular in Mumbai may score highly even if that topic has little connection to the brand, product, or campaign fingerprint.

The intended model in your own plan is:

> creator content signals matching campaign fingerprint signals, weighted by Qloo affinity and evidence quality.

That matching step is missing. The current score is closer to:

> “How culturally popular are this creator’s topics in the target market?”

That is useful, but it is not strong creator-to-campaign matching.

### 2. The default “culture-informed search” is identical to baseline search

The search-plan generator explicitly ignores Qloo signals:

search-plan.ts (/C:/Users/abbas/Desktop/culture-match/lib/workflow/search-plan.ts:79)

The workflow then creates the culture-informed plan from the exact same broad plan:

run-campaign-analysis.ts (/C:/Users/abbas/Desktop/culture-match/lib/workflow/run-campaign-analysis.ts:246)

The stored metadata even records empty Qloo terms and signal IDs.

This is an intentional strategy documented in qloo-creator-discovery-strategy.md (/C:/Users/abbas/Desktop/culture-match/docs/qloo-creator-discovery-strategy.md:69), but the UX does not explain it accurately. The form says cultural signals shape the culture-informed search query, while they normally do not:

campaign-form.tsx (/C:/Users/abbas/Desktop/culture-match/app/campaigns/new/campaign-form.tsx:554)

Similarly, “Same constraints plus Qloo signals” is misleading when the candidate pool is the same and Qloo only affects post-search scoring.

### 3. Campaign inputs are too aggressively converted into tags

Long product descriptions are split into individual tokens:

resolve-tags.ts (/C:/Users/abbas/Desktop/culture-match/lib/tools/qloo/resolve-tags.ts:110)

Then the first semantic Qloo result is accepted even without a confidence threshold:

resolve-tags.ts (/C:/Users/abbas/Desktop/culture-match/lib/tools/qloo/resolve-tags.ts:80)

This can produce unstable or irrelevant tags. For example, a descriptive phrase can become several unrelated tag searches, and the top semantic result may not represent the user’s intended meaning.

This is a major source of output variation.

### 4. Cultural references are searched only as brands

All entity references default to:

urn:entity:brand

resolve-entities.ts (/C:/Users/abbas/Desktop/culture-match/lib/tools/qloo/resolve-entities.ts:25)

That prevents proper resolution of references such as movies, artists, books, destinations, TV shows, or places. Qloo supports multiple entity types, so this significantly limits the cultural model.

### 5. Only the first 20 creators receive Qloo enrichment

The default enrichment limit is 20:

enrich-creators.ts (/C:/Users/abbas/Desktop/culture-match/lib/tools/qloo/enrich-creators.ts:32)

The UI allows up to 100 creators per search, meaning many creators can be scored without Qloo cultural evidence. Since unavailable score components are renormalized, creators with and without Qloo coverage are not perfectly comparable.

### 6. Person validation is missing trend bias

The TDD says person validation should use bias.trends=high, but the actual request does not send it:

enrich-creators.ts (/C:/Users/abbas/Desktop/culture-match/lib/tools/qloo/enrich-creators.ts:174)

This can reduce the quality of person-level matching.

### 7. Qloo audience IDs are supported by the backend but absent from the form

The database and validation schemas support qlooAudienceIds and qlooAudienceWeight, but users cannot provide them through the UI.

So an important Qloo capability exists internally but is practically unavailable in the product.

### 8. fees is always marked missing

The Apify normalizer always adds "fees" to missingFields, even when an estimated fee is actually returned:

search-creators.ts (/C:/Users/abbas/Desktop/culture-match/lib/tools/apify/search-creators.ts:151)

This can create incorrect caveats and trigger unnecessary enrichment.

### 9. Qloo advanced features are mostly isolated

Comparison, heatmaps, and trends exist, but they are not deeply connected to creator matching.

For example, comparison currently focuses on resolved brand/reference entities. It does not compare a creator’s signal set against the campaign fingerprint, which would be much more meaningful for this product.

## Why outputs vary so much

The variation is caused by several layers:

- Live Apify search results change between runs.
- Qloo semantic tag search accepts the first ranked result without confidence validation.
- Product descriptions are tokenized instead of treated as structured phrases.
- Qloo cache is disabled by default.
- Only some creators receive enrichment.
- Some creators use content-level affinity while others use person-level affinity.
- Score normalization changes based on which fields happen to be available for each creator.
- Person-level affinity and content-level resonance are currently treated as the same scoring component even though they measure different things.

The deterministic scoring code is stable once inputs are stored, but the provider inputs are not sufficiently normalized or reproducible.

## Recommended correction order

### P0 — Fix the matching meaning

Change cultural resonance so that creator signals are explicitly compared against the campaign fingerprint:

- Match creator Qloo tags against combined/product/reference campaign tags.
- Weight matches using campaign signal weight and Qloo affinity.
- Penalize unresolved evidence coverage separately.
- Keep location popularity as contextual evidence, not the complete resonance score.
- Separate person-level affinity from content-to-campaign resonance.

### P0 — Correct the UX language

Use separate labels:

- “Broad discovery”
- “Qloo-enriched ranking”
- “Qloo-guided refinement” only when a second search actually runs
- “Qloo impact on ranking”
- “Qloo impact on discovery”

Do not call the default candidate pool “culture-informed” when it is the same Apify search.

### P1 — Improve signal resolution

- Preserve multi-word phrases.
- Use product/category-specific tag searches.
- Add confidence or ambiguity thresholds.
- Let users confirm ambiguous cultural references.
- Search references across supported Qloo entity types instead of only brands.

### P1 — Use more Qloo capabilities meaningfully

- Add audience ID and audience weight inputs to the form.
- Add biasTrends: "high" to person validation.
- Compare creator signal groups against the campaign fingerprint.
- Make comparison and heatmap outputs explain actual campaign decisions.
- Expand supported tag namespaces after live validation.

### P1 — Fix data-quality issues

- Remove unconditional "fees" from missing fields.
- Show Qloo coverage per creator.
- Avoid scoring creators with and without cultural enrichment as if evidence coverage were equivalent.
- Persist request summaries and normalized Qloo responses per analysis run for reproducibility.

## Final assessment

The codebase is structurally healthy and passes all automated checks, but the product’s central claim is currently overstated.

Qloo is meaningfully present in the system, yet the most important connection—creator content resonance against the campaign’s cultural fingerprint—is incomplete. Until that is fixed, CultureMatch is primarily:

> Apify creator discovery + Qloo market context + location popularity scoring

It is not yet fully:

> Qloo-powered cultural matching between a campaign, a market, and a creator’s observed content.