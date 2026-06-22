# Memory Optimization Work Instructions

## Objective
Implement the next runtime-memory reduction wave without interrupting the running `bible` service.

## Operating constraints
- Do not take down the live PM2 process just to measure memory.
- Use shadow ports for heavy verification whenever possible.
- Prefer boring disk-backed lookups over clever in-memory ranking caches.
- Preserve public route contracts for companion, bible reader, and crossrefs.

## Work order

### 1. Freeze the target behavior
Use the current docs as the contract source:
- `docs/memory-optimization-architecture.md`
- `docs/memory-optimization-roadmap.md`
- `docs/memory-optimization-addendum.md`
- `docs/memory-optimization-checklist.md`

Do not widen scope into product redesign.

### 2. Remove the highest-risk memory path first
Primary target:
- `lib/crossref-graph.ts`

Required change:
- replace the current full JSON corpus indexing path with a bounded network builder that starts from SQLite-backed cross-reference suggestions
- load only the linked passages that are actually needed for the current reference
- keep the current `CrossReferenceNetwork` view model shape stable enough for existing routes/components

### 3. Tighten fallback behavior
Targets:
- `lib/knowledge.ts`
- `lib/bible-passage-index.ts`

Required change:
- production should prefer DB-only behavior by default
- JSON fallback must become explicit emergency behavior, not silent steady-state behavior
- keep opt-in environment switches for break-glass rollback during rollout

### 4. Keep request-path loaders bounded
Targets:
- `lib/retrieval.ts`
- `lib/hybrid-retrieval.ts`
- `lib/bible.ts`

Required change:
- no request path should expand whole-locale Bible or passage-index corpora
- whole-corpus utilities remain allowed only for builders, QA, or clearly marked debug/admin surfaces

### 5. Preserve route compatibility
Targets:
- `app/[locale]/api/crossrefs/[reference]/route.ts`
- `app/[locale]/crossrefs/[reference]/page.tsx`
- `components/crossref-network.tsx`

Required change:
- preserve current filters and grouping semantics as much as practical
- if full historical graph semantics are too expensive, keep the same response contract but document/encode reduced evidence provenance using the live SQLite-backed suggestion set

### 6. Verify locally before touching deployment
Run, in order:
1. `npx tsc --noEmit`
2. `npm run lint`
3. `npm run build`
4. `npm run qa:crossrefs`
5. `npm run qa:concerns`
6. `npm run qa:open-ended`

Then run browser smoke checks against a production server.

### 7. Measure memory on a shadow process
- launch `next start` on an unused port
- hit `/ko`, `/ko/companion?...`, `/ko/bible?...`, `/ko/crossrefs/...`, `/ko/hanja/...`
- capture RSS before and after request bursts
- confirm the process does not climb toward the live worker’s 1.3 GB state

### 8. Deployment path
- rebuild generated DB assets
- deploy to the server without killing the old worker first
- validate via a shadow port or replacement worker
- only then reload PM2
- re-measure live PM2 memory after warm traffic

## File ownership notes
- crossrefs DB builder: `scripts/build-crossref-sqlite.mjs`
- bible DB builder: `scripts/build-bible-sqlite.mjs`
- passage-index DB builder: `scripts/build-passage-index-sqlite.mjs`

## Stop conditions
Do not stop at “it builds.” Continue until all are true:
- QA is green
- production-like browser checks are green
- memory measurements show the remaining large runtime paths are removed or explicitly gated
- the live-service rollout path is documented and ready
