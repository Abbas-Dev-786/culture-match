# Qloo and Creator Discovery Strategy

## Problem statement

Qloo is valuable for understanding cultural affinity, but using Qloo signal names directly inside creator-search queries can reduce the quality of creator discovery.

The current workflow intentionally does not add Qloo signal names to the initial Apify free-text query. Qloo enriches the broad result set first; an optional refinement can translate selected signals or market concepts into creator-friendly terms only after an agent decision.

- Qloo signals describe entities, tags, affinities, and cultural relationships.
- Apify creator search terms usually describe creator topics, profile language, content, or market terms.

A Qloo signal is not necessarily a useful literal search keyword for a creator provider.

## How Qloo-informed search can degrade output

### Reduced recall

A relevant creator may strongly match a cultural idea without mentioning the exact Qloo signal name in their profile or content. Adding the signal as a keyword can exclude that creator.

### Literal-keyword bias

The creator provider may favor profiles that contain the signal text literally. This can select creators who mention a cultural term rather than creators whose content actually resonates with the culture.

### Query over-constraint

The campaign already contains product, objective, market, language, audience, and follower constraints. Adding multiple Qloo terms can make the query too narrow, especially for smaller markets.

### Duplicate evidence influence

The same Qloo signal can influence discovery, creator enrichment, scoring, and report language. This can amplify one provider's opinion and make the final ranking look more confident than the evidence supports.

### Misleading baseline comparison

If an optional refinement returns a different candidate pool, ranking changes may reflect different search recall rather than cultural ranking quality. The comparison is useful as an operational experiment, but it should not be treated as a clean causal measurement.

## Recommended role for Qloo

Qloo should be used primarily as a cultural interpretation and validation layer:

1. Resolve and understand campaign references.
2. Build a cultural fingerprint for the target market.
3. Enrich broad creator results with cultural affinity and content evidence.
4. Help the agent interpret ambiguous creator evidence.
5. Influence ranking with a capped, explainable contribution.
6. Generate cultural rationale for the final report.

Qloo should not automatically be used as a literal keyword generator for every creator search.

## Proposed discovery flow

```text
Campaign constraints
       |
       v
Broad creator discovery
       |
       v
Qloo creator enrichment
       |
       v
Evidence critic
       |
       +--> accept and score
       +--> request enrichment
       +--> run one optional Qloo-guided refinement search
       +--> stop with caveats
```

### Stage 1: Broad discovery

Use product category, product description, objective, market, language, audience, platform, follower bounds, and creator limit. Do not add raw Qloo signal names by default.

The broad query should maximize recall while preserving the campaign's hard constraints.

### Stage 2: Qloo enrichment

For each creator, use Qloo to inspect available profile, person, bio, and content signals. Store the exact Qloo inputs and returned evidence. Treat unresolved creators as unresolved rather than assigning a zero or fabricated affinity.

### Stage 3: Evidence criticism

The critic should inspect:

- Creator result count.
- Cultural evidence coverage.
- Market and language coverage.
- Qloo signal verification state.
- Evidence concentration in a small number of creators.
- Duplicate or redundant results.
- Missing fields needed for the campaign.

### Stage 4: Optional refinement

The agent may run one additional search only when broad discovery is weak. It should choose one strategy:

- Add validated cultural concepts translated into creator-friendly language.
- Adjust market terms.
- Broaden the creator topic query.
- Request enrichment instead of another search.

The refinement must preserve all hard campaign constraints and must report why it is expected to improve the result set.

## Agent decision contract

The creator discovery agent should return a strict action such as:

```json
{
  "action": "stop_search",
  "decision": "accept",
  "signalIds": [],
  "summary": "Broad discovery produced enough creators with usable evidence.",
  "rejectedActions": ["add_cultural_signals", "broaden_query"]
}
```

Allowed actions should include:

- `stop_search`
- `broaden_query`
- `adjust_market_terms`
- `add_cultural_signals`
- `request_enrichment`

The model should select signal IDs rather than inventing signal names. The executor should translate selected signals into search terms only when the provider search contract supports that use.

## Ranking policy

Qloo should affect ranking through explicit, capped components:

- Cultural affinity.
- Content resonance.
- Person-level validation, when available.
- Cultural evidence completeness.

Qloo must not override hard campaign constraints. Missing Qloo evidence should reduce confidence, not automatically make a creator a poor match. A creator with strong content evidence but no exact Qloo entity match should remain eligible.

The report should distinguish:

- Provider-reported affinity.
- Observed creator content.
- User-supplied campaign references.
- Agent inference.

## Experiment plan

Run an ablation using the same campaign set and hard constraints:

### Variant A: Broad discovery

No Qloo terms in the creator query. Qloo is used for enrichment and scoring.

### Variant B: Optional Qloo-guided refinement

The agent may select validated Qloo-derived concepts or market terms for one refinement query, followed by the same enrichment and scoring process. This is not run by default.

### Variant C: Qloo ablation

Use the optional-refinement candidate set, when present, but remove Qloo resonance from scoring. This separates retrieval changes from the contribution of Qloo evidence to ranking.

Measure:

- Creator result count.
- Unique creator count.
- Broad/refinement overlap.
- Cultural evidence coverage.
- Market coverage.
- Language coverage.
- Missing-field rate.
- Human-rated cultural relevance.
- Human-rated creator quality.
- Cost and runtime.
- Rank stability after enrichment.

The important metric is not merely the final score. It is whether optional Qloo-guided refinement adds relevant creators that broad discovery misses without materially reducing evidence quality or result coverage.

## Rollout recommendation

1. Make broad discovery the default.
2. Keep Qloo enrichment and cultural scoring enabled.
3. Disable raw Qloo terms in the default creator query.
4. Add an agent-selected refinement path with in-product approval and a one-search safety budget.
5. Log the exact query, selected signal IDs, result count, and critic decision.
6. Compare broad, optional-refinement and ablation results on recorded campaigns.
7. Keep optional Qloo-guided refinement only when it demonstrates incremental value.

## Success criteria

The revised strategy is successful when:

- Broad discovery returns equal or more usable creators.
- Qloo enrichment increases cultural evidence without sharply reducing recall.
- Optional Qloo refinement improves a measurable gap rather than running by default.
- Final rankings are not dominated by literal Qloo keyword matches.
- Every Qloo contribution is visible in the trace and attributable to stored evidence.
