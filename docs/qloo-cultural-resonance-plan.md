# Qloo Cultural Intelligence Plan

**Project:** CultureMatch
**Status:** Pivoted MVP direction
**Purpose:** Make Qloo the product’s primary decision layer for beauty/wellness market entry.

## 1. Product thesis

CultureMatch should use Qloo to answer:

1. What cultural signals are strong in a selected city?
2. How does a beauty/wellness brand relate to those signals?
3. Which supported brands, places, artists, or media entities are culturally adjacent?
4. What launch hypotheses can be formed from that evidence?

The product should not reduce Qloo output to keywords or use it to claim that an influencer’s audience lives in a market.

## 2. Qloo capabilities used in the MVP

- Entity search and resolution.
- Tag search and metadata.
- Location-conditioned Insights.
- Weighted entity and tag signals.
- Union/intersection operators where validated.
- Cross-domain opportunity discovery for one selected entity type.
- Entity comparison as an optional view.
- Heatmaps as an optional cultural-signal visualization.

The exact API parameters and response semantics must be confirmed against the active environment and captured in sanitized fixtures.

## 3. Fingerprint layers

| Layer | Question |
|---|---|
| Market | What signals are associated with the selected city? |
| Brand | How does the brand relate to the city? |
| Product | Which signals relate to the product category in the city? |
| Reference | How do the selected cultural references relate to the city? |
| Combined | Which weighted signals define the launch context? |

Each signal retains its Qloo ID, name, type, affinity/rank, input weight, source layer, query scope, and evidence reference.

## 4. Opportunity discovery

Every analysis selects one opportunity type. The workflow uses the combined fingerprint to request supported Qloo results for that type.

Examples:

- Brand partnership candidates.
- Place or venue candidates.
- Artist or media references.

The MVP should expose only the type that passes the Phase 0 live validation. It should not present an empty or unsupported category as a product feature.

## 5. Ranking rules

Use Qloo’s provider rank or documented affinity as the primary ordering signal. Add a derived score only when:

- The provider semantics are known.
- The inputs are stored.
- The algorithm is versioned.
- The UI shows the contributing evidence.

Never turn an undocumented provider value into a fabricated probability or business-success score.

## 6. Evidence chain

The strongest recommendation should be traceable through:

```text
Launch brief
  -> resolved Qloo entity/tag
  -> city-conditioned signal
  -> combined fingerprint
  -> opportunity entity
  -> provider rank/affinity
  -> activation hypothesis
```

The activation hypothesis remains a proposal for human validation. It is not provider-reported fact.

## 7. Guardrails

- Do not infer sensitive traits.
- Do not treat city affinity as universal population preference.
- Do not claim partnership availability.
- Do not claim customer reach, creator audience geography, or ROI.
- Do not hide unresolved inputs.
- Do not use an LLM to assign rankings or invent provider evidence.
- Do not add creator matching to the MVP workflow.

## 8. Success condition

The Qloo work is successful when a user can inspect one opportunity and understand:

- Which city and campaign inputs were used.
- Which Qloo signals supported the result.
- Why the entity appeared.
- Which facts are provider-reported.
- Which conclusions are derived or hypothetical.
- What must be validated commercially before action.
