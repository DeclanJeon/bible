# Memory Optimization Checklist

## Goal
Keep the deployed `bible` service online while removing the remaining large in-memory runtime paths.

## Preconditions
- [x] `docs/memory-optimization-architecture.md` reviewed
- [x] `docs/memory-optimization-roadmap.md` reviewed
- [x] `docs/memory-optimization-addendum.md` reviewed
- [ ] current remote memory baseline captured from the live PM2 worker
- [x] shadow-process measurement path verified on a non-live port

## Design checklist
- [x] confirm which request paths are still allowed to read large JSON corpora
- [x] confirm production-only behavior for JSON fallbacks
- [x] confirm rollback flags for passage-index DB cutover
- [ ] confirm memory budgets for companion, bible reader, and crossrefs surfaces
- [x] confirm no-downtime deployment sequence

Heap-level budgets from `docs/memory-optimization-addendum.md` remain open because live PM2 telemetry only exposes RSS. Current rollout evidence instead shows shadow RSS at 271.5 MB after companion, 294.2 MB after bible, and 304.2 MB after crossrefs with sqlite-only steady state.

The stale fork-mode PM2 metadata was fixed on 2026-06-22 by running a guarded `PONSLINK_PM2_STRATEGY=recreate` deploy, which replaced the live `bible` app with two validated cluster-mode workers on the correct Next entrypoint.

## Implementation checklist

### A. Crossrefs / graph runtime
- [x] remove full JSON graph indexing from live request paths
- [x] rebuild crossref network data from SQLite-backed `getPassageCrossReferences()` results
- [x] preserve current response shape for `/api/crossrefs/[reference]`
- [x] preserve current page shape for `/[locale]/crossrefs/[reference]`
- [x] keep excerpt loading bounded to requested linked passages only

### B. Fallback discipline
- [x] disable JSON fallback by default in production for `lib/knowledge.ts`
- [x] disable JSON fallback by default in production for `lib/bible-passage-index.ts`
- [x] keep explicit opt-in escape hatches for emergency rollback only
- [x] document any remaining whole-corpus loaders as offline/debug-only

### C. Guardrails and observability
- [x] add lightweight request-path source indicators for DB vs fallback where safe
- [x] add or preserve kill-switch flags without making them the default architecture
- [x] ensure no new module-level cache retains full locale corpora

## Verification checklist

### Compile / build
- [x] `npx tsc --noEmit`
- [x] `npm run lint`
- [x] `npm run build`

### Functional QA
- [x] `npm run qa:crossrefs`
- [x] `npm run qa:concerns`
- [x] `npm run qa:open-ended`
- [x] browser smoke: `/ko/companion?...`
- [x] browser smoke: `/ko/bible?...`
- [x] browser smoke: `/ko/crossrefs/...`
- [x] browser smoke: `/ko/hanja/...`

### Memory QA
- [x] measure cold production RSS
- [x] measure RSS after companion burst
- [x] measure RSS after crossrefs burst
- [x] compare shadow-process RSS before/after changes
- [x] verify no large runtime JSON file becomes resident on steady-state request path

## Deployment checklist
- [x] build generated SQLite artifacts before deploy
- [x] deploy to a shadow port first
- [x] validate health endpoints and key pages on shadow
- [x] reload PM2 without taking down the live service
- [x] re-check live PM2 RSS after warm traffic
- [x] keep rollback env flags ready but unused unless regression appears
- note: the first live `pm2 reload` on 2026-06-22 exposed the stale fork-mode supervisor problem; after the guarded recreate deploy, a follow-up live reload on the two-worker cluster completed with zero failed `/api/runtime` polls.
- note: `scripts/deploy-ponslink.sh` now fails if PM2 comes back with the wrong script path, wrong exec mode, or the wrong instance count, so PM2 drift cannot hide behind a green shadow validation anymore.

## Exit criteria
- [x] live service remains available during rollout
- [x] crossrefs route no longer requires giant JSON graph indexing
- [x] production worker RSS trends materially lower than the current bloated worker state

Current live evidence: the guarded recreate deploy brought the service back as two cluster-mode workers at 56.5 MB and 44.9 MB cold RSS, a follow-up `pm2 reload` completed with zero failed runtime polls, and the controlled warm bundle left the pair at 719.9 MB total RSS with sqlite-only runtime sources and JSON fallbacks still disabled.
- [x] QA remains green
