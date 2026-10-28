# Phase 0 provider field matrix

Generated: 2026-10-22T16:55:14.463Z

This file is generated from sanitized spike output. A field is not considered supported until the live response has been reviewed and mapped to an application contract.

## Qloo

Status: location-tag-live-smoke-passed; person-validation-live-smoke-returned-no-usable-entities

| Path | Types | Occurrences |
| --- | --- | --- |
| $ | object | 1 |
| $.results | array/object | 1 |
| $.results[] | object | 5 |
| $.results[].entity_id | string | 5 |
| $.results[].name | string | 5 |
| $.results[].popularity | number | 5 |
| $.results[].properties | object | 5 |
| $.results[].tags | array | 5 |
| $.results[].types | array | 5 |
| $.success | boolean | 1 |
| $.results.tags | array | 1 |
| $.results.tags[] | object | 10 |
| $.results.tags[].tag_id | string | 10 |
| $.results.tags[].name | string | 10 |
| $.results.tags[].popularity | number | 10 |
| $.results.tags[].query.affinity | number | 10 |
| $.results.tags[].subtype | string | 10 |
| $.results.tags[].tag_value | string | 10 |
| $.results.tags[].types | array | 10 |
| $.query.localities.signal.entity_id | string | 1 |
| $.query.localities.signal.name | string | 1 |
| $.query.localities.signal.subtype | string | 1 |
| $.query.localities.signal.location.lat | number | 1 |
| $.query.localities.signal.location.lon | number | 1 |

## Apify / Influship

Status: one capped live smoke run reviewed on 2026-10-27; actor returned bio and provider match fields only

Documented actor input contract from the current public schema:

| Field | Documented shape |
| --- | --- |
| query | required string |
| platforms | optional string array; `instagram` is currently documented |
| minFollowers / maxFollowers | optional non-negative integers |
| minEngagementRate / maxEngagementRate | optional percentage numbers |
| verified | optional boolean |
| maxResults | optional integer from 1 to 100; spike uses 5 |

Documented actor output areas:

| Area | Live classification |
| --- | --- |
| creator | Documented; live unverified |
| match | Documented; live unverified and not an independent cultural score |
| primary_profile | Documented; live unverified |
| relevant_profile | Documented; live unverified |

| Path | Types | Occurrences |
| --- | --- | --- |
| $ | array | 1 |
| $[] | object | 5 |
| $[].creator | object | 5 |
| $[].creator.avatar_url | string | 5 |
| $[].creator.bio | string | 5 |
| $[].creator.id | string | 5 |
| $[].creator.name | string | 5 |
| $[].location_unverified | boolean | 5 |
| $[].match | object | 5 |
| $[].match.confidence | number | 5 |
| $[].match.evidence | array | 5 |
| $[].match.evidence[] | object | 17 |
| $[].match.evidence[].evidence_quote | null | 17 |
| $[].match.evidence[].fact_id | null,string | 17 |
| $[].match.evidence[].provenance | string | 17 |
| $[].match.evidence[].source_post_id | null,string | 17 |
| $[].match.evidence[].text | string | 17 |
| $[].match.low_confidence | boolean | 5 |
| $[].match.ranking_source | string | 5 |
| $[].match.reasons | array | 5 |
| $[].match.reasons[] | string | 17 |
| $[].match.score | number | 5 |
| $[].primary_profile | object | 5 |
| $[].primary_profile.data_updated_at | string | 5 |
| $[].primary_profile.engagement_rate | number | 5 |
| $[].primary_profile.followers | number | 5 |
| $[].primary_profile.id | string | 5 |
| $[].primary_profile.is_verified | boolean | 5 |
| $[].primary_profile.platform | string | 5 |
| $[].primary_profile.url | string | 5 |
| $[].primary_profile.username | string | 5 |
| $[].relevant_profile | object | 5 |
| $[].relevant_profile.data_updated_at | string | 5 |
| $[].relevant_profile.engagement_rate | number | 5 |
| $[].relevant_profile.followers | number | 5 |
| $[].relevant_profile.id | string | 5 |
| $[].relevant_profile.is_verified | boolean | 5 |
| $[].relevant_profile.platform | string | 5 |
| $[].relevant_profile.url | string | 5 |
| $[].relevant_profile.username | string | 5 |

## Product fields requiring explicit classification

| Field | Classification | Evidence requirement |
| --- | --- | --- |
| creator identity | supported | Stable creator id or profile URL |
| bio/content evidence | supported | Actual provider field path; inferred evidence remains labeled |
| follower count | supported | Numeric provider field |
| engagement rate | supported | Numeric provider field with documented percentage units |
| language | unavailable | Never infer from market or query |
| audience geography | unavailable; provider explicitly marks location as unverified | Creator residence is insufficient |
| fees | unavailable unless explicitly returned | Never infer a creator fee |
| provider match score | supported / provider-derived signal | Do not double-count when Qloo terms feed the query |
| growth momentum | unavailable unless returned in the observed payload | Never infer from follower count or posting history |
| posting consistency | unavailable unless returned in the observed payload | Never infer from content sample size |
| budget fit | conditional rough proxy | Follower tier is not a creator fee or affordability guarantee |
