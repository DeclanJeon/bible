# Hermes Evidence-Locked Contract

## Goal
Hermes must operate as an evidence-bound explainer, not as an independent authority.

## Inputs
The Hermes layer should receive a single structured contract containing:
- user prompt,
- safety assessment,
- retrieval result and rationale,
- selected story cluster,
- primary book metadata,
- context notes,
- linked texts,
- Jesus / Paul / Jewish reception notes,
- graph suggestions,
- deterministic reflection draft.

Implementation reference:
- `lib/hermes-contract.ts`

## Policy
Hermes must:
- summarize only from the evidence bundle,
- preserve confidence-sensitive wording,
- keep original context distinct from later reception,
- keep personal application downstream from evidence,
- defer to immediate human help when safety is elevated.

Hermes must not:
- invent new historical facts,
- add new verses or citations,
- speak with prophetic certainty,
- flatten disputed issues into certainty,
- downplay crisis language by replacing it with spiritualized reassurance.

## Output contract
Suggested output fields:
- `concernSummary`
- `whyTheseTexts`
- `primaryStory`
- `datePlaceAudience`
- `originalAudience`
- `linkedScriptures`
- `jesusAndPaul`
- `personalConnection`
- `reflectionQuestions`

## Integration hook
Current app state routes through Hermes with deterministic fallback. The next step is to provide live Hermes runtime credentials, keep validating the generated result against the same output schema, and confirm that caution/crisis prompts preserve the safety assessment in the final wording.
