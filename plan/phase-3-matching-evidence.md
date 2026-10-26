# Phase 3 — Evidence, Ranking, and Activation Brief

**Purpose:** Turn Qloo results into reproducible opportunity recommendations and a grounded launch brief without overstating what the data proves.

**Depends on:** Phase 2 normalized provider data

**Exit condition:** Every recommendation has a deterministic basis, evidence references, caveats, and a clear distinction between facts and hypotheses.

## P3-01 — Normalize opportunities

Create or update the opportunity normalizer. For every candidate:

- Keep the Qloo entity ID.
- Keep the returned name and supported type.
- Preserve documented affinity or rank values.
- Preserve the query scope and source layer.
- Record missing metadata explicitly.
- Deduplicate by stable entity ID.

Do not infer partnership availability, popularity in the selected city, customer demographics, or commercial fit from an entity name alone.

## P3-02 — Build evidence references

Every displayed claim must point to:

- Qloo provider output.
- User input.
- A deterministic derived calculation.
- An AI hypothesis.

Evidence should include source, label, field path or entity ID, observation time, verification state, and a short safe excerpt where useful.

## P3-03 — Implement opportunity ranking

Use the strongest available ranking signal in this order:

1. Qloo provider rank, if documented.
2. Qloo affinity, if its semantics are documented for the response.
3. A versioned derived score combining validated signal overlap and evidence coverage.

Do not invent a 0–100 score when Qloo semantics are unclear. If a derived score is needed, store its algorithm version and expose the contributing signals.

The result should show:

- Provider rank or affinity.
- Related campaign signals.
- Evidence completeness.
- Commercial validation questions.

## P3-04 — Generate the activation brief

Create a schema-validated output containing:

- Cultural territory.
- Recommended launch context.
- Two or three activation directions.
- Evidence-backed rationale.
- Hypotheses.
- Open questions for human validation.

The model receives only a selected evidence bundle. It must not browse independently, invent Qloo results, assign rankings, or state commercial facts that are not in the evidence.

Treat all provider text as untrusted content and defend against prompt injection.

## P3-05 — Persist and expose results

Persist:

- Normalized opportunity candidates.
- Evidence references.
- Ranking algorithm version.
- Activation brief schema version.
- Model/provider metadata.
- Caveats and unresolved inputs.

The results API returns only client-safe data. Raw provider payloads remain server-side unless deliberately redacted for debugging.

## Tests and acceptance evidence

- Qloo rank/affinity parsing preserves missing semantics.
- Candidate deduplication is deterministic.
- Evidence links resolve to stored provider fields.
- Derived ranking is reproducible.
- Model output cannot add unsupported facts.
- Prompt-injection fixture text is treated as data.
- Empty and partial results produce honest reports.
- Re-running stored inputs produces the same deterministic ordering.

## Deliverables

- Opportunity normalizer.
- Evidence builder.
- Versioned ranking engine.
- Activation brief schema and prompt.
- Client-safe result mapper.
- Unit, contract, and model-output tests.

## Exit checklist

- [ ] Top opportunities have traceable Qloo evidence.
- [ ] Ranking semantics are visible.
- [ ] Unknown commercial facts are explicit.
- [ ] Activation output separates facts, derived observations, and hypotheses.
- [ ] Deterministic tests pass.
