# Companion Passage Background Work Order

## Scope

Implement the first local version of richer Companion passage background explanation.

## Tasks

### 1. Data model

- Extend `PassageBackgroundSummary` in `lib/passage-background.ts` with optional typed structures for people, setting, message, and application.
- Keep backward compatibility with existing fields and consumers: `summarizeBackgroundPack`, `buildLocalPassageBackground`, `buildPassageRecommendation`, and `app/[locale]/companion/page.tsx`.
- Treat every new field as optional at render boundaries.

### 2. Local enrichment

- Implement deterministic enrichment in `buildLocalPassageBackground`.
- Use book metadata, passage index summary, genre, testament, and selected reference.
- Add conservative template helpers with explicit grounding/fallback rules:
  - generic biblical people/groups by genre/testament; no invented named people;
  - setting from metadata and passage unit only;
  - original/theological/pastoral message using book metadata, passage unit, and selected reference;
  - application and takeaway with uncertainty-aware wording;
  - caution notes from genre and recommendation state.
- Preserve passage-selection behavior: do not alter ranking, retrieval, `primaryReference`, or related-passage selection logic.

### 3. Companion UI

- Update `app/[locale]/companion/page.tsx` to show richer background cards without breaking missing-field fallback.
- Surface in this compact order:
  - `본문이 놓인 자리` / `Where this passage sits`;
  - `등장 인물과 상황` / `People and situation`;
  - `이 말씀이 전하는 메시지` / `What this passage says`;
  - `오늘 붙들 문장` / `A sentence to hold today`;
  - `조심해서 읽을 점` / `Reading cautions`.
- Hide optional subsections when absent. Do not render placeholder or speculative text.
- Keep each card concise: short paragraphs and 1–3 role cards.

### 4. QA

- Extend `scripts/run-companion-probes.mjs` to assert the new UI text is present for at least one Korean probe and that existing primary-reference expectations remain stable.
- Run:
  - `npm run lint`
  - `npm run qa:companion-probes`
  - `npm run build`

## Non-goals

- No live web crawling in this implementation.
- No new external commentary database yet.
- No changes to passage selection ranking.
- No broad redesign of the entire Companion page.

## Completion evidence for this work order

- Design doc: `docs/companion-passage-background-design.md`
- Work order: `docs/companion-passage-background-work-order.md`
- Implementation completion must cite changed files, verification commands, and probe/build results in the ultragoal ledger.
