# CultureMatch
## Product Requirements Document (PRD)

**Version:** 1.1 · **Status:** Implemented MVP flow · **Date:** 27 October 2026
**Product:** CultureMatch — cultural intelligence for regional influencer marketing  \
**Hackathon:** Qloo Agentic Hackathon 2026

> **Product promise:** Find creators whose content fits a region's cultural tastes, and show the evidence behind every match.

\newpage


## 1. Executive summary

CultureMatch helps a brand or marketer identify creator partnerships for a specific regional campaign. The user enters a product, target market, campaign goal, budget range, language needs, demographic conditioning and cultural references. CultureMatch uses Qloo to investigate supported taste and location signals, runs paired baseline and culture-informed searches through the Influship influencer-search actor on Apify, and applies a transparent matching process to rank candidates and generate evidence-grounded campaign concepts.

CultureMatch is not merely a natural-language wrapper around influencer search. Its differentiator is the *regional cultural research and reranking layer*: Qloo informs the creator-search strategy and the reasons presented in the final ranking. Creator discovery metrics come from Apify's actual returned dataset; cultural insights come from Qloo's actual responses; the model synthesizes these inputs but cannot invent either.

**MVP target:** a working, hosted product for a narrow, demonstrable campaign scenario in one or two validated global markets and one product category, with India as the initial demonstration focus. It must compare a baseline creator search with a Qloo-informed search and show where the cultural analysis changed—or did not materially change—the recommendations.

## 2. Problem statement

Brands can discover influencers by niche, location, follower count or semantic query, but selecting a creator for a particular regional audience remains difficult. Follower count does not prove local audience reach, a creator's residence does not prove where their followers live, and a query relevance score does not prove cultural resonance. Teams often stitch together search tools and manual profile reviews to judge whether a creator's content is relevant to a region and a brand.

CultureMatch addresses this gap by connecting three evidence layers:

1. **Market culture:** taste/affinity signals returned by Qloo for an appropriately configured entity and location analysis.
2. **Creator evidence:** profile, content, language, audience and performance fields actually returned by Apify or another expressly configured data source.
3. **Campaign context:** the brand's product category, objective, target market, language needs and budget.

The product makes its recommendation logic inspectable and flags missing evidence rather than turning uncertainty into a false claim.

## 3. Product vision and value proposition

**Vision:** Make culturally relevant creator selection easier for brands entering or activating in regional markets.

**Value proposition:** “Stop choosing creators by follower count alone. Discover which creators have the strongest evidenced fit for your brand and target market.”

### Why now / why Qloo

Qloo's published API supports taste-driven insights across supported entity categories and location signals. Its Taste Analysis guide describes tag-level insights for audience, entity or location signals. CultureMatch applies that cultural layer to the creator-discovery workflow rather than treating it as a generic recommendation feature. See the official [Qloo Insights API Deep Dive](https://docs.qloo.com/reference/insights-api-deep-dive), [Taste Analysis](https://docs.qloo.com/reference/taste-analysis), and [Search Entities](https://docs.qloo.com/reference/get-search).

## 4. Target users

### Primary persona — regional campaign marketer

- Works at a D2C or consumer brand, growth agency, or small marketing team planning activity in a specific regional market.
- Needs to launch a product or campaign in one or more regional markets.
- Wants a credible shortlist faster than manual search and spreadsheet comparison.
- Needs to explain creator choices to a founder, brand lead or client.

The initial demo should use an India-focused campaign, while the product model and workflow remain market-agnostic.

### Secondary persona — founder / small brand owner

- Has limited budget and no dedicated influencer research team.
- Needs to choose a small set of creators and a campaign angle.
- Values transparent evidence and clear next steps over complex marketing analytics.

### Not the initial target

Enterprise influencer procurement, campaign payments, contract management, multi-platform social listening, automated outreach, or guaranteed ROI forecasting.

## 5. Goals, non-goals and guardrails

### MVP goals

1. Accept a structured campaign brief in under five minutes.
2. Retrieve live Qloo results and live Apify creator results for a supported campaign.
3. Produce a ranked shortlist with transparent component scores and evidence notes.
4. Make a baseline-vs-culture-informed comparison visible to the user.
5. Generate a specific campaign angle for each shortlisted creator using only supplied evidence and clearly labeled hypotheses.
6. Deploy a public demo and publish a reproducible source-code repository with an open-source license, consistent with the hackathon submission rules.

### Non-goals

- Predicting sales, conversions or campaign ROI from taste data alone.
- Claiming to know followers' city, language, interests or demographics unless a source actually supplies that field.
- Scraping or circumventing platform restrictions beyond the data provider's permitted interfaces and terms.
- Supporting every country, city, social platform or product vertical in the MVP.
- Building a general-purpose multi-agent framework, influencer CRM, payments, messaging, or contract workflow.
- Using sensitive personal traits to infer cultural preference.

### Trust and product guardrails

- Separate **verified facts**, **provider-derived signals**, and **AI-generated hypotheses** in the UI.
- A creator's location is not a substitute for audience geography.
- A Qloo location signal is not proof that a cultural preference is universal or dominant in that region.
- Never display a “probability of campaign success” unless independently validated against outcome data. Call the initial measure a *Campaign Fit Score*.
- Display “not available” or “not verified” instead of fabricating missing fields.

### Hackathon alignment and submission gates

The official [Qloo Agentic Hackathon rules](https://qloo.devpost.com/rules) list a submission deadline of **30 October 2026 at 11:45 PM EDT**. The current rules page lists judging for **2–5 November 2026** and winner announcements around **5 November 2026**; check Devpost again before submission in case the organizer updates the schedule.

Stage one is pass/fail: the project must fit the agentic theme and meaningfully apply the required API. Stage two uses four equally weighted criteria:

| Official criterion | How CultureMatch demonstrates it |
|---|---|
| Technological implementation | Real Qloo entity/taste/location research; Qloo signals feed the creator-search and matching pipeline; baseline comparison demonstrates its contribution. |
| Design | Complete workflow from campaign brief to culture profile, creator shortlist, score breakdown and campaign concept. |
| Potential impact | Global D2C brands, agencies and campaign marketers selecting creators for regional launches; demonstrate the workflow first with an India-focused market and transparent limitations. |
| Quality of the idea | Non-obvious use of cultural affinities to inform influencer/creator matching rather than generic influencer discovery. |

Submission gates: provide a functional public demo URL, a public code repository with required source/assets/instructions and an open-source license visible on the repository page, plus an English project description. The app must be available for judging/testing through the judging period. The PRD and technical design should not substitute for the actual rules; re-check the official page before submitting.

## 6. Core user journey

1. **Create campaign:** enter brand name, product/category, target market, objective, optional cultural references, preferred languages, follower bounds, budget/currency, optional Qloo audience IDs and weight, age range, gender, and creator limit.
2. **Persist a resumable run:** create a campaign and queued analysis run with an idempotency key. The workflow advances through `researching_culture`, `searching_creators`, `scoring` and `generating_report`; state is persisted so refreshes and retries do not create duplicate provider runs.
3. **Resolve Qloo inputs:** search brand and reference names as brand entities with spelling retries. Unresolved entity inputs immediately try scoped tag search and remain explicitly unresolved as entities; a usable tag fallback can still contribute to cultural research.
4. **Resolve cultural tags:** expand product and reference text into search terms, then call Qloo tag search with typo tolerance, semantic search and relevant tag namespaces. Exact matches are preferred; otherwise the ranked semantic result is retained with provider-reported evidence.
5. **Research the market:** execute five Qloo Taste Analysis layers—market, brand, product, reference and combined—using `filter.type=urn:tag`, `signal.location.query`, scoped tag types and centralized age serialization. Uniform entity weights use the documented scalar GET parameter; distinct per-entity weights use a POST body. The combined tag operator is `union` for sparse inputs and `intersection` only when at least five tags resolve.
6. **Build paired creator searches:** construct deterministic baseline and culture-informed plans. The culture-informed plan includes the strongest verified Qloo signals; an optional structured model plan can replace it when enabled and valid. Start one Apify run for each plan, persist provider run/dataset IDs, and poll them asynchronously.
7. **Normalize and enrich creators:** normalize only fields present in Apify payloads. Add location-conditioned Qloo content affinity from resolved creator tags. For creators with names, run a separate POST person validation using `filter.results.entities.query`, campaign tags, demographic conditioning and `bias.trends=high`; do not send person location signals or locally match names.
8. **Score and compare:** calculate baseline scores with Qloo resonance disabled, culture-informed scores with Qloo enabled, and a culture-run ablation without Qloo. Persist component evidence, unavailable fields, overlap, rank changes, score deltas and Qloo contribution metrics.
9. **Report and inspect:** optionally generate evidence-grounded reports for the top five culture-informed matches when model reporting is enabled. The deterministic score and evidence remain authoritative if model generation is disabled or fails. The dashboard shows status, culture profile, paired rankings, caveats and creator evidence.
10. **Export/share:** allow CSV export and print-friendly review without secrets or retained raw provider payloads.

## 7. Functional requirements

Priority notation: **P0** = required for submission; **P1** = important if time permits; **P2** = future enhancement.

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---:|---|
| FR-01 | Campaign brief form | P0 | Required fields validate client-side and server-side; invalid combinations return actionable errors. |
| FR-02 | Persist campaign and analysis run | P0 | A campaign receives a stable ID; stage/status and timestamps persist across refreshes. |
| FR-03 | Qloo entity and tag resolution | P0 | Backend resolves brand/reference entities with spelling retries, falls back to scoped tag search when entity resolution fails, and surfaces ambiguity or unresolved status without inventing an entity. |
| FR-04 | Five-layer regional taste research | P0 | Backend runs market, brand, product, reference and combined Qloo Taste Analysis layers with scoped tag types, centralized age normalization, safe weighting and sparse-tag operator rules; normalized signals and provider provenance are traceable. Retaining raw payloads is optional and time-limited. |
| FR-05 | Paired creator search with Apify | P0 | Backend creates validated baseline and culture-informed plans, starts one `influship/influencer-search` run per plan with idempotency protection, persists run/dataset IDs and polls asynchronously. |
| FR-06 | Asynchronous actor status | P0 | Frontend polls campaign status; polling does not start duplicate actor runs. Terminal success/failure is displayed. |
| FR-07 | Creator normalization | P0 | Each result is mapped into a stable internal schema; unknown fields and source payload are retained safely where useful. |
| FR-08 | Deterministic match score | P0 | Every score is computed by code from declared inputs, with component values and missing-data notes exposed. |
| FR-09 | Evidence-grounded explanation | P0 | Each recommendation identifies which actual Qloo signals and creator fields support it; no unverified audience claims. |
| FR-10 | Baseline comparison | P0 | Same campaign constraints can be run with a baseline Apify query and a culture-informed query; results and ranking changes are shown honestly. |
| FR-11 | Evidence-grounded campaign report | P1 | When enabled, a model proposes creator-specific summaries, caveats and concepts for the top five culture-informed matches; output is schema-validated and evidence keys are checked. Deterministic results remain valid when disabled. |
| FR-12 | Retry and recoverability | P0 | Transient provider/network failures are retried within a limit; failed campaigns show a useful message and can be retried safely. |
| FR-13 | Responsive results dashboard | P0 | User can view ranked creators, profiles, metrics, score breakdown and source/uncertainty labels on desktop and mobile widths. |
| FR-14 | Export results | P1 | User can download CSV or use print view without including secrets or internal raw payloads. |
| FR-15 | Public demo and repository | P0 | App works from a public URL; README documents setup, environment variables, data flow, license and limitations. |

## 8. Campaign brief fields

| Field | Required? | Notes |
|---|---|---|
| Brand name | Yes | Free text; resolve through Qloo when possible. |
| Product/category | Yes | Controlled list plus “other”; used for creator search and entity type selection. |
| Target market | Yes | Country plus optional region/state and city; MVP should constrain execution to validated markets, while keeping the model globally extensible. |
| Campaign objective | Yes | Launch awareness, product education, store traffic, community engagement, etc. |
| Brand/cultural references | Optional but recommended | One or more names; user confirms uncertain entity matches. |
| Preferred content language | Optional | Explicit constraint; must be verified from creator data where available. |
| Creator size range | Optional | Follower bounds; don't assume these imply quality. |
| Budget range | Optional | Store as user-entered constraint; creator fees may be unavailable. |
| Qloo audience conditioning | Optional | Audience IDs and an equal-weight scalar used by supported Qloo requests. |
| Qloo demographic conditioning | Optional | UI age values are `25_to_34`, `35_and_younger`, `36_to_55` or `55_and_older`; the shared Qloo client serializes the legacy 25–34 value into valid API buckets. Gender is `male` or `female`. |
| Creator limit | Yes | One to 100 candidates per Apify search variant. |
| Search mode | System-controlled | The workflow always creates baseline and culture-informed variants for comparison. |

## 9. Match score and explanation requirements

The implemented score is a deterministic six-component ranking aid. The weights are code configuration, not model instructions:

| Component | Weight | Evidence rule |
|---|---:|---|
| Cultural affinity | 35% | Qloo person-level affinity when available; otherwise location-conditioned affinity for resolved creator-content tags. |
| Engagement rate | 25% | Apify engagement rate, normalized against a 10% reference ceiling. |
| Semantic relevance | 20% | Apify creator-search match score. |
| Growth momentum | 10% | Apify monthly growth when returned, normalized against a 20% reference ceiling. |
| Posting consistency | 5% | Apify posting frequency when returned, normalized against 12 posts per month. |
| Budget tier fit | 5% | Provider fee when available; otherwise follower-based creator tier against the campaign budget. |

Implementation rules:

- Keep component weights in configuration, not prompts.
- Treat all component scores as 0–100 normalized indicators with documented methods.
- If a component is missing, mark it unavailable and renormalize across eligible components; also show evidence completeness separately.
- Baseline scoring disables the cultural-affinity component so the culture-informed score can be compared against a no-Qloo baseline. A separate culture-run ablation disables Qloo only while keeping the same culture-informed candidates.
- Qloo person coverage is conditional: established public figures may resolve, while micro-influencers may remain unavailable. Missing Qloo data is not converted to zero.
- Audience geography and language remain unavailable unless the provider returns and verifies those fields; creator location is not audience evidence.
- Explain that Campaign Fit Score is a ranking aid, not a validated prediction of ROI.

## 10. Results experience

### Campaign summary

Show market, objective, selected references, timestamp, Qloo research status and Apify run status.

### Regional culture profile

Show a compact selection of actual returned Qloo entities/tags, grouped by market, brand, product, reference and combined research layer. Include affinity or relevance data only when Qloo returns it, show unresolved entity/tag inputs separately, and identify tag fallbacks as tag signals rather than resolved entities. Include a source label and a short note that these signals are directional and dependent on query parameters.

The profile should disclose the active location query, demographic/audience conditioning, whether heatmap research was enabled, and the combined tag operator. The optional compare result is a shared-tag comparison between the brand and resolved references; it is not a person or creator ranking.

### Creator ranking card

Each card should show:

- Creator name/handle and public profile URL if returned.
- Platform and follower count, engagement rate, verification status and posting/growth data only when returned.
- Overall Campaign Fit Score and a component breakdown.
- Cultural-affinity availability: Qloo person validation, location-conditioned content affinity, or unavailable.
- “Why this match?” with two or three evidence-linked reasons.
- “Unknown / not verified” fields, especially audience geography and language.
- One campaign concept, marked as an AI-generated hypothesis.

### Baseline versus culture-informed results

Display the two ranked lists side by side or in a switchable view. Report candidate overlap, changed ranks, score deltas, Qloo-scored creator counts and the Qloo ablation result. If it does not materially improve the shortlist, state that result rather than exaggerating the impact of Qloo.

## 11. Non-functional requirements

- **Security:** all provider secrets remain server-side; validate all user and model-generated inputs; do not expose raw API tokens in logs or responses.
- **Reliability:** analysis status, provider run IDs and dataset IDs are persisted; an interrupted page session can resume by campaign ID; provider-start claims prevent duplicate Apify runs; retries are bounded to the configured attempt limit.
- **Latency:** use asynchronous Apify runs and return the campaign ID immediately. Show stage progress instead of holding a single request open.
- **Cost:** the campaign creator limit is capped at 100; Qloo creator enrichment is capped by `QLOO_CREATOR_ENRICH_LIMIT` (default 20); model search plans and reports are opt-in through environment flags.
- **Explainability:** every score is reproducible from stored normalized inputs and configured weights.
- **Accessibility:** semantic forms, keyboard-accessible controls, readable contrast, clear status messages.
- **Privacy:** collect only the campaign information necessary; don't store unnecessary personal data; raw provider payload retention is optional and expires after seven days by default.

## 12. MVP success metrics

These are prototype validation metrics, not business claims:

- API completion: a complete test campaign succeeds end-to-end in at least 4 of 5 repeated runs with expected provider access.
- Evidence coverage: every displayed score has a stored component breakdown and source references/field provenance.
- Comparative value: for one test brief, baseline, culture-informed and Qloo-ablation results can be compared with candidate overlap, rank changes and score deltas explained; no requirement that Qloo must always change the list.
- Data honesty: zero unsupported claims about audience location, language, culture, engagement or expected ROI in acceptance tests.
- Usability: a new tester can create a campaign and interpret the first three recommendations without developer assistance.
- Submission readiness: public deployment, source repository, license and reproducible setup documentation are all available.

## 13. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Qloo query combinations don't return useful results for chosen market/category | Critical | Run an API spike before UI build; choose one supported market/category; store tested request fixtures. |
| Qloo entity resolution fails for a brand or reference | High | Retry spelling variants, immediately try scoped tag search, preserve unresolved entity status, and use the tag only as an explicitly labeled fallback signal. |
| Qloo tag response shape or namespace changes | High | Validate top-level and nested tag responses, accept documented labels, scope tag types, and keep adapter fixtures and schema tests. |
| Qloo Person has no matching micro-influencer | High | Query each creator by provider-returned real name; treat missing person affinity as unavailable and retain content-level Qloo enrichment where possible. |
| Apify actor omits post text, language or follower geography | Critical | Inspect actor input/output schema and live result items first; mark missing data; narrow product promise to supported evidence. |
| Culture signals are generalized into stereotypes | High | Use actual returned signals, label them directional, avoid essentializing language and let users inspect evidence. |
| Cultural signals don't improve shortlist | High | Run baseline comparison; improve query design; report limited/no improvement honestly. |
| Cost/latency of actor runs | Medium | Small result count, asynchronous run lifecycle, explicit cost guardrails and retries. |
| AI generates unsupported explanation | High | Supply structured evidence only; schema-validate output; render facts and generated hypotheses separately. |
| Provider schema changes | Medium | Central adapters, response validation, bounded retries and integration tests with recorded fixtures. |

## 14. Hackathon demo narrative

**Scenario:** A global D2C skincare or streetwear brand wants to test a regional campaign, initially using an India-focused city or market.

1. Submit one campaign brief with a selected country/region/city, demographic conditioning and a small set of cultural references.
2. Show Qloo entity resolution, tag fallback/semantic search and the five-layer regional culture profile.
3. Show the paired baseline and culture-informed Apify searches with persisted asynchronous run status.
4. Show normalized candidate profiles and additive Qloo creator-content/person enrichment.
5. Compare baseline, culture-informed and Qloo-ablation rankings, including overlap and rank changes.
6. Open a creator card to show evidence, unavailable fields, cultural-affinity source and an optional campaign concept.
7. Change one reference or market parameter and rerun, showing how the research signals and creator-search plan change.

The demo should emphasize that Qloo informs cultural research and materially participates in the selection pipeline. Avoid claiming guaranteed performance gains.

## 15. Scope plan

### Must ship

Campaign brief with flexible global market fields; Qloo entity/tag resolution with fallback; five-layer regional Taste Analysis; paired baseline and culture-informed Apify runs; asynchronous run polling; creator normalization and additive Qloo enrichment; deterministic six-component scoring; Qloo ablation; evidence-based reasons; deployable results UI; README and license.

### Ship if time permits

Optional model-generated campaign reports; candidate bookmarking; more than one tested market; saved report comparison.

### Future

Multiple platforms, direct audience demographic integrations, verified post-level analysis, campaign outcome feedback loop, custom weighting, agency workspaces, CRM integrations and performance calibration against real outcomes.

## 16. Remaining provider validation

1. Which Qloo tag namespaces and location combinations return useful signals for each supported market/category under live credentials?
2. Which fields are actually returned by `influship/influencer-search` for a live test run, especially bio, post evidence, language, audience location, engagement, growth and costs?
3. Does the actor's returned semantic score remain comparable when query wording changes? Treat it as provider metadata, not a cross-run calibrated probability.
4. What are the current actor cost and latency for paired baseline/culture searches under the account used for the demo?
5. Which model provider/model and hosting limits are available under the team's credentials and deployment plan?

## 17. References

- Qloo Agentic Hackathon — official rules and deadline: https://qloo.devpost.com/rules
- Qloo Insights API Deep Dive: https://docs.qloo.com/reference/insights-api-deep-dive
- Qloo Parameter Overview: https://docs.qloo.com/reference/parameter-overview
- Qloo Search Entities: https://docs.qloo.com/reference/get-search
- Qloo Search Tags: https://docs.qloo.com/reference/search-tags
- Qloo Taste Analysis: https://docs.qloo.com/reference/taste-analysis
- Qloo Analysis Compare: https://docs.qloo.com/reference/analysis-compare
- Qloo Heatmap Insights: https://docs.qloo.com/reference/heatmap-insights
- Apify Influship Influencer Search actor: https://apify.com/influship/influencer-search
- AI SDK Core tool calling: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
- Vercel Function duration configuration: https://vercel.com/docs/functions/configuring-functions/duration

---

**Document note:** This PRD is an implementation draft. Provider capabilities and parameters must be confirmed against live credentials, current provider docs, and actual response payloads before production claims or UI fields are finalized. The product is globally extensible, but market coverage must remain limited to locations that have been tested and evidenced.
