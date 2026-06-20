# Memory Optimization Roadmap

## Objective

Execute the next memory-reduction wave without breaking the passage-first product:

- companion remains stable
- bible reader remains chapter-fast
- crossrefs remain exact
- retrieval quality stays at or above current QA baselines

## Baseline

### Current on-disk artifacts

- `data/knowledge/openbible-crossrefs.json` ≈ 48.88 MB
- `data/knowledge/crossreferences-kjv.json` ≈ 55.24 MB
- `data/knowledge/crossrefs.sqlite` ≈ 59.41 MB
- `data/bible/bible.sqlite` ≈ 11.89 MB
- `data/passage-index/en-runtime.json` ≈ 13.27 MB
- `data/passage-index/ko-runtime.json` ≈ 16.62 MB

### Current request-path status

Already fixed:
- crossrefs use SQLite
- Bible text uses SQLite and chapter-lazy reads

Still pending:
- passage index lives as a full JSON locale cache
- retrieval fallback still loads full-locale verses

## Work items

### 1. Passage-index SQLite builder

#### Deliverable
- `scripts/build-passage-index-sqlite.mjs`
- `data/passage-index/passage-index.sqlite`

#### Rules
- build from current runtime projection or full index source
- preserve locale separation
- preserve exact reference fidelity
- preserve enough fields for retrieval, background, and related-passages output

#### Acceptance
- DB can answer exact reference lookups
- DB can answer same-chapter overlap lookups
- DB can answer keyword / axis candidate lookups

### 2. Passage-index query module

#### Deliverable
- `lib/passage-index-db.ts`

#### Required API shape
- `findExactPassageUnit(reference, locale)`
- `findOverlappingPassageUnit(reference, locale)`
- `findCandidatePassageUnits({ locale, keywords, axes, limit })`

#### Rules
- do not return whole-locale arrays
- do not cache the full DB result set in memory
- allow a tiny exact-query cache only if measured useful

### 3. Retrieval cutover

#### Deliverable
- `lib/retrieval.ts` no longer calls `loadVerses()` on request paths

#### Replace
- whole-Bible verse scans
- per-book maps built from all verses

#### With
- deterministic priors
- passage-index candidate lookup
- existing hybrid reranker / answer-bundle logic
- explicit unsupported and tentative states

#### Acceptance
- `qa:concerns` remains clean
- `qa:crossrefs` remains clean
- no unsupported/tentative regression on existing fixtures

### 4. Background lookup cutover

#### Deliverable
- `lib/passage-background.ts` reads from passage-index DB helpers

#### Acceptance
- exact reference background still resolves
- same-chapter overlap fallback still resolves
- no full locale unit cache remains necessary

### 5. Request-path guardrails

#### Deliverable
Small code-level guardrails, not framework theater.

Examples:
- comments marking `loadVerses()` as offline/debug-only
- local assertions in retrieval modules
- avoiding new callsites that expand the entire locale corpus

## Recommended file-level order

1. `scripts/build-passage-index-sqlite.mjs`
2. `lib/passage-index-db.ts`
3. `lib/bible-passage-index.ts`
4. `lib/passage-background.ts`
5. `lib/retrieval.ts`
6. focused QA + memory measurements

## Verification plan

### Compile / build
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`

### Product QA
- `npm run qa:crossrefs`
- `npm run qa:concerns`
- browser smoke: `/ko/companion?...`
- browser smoke: `/ko/bible?...`

### Memory QA

Capture at least:
- old baseline for passage-index JSON load
- new passage-index DB lookup heap delta
- companion request heap delta after cutover

### Success criteria

- no full runtime load of `en-runtime.json` / `ko-runtime.json` in steady state
- no request-path `loadVerses()` call in retrieval
- companion and bible pages still work
- QA remains green

## Risks

### Risk 1: retrieval quality drops after removing whole-Bible fallback

Mitigation:
- keep deterministic priors unchanged
- keep answer-bundle / hybrid rerank unchanged where possible
- verify with existing fixtures before deleting fallback code completely

### Risk 2: SQLite query design becomes too clever

Mitigation:
- start boring: exact, chapter, keyword, axis queries
- use FTS only if runtime support is proven and unnecessary complexity is avoided

### Risk 3: passage-index DB schema omits fields later needed by UI

Mitigation:
- store the current runtime projection fields that already feed companion/background
- do not prematurely compress away summary/excerpt/search corpus

## Stop conditions

Do not call this optimization complete until both are true:

1. passage-index locale blobs are off the steady-state request path
2. retrieval no longer expands the whole Bible on normal companion requests

## Summary

The first optimization wave fixed crossrefs and Bible text. The second wave should finish the job by moving passage-index access and retrieval fallback logic onto disk-backed, incremental lookup paths.
