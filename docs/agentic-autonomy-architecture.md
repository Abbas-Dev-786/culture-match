# Agentic Autonomy Architecture

## Purpose

CultureMatch uses a bounded agentic workflow in which agents can choose the next research, discovery, enrichment, and reporting action while the runtime enforces schemas, authorization, cost limits, persistence, and recovery.

The goal is not to let a model execute arbitrary code or make unbounded provider calls. The goal is to make the model responsible for planning and decision-making while the runtime remains responsible for validation, authorization, cost control, persistence, and recovery.

## Current implementation and remaining limitations

The current workflow has moved beyond the original fixed paired-search design:

- Qloo research still follows a bounded predefined sequence for the core cultural fingerprint.
- Creator discovery starts broad; an agent and evidence critic may select one optional refinement.
- Creator-search actions are schema-validated, persisted and constrained by campaign inputs.
- Creator scoring remains deterministic so rankings are reproducible and auditable.
- Model decisions are feature-gated; disabled or unavailable agentic features use an explicit fallback mode that must be visible in production configuration.

The remaining limitation is breadth of tool selection: the supervisor does not yet autonomously choose every Qloo layer or scoring component. This is a controlled boundary, not an excuse to let the model bypass validation or cost limits.

## Target architecture

```text
Campaign brief
    |
    v
Autonomous supervisor
    |
    +--> Qloo research tools
    +--> creator discovery tools
    +--> creator enrichment tools
    +--> evidence critic
    +--> scoring and ranking agent
    +--> report agent
    |
    v
Validated campaign result
```

The supervisor owns the objective and chooses the next action based on the persisted state. Each action is a typed tool call. The supervisor may stop, refine, request enrichment, or ask for approval.

## Agent responsibilities

### Research supervisor

The research supervisor should choose between actions such as:

- Resolve cultural references.
- Query market culture.
- Query product culture.
- Compare brand and references.
- Request a heatmap when geographic concentration is useful.
- Broaden, narrow, or replace research inputs.
- Stop research with or without caveats.

The supervisor must receive the objective, available evidence, previous actions, rejected actions, and remaining budget on every iteration.

### Creator discovery agent

The creator discovery agent should choose:

- Whether broad discovery is sufficient.
- Which market, language, product, or cultural terms to emphasize.
- Whether a second search is justified.
- Whether the result set needs enrichment instead of another search.
- Whether to stop with caveats.

The agent must never weaken campaign constraints such as follower range, creator limit, platform, or target market without explicit approval.

### Evidence critic

Before scoring, a bounded critic should inspect the complete evidence set and return exactly one decision:

- `accept`
- `refine_qloo`
- `refine_creator_search`
- `stop_with_caveats`

The critic should assess evidence quantity, reference representation, layer diversity, creator evidence coverage, redundancy, and missing campaign constraints.

### Scoring agent

The scoring agent may select which evidence dimensions matter most for a campaign and explain the ranking. It must:

- Cite stored evidence for every material claim.
- Separate observed facts from inference.
- Mark missing evidence as unavailable.
- Avoid treating provider relevance as proof of audience geography or campaign performance.
- Return structured scores and explanations through a strict schema.

The score output should be reproducible from the persisted input snapshot, agent decision, and model version.

### Report agent

The report agent should synthesize the scored evidence into a campaign concept and shortlist explanation. It should not introduce facts that do not exist in the evidence bundle.

## Tool contract

Every tool must have a strict Zod input and output schema. A tool should receive only the fields it needs and return structured metadata, including:

- Tool name and version.
- Validated input summary.
- Result count.
- Evidence count.
- Provider cost or budget units, when available.
- Warnings and caveats.
- Idempotency key.

The model may request an action, but the executor must validate it before making a provider call.

## Autonomous loop

Each agent loop should follow this sequence:

1. Load the persisted state.
2. Build a compact evidence summary.
3. Ask the model for one structured next action.
4. Validate the action against the action schema.
5. Validate the action against campaign constraints and budget.
6. Execute the selected tool exactly once.
7. Validate and normalize the tool result.
8. Append the tool outcome to the trace.
9. Persist state before continuing.
10. Stop, request approval, or continue until a hard limit is reached.

The model should never receive an unbounded transcript. It should receive the current objective, summarized evidence, recent actions, rejected actions, and remaining budget.

## Persisted state

Persist state in the analysis-run research summary or a dedicated agent-state record. The state should include:

```text
objective
availableEvidence
selectedInputs
actionsTaken
rejectedActions
toolOutcomes
criticDecisions
refinementCount
budgetRemaining
pendingApproval
stopReason
modelVersion
```

State must be written after every provider callback and before starting a new paid provider operation. This allows a callback or process restart to resume without reconstructing decisions from workflow stage names.

## Autonomy controls

Full autonomy still requires hard runtime controls:

- Maximum actions per campaign.
- Maximum provider searches per campaign.
- Maximum elapsed runtime.
- Maximum retry count.
- Maximum estimated provider cost.
- Maximum refinement count per agent.
- Idempotency keys for every external operation.
- No provider call without a validated tool input.
- No constraint weakening without approval.
- Circuit breaker after repeated invalid model actions.

These are execution guarantees, not deterministic business decisions. The agent remains autonomous inside the allowed operating envelope.

## Approval checkpoints

The agent should be able to pause and request approval for:

- Broadening creator constraints.
- Running another paid provider search.
- Using unresolved or weak evidence.
- Changing the search objective.
- Proceeding after a critic returns `stop_with_caveats`.

The approval request should include the proposed action, reason, expected benefit, estimated cost, and affected constraints. Approval must be persisted and bound to the exact proposed action so it cannot be reused for a different request.

## Removing deterministic decisions

The migration should remove deterministic business decisions in phases:

### Phase 1: Production decision policy

- Use the configured model automatically in deployments with model credentials; retain deterministic fallback behavior for development and provider-outage recovery.
- Fail clearly or show an explicit fallback status when the configured decision model is unavailable.
- Keep deterministic fallback behavior available for development and provider-outage recovery.

### Phase 2: Agentic discovery

- Let the discovery agent select the number and type of creator searches.
- Keep the broad initial search and use the search-plan tool for optional refinement.
- Let the agent decide whether Qloo should influence discovery.

### Phase 3: Agentic evidence review

- Replace fixed sufficiency thresholds with the evidence critic.
- Require a structured critic decision before scoring.
- Store critic reasoning and evidence references.

### Phase 4: Agentic scoring and reporting

- Move score-component selection and ranking rationale behind a scoring agent.
- Keep evidence completeness and unsupported-claim checks in the executor.
- Require the report agent to cite the stored evidence bundle.

## Failure behavior

The system should stop with a structured failure when:

- The model repeatedly emits invalid actions.
- The agent exceeds its action or cost budget.
- A required provider result cannot be validated.
- The agent attempts to weaken a campaign constraint without approval.
- The evidence critic cannot produce a valid decision.

Failures should preserve the last valid state, trace, and stop reason so the user can retry or approve a revised action.

## Acceptance criteria

- No enabled agentic decision path silently falls back to deterministic planning; any fallback is persisted and visible.
- Every model action is validated by a strict schema.
- Every provider operation is bounded and idempotent.
- The agent can resume after provider callbacks and process restarts.
- The trace records tool, input summary, result count, evidence count, decision, next action, and rejected alternatives.
- Scoring and reporting never invent evidence.
- Agent behavior is testable with recorded model responses and provider fixtures.
