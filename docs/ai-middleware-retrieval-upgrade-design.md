# AI Middleware Retrieval Upgrade Design

## Status
- Status: Draft for implementation
- Last refreshed: 2026-06-19
- Scope: Upgrade open-ended Bible QA retrieval so AI interpretation becomes a first-class low-cost middleware input without requiring manual question-to-verse mappings.
- Builds on: `docs/open-ended-bible-qa-architecture.md`
- Primary code surfaces: `app/[locale]/api/reflect/route.ts`, `lib/rag-query.ts`, `lib/retrieval.ts`, `lib/answer-bundle.ts`, `lib/hybrid-retrieval.ts`, `lib/question-understanding.ts`, `scripts/build-passage-index.mjs`, `data/passage-index/*.json`

## Problem

Users can phrase spiritual, philosophical, doctrinal, pastoral, and existential questions in unbounded ways. The system must not require engineers to predict each wording and map it by hand.

The current architecture has two competing truths:

1. The product expectation is an AI-mediated interpreter:
   ```text
   user prompt → AI understands the question → retrieval finds grounded Bible passages → answer explains only retrieved evidence
   ```
2. The current runtime still has too much deterministic routing:
   ```text
   user prompt → regex/topic rules/manual priors → small passage index → lexical fallback → evidence-locked answer
   ```

The upgrade target is not “let AI answer directly.” The target is:

```text
AI interprets the question into bounded retrieval inputs; deterministic retrieval still chooses and validates Bible evidence.
```

## Product definition

This product is not merely a Bible search engine.

The user enters a question, concern, philosophical problem, faith struggle, or theological issue. The system should:

1. understand what the user is really asking,
2. connect that concern to fitting Bible passages,
3. explain the historical/literary setting of those passages,
4. tell the passage as a story rather than as a detached proof text,
5. show exactly where the user's question meets the passage,
6. offer life guidance that stays inside the passage's evidence and application boundary.

The intended experience is:

```text
my question / concern / philosophy / faith struggle
→ interpreted into biblical themes and human concerns
→ connected to grounded passages
→ explained with ancient context and canonical storyline
→ bridged back to my actual situation
→ turned into cautious, evidence-based life guidance
```

Therefore the system needs both:

- **AI help** for interpreting open-ended user language and narrating evidence naturally.
- **Web/source help** for historical, literary, lexical, and theological background that is not fully present in the local Bible text.

But neither AI nor web snippets may become unchecked authority. They must be source-locked, cached, attributed, and validated before they influence final answers.


## Current evidence and structural limits

### What already works

- `app/[locale]/api/reflect/route.ts` already has a RAG query planning stage before retrieval.
- `lib/rag-query.ts` can call Hermes/OpenAI-compatible chat completion or Hermes agent oneshot and asks it for `intentSummary` + `searchTerms` only.
- `lib/hermes.ts` and `lib/hermes-contract.ts` already enforce evidence-locked final generation. Unsupported references, unsupported evidence IDs, unsupported quotes, and unsupported source-bound background claims are rejected.
- `lib/answer-bundle.ts` can assemble primary/supporting passage candidates and relation maps.
- `lib/hybrid-retrieval.ts` searches passage-index text, search queries, concern axes, theological axes, summaries, keywords, and indexed metadata.

### Current structural limits

1. **AI planner output is still too shallow.**
   - Current `RagQueryPlan` carries only `expansionTerms`, `expansionSummary`, provider/model/note.
   - It does not carry a full planned `QuestionUnderstanding`, axes, answer policy, or confidence.

2. **The passage index is not Bible-wide.**
   - `data/passage-index/ko.json` and `en.json` currently contain 28 curated seed units.
   - That is enough for smoke/QA fixtures, not enough for unbounded user questions.

3. **Manual maps still dominate some good results.**
   - `lib/question-understanding.ts` topic rules.
   - `lib/rag-query.ts` deterministic intent profiles.
   - `lib/retrieval.ts` philosophical priors and doctrinal routing rules.
   - These are useful migration scaffolds, but cannot be the product architecture.

4. **Runtime AI cannot process the whole Bible per request.**
   - Per-request “ask AI to search all Scripture” would be slow, expensive, and citation-risky.
   - Runtime AI must only produce a compact query plan over the user prompt.

5. **Evidence lock means AI cannot repair weak retrieval after the fact.**
   - Final generation can only use retrieved evidence.
   - If retrieval misses, the final answer must either be low-confidence or wrong. Therefore the retrieval input and index must improve upstream.

6. **Canonical/cross-reference scores must not create candidates by themselves.**
   - Cross-reference degree and canonical weight may boost already-relevant candidates.
   - They must not make a passage relevant when lexical/semantic/axis match is zero.

## Design principles

1. **AI plans; retrieval proves.**
   - AI may summarize intent and generate search terms/axes.
   - AI must not choose, cite, or invent Bible references.

2. **Fast path before paid path.**
   - If deterministic understanding is confident, use it.
   - If deterministic understanding is weak or generic, call the bounded AI planner when configured.
   - `HERMES_RAG_QUERY=0` must force no-AI operation.

3. **Offline work beats runtime cost.**
   - Build a richer full-Bible passage index offline.
   - Runtime uses local index search, not full-corpus LLM reasoning.

4. **Manual rules become safety rails, not the engine.**
   - Keep explicit rules for safety, off-topic detection, and well-known doctrinal divergences.
   - Stop adding prompt-by-prompt mapping rules as the primary fix path.

5. **No evidence, no confident citation.**
   - If index search cannot produce direct/supporting evidence, return low-confidence guidance or clarification.

## Target architecture

```text
POST /[locale]/api/reflect
  → safety/off-topic precheck
  → buildRetrievalQueryPlan(prompt, locale)
      → deterministic base QuestionUnderstanding
      → optional bounded AI planner for weak/generic cases
      → sanitized query plan
  → retrieveClusterForPrompt(prompt, locale, { queryPlan })
      → hard safety/external limits remain upstream
      → answer bundle retrieval using planned question/search queries/axes
      → fallback full-corpus lexical/embedding retrieval using same plan
  → evidence bundle / low-confidence result
  → evidence-locked deterministic or Hermes final generation
```

## Target contracts

### `RetrievalQueryPlan`

Replace expansion-only planning with a first-class retrieval contract.

```ts
export type RetrievalQueryPlan = {
  question: QuestionUnderstanding;
  expansionTerms: string[];
  expansionSummary: string | null;
  searchQueries: string[];
  concernAxes: string[];
  theologicalAxes: string[];
  plannerConfidence: "high" | "medium" | "low";
  expansionProvider: "deterministic" | "hermes" | "hermes-agent" | "hermes-fallback";
  expansionModel: string;
  expansionNote: string;
  droppedReferenceHints: string[];
};
```

Rules:

- `question` is the single source of retrieval intent after planning.
- AI output may enrich `searchQueries`, `concernAxes`, and `theologicalAxes`.
- AI output may not downgrade safety/external/off-topic policy.
- Ref-shaped AI output, e.g. `JOH 3:16`, is dropped and recorded in `droppedReferenceHints`.
- Term counts and lengths are clamped.

### AI planner JSON shape

Runtime AI response must remain compact.

```json
{
  "intentSummary": "short plain-language interpretation",
  "searchTerms": ["Bible-like terms likely to occur in passages"],
  "searchQueries": ["short query phrases"],
  "concernAxes": ["human concern axes"],
  "theologicalAxes": ["biblical/doctrinal axes"],
  "intent": "optional known enum",
  "answerMode": "optional known enum",
  "confidence": "optional high|medium|low"
}
```

Sanitization:

- Unknown enum values are ignored.
- Reference-shaped strings are rejected.
- Terms longer than 40 chars are rejected.
- Arrays are capped.
- Empty AI plans fall back to deterministic plan.

## Passage index upgrade

### Current index role

The current 28-unit seed index should be treated as a curated nucleus, not the final corpus.

### Target index role

Generate a Bible-wide passage-unit index offline.

```text
local Bible corpus
  → passage segmentation
  → deterministic metadata extraction
  → optional offline AI metadata enrichment
  → cross-reference enrichment
  → optional embeddings
  → versioned data/passage-index/{locale}.json or SQLite
```

### Passage segmentation

- Poetry/proverbs: 1–4 verse units.
- Narrative/discourse/epistles: 3–10 verse units.
- Never cross book boundaries.
- Avoid crossing chapter boundaries unless a known pericope requires it.
- Preserve exact `BibleReference` span.
- Include overlap only when needed to prevent context loss.

### Metadata fields

Each `BiblePassageUnit` should include:

```ts
{
  id,
  reference,
  locale,
  text,
  normalizedText,
  summary,
  themes,
  doctrines,
  humanConcerns,
  questionsAnswered,
  entities,
  keywords,
  canonicalWeight,
  crossReferenceDegree,
  crossReferences,
  provenance,
  indexVersion,
  embedding?
}
```

### Metadata generation policy

- Deterministic metadata first:
  - book metadata,
  - headings/pericope boundaries if available,
  - known entities,
  - repeated lexical/theological terms,
  - cross-reference graph.
- Offline AI metadata allowed:
  - only during index build,
  - cached into the index,
  - versioned by model/prompt/hash,
  - never required in synchronous request path.
- Runtime AI metadata generation is disallowed.

## Web/source background enrichment

The storytelling requirement needs more than verse text. The system needs reliable background packs for books, passages, places, people, genre, and theological themes.

### Source tiers

Use source tiers so the answer can distinguish primary text, curated data, and external study aids.

| Tier | Source type | Runtime use | Notes |
|---|---|---|---|
| 1 | Local Bible text, passage index, cross-reference datasets | Always allowed | Primary evidence for citations and passage claims. |
| 2 | Repo-curated metadata: `lib/book-metadata.ts`, doctrine source index, generated passage metadata | Allowed when present | Must carry provenance and confidence. |
| 3 | Allowed external datasets/pages fetched offline or cached | Allowed after ingestion | Examples: STEPBible data, BibleProject book/theme pages, public-domain dictionaries/commentaries where license permits. |
| 4 | Live web search results | Not directly answerable evidence | May propose sources for ingestion, but must not be quoted into final user answers unless fetched, cached, attributed, and validated. |
| 5 | AI model knowledge | Never evidence by itself | May summarize provided sources; cannot invent background claims. |

### Background pack

Add a source-backed background object for each book/passage/theme.

```ts
export type BackgroundSource = {
  id: string;
  title: string;
  url?: string;
  license?: string;
  retrievedAt: string;
  sourceTier: 1 | 2 | 3;
};

export type PassageBackgroundPack = {
  reference: BibleReference;
  book: {
    title: string;
    genre: string;
    authorship: ContextNote;
    date: ContextNote;
    place: ContextNote;
    audience: ContextNote;
  };
  passageContext: {
    literaryUnit: string;
    beforeAfter: string;
    argumentFlow?: string;
    narrativeSetting?: string;
    genreCaution?: string;
  };
  historicalContext: {
    period?: string;
    location?: string;
    peopleGroups?: string[];
    institutions?: string[];
    confidence: "high" | "medium" | "disputed";
  };
  lexicalContext: Array<{
    term: string;
    originalLanguage?: "hebrew" | "greek" | "aramaic";
    gloss: string;
    whyItMatters: string;
    sourceIds: string[];
  }>;
  themeContext: Array<{
    theme: string;
    storyline: string;
    canonicalLinks: BibleReference[];
    sourceIds: string[];
  }>;
  sources: BackgroundSource[];
  generatedBy?: {
    model: string;
    promptHash: string;
    generatedAt: string;
  };
};
```

### Ingestion policy

Background enrichment should be primarily offline/cache-first.

1. Fetch from allowed sources or local datasets.
2. Store raw source snapshots or normalized excerpts with license/provenance.
3. Let AI summarize only the fetched source material into structured background packs.
4. Validate that every generated background claim points to a `sourceId`.
5. Store the generated pack with model/prompt/version hashes.
6. Runtime answer generation may use only stored packs, not uncached live web snippets.

Runtime live web search can be a maintenance/admin action:

- discover candidate sources,
- refresh stale packs,
- flag missing background,
- compare multiple external references.

It should not be the default user request path because it is slow, nondeterministic, and citation-risky.

### Candidate external sources

Initial allowed-source candidates:

- STEPBible Data: open, CC BY 4.0 datasets for lexical, tagged Bible, proper noun, morphology, and related study data.
- BibleProject public book/theme/video pages: useful for narrative summaries and theme-level storytelling, subject to attribution/licensing constraints.
- Existing repo data: `world_english_bible`, `korean_bible`, cross-reference datasets, `lib/book-metadata.ts`, `data/doctrine-sources`.

Any new external source must be added with:

- URL,
- license/terms status,
- source tier,
- fields allowed to extract,
- whether it can be quoted, summarized, or only linked.

### AI role in background enrichment

AI may:

- summarize fetched source excerpts into `PassageBackgroundPack`,
- map source material to user-friendly Korean storytelling,
- identify uncertainty and disputed views,
- propose missing source fields for human/admin review.

AI may not:

- invent historical claims from memory,
- quote a source not stored in the pack,
- collapse disputed authorship/date questions into certainty,
- use background to override the selected Bible passage evidence.


## Retrieval scoring upgrade

### Channels

1. Lexical search over passage text and normalized text.
2. Query search over `searchQueries` and AI/deterministic expansion terms.
3. Axis search over `themes`, `doctrines`, `humanConcerns`, `questionsAnswered`.
4. Optional embedding search over precomputed vectors.
5. Cross-reference support as a booster only.
6. Canonical coverage as a booster only.

### Invariant

```ts
matchScore = lexicalScore + semanticScore + axisScore + embeddingScore;
finalScore = matchScore > 0
  ? matchScore + crossReferenceBoost + canonicalBoost
  : 0;
```

Cross-reference and canonical scores cannot create relevance. They only stabilize ranking among already matched candidates.

### Broad question bundle behavior

For broad questions, retrieval should prefer coverage bundles over one high lexical hit.

Examples:

- “하나님은 누구인가?” → self-existence, creator, love, revelation.
- “사람은 왜 사는가?” → image of God, created purpose, love of God/neighbor, hope.
- “고통이 있다면 삶은 의미 있는가?” → suffering, hope, formation, resurrection/future.

## Passage explanation upgrade

Retrieval correctness is not enough. A selected passage must also be explained with context and with an explicit bridge to the user's prompt.

The answer should not merely say:

```text
This verse is relevant because it mentions hope.
```

It should say:

```text
The user is asking where to find hope when endurance feels impossible.
This passage was first spoken/written in this setting.
The passage names this specific pressure or theological claim.
Therefore it connects to this part of the user's question.
It helps with this, but it does not settle that.
```

### Required explanation layers

Each primary/supporting passage in an answer bundle should carry:

1. **Passage background**
   - book,
   - literary context,
   - original audience or setting,
   - confidence-sensitive date/place/authorship where available,
   - genre caution, e.g. proverb, lament, narrative, epistle, apocalyptic.

2. **Passage claim**
   - what the passage actually says,
   - what question or concern it directly answers,
   - whether it is direct, supporting, background, or weak.

3. **User connection**
   - which phrase/concern in the user prompt it connects to,
   - which indexed terms/axes caused the match,
   - why that connection is conceptually valid rather than just a word overlap.

4. **Application boundary**
   - what the passage can responsibly help with,
   - what it does not decide,
   - where further context, pastoral care, or human help is needed.

### Target `PassageExplanation` contract

```ts
export type PassageExplanation = {
  reference: BibleReference;
  role: "primary" | "supporting" | "background";
  directness: "direct" | "supporting" | "background" | "weak";
  background: {
    book: string;
    genre?: string;
    literaryContext: string;
    originalAudience: string;
    datePlaceAudience?: string;
    confidence: "high" | "medium" | "disputed";
  };
  passageClaim: {
    summary: string;
    keyLines: string[];
    answers: string;
  };
  userConnection: {
    promptFragment: string;
    matchedTerms: string[];
    matchedAxes: string[];
    connectionReason: string;
  };
  applicationBoundary: {
    helpsWith: string[];
    doesNotSettle: string[];
    caution?: string;
  };
};
```

### Answer bundle impact

`AnswerBundle.relationMap` should evolve from short strings into structured `PassageExplanation[]`.

Current transitional fields:

- `relation.answers`
- `relation.userConnection`
- `relation.limits`

Target fields:

- `background`
- `passageClaim`
- `userConnection`
- `applicationBoundary`

The final response should be generated from this structured bridge, not from a naked `primaryReference`.

### Final response requirements

For Korean output, the answer should include these conceptual sections even if the UI labels differ:

1. `질문 이해`
   - restate the user's actual concern, not generic doctrine.
2. `본문 배경`
   - explain the primary passage's book/literary/original-audience context.
3. `중심 본문이 말하는 것`
   - summarize the passage claim from evidence.
4. `내 질문과 연결되는 지점`
   - name the user's phrase/concern and the passage phrase/theme that meet.
5. `함께 읽을 본문`
   - explain how supporting texts reinforce, qualify, or broaden the primary passage.
6. `적용의 경계`
   - state what the passage helps with and what it does not decide.

### Scoring/reranking impact

The reranker should not only ask “does this passage match terms?”

It should ask:

- Can the system name a concrete `promptFragment` this passage answers?
- Can it name a concrete `passageClaim` from the indexed text/metadata?
- Is the connection direct, supporting, background, or weak?
- Does the passage require a genre/context caution?

If a candidate cannot produce a defensible user-connection bridge, it should be demoted even if lexical score is high.


## Runtime cost model

### Default request path

| Case | Runtime AI? | Reason |
|---|---:|---|
| Safety/off-topic/external fact | No | Policy must be deterministic and conservative. |
| High-confidence deterministic understanding | No | Avoid unnecessary cost. |
| Generic/low-confidence Bible question | Yes, if Hermes ready | AI adds recall terms/axes. |
| Hermes unavailable/fails | No | Deterministic fallback remains usable. |
| Background storytelling | No live web; AI only if summarizing cached sources offline | Runtime uses stored `PassageBackgroundPack` evidence. |
| Final generation with `agent-oneshot` Hermes | No | Avoid proxy timeout; deterministic builder remains evidence-locked. |

### Configuration

- `HERMES_RAG_QUERY=0`: disable runtime AI planner.
- `HERMES_RAG_QUERY=force`: use AI planner even when deterministic profile matched, for QA/debug only.
- Default: deterministic first, AI only for weak/generic cases.

## Migration plan

### Phase 1 — Contract cutover

Goal: Make AI planner output flow into actual retrieval.

Tasks:

1. Replace expansion-only `RagQueryPlan` with `RetrievalQueryPlan`.
2. Add planner sanitizers for refs, lengths, array caps, enums.
3. Pass `{ queryPlan }` through `app/[locale]/api/reflect/route.ts` → `retrieveClusterForPrompt()` → `buildAnswerBundle()`.
4. Make `buildAnswerBundle()` consume `queryPlan.question` directly instead of recomputing disconnected understanding.
5. Keep safety/off-topic policy from deterministic precheck.

Acceptance:

- Mock Hermes planner terms appear in `answerBundle.question.searchQueries`.
- AI-produced reference strings are dropped and not cited.
- Safety/external/off-topic prompts cannot be upgraded into confident citations by AI terms.

### Phase 2 — Scoring hardening

Goal: Prevent generic/high-authority passages from winning without question match.

Tasks:

1. Keep match-score gate in `lib/hybrid-retrieval.ts`.
2. Remove generic fallback axes like `Bible/discernment` when AI planner terms are present.
3. Penalize candidates whose only match is a stopword-like or generic theological axis.
4. Add directness thresholds for `answerBundle` confidence.

Acceptance:

- Mock planner with `소망/생명/부활` does not rank `2TI 3:16-17` because of `Bible` axis alone.
- Candidates with zero lexical/semantic/axis/embedding match are excluded even if cross-reference degree is high.

### Phase 3 — Passage explanation contract

Goal: Make every selected passage explain its background and its explicit bridge to the user's prompt.

Tasks:

1. Add `PassageExplanation` or equivalent structured fields to `lib/answer-bundle.ts`.
2. Build `background` from `BookMetadata`, `StoryCluster.context`, and passage/index provenance.
3. Build `passageClaim` from passage text, summary, and indexed metadata.
4. Build `userConnection` from prompt fragments, matched terms, matched axes, and reranker directness.
5. Build `applicationBoundary` from answer mode, directness, safety state, and genre/context cautions.
6. Update `lib/reflection.ts` and `lib/hermes-contract.ts` so generation consumes this structured bridge.

Acceptance:

- The response names the user's actual concern fragment, not only a generic topic.
- The response explains the primary passage's background before applying it.
- The response states why the passage connects conceptually, not just lexically.
- The response states what the passage does not decide.
- Weak/background passages are labeled as such instead of presented as direct answers.

### Phase 4 — Source-backed background packs

Goal: Give every selected passage enough historical/literary/lexical context for storytelling without relying on uncached AI memory.

Tasks:

1. Add `PassageBackgroundPack` storage under `data/background-packs/` or a SQLite-backed equivalent.
2. Add an allowed-source registry with URL, license, tier, extractable fields, and citation rules.
3. Ingest existing repo metadata first: `lib/book-metadata.ts`, cross-reference graph data, doctrine sources, local Bible metadata.
4. Add offline fetch/import for approved external sources such as STEPBible Data and selected BibleProject pages where licensing permits.
5. Use AI only to summarize fetched/cached source material into structured packs.
6. Validate every background claim against a `sourceId`.
7. Expose background packs to `AnswerBundle`/`PassageExplanation`.

Acceptance:

- A selected passage can produce book/genre/original-audience/literary-context fields from stored evidence.
- AI-generated background summaries include source IDs and model/prompt/version hashes.
- Final runtime generation never uses live web snippets directly.
- Source/license metadata is visible in response evidence or source inventory.

### Phase 5 — Full-Bible passage index

Goal: Remove dependence on 28 seed units and manual passage priors.

Tasks:

1. Refactor `scripts/build-passage-index.mjs` to segment the whole Bible.
2. Preserve the 28 curated units as high-quality seed metadata, not the whole index.
3. Add deterministic metadata extraction.
4. Add optional offline AI metadata enrichment.
5. Store provenance and index version.
6. Consider SQLite when JSON size or startup parse cost becomes too high.

Acceptance:

- Index unit count reflects full corpus passage segmentation, not 28 seeds.
- Common unseen questions produce direct/supporting candidates without adding new regex profiles.
- Build remains deterministic when offline AI enrichment is disabled.



### Phase 6 — Embedding/index acceleration

Goal: Improve paraphrase recall without per-request full-corpus AI cost.

Tasks:

1. Add offline embeddings for passage units when provider is configured.
2. Load vector index lazily or from compact binary/SQLite.
3. Query embedding uses planned question text + AI/deterministic terms.
4. Keep lexical/axis fallback available when embeddings are disabled.

Acceptance:

- Embeddings improve paraphrase recall but are not required for correctness.
- Runtime reports `retrievalMode: "embeddings"` only when vectors and provider are both ready.

### Phase 7 — Manual rule retirement

Goal: Make manual mappings exceptional.

Tasks:

1. Classify existing rules into:
   - keep: safety/off-topic/external limits,
   - keep: doctrinal divergence policy,
   - demote: deterministic recall hints,
   - retire: question-to-reference priors replaced by full index.
2. Delete retired mappings only after QA proves equivalent or better behavior.
3. Add regression fixtures for retired cases.

Acceptance:

- New user wording is handled by planner/index, not by adding another regex.
- Rule count stops growing with QA coverage.

## Failure modes and handling

| Failure | Handling |
|---|---|
| AI returns references | Drop ref-shaped strings; record `droppedReferenceHints`; never cite them. |
| AI returns generic terms only | Fallback to deterministic query plan or low-confidence retrieval. |
| AI unavailable/timeout | Deterministic path continues. |
| Full index has no direct match | Return low-confidence/clarification instead of forcing citation. |
| Candidate matches only popularity/crossrefs | Exclude by match-score gate. |
| Candidate shares word but not meaning | Reranker marks weak/background; answer bundle rejects if confidence low. |
| User asks everyday concrete choice | Deterministic policy blocks concrete Bible decision; optional wisdom principle only. |
| User crisis/self-harm | Safety-first path overrides AI planner and retrieval confidence. |
| Live web source is unavailable | Use existing cached packs; mark missing/stale background instead of inventing it. |
| External source license is unclear | Do not ingest or quote; record as candidate-only until reviewed. |
| AI background summary lacks source IDs | Reject the pack; background claims must be traceable. |
| Background pack conflicts with Bible passage evidence | Bible passage evidence controls the answer; background becomes a qualified note or is omitted. |

## Verification plan

### Unit-level checks

- `buildRagQueryPlan()` sanitizes AI output:
  - drops `JOH 3:16`, `ROM 8:28`, and range-like strings,
  - caps term count,
  - ignores invalid enum values,
  - preserves deterministic safety policy.
- `enrichQuestionWithExpansion()` or replacement query-plan merge:
  - merges expansion terms into search queries,
  - removes generic fallback axes when planned terms are present,
  - does not alter safety/external/off-topic modes.
- `retrieveHybridPassageCandidates()`:
  - excludes zero-match candidates,
  - applies cross-reference/canonical only as boosters.
- `PassageExplanation` builder:
  - includes book/literary/original-audience background for the primary passage,
  - names a concrete user prompt fragment,
  - names the passage claim that connects to that fragment,
  - records `helpsWith` and `doesNotSettle`,
  - labels weak/background passages without upgrading them to direct answers.
- `PassageBackgroundPack` ingestion:
  - stores source URL/license/tier/retrievedAt,
  - rejects generated claims without `sourceId`,
  - records model/prompt/version hashes for AI summaries,
  - exposes book/genre/original-audience/literary-context to `PassageExplanation`.

### API smoke checks

1. Known deterministic question:
   - Prompt: `하나님이 안 보이는데 어떻게 믿으라는 거야?`
   - Expected: no runtime AI required, answer bundle present, evidence-locked generation.

2. Unseen metaphorical question with mock Hermes:
   - Prompt: `내 그림자가 너무 길게 느껴지는 날에는 무엇을 붙들어야 해?`
   - Mock terms: `소망`, `인자`, `생명`, `기다림`, `부활`, `평안`
   - Expected: `ragQuery.expansionProvider = hermes`, terms appear in `answerBundle.question.searchQueries`, no generic `Bible/discernment` axis dominance.

3. AI tries to cite:
   - Mock terms include `JOH 3:16`.
   - Expected: ref dropped, not in search terms, not in citations unless retrieval independently finds it.

4. Safety prompt:
   - Prompt with self-harm wording.
   - Expected: safety-first response policy; AI planner cannot convert it to normal retrieval.

5. External fact prompt:
   - Prompt asks weather/news/stock.
   - Expected: limited answer; no forced Bible citation.

6. Background and user-connection explanation:
   - Prompt: `왜 버텨야 하지?`
   - Expected: response explains the primary passage background, names the user's endurance/hope concern, states the passage claim, and includes an application boundary.

### Regression scripts

- `npm run build`
- `npm run qa:philosophy`
- `npm run qa:open-ended`
- `npm run qa:concerns`
- Add a new focused QA script or fixture for AI middleware contract:
  - mocked Hermes planner,
  - ref-shaped term rejection,
  - low-confidence metaphorical prompts,
  - generic-axis demotion,
  - background/user-connection explanation coverage,
  - cached source-backed background pack coverage.

## Success criteria

1. Unknown wording no longer requires adding a new regex/manual mapping to retrieve plausible evidence.
2. AI query planning affects actual candidate selection, not only debug metadata.
3. Runtime AI cost is bounded to one small planner call only when deterministic understanding is weak.
4. Final responses never cite AI-invented references.
5. Each selected passage includes source-backed background, passage claim, user-connection bridge, and application boundary.
6. Historical/literary storytelling is generated from cached source packs, not live web snippets or AI memory.
7. Passage index grows toward Bible-wide coverage offline.
8. QA failures are fixed by improving planner/index/reranker/explanation/source-pack contracts, not by prompt-by-prompt mappings.

## Non-goals

- Do not ask AI to read/search the whole Bible per request.
- Do not let AI choose final references.
- Do not remove safety/off-topic conservative gates.
- Do not keep growing regex maps as the primary retrieval strategy.
- Do not treat QA term-hit success as proof of semantically correct retrieval.
- Do not use live web snippets directly in final answers without ingestion, attribution, and validation.

## Immediate next implementation step

Implement Phase 1 cleanly:

1. Rename or replace `RagQueryPlan` with `RetrievalQueryPlan`.
2. Thread the complete plan through route/retrieval/answer bundle.
3. Add sanitizer tests with mocked planner output.
4. Keep current partial expansion-term bridge only as the transitional baseline.

After Phase 1 is verified, implement Phase 3 passage explanation, then Phase 4 source-backed background packs, then Phase 5 full-Bible passage index generation before adding more manual topic rules.
