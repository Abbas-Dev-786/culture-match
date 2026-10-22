# CultureMatch
## Product Requirements Document (PRD)

**Version:** 1.0 · **Status:** Build-ready MVP draft · **Date:** 22 October 2026  
**Product:** CultureMatch — cultural intelligence for regional influencer marketing  \
**Hackathon:** Qloo Agentic Hackathon 2026

> **Product promise:** Find creators whose content fits a region's cultural tastes, and show the evidence behind every match.

\newpage


## 1. Executive summary

CultureMatch helps a brand or marketer identify creator partnerships for a specific regional campaign. The user enters a product, target market, campaign goal, budget range, language needs and cultural references. CultureMatch uses Qloo to investigate supported taste and location signals, uses the Influship influencer-search actor on Apify to discover candidate Instagram creators, and applies a transparent matching process to rank candidates and generate evidence-grounded campaign concepts.

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

1. **Create campaign:** enter brand name, product/category, target market, campaign objective, optional brand/reference entities, desired language, creator-size range, budget range and optional verified constraints.
2. **Review research plan:** show the intended Qloo lookup and broad creator-search criteria. For MVP, this may be a compact summary rather than a separate approval step.
3. **Analyze market culture:** resolve relevant entities and query supported Qloo taste/location insights. Display returned signals and a note about the scope of the data.
4. **Discover creators:** use the culture profile plus explicit campaign criteria to construct an Influship actor query and run.
5. **Compare and rank:** normalize the returned creator data, compute deterministic fit components, and compare a baseline shortlist with a culture-informed shortlist.
6. **Inspect a candidate:** view profile link, available metrics, match explanation, data-confidence indicator, missing fields and a suggested campaign concept.
7. **Export/share:** export a simple report (MVP: print-friendly page or CSV of available profile fields and scores; PDF export may be deferred if it threatens delivery).

## 7. Functional requirements

Priority notation: **P0** = required for submission; **P1** = important if time permits; **P2** = future enhancement.

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---:|---|
| FR-01 | Campaign brief form | P0 | Required fields validate client-side and server-side; invalid combinations return actionable errors. |
| FR-02 | Persist campaign and analysis run | P0 | A campaign receives a stable ID; stage/status and timestamps persist across refreshes. |
| FR-03 | Qloo entity resolution | P0 | Backend resolves user-supplied brand/reference names; ambiguous or unresolved entities are surfaced, not silently substituted. |
| FR-04 | Regional taste research | P0 | Backend calls documented Qloo Insights/Taste Analysis parameters validated for the selected query; raw response and normalized evidence are traceable. |
| FR-05 | Creator search with Apify | P0 | Backend starts `influship/influencer-search` with a validated query and supported filters; run ID is stored. |
| FR-06 | Asynchronous actor status | P0 | Frontend polls campaign status; polling does not start duplicate actor runs. Terminal success/failure is displayed. |
| FR-07 | Creator normalization | P0 | Each result is mapped into a stable internal schema; unknown fields and source payload are retained safely where useful. |
| FR-08 | Deterministic match score | P0 | Every score is computed by code from declared inputs, with component values and missing-data notes exposed. |
| FR-09 | Evidence-grounded explanation | P0 | Each recommendation identifies which actual Qloo signals and creator fields support it; no unverified audience claims. |
| FR-10 | Baseline comparison | P0 | Same campaign constraints can be run with a baseline Apify query and a culture-informed query; results and ranking changes are shown honestly. |
| FR-11 | Campaign concept generation | P1 | A model proposes a creator-specific idea using candidate evidence and campaign objective; output is schema-validated. |
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
| Search mode | Yes (default: culture-informed) | Baseline vs Qloo-informed mode for comparison. |

## 9. Match score and explanation requirements

Initial configurable scoring proposal (not validated industry weights):

| Component | Starting weight | Evidence rule |
|---|---:|---|
| Cultural alignment | 35% | Similarity/relationship derived from actual Qloo outputs and evidenced creator topics/entities. |
| Content and campaign fit | 30% | Fit between campaign objective/category and available creator bio/content/search evidence. |
| Target-market relevance | 15% | Only verified audience geography or other reliable regional evidence; creator residence alone is insufficient. |
| Engagement quality | 10% | Use provider-returned engagement fields when present, with range/outlier checks. |
| Reach/budget fit | 10% | Use available follower metrics and a user budget; if creator fees are absent, do not claim a confirmed price fit. |

Implementation rules:

- Keep component weights in configuration, not prompts.
- Treat all component scores as 0–100 normalized indicators with documented methods.
- If a component is missing, mark it unavailable and renormalize across eligible components; also show evidence completeness separately.
- Avoid double-counting Apify's semantic query score as independent cultural-fit evidence when the Qloo-derived terms were already included in that query.
- Explain that Campaign Fit Score is a ranking aid, not a validated prediction of ROI.

## 10. Results experience

### Campaign summary

Show market, objective, selected references, timestamp, Qloo research status and Apify run status.

### Regional culture profile

Show a compact selection of actual returned Qloo entities/tags, their labels and any returned strength/relevance data the API explicitly provides. Include a source label and a short note that these signals are directional and dependent on query parameters.

### Creator ranking card

Each card should show:

- Creator name/handle and public profile URL if returned.
- Platform and follower count, engagement rate, verification status and posting/growth data only when returned.
- Overall Campaign Fit Score and a component breakdown.
- “Why this match?” with two or three evidence-linked reasons.
- “Unknown / not verified” fields, especially audience geography and language.
- One campaign concept, marked as an AI-generated hypothesis.

### Baseline versus culture-informed results

Display the two ranked lists side by side or in a switchable view. Report candidate overlap, changed ranks and the evidence behind significant changes. If it does not materially improve the shortlist, state that result rather than exaggerating the impact of Qloo.

## 11. Non-functional requirements

- **Security:** all provider secrets remain server-side; validate all user and model-generated inputs; do not expose raw API tokens in logs or responses.
- **Reliability:** analysis status is persisted; an interrupted page session can resume by campaign ID; retries are bounded and idempotent.
- **Latency:** use asynchronous Apify runs and return the campaign ID immediately. Show stage progress instead of holding a single request open.
- **Cost:** default to a small search result limit (e.g. 10–20 candidates) during development; surface actor/model usage for internal debugging.
- **Explainability:** every score is reproducible from stored normalized inputs and configured weights.
- **Accessibility:** semantic forms, keyboard-accessible controls, readable contrast, clear status messages.
- **Privacy:** collect only the campaign information necessary; don't store unnecessary personal data; define a simple retention policy for raw provider payloads.

## 12. MVP success metrics

These are prototype validation metrics, not business claims:

- API completion: a complete test campaign succeeds end-to-end in at least 4 of 5 repeated runs with expected provider access.
- Evidence coverage: every displayed score has a stored component breakdown and source references/field provenance.
- Comparative value: for one test brief, the baseline and culture-informed results can be compared and the ranking differences explained; no requirement that Qloo must always change the list.
- Data honesty: zero unsupported claims about audience location, language, culture, engagement or expected ROI in acceptance tests.
- Usability: a new tester can create a campaign and interpret the first three recommendations without developer assistance.
- Submission readiness: public deployment, source repository, license and reproducible setup documentation are all available.

## 13. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Qloo query combinations don't return useful results for chosen market/category | Critical | Run an API spike before UI build; choose one supported market/category; store tested request fixtures. |
| Apify actor omits post text, language or follower geography | Critical | Inspect actor input/output schema and live result items first; mark missing data; narrow product promise to supported evidence. |
| Culture signals are generalized into stereotypes | High | Use actual returned signals, label them directional, avoid essentializing language and let users inspect evidence. |
| Cultural signals don't improve shortlist | High | Run baseline comparison; improve query design; report limited/no improvement honestly. |
| Cost/latency of actor runs | Medium | Small result count, asynchronous run lifecycle, explicit cost guardrails and retries. |
| AI generates unsupported explanation | High | Supply structured evidence only; schema-validate output; render facts and generated hypotheses separately. |
| Provider schema changes | Medium | Central adapters, response validation and integration tests with recorded fixtures. |

## 14. Hackathon demo narrative

**Scenario:** A global D2C skincare or streetwear brand wants to test a regional campaign, initially using an India-focused city or market.

1. Submit one campaign brief with a selected country/region/city and a small set of cultural references.
2. Show Qloo resolving the references and returning real regional taste signals.
3. Show an Apify creator search run based on explicit requirements.
4. Show candidate profiles from actual returned data.
5. Compare baseline vs culture-informed ranking.
6. Open a creator card to show evidence, missing data and a campaign concept.
7. Change one reference/market parameter and rerun or show how the research plan changes.

The demo should emphasize that Qloo informs cultural research and materially participates in the selection pipeline. Avoid claiming guaranteed performance gains.

## 15. Scope plan

### Must ship

Campaign brief with flexible global market fields; Qloo entity resolution; one tested regional taste query; Apify actor execution; asynchronous run polling; normalization; deterministic scoring; evidence-based reasons; baseline comparison; deployable results UI; README and license.

### Ship if time permits

Campaign concept cards; CSV export; candidate bookmarking; more than one tested market; saved report comparison.

### Future

Multiple platforms, direct audience demographic integrations, verified post-level analysis, campaign outcome feedback loop, custom weighting, agency workspaces, CRM integrations and performance calibration against real outcomes.

## 16. Open questions to resolve during the API spike

1. Which Qloo entity/tag types and location parameter combinations reliably return useful data for the first chosen category and validated markets?
2. Which fields are actually returned by `influship/influencer-search` for a live test run, especially bio, post evidence, language, audience location, engagement, growth and costs?
3. Does the actor's returned semantic score remain comparable when query wording changes? Treat it as provider metadata, not a cross-run calibrated probability.
4. What is the current actor cost and expected latency for 10–20 results under the account used for the demo?
5. Which model provider/model and hosting limits are available under the team's credentials and deployment plan?

## 17. References

- Qloo Agentic Hackathon — official rules and deadline: https://qloo.devpost.com/rules
- Qloo Insights API Deep Dive: https://docs.qloo.com/reference/insights-api-deep-dive
- Qloo Parameter Overview: https://docs.qloo.com/reference/parameter-overview
- Qloo Search Entities: https://docs.qloo.com/reference/get-search
- Qloo Taste Analysis: https://docs.qloo.com/reference/taste-analysis
- Apify Influship Influencer Search actor: https://apify.com/influship/influencer-search
- AI SDK Core tool calling: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
- Vercel Function duration configuration: https://vercel.com/docs/functions/configuring-functions/duration

---

**Document note:** This PRD is an implementation draft. Provider capabilities and parameters must be confirmed against live credentials, current provider docs, and actual response payloads before production claims or UI fields are finalized. The product is globally extensible, but market coverage must remain limited to locations that have been tested and evidenced.
