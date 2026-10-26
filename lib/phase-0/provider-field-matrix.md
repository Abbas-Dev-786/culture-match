# Phase 0 provider field matrix

Generated: 2026-10-26T11:00:42.772Z

This matrix records the fields used by the narrowed launch-intelligence spike. A field remains provisional until a live response is manually reviewed.

## Qloo

Status: completed

| Application field | Provider path | Classification |
| --- | --- | --- |
| resolved reference id | entity search result entity_id/id | provider-reported |
| cultural signal id | insights results tags[].tag_id or entities[].entity_id | provider-reported |
| cultural affinity | insights result query.affinity | provider-reported; semantics require review |
| opportunity id | recommendation result entity_id/id | provider-reported |
| opportunity name | recommendation result name/title | provider-reported |
| opportunity type | recommendation result types[] | provider-reported |
| evidence | normalized result field path and observed timestamp | derived traceability |
| launch fit | no provider field | unavailable in Phase 0 |

## Acceptance notes

- Qloo is the only external provider in the narrowed MVP.
- Raw payloads are retained only when PROVIDER_RETAIN_RAW=true and must remain access-controlled.
- No language, audience geography, budget fit, or launch success is inferred from Qloo results.
