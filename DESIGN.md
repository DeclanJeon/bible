# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-06-22
- Primary product surfaces:
  - `/[locale]/companion`: prompt-to-study result page.
  - `/[locale]/api/reflect`: prompt-to-study JSON API.
  - `/[locale]/study/[slug]`: guided study desk for a selected lane.
  - `/[locale]/graph/[slug]`: scripture hyperlink graph view.
  - `/[locale]/passage/[reference]`: passage reader with surrounding context and related navigation.
  - `/[locale]/crossrefs/[reference]`: full cross-reference network reader.
  - `/[locale]/api/crossrefs/[reference]`: full cross-reference network API.
  - `/[locale]/bible`: full Bible reader by book and chapter.
  - `/[locale]/lanes`: study lane catalog.
  - `/[locale]/reviews`: anonymous review board.
  - `/[locale]/hanja` and `/[locale]/hanja/[slug]`: Hanja catalog and evidence/detail surfaces.
- Evidence reviewed:
  - `README.md` — product positioning, routes, architecture, operating constraints.
  - `docs/bible-hyperlink-companion-design.md` — product direction, interaction model, graph intent, source policy.
  - `docs/hermes-evidence-locked-contract.md` — evidence-locked explanation contract.
  - `reports/rag-qa-improvement-report.md` — current RAG flow, QA results, known limits.
  - `app/[locale]/api/reflect` live probe for “삶이 지쳤어 내가 왜 살아야되는지 모르겠어” — current low-confidence failure mode for unpredictable Korean concern input.
  - `lib/knowledge.ts` — current top-N cross-reference aggregation.
  - `lib/retrieval.ts` — prompt-to-primary-passage retrieval.
  - `lib/reflection.ts` — deterministic explanation fields.
  - `lib/hermes-contract.ts` and `lib/hermes.ts` — generation policy and fallback behavior.
  - `lib/book-metadata.ts` and `lib/app-data.ts` — book-level history/background/context notes.
  - `app/[locale]/api/reflect/route.ts`, `app/[locale]/companion/page.tsx`, `app/[locale]/graph/[slug]/page.tsx`, `app/[locale]/passage/[reference]/page.tsx` — current API/UI use of cross-reference suggestions.
  - `components/crossref-section.tsx`, `components/passage-card.tsx` — current display patterns.
  - `scripts/ingest_openbible_crossrefs.py`, `scripts/ingest_phrase_crossrefs.py` — current cross-reference data generation.
  - `qa/*.json`, `scripts/run-*.mjs` — current QA scope and gaps.

  - `docs/open-ended-bible-qa-architecture.md` — current open-ended QA pipeline, answer-bundle contract, and verification gates.
  - `lib/question-understanding.ts`, `lib/answer-bundle.ts`, `lib/hybrid-retrieval.ts`, `lib/passage-reranker.ts` — current question understanding, bundle assembly, and ranking behavior.
  - `app/[locale]/page.tsx`, `app/[locale]/companion/page.tsx`, `app/[locale]/bible/page.tsx`, `app/[locale]/lanes/page.tsx`, `app/[locale]/study/[slug]/page.tsx`, `app/[locale]/graph/[slug]/page.tsx`, `app/[locale]/crossrefs/[reference]/page.tsx`, `app/[locale]/reviews/page.tsx`, `app/[locale]/hanja/page.tsx`, `app/[locale]/hanja/[slug]/page.tsx` — 2026 UI audit of implemented pages.
  - `app/globals.css`, `tailwind.config.ts`, `components/global-nav.tsx`, `components/quick-prompt-form.tsx`, `components/passage-card.tsx`, `components/crossref-network.tsx`, `components/review-board.tsx`, `components/bible-book-search.tsx`, `components/hanja-catalog-search.tsx` — current layout, typography, token, navigation, card, form, and dense-list patterns.
  - `docs/design/concepts/home-google-style-ko.svg`, `docs/design/concepts/v2/overview-simplified-v2-ko.svg`, `docs/design/concepts/v2/companion-simplified-v2-ko.svg`, `docs/design/concepts/v2/study-simplified-v2-ko.svg`, `docs/design/concepts/v2/graph-simplified-v2-ko.svg`, `docs/design/concepts/v2/lanes-simplified-v2-ko.svg` — existing simplified concept direction.
  - Live local audit on `http://localhost:3101/ko`: home, companion, Bible reader, lanes, study, graph, cross-reference summary/full, reviews, Hanja catalog/detail, passage redirect, and not-found screens.

## Brand
- Personality:
  - Warm, calm, source-first Bible study companion.
  - Study desk before chatbot.
  - Editorial, reverent, precise, confidence-aware.
- Trust signals:
  - Every passage shown with a hyperlink to the full passage.
  - Every relationship shown with source provenance.
  - Historical/background notes labeled by confidence.
  - Dataset limits disclosed instead of hidden.
- Avoid:
  - Isolated verse advice.
  - Hidden curation by omission.
  - Invented historical claims.
  - Fake certainty around disputed authorship/date/place.
  - Overloading the first answer with hundreds of prose explanations.

## Product goals
- Goals:
  - Given a user concern or a selected passage, surface the primary biblical passage, its context, every available direct cross-reference from the ingested datasets, and the book/history/background notes needed to read responsibly.
  - Preserve the Bible-hyperlink identity of the product: users can follow all available links, not only a curated shortlist.
  - Keep explanation evidence-locked: prose explains the provided passages and metadata, never invents new citations or background.
  - Separate summary guidance from complete data access.
  - Make the full cross-reference network navigable by book, canon section, direction, relation type, source, strength, and phrase anchor.
  - Interpret unpredictable free-form user concerns through an AI/query-planner middleware before retrieval, while keeping the Bible corpus and evidence contract as the source of truth for final passage selection.
  - For doctrine prompts, distinguish common Christian core claims from tradition-sensitive interpretations instead of flattening everything into one undifferentiated doctrinal voice.
- Non-goals:
  - Do not claim to know every possible theological relationship beyond the datasets and local metadata.
  - Do not force every cross-reference into the generated answer body.
  - Do not replace Bible reading with generated explanation.
  - Do not add external historical facts unless they are ingested into the local evidence layer with provenance.
  - Do not flatten materially disputed doctrine into a fake universal consensus.
  - Do not attribute a denominational view unless the app has explicit local sources for that tradition.
- Success signals:
  - The full network endpoint returns all dataset-backed direct links for a passage without top-N truncation.
  - The companion page clearly states total available links and offers full exploration.
  - The full cross-reference page can show every link while remaining readable through grouping/filtering.
  - Each displayed link includes `why connected`, `source`, `direction`, `excerpt`, and `full passage` navigation.
  - QA includes exact-count recall checks for known anchors and no-truncation checks for the full endpoint.
  - Korean free-form concern QA covers at least 30 prompts across weariness, purpose, despair, safety, unrelated everyday input, and theological questions with ≥95% pass rate.
  - Doctrine prompts with real interpretive divergence show a shared-core summary first, then clearly labeled tradition-specific views with cited limits and source provenance.

## Personas and jobs
- Primary personas:
  - Korean and English Bible readers who begin with a personal concern and need a grounded study path.
  - Bible teachers/small-group leaders who need all cross-reference links visible before preparing a lesson.
  - Serious lay readers who want context, history, and canonical echoes without losing the primary text.
- User jobs:
  - “Show me the passages connected to this concern.”
  - “Do not hide links from me; let me inspect the whole network.”
  - “Tell me why each passage is connected.”
  - “Show the book/background/history context so I do not misuse a verse.”
  - “Let me jump directly to every referenced passage.”
- Key contexts of use:
  - Mobile devotional reading: needs summary and progressive disclosure.
  - Desktop study preparation: needs full network, filters, and dense lists.
  - Bilingual study: Korean/English routes must preserve the same graph semantics.

## Information architecture
- Primary navigation:
  - Home → Companion → Study desk → Graph → Passage reader.
  - New path: Companion / Passage reader / Graph → Full cross-reference network.
- Core routes/screens:
  - `/[locale]/companion`: summary, primary passage, highlights, context, and full-network call-to-action.
  - `/[locale]/api/reflect`: same evidence contract for API clients, with full-network summary and URL.
  - `/[locale]/crossrefs/[reference]`: full network page for one selected passage.
  - `/[locale]/api/crossrefs/[reference]`: full network JSON endpoint.
  - `/[locale]/passage/[reference]`: passage text, surrounding context, and entry into the full network.
  - `/[locale]/graph/[slug]`: lane-level map; should link to the full passage-level network for the primary reference.
- Content hierarchy:
  1. Center passage and confidence.
  2. Why this passage was selected.
  3. Immediate historical/book context.
  4. Cross-reference summary and strongest links.
  5. Full network access.
  6. Complete grouped network.
  7. Interpretation guide and cautions.

## Design principles
- Principle 1: No curation by omission.
  - The system may rank and summarize, but it must preserve access to every dataset-backed direct link.
- Principle 2: Progressive disclosure, not suppression.
  - First view shows digestible highlights; full view exposes the complete network.
- Principle 3: Evidence before prose.
  - Passages, links, source labels, and background notes appear before interpretive application.
- Principle 4: Direction matters.
  - Outgoing, incoming, and mutual links are distinct. Do not collapse them into one undifferentiated list.
- Principle 5: History/background must be scoped.
  - Current repository evidence supports book-level metadata and surrounding passage context. Do not label it as verse-specific history unless verse-specific evidence exists.
- Principle 6: Complete does not mean unstructured.
  - Complete link access requires grouping, filters, counts, and stable sorting.
- Tradeoffs:
  - Reflect/companion responses stay small for speed; full network is fetched separately.
  - Generated explanation sees highlights and summaries; the full list remains deterministic data.
  - “All” means all links in ingested sources for the selected passage, plus both directions after reverse indexing. The UI must disclose source coverage.

- Principle 7: AI interprets the question; evidence selects the passage.
  - LLM/Hermes middleware may normalize intent and propose search terms, but it must not become the source of Bible citations. Retrieved local passages, curated priors, and evidence validation decide what is shown.
- Principle 8: Consensus before divergence.
  - For doctrine prompts, show the broad Christian common core before explaining where traditions separate.
- Principle 9: Tradition labels require evidence.
  - No Catholic / Orthodox / Reformed / Baptist / Pentecostal card may appear unless local evidence exists for that tradition's reading.
- Principle 10: Difference should be visible, not noisy.
  - Tradition-specific detail belongs in a secondary layer by default so the first answer remains readable.

## Visual language
- Color:
  - Canvas: `#0a0a0f`.
  - Surface 1: `#12121a`.
  - Surface 2: `#1a1a25`.
  - Surface 3: `#22222f`.
  - Hairline: `rgba(255,255,255,0.08)`.
  - Strong hairline: `rgba(255,255,255,0.15)`.
  - Ink: `#f0ece4`.
  - Muted ink: `#9a9490`.
  - Subtle ink: `#6b6560`.
  - Gold: `#d4a853`.
  - Gold hover: `#e0bc6a`.
  - Gold soft: `rgba(212,168,83,0.10)`.
  - Gold border: `rgba(212,168,83,0.25)`.
  - Link blue: `#8ab4e8`.
- Typography:
  - Display large: 48px / 700 / 1.1 / -1.5px.
  - Display medium: 36px / 700 / 1.15 / -1px.
  - Heading 1: 28px / 600 / 1.2 / -0.5px.
  - Heading 2: 22px / 600 / 1.25 / -0.3px.
  - Heading 3: 18px / 600 / 1.35.
  - Body large: 18px / 400 / 1.65.
  - Body: 16px / 400 / 1.6.
  - Body small: 14px / 400 / 1.55.
  - Caption: 12px / 500 / 1.4 / 0.3px.
- Spacing/layout rhythm:
  - `4, 8, 16, 24, 32, 48, 64` px scale.
  - Full network lists use compact row density on desktop and stacked cards on mobile.
- Shape/radius/elevation:
  - 6, 8, 12, 16, 20, 24px radii, plus pill.
  - Glass surfaces stay subtle: low-opacity borders, no heavy blur.
- Motion:
  - Minimal. Expand/collapse and filter changes should not distract from reading.
- Imagery/iconography:
  - Use existing Lucide icon language.
  - Gold only for scripture focus, active state, verse number, and primary CTA.


## 2026 redesign audit and target direction

### Current state
- The implemented visual system already has a coherent dark canvas, warm gold accent, hairline borders, glass/soft-glass surfaces, responsive spacing variables, 44px touch targets, and reduced-motion handling.
- The product concept is clear: passage-first Bible study, not chatbot-first advice.
- The main weakness is information architecture density. Most internal pages expose too many equal-weight cards, panels, tabs, badges, and CTAs before the user has a clear reading path.
- The second weakness is inconsistent hierarchy: some pages use a minimal search-home pattern, some use heavy hero cards, some use tabbed dashboards, and Hanja detail uses a different editorial layout without the shared glass language.
- The third weakness is oversized unvirtualized lists: `/[locale]/lanes` renders the full 66-lane catalog and `/[locale]/crossrefs/[reference]?view=full` can become an extremely long page; Hanja catalog has over 1,000 searchable cards but a controlled visible count.

### 2026 north star
- Keep the dark, reverent, source-first identity. Do not pivot to a generic SaaS gradient dashboard.
- Redesign around a single rule: **one screen = one primary decision**.
- Make the product feel like a calm study instrument: search-first entry, reading-first results, data available on demand, provenance always visible but secondary.
- Use the existing simplified concept assets as the visual direction: centered input on home, compact result summary on companion, Bible-text-first study page, guided graph explanation before network detail, catalog pages as search/filter surfaces.

### Page-level target IA
- Home: search engine layout. Keep only brand, one prompt input, 3–5 suggestion chips, and minimal navigation. Remove explanatory card clutter from the first viewport.
- Companion: reorder to `one-sentence answer → primary passage → why this passage → related passages → background/provenance/sidebar`. Hide diagnostics such as answer mode, expansion provider, state, and confidence behind a compact “search notes” disclosure.
- Bible reader: keep the two-column reader, but make the passage article visually quieter and more book-like. The selected chapter and chapter picker should be sticky/contextual; reflection CTA should not compete with the text.
- Lanes: add an explicit H1 and make it a fast catalog: search, topic chips, result count, cards. Each card should have one dominant CTA; study/graph links can be secondary text actions.
- Study desk: remove duplicated pastoral prompt. Default to the primary passage reading view. Move notes, related lanes, and source inventory into the right rail or below-the-fold disclosures.
- Graph: make the first screen explain “why these passages connect” before showing cards. Visual node graph may be decorative only; accessible list remains primary.
- Cross-reference network: default to summary + strongest links + load-full action. Full mode needs a denser table/list, sticky filters below the global nav, and chunking/pagination or virtualization so the page does not become an 80k+ px scroll.
- Reviews: keep as a small trust/support page. Reduce hero height; put the form first on mobile and reviews first on desktop.
- Hanja catalog: keep visible-count loading, but add a clearer H1/description tying it to Bible study and use a denser list/card hybrid for 1,000+ entries.
- Hanja detail: align with the editorial reading template: character hero, thesis, evidence, passages, sources. Reuse shared surface classes and CTA styling so it does not feel like a separate product.
- Loading/error/not-found: localize Korean/English copy by route locale where possible; remove emoji from error UI and use the same calm icon/card language as `BrandedLoadingPage`.

### Typography and scale target
- Keep `Pretendard` first for Korean, but load it explicitly or switch to a bundled/system Korean-safe stack. Do not rely on an undeclared local font.
- Use a stricter type ramp: display 56/64 desktop, 40/48 tablet, 32/40 mobile; page H1 40–48 desktop; section H2 24–28; card title 17–20; body 16–18; metadata 12–13.
- Long Bible text should use a dedicated reading style: 18–20px, 1.85–2.0 line-height, max line length 64–72 Korean characters, verse numbers in a fixed column.
- Eyebrows should stay rare. Use them for source/provenance or major sections, not every card.

### Layout and component target
- Standardize page shells:
  - `SearchShell`: home and compact search pages.
  - `ReaderShell`: Bible, study, companion primary passage.
  - `CatalogShell`: lanes and Hanja catalog.
  - `NetworkShell`: graph and cross-reference network.
  - `EditorialShell`: Hanja detail, reviews, support/info pages.
- Standardize surfaces:
  - `FocusCard`: gold-tinted primary scripture/result.
  - `SurfaceCard`: normal content.
  - `MutedPanel`: metadata/provenance/debug information.
  - `ActionRow`: one primary CTA plus secondary text links.
- Reduce radius variance. Default card radius 20–24px, input/button radius 14–16px, pills only for filters/tags.
- Use gold only for primary action, active state, scripture focus, verse number, and evidence accent. Avoid white text on gold when contrast is weaker than dark text on gold.

### Interaction and UX target
- Progressive disclosure is mandatory for diagnostics, source inventory, long notes, and full networks.
- Filters must be URL-backed and shareable; dense results must preserve total counts while paginating or virtualizing visible rows.
- Sidebars must be sticky only after the global nav offset; mobile sidebars become ordered sections, not off-canvas drawers.
- Preserve keyboard and screen-reader affordances: real headings, semantic lists/tables, visible focus, non-color-only badges.

### Implementation order
1. Token and shell pass: explicit font loading, page-shell components, unified surface/CTA classes.
2. Home and companion pass: search-first home, result-summary-first companion, debug notes disclosure.
3. Reader pass: Bible/study text hierarchy and duplicated prompt cleanup.
4. Catalog pass: lanes H1, one-primary-action cards, Hanja dense catalog alignment.
5. Network pass: cross-reference full-mode density, sticky filters, chunked/virtualized rendering strategy.
6. Edge-state pass: localized not-found/error/loading alignment and final accessibility sweep.

### Concrete defects found in the 2026 audit (verified, fix during redesign)
- Duplicate pastoral prompt: `app/[locale]/study/[slug]/page.tsx:90-91` renders `{cluster.pastoralPrompt}` twice in a row. Remove one; keep a single subtitle line.
- Inconsistent gold-CTA foreground token across the app — pick one (dark `text-[var(--canvas)]` on gold) and apply everywhere:
  - Correct (dark on gold): `components/quick-prompt-form.tsx:34`, `app/[locale]/companion/page.tsx:163`, `app/[locale]/bible/page.tsx:198`, `app/[locale]/study/[slug]/page.tsx:94`.
  - Low-contrast off-white on gold (`text-[var(--ink)]`): `app/[locale]/lanes/page.tsx:65,143,161`.
  - Low-contrast white on gold (`text-white` on `--accent`): `app/[locale]/graph/[slug]/page.tsx:173`.
- Legacy `--accent`/`text-slate-950` and English-only edge states: `app/error.tsx:19-26`, `app/not-found.tsx:7-21` use the legacy `--accent` alias, a raw emoji, and hardcoded English. Migrate to `--gold`/`--canvas`, drop the emoji, and localize.
- Missing explicit web-font loading: `app/globals.css:89` declares `"Pretendard"` first but no `@font-face`/`next/font` ships it, so Korean type silently falls back per device. Bundle Pretendard via `next/font/local` (or a system Korean-safe stack) before relying on the new type ramp.
- Lanes has no `H1`: `app/[locale]/lanes/page.tsx` opens at a `section-title` eyebrow; add a real page `H1` for hierarchy and SEO.
- Unbounded scroll surfaces confirmed in live audit: `/[locale]/lanes` (full 66-lane catalog, ~11k px) and `/[locale]/crossrefs/[reference]?view=full` (~87k px when every edge card expands). Apply pagination/virtualization, not data truncation.

## Components
- Existing components to reuse:
  - `PassageCard` for passage links.
  - `CrossReferenceSection` for highlight lists.
  - `NoteCard` and `BookProfileCard` for context/history notes.
  - `TabSection` and `Collapsible` for progressive disclosure.
  - `SourceList` for source provenance.
- New/changed components:
  - `CrossReferenceNetworkSummary`: totals, directions, books touched, strongest sources.
  - `CrossReferenceNetworkTable`: all edges with filters/sort.
  - `CrossReferenceBookGroup`: book-level grouping with context note summary.
  - `CrossReferenceRelationBadge`: consensus/vote/phrase/incoming/outgoing/mutual labels.
  - `CrossReferenceFilters`: direction, book, canon section, relation type, source, phrase anchor.
  - `CrossReferenceEmptyState`: explicit message when source datasets have no links for a reference.
  - `FullNetworkCta`: reusable CTA from companion, graph, study, and passage pages.
  - `BrandedLoadingPage`: logo-led route loading page for prompt/response waits and generic route transitions.
- Variants and states:
  - Highlight mode: 4–8 strongest links.
  - Full mode: no edge truncation; paginated/virtualized only as a rendering strategy, never as data loss.
  - Dense mode: desktop table/list.
  - Card mode: mobile stacked cards.
  - Low-confidence mode: no expansion from weak primary passage; first try AI/deterministic query normalization for concern intent, then pause expansion if the normalized query still lacks a reliable passage.
- Token/component ownership:
  - Use existing CSS variables and Tailwind patterns.
  - Do not introduce a new design-system dependency.

## Accessibility
- Target standard:
  - WCAG 2.1 AA for contrast, keyboard navigation, focus visibility, and semantic grouping.
- Keyboard/focus behavior:
  - Filters are reachable by Tab.
  - “Clear filters” is a real button.
  - Group accordions expose expanded/collapsed state.
  - Passage links have descriptive labels including book/chapter/verse.
- Contrast/readability:
  - Passage text remains higher contrast than metadata.
  - Badges must not rely on color alone; include text labels.
- Screen-reader semantics:
  - Network totals are announced as summary text.
  - Direction groups use headings.
  - Tables/lists use semantic roles; avoid div-only data grids unless fully accessible.
- Reduced motion and sensory considerations:
  - Avoid animated graph force layouts as the only navigation path.
  - Text/list view is the primary accessible representation.

## Responsive behavior
- Supported breakpoints/devices:
  - Mobile-first.
  - Desktop study mode may use two-column summary + filter rail.
- Layout adaptations:
  - Mobile: summary → filters accordion → grouped cards.
  - Tablet: summary → horizontal filter chips → grouped cards.
  - Desktop: summary/header → left filter rail → main grouped network.
- Touch/hover differences:
  - Minimum 44px touch targets.
  - Hover affordances must have focus equivalents.

## Interaction states
- Loading:
  - Prompt-to-companion waits use a separate logo-led loading page with calm progress copy.
  - Keep motion minimal and respect reduced-motion preferences.
  - Do not show partial counts as final.
- Empty:
  - State whether there are no links in the ingested datasets for this passage, or whether retrieval confidence is too low to expand.
- Error:
  - Keep primary passage visible.
  - Show source/network load failure separately.
  - Do not degrade into invented links.
- Success:
  - Show total edge count, grouped counts, and full list.
- Disabled:
  - Full-network CTA disabled only when no parseable reference exists.
- Offline/slow network:
  - Reflect summary can render first; full network loads independently.
  - Preserve direct passage links once loaded.

## Content voice
- Tone:
  - Korean: direct, pastoral but not sentimental, evidence-first.
  - English: calm, study-oriented, cautious with interpretation.
- Terminology:
  - “전체 관련 성구” means all available direct links in the ingested cross-reference sources.
  - “상호참조” for dataset-backed links.
  - “들어오는 참조” for incoming links.
  - “나가는 참조” for outgoing links.
  - “상호/합의 링크” for mutual or multi-source links.
  - “책 배경” rather than “절별 역사” unless verse-level evidence exists.
- Microcopy rules:
  - Always disclose source basis: “수집된 OpenBible 및 Bible Cross References 데이터셋 기준”.
  - Avoid “성경의 모든 가능한 관련 구절” unless the scope sentence immediately clarifies dataset coverage.
  - Prefer “이 연결은 … 때문에 제안됩니다” over “이 구절은 반드시 …를 뜻합니다”.
  - For despair or purpose prompts, acknowledge the safety/weight of the input before study framing; never answer existential distress with an empty “try another search” state unless retrieval truly fails after intent normalization.
  - For doctrine prompts, use explicit framing such as “대체로 공통으로 붙드는 내용” and “전통에 따라 해석이 갈리는 부분”.
  - Avoid “성경은 명백히 오직 …를 뜻한다” when multiple orthodox traditions materially disagree.
  - If the app can only justify common ground, say so directly and do not improvise denominational nuance.

## Implementation constraints
- Framework/styling system:
  - Next.js App Router, React 19, TypeScript, Tailwind CSS.
  - Canonical locale route tree under `/[locale]`.
- Design-token constraints:
  - Reuse existing dark/gold/glass system.
  - Do not introduce another styling framework.
- Performance constraints:
  - Do not inflate `/api/reflect` with full edge payloads by default.
  - Full graph endpoint can return complete data; UI may paginate or virtualize rendering without truncating the underlying result.
  - Runtime cross-reference lookup must avoid repeated large scans; build incoming index and normalized edge maps once per process/cache.
  - Avoid string-heavy hot paths when numeric canonical verse IDs can be generated at ingest time.
- Compatibility constraints:
  - Preserve current `getPassageCrossReferences(reference, limit, locale)` behavior until all callers migrate, then remove compatibility shims in the same cutover.
  - Existing APIs should gain summary/URL fields without breaking required current payload fields during the migration window only if unavoidable. Final target is a clean cutover.
- Test/screenshot expectations:
  - Unit coverage for graph normalization, incoming/outgoing/mutual classification, no-truncation full output, and source provenance.
  - API coverage for reflect summary vs full graph endpoint.
  - UI coverage for empty, low-confidence, large-network, and filtered states.
  - Prompt-intent middleware coverage for at least 30 Korean free-form prompts, including morphology variants such as `지쳤어`, `살아야되는지`, `살 이유`, and `버텨야`.
  - Tradition-aware doctrine mode requires a structured local doctrine-source layer; runtime model memory alone is forbidden as a source of denominational claims.
  - The API and UI must support three doctrine states: `shared_core_only`, `shared_core_plus_views`, and `tradition_requested`.
  - Tradition-difference UI should stay collapsed by default on mobile and expanded only on explicit user action or explicit tradition request.

# Exhaustive Scripture Network Design

## Problem
Current implementation surfaces ranked cross-reference suggestions, usually 4–8 items. This is useful for a quick answer but insufficient for the product promise: users must be able to inspect the complete scripture hyperlink network behind a passage.

## Decision
Build a two-tier system:

1. **Summary tier** for companion/reflection.
   - Primary passage.
   - Historical/book context.
   - Strongest cross-reference highlights.
   - Full-network counts.
   - Link to full network.
2. **Full network tier** for exhaustive study.
   - Every dataset-backed direct outgoing link.
   - Every dataset-backed incoming link via reverse index.
   - Mutual/multi-source classification.
   - Full passage hyperlinks.
   - Grouping, filters, excerpts, book context, and source provenance.

This preserves complete access without making the first generated answer unreadable.

## Definition of “all related Scriptures”
- Must include:
  - All outgoing links where any verse in the selected passage appears as a source anchor in an ingested cross-reference dataset.
  - All incoming links where any verse in the selected passage appears as a target in an ingested cross-reference dataset.
  - All merged duplicates across OpenBible and Bible Cross References KJV.
  - All relation evidence attached to the link: votes, phrase anchors, source names, anchor verses, target ranges.
  - All full-passage hyperlinks for each linked target/source.
- Must not claim:
  - Exhaustive theological relation beyond the available sources.
  - Verse-specific history when only book-level metadata is available.
  - LLM-discovered citations unless they are validated against local evidence.
- Scope label:
  - Korean: “수집된 상호참조 데이터셋 기준 전체 직접 연결”.
  - English: “All direct links available in the ingested cross-reference datasets.”

## Completeness invariants
- The full network must be complete for the selected scope before any UI filtering is applied.
- `highlights` is a ranked subset only; it must never be used as the source of truth for counts, grouping, or “all related Scriptures” copy.
- Every edge in `all` must remain addressable through a stable `id` and at least one full-passage hyperlink.
- Filtering, grouping, pagination, virtualization, and collapsed sections may reduce what is visible at one time, but they must not change the underlying `summary.totalEdges` or source coverage note.
- If a source record is normalized, collapsed, skipped, or partially unsupported, the graph must expose that as data-quality metadata instead of silently pretending the source was fully represented.
- Direction counts must use one documented convention:
  - `outgoingCount`: unique direct edges from the selected passage to another passage.
  - `incomingCount`: unique direct edges from another passage to the selected passage.
  - `mutualCount`: unique unordered passage pairs where both directions exist.
  - `totalEdges`: unique directed edges shown in `all.outgoing` plus `all.incoming`; mutual pairs are labeled but not double-counted as a third edge bucket.
  - `all.mutual`: derived view over the directed edges, not an additional source of count truth.

## Provenance and attribution requirements
- Every result must preserve dataset source, source URL where known, license, and retrieval/ingest timestamp.
- OpenBible links must be attributable to OpenBible Cross References.
- Bible Cross References KJV links must be attributable to Bible Cross References KJV and retain phrase anchors even when displayed in Korean.
- Source labels must distinguish source evidence from interpretation. Example: “KJV phrase anchor: beginning” is evidence; “creation theme” is an interpretive grouping unless separately sourced.
- Full-network pages must include a source/coverage panel explaining:
  - which datasets are included,
  - which datasets are not yet included,
  - whether the network is 1-hop direct only,
  - whether incoming links are reverse-indexed from the same source stores,
  - any known normalization loss.

## Data sources
- Existing:
  - `data/knowledge/openbible-crossrefs.json`.
    - Outgoing verse-key map.
    - Vote count per target.
    - Source: OpenBible Cross References.
  - `data/knowledge/crossreferences-kjv.json`.
    - Outgoing verse-key map.
    - Phrase anchor per target.
    - Source: Bible Cross References KJV.
  - `world_english_bible/canon_66_vpl.txt` and `korean_bible/canon_66_vpl.txt`.
    - Local passage text.
  - `lib/book-metadata.ts`.
    - Book-level author/date/place/audience metadata with confidence.
- Future compatible sources:
  - Treasury of Scripture Knowledge.
  - Sefaria links for Jewish textual linkage.
  - Curated NT use-of-OT notes.
  - Verse-level or pericope-level historical/context datasets.

## Canonical reference model

```ts
type BibleReference = {
  code: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
};
```

Add canonical numeric verse IDs at ingest/runtime index layer:

```ts
type VerseId = number;

type CanonVerse = {
  id: VerseId;
  code: string;
  chapter: number;
  verse: number;
  order: number;
};

type ReferenceSpan = {
  code: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  startId: VerseId;
  endId: VerseId;
};
```

Rules:
- `VerseId` follows canonical order from local 66-book metadata.
- Same-book, same-chapter range maps to `[startId, endId]`.
- Existing datasets that span more than current renderer can support must be normalized explicitly, not silently collapsed without recording the source loss.

### Range normalization and data-quality accounting
- Current OpenBible ingest collapses cross-book or cross-chapter ranges to the start anchor for renderer compatibility; the new graph layer must either preserve the original raw token or record `normalizationLoss`.
- Phrase references that contain comma-separated verse segments must preserve each segment as a distinct target span before merge.
- Passage-range queries must retain which selected verse(s) produced each edge. A link from `MAT 11:28-30` to another passage must be able to say whether the anchor was verse 28, 29, 30, or multiple verses.
- Self-overlap exclusion applies only to links that overlap the selected passage itself. Same chapter links outside the selected range remain valid.
- Invalid, unsupported, or skipped source references must be counted in an index-level `dataQuality` object:

```ts
type CrossReferenceDataQuality = {
  skippedSourceRows: number;
  unsupportedRanges: number;
  collapsedRanges: number;
  missingCanonVerses: number;
  notes: string[];
};
```

The full network response should expose aggregate data-quality notes when they affect the selected passage or source dataset.

## Edge model

```ts
type CrossReferenceSource =
  | "openbible"
  | "crossreferences-kjv"
  | "tsk"
  | "sefaria"
  | "curated";

type CrossReferenceRelationType =
  | "consensus-link"
  | "vote-supported"
  | "phrase-anchor"
  | "incoming"
  | "outgoing"
  | "mutual";

type CrossReferenceDirection = "outgoing" | "incoming" | "mutual";

type CrossReferenceEdgeEvidence = {
  source: CrossReferenceSource;
  sourceName: string;
  sourceUrl?: string;
  license?: string;
  votes?: number;
  anchorPhrases: string[];
  anchorVerses: ReferenceSpan[];
};

type CrossReferenceEdge = {
  id: string;
  from: ReferenceSpan;
  to: ReferenceSpan;
  direction: CrossReferenceDirection;
  relationTypes: CrossReferenceRelationType[];
  evidence: CrossReferenceEdgeEvidence[];
  score: number;
  sourceCount: number;
  totalVotes: number;
  anchorPhrases: string[];
  displayReference: string;
  excerpt: string;
  href: string;
};
```

Edge identity:

```text
from.code/from.chapter/from.startVerse-from.endVerse -> to.code/to.chapter/to.startVerse-to.endVerse
```

Merge rules:
- Same normalized `from` + `to` merges evidence arrays.
- OpenBible votes sum per merged edge.
- KJV phrase anchors dedupe by phrase text.
- If both datasets support the same `from → to`, relation includes `consensus-link`.
- If reverse `to → from` also exists, direction becomes `mutual` for the paired network view.

## Graph result contract

```ts
type CrossReferenceNetworkSummary = {
  reference: BibleReference;
  totalEdges: number;
  outgoingCount: number;
  incomingCount: number;
  mutualCount: number;
  consensusCount: number;
  voteSupportedCount: number;
  phraseAnchorCount: number;
  booksTouched: Array<{ code: string; name: string; count: number }>;
  canonSectionsTouched: Array<{ section: string; count: number }>;
  strongestSources: Array<{ source: CrossReferenceSource; count: number }>;
  strongestBooks: Array<{ code: string; name: string; count: number; maxScore: number }>;
  scopeLabel: string;
  coverageNote: string;
};

type CrossReferenceNetwork = {
  primary: PassagePayload;
  summary: CrossReferenceNetworkSummary;
  highlights: CrossReferenceEdge[];
  all: {
    outgoing: CrossReferenceEdge[];
    incoming: CrossReferenceEdge[];
    mutual: CrossReferenceEdge[];
  };
  grouped: {
    byBook: CrossReferenceBookGroup[];
    byCanonSection: CrossReferenceCanonSectionGroup[];
    byRelation: CrossReferenceRelationGroup[];
    bySource: CrossReferenceSourceGroup[];
  };
  background: {
    primaryBook: BookMetadata | null;
    relatedBooks: Array<{ code: string; name: string; metadata: BookMetadata | null; edgeCount: number }>;
  };
  dataQuality: CrossReferenceDataQuality;
  sources: SourceLink[];
  version: {
    generatedAt: string;
    sourceVersions: Array<{ source: CrossReferenceSource; retrievedAt?: string; license?: string }>;
  };
};
```

### Public JSON DTOs
These DTOs are the serialized API boundary. Implementation types may be richer internally, but public responses must remain stable.

```ts
type PassageVersePayload = {
  code: string;
  chapter: number;
  verse: number;
  text: string;
};

type PassagePayload = {
  reference: string;
  referenceSpan: BibleReference;
  book: { code: string; name: string; testament?: string } | null;
  verses: PassageVersePayload[];
  href: string;
};

type CrossReferenceBookGroup = {
  code: string;
  name: string;
  count: number;
  edges: CrossReferenceEdge[];
  background: CrossReferenceReceptionLayers | null;
};

type CrossReferenceCanonSectionGroup = {
  section: string;
  count: number;
  edges: CrossReferenceEdge[];
};

type CrossReferenceRelationGroup = {
  relationType: CrossReferenceRelationType;
  label: string;
  count: number;
  edges: CrossReferenceEdge[];
};

type CrossReferenceSourceGroup = {
  source: CrossReferenceSource;
  sourceName: string;
  count: number;
  edges: CrossReferenceEdge[];
};
```

Grouped DTOs may omit `edges` only when `summaryOnly=1`.

## Runtime API design

### `GET /[locale]/api/crossrefs/[reference]`
Purpose: return complete dataset-backed direct cross-reference network for one passage.

Request:

```text
GET /ko/api/crossrefs/MAT-11-28-30
```

Query parameters:
- `direction=all|outgoing|incoming|mutual` — default `all`.
- `group=book|canon|relation|source|none` — default `book`.
- `includeExcerpts=preview|none|full` — default `preview`; `preview` returns bounded excerpts for every edge, `full` returns full selected target/source passage text where available, `none` keeps references and evidence only.
- `includeBackground=1|0` — default `1`.
- `highlightLimit=4..12` — default `8`; affects highlights only, never `all`.
- `summaryOnly=1|0` — default `0`; allows lightweight count checks without excerpts.
- `format=json` — reserved for future export formats; initial endpoint returns JSON only.

Response rules:
- Full response returns complete `all` arrays.
- `summaryOnly=1` may omit `all`, `grouped`, and excerpts, but must still report exact counts and source coverage.
- Client-side pagination or virtualization may be used by the page, but the API contract must make the full unfiltered result available.
- Query-string filter state on the page must be shareable; opening a copied URL must restore direction/book/relation/source filters.

Behavior:
- Parse reference with the same slug parser as passage pages.
- Load full graph from cache/index.
- Return all matching direct edges in `all`.
- Return ranked `highlights` separately.
- Return book/background metadata for every touched book where available.
- Never truncate `all` because of `highlightLimit`.

### `POST /[locale]/api/reflect`
Purpose: remain fast and readable while exposing full-network access.

Add fields:

```ts
crossReferenceSummary: CrossReferenceNetworkSummary | null;
crossReferenceHighlights: CrossReferenceEdge[];
crossReferenceNetworkUrl: string | null;
```

Rules:
- If retrieval is reliable, build graph summary and highlights from primary reference.
- If retrieval is low confidence, keep expansion paused and set network URL only if a direct passage is explicitly selected.
- Do not include `all` in reflect response.
- Existing `graphSuggestions` should be replaced by or mapped from `crossReferenceHighlights` in a clean cutover.

### `/[locale]/crossrefs/[reference]`
Purpose: user-facing complete network reader.

Sections:
1. Header: selected passage, total links, scope label.
2. Primary passage excerpt and “read full passage”.
3. Network summary cards: outgoing, incoming, mutual, consensus, books touched.
4. Filters.
5. Grouped complete list.
6. Book/background panel.
7. Source and coverage note.

## Graph construction algorithm

### Build indexes
On first request or static build step:

```text
load OpenBible store
load Phrase store
load canon verse order
normalize every from/to reference into spans
build outgoingByVerseId: Map<VerseId, EdgeSeed[]>
build incomingByVerseId: Map<VerseId, EdgeSeed[]>
build edgeByPair: Map<EdgePairKey, MergedEdgeSeed>
cache result by process
```

### Query graph
For selected reference:

```text
selectedIds = every VerseId in selected span
outgoingSeeds = union outgoingByVerseId[id]
incomingSeeds = union incomingByVerseId[id]
merge duplicates
remove self-overlapping links only when from/to overlap the selected exact passage
classify reverse-pair links as mutual
hydrate excerpts and display refs
score
sort
build summary and groups
```

### Scoring
Score is for ordering only, not inclusion.

```text
score = totalVotes
      + phraseAnchorCount * 12
      + sourceCount * 25
      + mutualBonus * 20
      + samePericopeAnchorBonus * 5
```

Rules:
- No edge is dropped because score is low.
- Sort stable by `score desc`, then canonical target order.
- Highlight list uses top score.
- Full list keeps all edges.

### Cache, versioning, and failure modes
- Build graph indexes once per process or static artifact; do not rescan raw JSON for every request.
- Cache keys must include source data version/retrievedAt and locale where labels/excerpts differ.
- If one source store is missing and another is available, return a degraded network with `dataQuality.notes` and source coverage disclosure instead of failing the whole page.
- If local passage text is missing for an edge target, keep the reference link and source evidence, but mark excerpt unavailable.
- If the selected reference is invalid, return 404 for pages and a structured `invalid-reference` error for APIs.
- If the selected reference is valid but has no dataset links, return success with zero counts, primary passage, background, and explicit empty state.

## History/background design

### Current evidence-supported levels
- Book-level:
  - author/authorship.
  - date/range.
  - place/geographic frame.
  - audience.
  - genre/category.
  - Jewish reception / early reception.
  - Jesus layer.
  - Paul/apostolic layer.
- Passage-level:
  - selected passage text.
  - surrounding chapter context via local Bible text.
  - cross-reference relation evidence.

### Not currently evidence-supported
- Verse-specific archaeological background.
- Pericope-specific historical critical notes for every passage.
- Original-language lexical claims.
- Full reception history per linked verse.

### UI language
- Use “책 배경” for book metadata.
- Use “본문 주변 문맥” for nearby verses.
- Use “연결 근거” for cross-reference evidence.
- Use “역사/배경 메모” only when notes are book-level or source-backed.
- Do not claim “이 절의 역사적 배경” unless a verse/pericope-level source is added.

### Context evidence roadmap
- Current release uses book-level metadata and surrounding passage text.
- Next evidence layer should add pericope-level historical/context notes before claiming detailed history for every linked passage.
- Any future pericope/verse-level notes must carry:
  - source label and URL or local source identifier,
  - confidence,
  - applicable reference span,
  - locale availability,
  - whether the note is historical, literary, reception-history, geography, or original-language evidence.
- Explanation builders may summarize only the context level actually present for a linked passage.

### Background payload

```ts
type CrossReferenceReceptionLayers = {
  originalContext: {
    metadata: BookMetadata | null;
    surroundingContext: PassagePayload;
  };
  reception: {
    jewishReception?: ContextNote;
    jesusLayer?: ContextNote;
    paulLayer?: ContextNote;
  };
};

type CrossReferenceBackground = {
  primaryBook: CrossReferenceReceptionLayers;
  relatedBooks: Array<{
    code: string;
    name: string;
    edgeCount: number;
    context: CrossReferenceReceptionLayers;
  }>;
  coverageNote: string;
};
```

## Explanation generation design

### Evidence contract changes
Hermes/deterministic explanation receives:

```ts
type CrossReferenceExplanationEvidence = {
  prompt: string;
  safety: SafetyAssessment;
  retrieval: RetrievalResult;
  primaryEvidenceId: string;
  crossReferenceHighlights: Array<CrossReferenceEdge & { evidenceId: string }>;
  crossReferenceSummary: CrossReferenceNetworkSummary;
  background: CrossReferenceBackground;
  allowedEvidenceIds: string[];
};
```

Hermes/deterministic explanation does **not** receive every edge by default.

Rationale:
- Full edge list can be hundreds of entries.
- LLM context should not be the source of truth for complete data display.
- Deterministic API/page owns completeness.

### Evidence IDs and citation validation
- Every passage, cross-reference edge, and background note admitted into the explanation contract must receive a stable evidence ID.
- Generated output may cite only evidence IDs supplied in `allowedEvidenceIds`.
- Server-side validation must reject or fall back from generated output that contains:
  - a Bible reference absent from the evidence bundle,
  - an evidence ID not in `allowedEvidenceIds`,
  - a quotation not present in the local passage excerpt,
  - a history/background claim not tied to a supplied context note.
- Deterministic fallback must remain the safe path when validation fails.
- Safety assessment remains part of the contract; caution/crisis prompts must keep immediate human help ahead of cross-reference exploration.

### Explanation output rules
- Explain:
  - Why the primary passage was selected.
  - What the strongest links show.
  - How the full network is distributed.
  - What book/background notes should constrain interpretation.
- Must include:
  - A sentence pointing to the complete network page/API.
  - Total link count from summary.
- Must not:
  - Invent missing links.
  - Summarize unprovided edge details as if read.
  - Claim a theological conclusion solely because many links exist.

## UI design: companion page

Current companion shows primary passage, tabs, notes, and top crossrefs. Target companion:

1. Header/result summary.
2. Primary passage card.
3. Cross-reference summary strip:
   - “전체 직접 연결 N개”.
   - Outgoing count.
   - Incoming count.
   - Mutual/consensus count.
   - Books touched count.
4. Highlight cards:
   - 4–8 strongest links.
   - Each card includes relation badges and source line.
5. CTA:
   - Korean: “전체 관련 성구 네트워크 보기”.
   - English: “Open full Scripture network”.
6. Notes tab:
   - primary book metadata.
   - strongest related book metadata summaries.
7. Explore tab:
   - full-network CTA above related lanes.

## UI design: full cross-reference page

### Header
- Selected reference and book name.
- Scope label.
- Total count.
- “Read primary passage” link.

### Summary cards
- Total direct links.
- Outgoing links.
- Incoming links.
- Mutual links.
- Consensus links.
- Books touched.

### Filters
- Direction.
- Relation type.
- Source.
- Book.
- Canon section.
- Phrase anchor search.
- Minimum votes.

### Complete list
Each row/card shows:
- Target/source passage reference.
- Direction badge.
- Relation badges.
- Excerpt.
- Why connected:
  - OpenBible votes.
  - KJV phrase anchors.
  - Source names.
  - Anchor verse(s).
- Links:
  - full passage.
  - open in graph/study if available.

### Background panel
- Primary book profile.
- Related books sorted by edge count.
- Confidence badges.
- Coverage note.

### Empty state
- “이 본문에 대해 수집된 상호참조 데이터셋에서 직접 연결을 찾지 못했습니다.”
- Still show primary passage and book background.

### Scale, filtering, and shareability
- Large networks must default to grouped presentation rather than a single long undifferentiated list.
- Filters must update URL query state so a teacher can share “incoming links from Isaiah” or “phrase-anchor links only”.
- The page must keep the unfiltered total visible while filters are active.
- Each group header must show visible count and total count.
- Add “copy references” and “copy page link” actions after the first full-network release; copying must preserve references and source labels, not generated interpretation.
- Export/download is optional, but if added it must export deterministic graph data, not LLM prose.

## UI design: graph page

Current graph page is lane-level and top-N. Target behavior:
- Keep lane graph as a guided map.
- Add passage-level full network CTA for the lane primary reference.
- Cross References tab should show highlights plus “full network” link.
- If a visual graph is added later, it must be secondary to the accessible list.

## UI design: passage page

Target behavior:
- Show surrounding context as now.
- Replace top-N-only crossrefs with:
  - summary count.
  - highlight list.
  - full-network CTA.
- Related lane cards remain secondary.

## Localization and translation caveats
- Graph topology must be locale-independent; only labels, book names, excerpts, and explanatory copy localize.
- KJV phrase anchors are English source evidence. Korean UI may display them as source anchors, but must not imply they are Korean lexical anchors unless a Korean phrase dataset is added.
- Korean and English Bible excerpts may differ in wording; cross-reference identity is based on canonical references, not exact translated words.
- If a relation depends on an English phrase anchor, Korean copy should say “KJV 구문 앵커” and keep the phrase visible.
- Locale tests must verify same graph counts for `/ko` and `/en`.

## Security, abuse, and payload constraints
- Public APIs must not expose provider topology, secrets, filesystem paths, or raw server errors.
- Full graph payloads can be large; enforce bounded reference spans for user-supplied route parameters before graph expansion.
- Reject or cap pathologically large chapter/book-range requests until the product explicitly supports book-level network browsing.
- Do not allow filter query parameters to trigger arbitrary file reads, regex execution over raw source files, or unbounded server work.
- Keep all generated interpretation downstream from deterministic graph and metadata evidence.

## Data migration plan

### Phase 0 — Lossless source refresh
- Update ingest output or add sidecar source maps so raw `from`/`to` tokens survive normalization.
- Record collapsed cross-book/cross-chapter ranges, skipped rows, unsupported references, and source retrieval metadata.
- Regenerate OpenBible and phrase stores before building the full network endpoint.

### Phase 1 — Pure graph library
- Add `lib/crossref-graph.ts`.
- Build normalized outgoing/incoming indexes from refreshed stores that preserve raw references and data-quality metadata.
- Add unit tests for known anchors, known collapsed ranges, and source metadata.

### Phase 2 — Full endpoint
- Add `/[locale]/api/crossrefs/[reference]`.
- Return complete graph contract.
- Verify no truncation.

### Phase 3 — UI page
- Add `/[locale]/crossrefs/[reference]`.
- Build summary, filters, grouped complete list, and background panel.

### Phase 4 — Reflect integration
- Replace `graphSuggestions` with highlight/summary contract or map temporarily.
- Add `crossReferenceNetworkUrl`.
- Update companion/study/graph/passage CTAs.

### Phase 5 — Clean cutover
- Remove obsolete top-N-only assumptions.
- Keep one graph source of truth.
- Update docs and QA.

### Phase 6 — Source/version hardening
- Add source version metadata and graph data-quality reporting.
- Add degraded-source behavior for missing OpenBible or phrase stores.
- Add localized source/coverage copy for Korean and English.
- Document source licenses in the full-network source panel.

### Phase 7 — Higher-resolution background
- Add pericope-level historical/context evidence only after a sourced local dataset exists.
- Update the evidence contract and UI labels to distinguish book, pericope, verse, and reception-history note levels.

## QA design

### Unit tests
- `GEN 1:1` outgoing count matches source stores after merge rules.
- Incoming links are present for a known target.
- Mutual classification works when both directions exist.
- `highlightLimit` changes highlights only, not full `all` counts.
- Same-passage overlap is excluded.
- Phrase anchors dedupe.
- OpenBible votes sum.
- Source provenance survives merge.
- Data-quality counts surface collapsed ranges and skipped/unsupported source records.
- Source version/license metadata survives graph construction.

### API tests
- Full API returns `summary.totalEdges === outgoingCount + incomingCount`; `mutualCount` is a derived overlap count and must not inflate `totalEdges`.
- Full API returns more than highlight limit for known high-degree anchors.
- Reflect API returns summary and URL, not full edge payload.
- Low-confidence prompt does not expand from a weak primary passage.
- Locale affects labels/display references, not graph counts.
- `summaryOnly=1` returns exact counts without full edge payload.
- Invalid references return structured errors without server internals.
- Missing one source store returns degraded success with source coverage disclosure.
- Public response DTOs match the documented `PassagePayload`, group DTO, version, and `dataQuality` shapes.
- `includeExcerpts=preview|none|full` changes excerpt payload size only; it does not change edge counts or edge identity.
- Explanation generation rejects or falls back when generated citations/reference strings are absent from supplied evidence IDs.
- Safety/caution/crisis prompts preserve `SafetyAssessment` priority after cross-reference contract changes.

### UI tests
- Full-network page renders total count and complete grouped list.
- Filters reduce visible rows without changing total source count display.
- Empty state is explicit.
- Mobile layout keeps filters reachable.
- Every edge has a full passage link.
- Active filters are reflected in the URL and restored on reload.
- Filtered views preserve unfiltered total count.
- Copy-link/copy-reference actions preserve deterministic references and source labels.
- Background panels render confidence labels for authorship, date, place, audience, and reception/context notes.

### Content tests
- No generated response contains citations absent from evidence.
- Historical/background text uses book-level language unless a verse-level source is present.
- Coverage note appears on full network page.
- Korean UI distinguishes KJV English phrase anchors from Korean lexical anchors.
- Coverage copy states “dataset-backed direct links,” not “every possible theological relation.”
- Disputed authorship/date/place notes remain tentative in generated and deterministic explanations.
- Crisis/caution copy is not displaced by “full network” exploration CTAs.

## Acceptance criteria
- For any selected passage with dataset links, user can open a page that lists every direct outgoing and incoming link available from ingested sources.
- No full-network result is truncated by UI highlight limits.
- Every listed related passage has a hyperlink to its full passage.
- Every listed related passage has source provenance and a relation reason.
- The companion summary exposes total network counts and a full-network CTA.
- Historical/background information is shown for primary and related books where available, with confidence labels.
- Generated explanation stays evidence-locked and does not invent extra citations.
- QA proves count preservation, incoming support, highlight/full separation, citation validation, visible confidence labels, safety preservation, and background-scope wording.

## Doctrine diversity design

### Problem
The current companion architecture is optimized for a single evidence bundle per question. That works for many Bible and theology prompts, but it is not sufficient for doctrine questions where orthodox Christian traditions share some claims while diverging on interpretation, emphasis, sacramental meaning, or application.

### Decision
Treat doctrine answers as a two-layer response:
1. `shared core` — what the app can say from broadly shared biblical evidence.
2. `tradition views` — where major Christian traditions diverge, each labeled and source-backed.

The app must never pretend that all doctrine questions have one universal downstream interpretation. It also must never invent denominational nuance when only shared biblical ground is available.

### Doctrine prompt classes
- **Shared-core doctrine**: broad questions where the common core is strong and divergence is secondary.
  - Examples: “예수님이 누구야?”, “예수님은 하나님이야?”, “예수님이 왜 죽으셨어?”
- **Tradition-divergent doctrine**: the biblical center is shared, but interpretation/application differs enough that one answer is misleading.
  - Examples: baptism, Lord's Supper/Eucharist, salvation security, predestination/free will, spiritual gifts, church governance, end-times sequencing.
- **Tradition-requested doctrine**: the user explicitly asks for one tradition's view.
  - Examples: “개혁주의에서는 세례를 어떻게 봐?”, “What is the Catholic view of the Eucharist?”

### Response contract
```ts
type TraditionKey =
  | "catholic"
  | "orthodox"
  | "reformed"
  | "lutheran"
  | "baptist_evangelical"
  | "wesleyan_arminian"
  | "pentecostal_charismatic";

type DoctrineDisplayMode =
  | "shared_core_only"
  | "shared_core_plus_views"
  | "tradition_requested";

type SharedCoreBlock = {
  summary: string;
  evidenceRefs: BibleReference[];
  confidence: "high" | "medium" | "low";
  limits?: string;
};

type TraditionViewBlock = {
  tradition: TraditionKey;
  label: string;
  summary: string;
  emphasis: string;
  evidenceRefs: BibleReference[];
  doctrineSourceRefs: string[];
  confidence: "high" | "medium" | "low";
  limits?: string;
};

type DoctrinePresentation = {
  topic: string;
  divergence: "low" | "medium" | "high";
  mode: DoctrineDisplayMode;
  sharedCore: SharedCoreBlock;
  views: TraditionViewBlock[];
  requestedTradition?: TraditionKey;
};
```

### Source policy
- Scripture passages may justify the `shared core`.
- Tradition-specific claims require explicit local doctrine sources such as creeds, confessions, catechisms, conciliar definitions, or official denominational statements.
- A tradition card without `doctrineSourceRefs` is invalid.
- The app may summarize a tradition's emphasis; it may not adjudicate which tradition is correct unless the product explicitly changes its scope.

### UX contract
- Companion answer order for doctrine prompts:
  1. Shared core summary
  2. Primary passages
  3. “Where traditions differ” section
  4. Tradition cards
  5. Why the difference exists
  6. Limits / what this answer does not settle
- Default behavior:
  - `shared_core_only` when divergence is low or local tradition sources are absent.
  - `shared_core_plus_views` when divergence is medium/high and sources exist.
  - `tradition_requested` when the prompt explicitly names a tradition.
- Mobile:
  - Tradition cards collapsed under an accordion by default.
- Desktop:
  - Shared core left; tradition cards right or below, depending on density.

### Initial rollout scope
- First doctrine-diversity slice should cover only prompts with high user risk from false consensus:
  - baptism
  - Lord's Supper / Eucharist
  - salvation security
  - predestination / free will
  - Spirit baptism / tongues / gifts
- Prompts like Christ's deity or the Trinity may remain `shared_core_only` until local tradition-source ingestion exists, because the common core is usually strong enough for a first answer.

### QA gates
- A shared-core doctrine prompt must not show fake disagreement cards.
- A divergent doctrine prompt must not collapse into one unqualified answer when local tradition sources exist.
- A tradition-requested prompt must foreground the requested tradition without hiding the common core.
- Every tradition card must expose both Bible references and doctrine-source references.
- If local tradition data is missing, the UI must say that the app is summarizing common ground only.

### Work order outline
- Add doctrine-topic classifier and divergence score to question understanding.
- Ingest local doctrine-source corpus by tradition.
- Extend answer bundle / reflection contract with `DoctrinePresentation`.
- Add doctrine-difference UI section on companion and API payload.
- Add QA fixtures for shared-core, divergent, and tradition-requested doctrine prompts.

## Open questions
- [ ] Should “full network” include 2-hop expansion as an optional mode, or only 1-hop direct links? Owner: product. Impact: network size and interpretive noise.
- [ ] Should the API support full verse-text export beyond the default bounded `preview` excerpts? Owner: engineering. Impact: payload size and export UX.
- [ ] Should future TSK/Sefaria data be merged into the same relation labels or kept visibly separate by tradition/source? Owner: product/theology. Impact: trust and interpretive framing.
- [ ] Is a visual node graph required, or is grouped list/table sufficient for the first complete-network release? Owner: design/product. Impact: implementation cost and accessibility.
