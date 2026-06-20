# Memory Optimization Addendum

## Why this addendum exists

The architecture and roadmap documents are enough to start implementation, but a few operational decisions are worth fixing now so the optimization does not sprawl into guesswork.

## 1. Add explicit memory budgets

The current documents define structural direction but not hard budgets. Add these working targets:

### Request-path targets
- cold boot baseline heap should stay below **120 MB** before the first companion request
- a single companion request should not add more than **20 MB** steady-state heap after GC
- a single Bible reader request should not add more than **5 MB** steady-state heap after GC
- crossrefs API request should not add more than **10 MB** steady-state heap after GC

### Cache targets
- chapter cache in `lib/bible.ts` stays bounded and small
- passage-index query cache, if added, should be capped by **entry count**, not by locale blob residency
- no module may keep both JSON runtime index and SQLite query results resident for the same locale after cutover

These are not perfect production SLOs; they are implementation guardrails.

## 2. Fix the rollout sequence

Do not cut everything at once.

### Recommended rollout order
1. build `passage-index.sqlite`
2. ship DB-backed lookup helpers with JSON fallback
3. switch `passage-background.ts` first
4. switch retrieval candidate lookup second
5. remove request-path `loadVerses()` only after QA stays green
6. remove JSON fallback only after measurement confirms the DB path is stable

This keeps failures local instead of making the entire companion path un-debuggable.

## 3. Make JSON fallback temporary, not permanent

The current plan says “keep JSON fallback during cutover.” That is correct, but the fallback must have an expiry condition.

### Required rule
JSON runtime passage-index loading is allowed only until all three are true:
- passage-index SQLite builder is reproducible in CI / local dev
- companion and background lookups pass current QA on the DB path
- memory measurements show locale blob residency is gone from steady state

After that, JSON should become:
- offline build/debug artifact only, or
- explicit emergency fallback behind a narrow opt-in flag

Not the default path.

## 4. Add observability before deeper rewrites

Optimization without visibility turns into superstition.

### Add lightweight instrumentation
At minimum, log or expose in debug mode:
- whether a request hit `bible.sqlite` or fallback file parsing
- whether a request hit `passage-index.sqlite` or JSON fallback
- chapter cache hit/miss counts
- passage-index query latency for exact/chapter/candidate lookups
- process heap before/after selected QA requests in a scripted measurement mode

This should stay behind a debug/admin surface or environment flag, not pollute normal output.

## 5. Decide how candidate lookup ranks before coding FTS

The architecture correctly avoids premature FTS dependence. Push that decision harder:

### Phase-1 candidate retrieval should use
- exact keyword hits
- axis hits
- canonical weight
- cross-reference degree
- existing question-understanding expansion terms

### Phase-1 should avoid
- introducing SQLite-specific ranking magic that changes retrieval semantics unpredictably
- tying correctness to FTS availability in one runtime and not another

If later needed, FTS can become a phase-2 optimization after parity is proven.

## 6. Clarify what stays allowed to use whole-corpus loaders

Right now the plan says `loadVerses()` / `loadVerseIndex()` should become debug/offline only. That should be spelled out more concretely.

### Allowed callers
- offline builders
- QA tools that intentionally benchmark whole-corpus logic
- admin/debug routes that are explicitly non-production-critical

### Disallowed callers
- companion page request path
- reflect API request path
- Bible reader request path
- crossrefs / passage background request path

## 7. Add a remote pons verification checklist

SSH is still flaky, but once it works, the plan should already say what to check.

### When `ssh pons` becomes reachable
Capture:
- process RSS / heap for the running `bible` service before request load
- RSS / heap after companion request burst
- RSS / heap after Bible reader request burst
- count of open SQLite handles
- whether any process still mmap/parses large runtime JSON files on steady state

### Compare against
- local measurement scripts
- the current `ruminate` deployment pattern

This keeps the remote check concrete instead of “looks lighter.”

## 8. Add builder ownership and rebuild triggers

The optimization introduces more generated assets. Make ownership explicit.

### Builders
- `scripts/build-bible-sqlite.mjs`
- `scripts/build-crossref-sqlite.mjs`
- future `scripts/build-passage-index-sqlite.mjs`

### Rebuild triggers
- Bible source text changed → rebuild `bible.sqlite`
- crossref JSON source changed → rebuild `crossrefs.sqlite`
- passage-index builder logic or source data changed → rebuild `passage-index.sqlite`

### Rule
Generated SQLite files must be reproducible from tracked source inputs and scripts. No hand-edited DB artifacts.

## 9. Add a kill-switch plan

If the DB-backed passage-index path regresses production behavior, there should be a narrow rollback path.

### Recommended temporary controls
- env flag to force JSON passage-index fallback during cutover only
- env flag to disable candidate DB path while preserving exact/chapter DB lookups

These flags should be removed after the cutover stabilizes. They are rollback tools, not permanent architecture.

## 10. Final recommendation

Yes, there were still a few things worth tightening. The biggest missing pieces were:
- hard memory budgets
- rollout order
- observability
- remote verification checklist
- ownership of generated DB artifacts
- a temporary kill-switch during cutover

With those clarified, the optimization plan is much less likely to drift or silently reintroduce giant in-memory blobs.
