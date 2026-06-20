# Bible Runtime Memory Optimization Architecture

## Goal

Reduce steady-state runtime memory so the `bible` service behaves closer to `ruminate`: large corpora stay on disk, request paths load only the slices they need, and fallback paths stop silently rebuilding full in-memory copies of the Bible.

## Scope

This document covers runtime-memory architecture for:

- Bible text access
- passage-index access
- retrieval fallback paths
- background/context lookup paths
- memory verification gates

It does **not** redesign product behavior, ranking policy, YouTube enrichment rules, or Hanja UX.

## Current findings

### Already improved

The current repo has already removed two major memory offenders from the hot path:

1. Cross-reference datasets
   - `data/knowledge/openbible-crossrefs.json` ≈ 48.88 MB
   - `data/knowledge/crossreferences-kjv.json` ≈ 55.24 MB
   - runtime access now prefers `data/knowledge/crossrefs.sqlite`

2. Bible text access
   - `lib/bible.ts` now reads from `data/bible/bible.sqlite`
   - request paths load chapter-level slices instead of keeping the entire locale corpus resident

### Remaining memory hotspots

1. Passage index still loads as a full locale blob
   - `data/passage-index/en-runtime.json` ≈ 13.27 MB
   - `data/passage-index/ko-runtime.json` ≈ 16.62 MB
   - `lib/bible-passage-index.ts` caches the entire locale payload and builds in-memory lookup maps

2. Retrieval still has full-Bible fallback paths
   - `lib/retrieval.ts` still calls `loadVerses(locale)` in legacy fallback logic
   - `loadClusterCorpora()` builds a per-book verse map from the entire locale corpus
   - `retrieveClusterForPrompt()` still computes global verse candidates from all verses as a final fallback

3. `loadVerseIndex()` remains whole-locale
   - `lib/bible.ts` still exports `loadVerseIndex()`
   - the current main reader path no longer depends on it, but the function still expands the entire locale corpus when called

4. Passage background still depends on passage-index residency
   - `lib/passage-background.ts` now uses exact/chapter lookup, but that lookup is still backed by the fully cached runtime passage-index object

### Remote comparison note

Live inspection of `ssh pons` was attempted again after restart, but SSH still timed out during banner exchange. This design therefore uses:

- current local repo measurements
- the earlier confirmed local sibling `../ruminate` pattern: large corpora should stay on disk and be queried incrementally rather than loaded as monolithic JSON

## Design principles

1. **No full-locale corpus in steady-state request memory**
2. **Prefer SQLite-backed lookups over monolithic JSON caches**
3. **Cache by chapter / unit / query result, not by entire locale payload**
4. **Keep deterministic retrieval intact before optimizing heuristics**
5. **Do not let optimization reintroduce behavioral regressions on companion / bible / crossrefs**

## Target state

### 1. Bible text remains chapter-lazy

Keep the current `bible.sqlite` architecture as the canonical request-time source for Bible text.

#### Required invariants

- `getPassage()` loads one chapter only
- `getChapterContext()` loads one chapter only
- `getBibleReaderState()` loads one chapter only
- steady-state cache is chapter-bounded LRU, not whole-locale arrays

#### Follow-up cleanup

- deprecate request-time use of `loadVerses()`
- deprecate request-time use of `loadVerseIndex()`
- keep any whole-corpus loading limited to offline scripts or explicitly marked debug / QA tools

### 2. Passage index moves from JSON blob to SQLite query surface

The next major memory cut is replacing `en-runtime.json` / `ko-runtime.json` as request-time caches.

#### New artifact

- `data/passage-index/passage-index.sqlite`

#### Recommended schema

##### `units`
- `locale TEXT`
- `unit_id TEXT PRIMARY KEY`
- `book_code TEXT`
- `chapter INTEGER`
- `start_verse INTEGER`
- `end_verse INTEGER`
- `display_reference TEXT`
- `summary TEXT`
- `excerpt TEXT`
- `search_corpus TEXT`
- `canonical_weight REAL`
- `cross_reference_degree REAL`
- `genre TEXT`
- `verse_count INTEGER`
- `index_version TEXT`
- `source_locale TEXT NULL`
- `method TEXT NULL`
- `seed_overlay INTEGER`

##### `unit_axes`
- `locale TEXT`
- `unit_id TEXT`
- `axis_value TEXT`

##### `unit_keywords`
- `locale TEXT`
- `unit_id TEXT`
- `keyword TEXT`

##### `unit_crossrefs`
- `locale TEXT`
- `unit_id TEXT`
- `target_reference TEXT`

#### Required indexes

- `(locale, book_code, chapter, start_verse, end_verse)`
- `(locale, book_code, chapter)`
- `(locale, axis_value)`
- `(locale, keyword)`
- `(locale, target_reference)`

#### Optional index

If bundled SQLite supports FTS5 reliably in the deployment runtime:

- `units_fts(locale, unit_id, search_corpus, summary, excerpt)`

If FTS5 is not reliable, keep the first implementation conservative and use:

- `unit_keywords`
- pre-tokenized query terms
- existing axis scoring logic

### 3. Retrieval must stop calling `loadVerses()` on request paths

This is the most important code-level contract.

#### New retrieval contract

Main retrieval should rank from these sources only:

1. deterministic doctrinal / prior routing
2. passage-index candidate retrieval
3. answer-bundle / hybrid reranking
4. explicit unsupported / tentative result-state handling

#### Must remove from request path

- full-locale `loadVerses()` in `loadClusterCorpora()`
- full-locale `loadVerses()` in `retrieveClusterForPrompt()`
- whole-Bible verse scans for fallback candidate generation

#### Replacement

- candidate lookup from `passage-index.sqlite`
- exact/chapter passage fetch from `bible.sqlite`
- existing question-understanding / concern-axis expansion
- supporting-reference lookup through lightweight exact-reference reads

### 4. Passage background should query exact units, not resident unit arrays

`lib/passage-background.ts` should move from `findPassageUnit()` backed by a fully cached index object to a DB-backed exact/chapter query.

#### Required behavior

- exact reference match first
- overlapping unit match within same chapter second
- no whole-locale unit array in memory

### 5. Non-core catalogs stay secondary

Current YouTube and Hanja JSON catalogs are not the primary memory problem.

#### Decision

- do not optimize them first
- only revisit if measured heap snapshots show they are material on live requests
- if needed later, apply the same pattern: SQLite or split catalog shards, not giant always-on arrays

## Proposed module changes

### Replace

- `lib/bible-passage-index.ts`
  - from: full JSON load + full lookup maps
  - to: SQLite-backed query helpers

### Add

- `scripts/build-passage-index-sqlite.mjs`
- `lib/passage-index-db.ts`

### Refactor

- `lib/retrieval.ts`
- `lib/passage-background.ts`
- `lib/answer-bundle.ts` only if it still assumes resident passage-unit arrays

### Restrict

- `lib/bible.ts::loadVerses()`
- `lib/bible.ts::loadVerseIndex()`

These should become:

- script/debug-only helpers
- clearly marked non-request-path utilities

## Execution phases

### Phase A — passage-index storage cutover

1. build `passage-index.sqlite` from current builder output
2. preserve current unit schema semantics
3. expose query helpers for:
   - exact reference
   - chapter overlap
   - axis / keyword candidate fetch
4. keep JSON fallback only during cutover

### Phase B — retrieval request-path cutover

1. replace `loadClusterCorpora()` whole-Bible verse dependency
2. replace global verse fallback candidate generation
3. keep doctrinal / prior / unsupported behavior stable
4. preserve current QA pass rates before further tuning

### Phase C — cleanup and guardrails

1. prevent request-path callers from using `loadVerses()` accidentally
2. add comments / small assertions around request-safe helpers
3. document which loaders are offline-only

## Verification gates

### Functional gates

Must continue passing:

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run qa:crossrefs`
- `npm run qa:concerns`
- companion browser smoke test
- bible reader browser smoke test

### Memory gates

Measure at minimum:

1. cold process before first request
2. after `/ko/companion?...` request
3. after `/ko/bible?...` request
4. after crossrefs API request

### Acceptance thresholds

1. companion request path must not require full-locale verse expansion
2. bible reader request path must remain chapter-only
3. passage-index request path must not cache 13–17 MB locale blobs in steady state
4. no regression in concern QA pass rate

## Recommended next implementation order

1. build `passage-index.sqlite`
2. add DB query helpers for exact/chapter/axis/keyword access
3. refactor `lib/bible-passage-index.ts` behind the same public intent
4. remove `loadVerses()` from `lib/retrieval.ts` request path
5. rerun QA and memory measurements

## Non-goals

- changing theological ranking policy
- changing supported result-state semantics
- changing Hanja product scope
- changing YouTube enrichment policy
- optimizing build-time memory first

## Summary

The major remaining structural issue is no longer Bible text itself. That part is now chapter-lazy and SQLite-backed. The next root fix is:

- **stop caching passage-index locale blobs in memory**
- **stop using whole-Bible verse scans inside retrieval fallbacks**

That brings `bible` materially closer to the lighter `ruminate` pattern: corpora on disk, request paths reading only what they need.
