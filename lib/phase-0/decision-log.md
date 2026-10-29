# Phase 0 decision log

**Status:** Phase 0 complete; ready for Phase 1 implementation

**Date:** 23 October 2026

## Scenario

| Decision | Current choice | Status |
| --- | --- | --- |
| First market | India, country scope | Validated by Qloo locality resolution and taste response |
| Product category | Streetwear | Selected for the spike; creator evidence remains provider-derived |
| Campaign objective | Regional launch awareness | Selected for the spike |
| Cultural references | Nike, Adidas | Must be resolved or surfaced as ambiguous by Qloo |
| Preferred languages | English, Hindi | User-entered constraints; not creator evidence |
| Candidate limit | Five for the feasibility run | Selected to control cost and latency |
| Budget | INR 5,000 maximum user constraint | Creator fees remain unavailable unless returned by the provider |

## Provider contracts

### Qloo

- Authentication: server-side `X-Api-Key` header.
- Search route: configured through `QLOO_SEARCH_URL`.
- Insights route: configured through `QLOO_INSIGHTS_URL`.
- Exact validated spike parameters: entity search uses `query=Nike`, `types=urn:entity:brand`, and `take=5`; taste analysis uses `filter.type=urn:tag`, `signal.location.query=India`, and `take=10`.
- Live result: entity search returned five results including Nike; location/taste returned ten tags with affinity values and resolved India locality metadata.
- Exit requirement: one resolved reference and one usable location/taste signal with documented score semantics.

### Apify / Influship

- Actor: `influship/influencer-search`.
- Spike input: natural-language `query`, `platforms: ["instagram"]`, and `maxResults: 5`.
- Documented output areas: `creator`, `match`, `primary_profile`, and `relevant_profile`.
- Live status: validated with one successful run on 22 October 2026.
- Run result: five dataset items, approximately 10 seconds, with creator, profile, match, evidence, follower, engagement, verification, and explicit location-unverified fields observed.
- Candidate fields are classified in `provider-field-matrix.md`; language, audience geography, and fees remain unavailable.

## Runtime and workflow

- The product workflow will persist the Apify run ID before waiting for completion.
- Production advancement should use an Apify webhook; the spike runner uses bounded polling only for observation.
- Browser status polling must read application state and must never start or poll provider jobs directly.
- The initial workflow budget is one Qloo research pass, one baseline actor run, and one culture-informed actor run per campaign.

## Model

- Installed provider package: `@openrouter/ai-sdk-provider`.
- MVP provider: OpenRouter with the free-model router `openrouter/free`, configured by `OPENROUTER_MODEL`.
- Model selection reason: the selected endpoint documents JSON-schema structured-output support, which matches the TDD requirement for schema-validated AI SDK output.
- Model limitation: the free endpoint is rate-limited and must not receive confidential or personal data; model use remains optional.
- The model is optional for Phase 0 and must not determine numeric scores.
- Deterministic search and scoring fallbacks remain mandatory.
- Structured output must use the installed AI SDK's Zod-backed `Output.object` API and a bounded step count.
- Model budget: one bounded search-plan or report-generation call per workflow stage; no model calls for numeric score components.

## Supabase access mode

- Phase 0 decision: authenticated demonstration using the server-side Supabase clients and route-level authentication helpers.
- Ownership field: `campaigns.user_id`, with owner-scoped policies based on `auth.uid()`.
- Provider calls and campaign writes remain server-side.
- Every exposed table must use RLS; authenticated users may access only their own campaign rows and related records.
- Browser and SSR clients use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY` is reserved for explicitly privileged server-only operations; `DB_PASSWORD` is reserved for database administration/migrations.
- The public-key convention is the current Supabase publishable key; no legacy anon-key variable is required.

## Retention and redaction

- Committed fixtures contain sanitized request/response data only.
- Raw provider payloads, if retained in the database later, require a short retention window and a deletion policy.
- Logs must contain IDs, stages, durations, safe error codes, and counts—not credentials or complete provider payloads.

## Phase 1 handoff

- Provider feasibility gate: passed with sanitized Qloo and Apify fixtures.
- Model provider and exact model ID: selected and recorded.
- Supabase access mode, ownership field, RLS boundary, and secret boundary: selected and recorded.
- Phase 1 must create the migrations and owner-scoped policies, then verify them with database tests and advisors before exposing application data.
