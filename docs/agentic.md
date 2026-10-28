The implementation now uses a bounded agentic workflow: the model can choose validated research and creator-search actions while tools enforce campaign constraints, provider limits, approval policy and persistence. Numeric matching remains deterministic by design so ranking is reproducible and auditable.

## Implemented status

The current codebase includes:

- A research supervisor action contract with persisted traces and evidence references.
- Creator-search result criticism and one optional adaptive refinement, gated by `ENABLE_AGENTIC_CREATOR_REFINEMENT`.
- Evidence criticism that can accept, refine or stop with caveats.
- Approval handling for higher-cost or broader actions through the persisted workflow.
- Broad initial creator discovery without automatically injecting raw Qloo signal labels into the query.

The remaining work is to expand tool coverage and live-provider validation, not to restore the old always-paired search behavior.

Recommended next steps:

1. Let the model choose the next research action

Instead of always doing:

select inputs → query Qloo → inspect → refine

allow the agent to choose between tools such as:

- resolve cultural references
- query market culture
- query product culture
- compare brand and references
- request a Qloo heatmap
- broaden or narrow inputs
- stop research

Every action should use a strict Zod schema and enforce campaign constraints.

2. Add adaptive creator-search replanning

After Apify returns creators, let the agent inspect the result:

- too few creators → broaden query
- poor cultural relevance → add stronger Qloo signals
- poor market coverage → adjust location terms
- weak evidence → request enrichment
- strong result set → stop searching

This would make creator discovery itself agentic, instead of only the Qloo stage.

3. Add an evidence critic

Before scoring, run a bounded critic that checks:

- Are there enough verified Qloo signals?
- Are cultural references actually represented?
- Is the evidence too concentrated in one layer?
- Are search results sparse or redundant?
- Are important campaign constraints missing?

The critic should return one of:

accept
refine_qloo
refine_creator_search
stop_with_caveats

4. Allow the agent to select search strategy

The initial broad search is always available; the agent can choose whether an optional refinement search is useful:

- whether a comparison search is useful
- which cultural signals should influence the creator query
- whether to emphasize product, market, language, or references
- whether a third search is justified

Keep a hard maximum, such as three creator searches per campaign.

5. Persist agent state and reasoning

Persist structured state such as:

current objective
available evidence
selected inputs
actions taken
rejected actions
refinement count
budget remaining
stop reason

This lets the agent resume safely after provider callbacks or failures instead of reconstructing state from workflow stages.

6. Add explicit tool outcomes to the trace

The trace should show more than “queried Qloo.” Include:

- tool name
- validated input summary
- result count
- evidence count
- decision
- next action
- why alternative actions were rejected

That makes the agent behavior easy to demonstrate during the hackathon.

7. Add an optional human approval checkpoint

For higher-risk actions, let the user approve:

- broadening creator constraints
- running an additional paid provider search
- using weaker or unresolved evidence
- changing the search objective

The agent proposes; the user approves.

The current bounded architecture is:

Campaign brief
  ↓
Research supervisor agent
  ├─ Qloo research tools
  ├─ evidence critic
  ├─ refinement tools
  └─ stop decision
  ↓
Creator-search planner agent
  ├─ Apify search
  ├─ result critic
  ├─ query refinement
  └─ stop decision
  ↓
Deterministic scoring and evidence-grounded report

The important distinction is that the model should decide which tool to call next based on observed results. The tools should still enforce limits, schemas, campaign constraints, and deterministic scoring.
