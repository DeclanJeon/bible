# Open-Ended Bible QA Architecture

## Status
- Status: Implemented v1 milestone
- Created: 2026-06-18
- Scope: Replace narrow prompt-to-book-lane retrieval with an open-ended Bible question answering pipeline.
- Primary surfaces: `/[locale]/companion`, `/[locale]/api/reflect`, retrieval/generation modules under `lib/`, QA scripts under `scripts/` and fixtures under `qa/`.

## Implementation progress
- Milestone: First working production candidate completed on 2026-06-18.
- QA completion: `npm run qa:open-ended` 96/96, `npm run qa:concerns` 148/148, `npm run qa:philosophy` 100/100.
- Batch verification: 50-prompt mixed batch re-run after off-topic and supporting-reference fixes passed 310/310 checks.
- Validation: `npm run lint` pass, `npm run build` pass.
- Warm latency: `/ko/api/reflect` observed 1.59s min / 1.74s avg / 1.89s p95 over 12 runs. `/ko/companion` observed 1.69s min / 1.88s avg / 2.02s p95 over 3 runs.
- Payload size: normal JSON answers observed at 43-55KB; rendered HTML observed at 115KB.

## Problem statement
Users can ask any question or leave any concern. The system must not depend on a finite list of known prompts. It must classify the question, find grounded Bible passages, explain why those passages connect to the question, and describe what those passages can and cannot answer.

Current failure mode:
- `성경은 뭐야?` returns low-confidence tentative text instead of a grounded answer about Scripture.
- `하나님은 뭐야?` returns low-confidence tentative text instead of a grounded answer about God.
- `사람은 왜 사는거지?` returns low-confidence tentative text instead of a grounded answer about human purpose.

The product requirement is not “always attach a plausible verse.” The requirement is: every input must be routed to the correct Bible-response policy:
1. Bible / faith / life / concern / ethics question → answer with an evidence bundle.
2. Broad question → answer with a multi-passage survey bundle, not a single weak verse.
3. Everyday choice → say the Bible does not decide the concrete choice, then provide wisdom principles if applicable.
4. Crisis / self-harm / despair → safety first, then Bible comfort and help-seeking guidance.
5. Empty / nonsensical input → ask for a usable direction and offer starter choices.
6. External fact question → state limits; do not force a Bible citation as factual proof.

## Current code evidence
- `lib/retrieval.ts` exposes `RetrievalResult` with one `primaryReference`, `supportingReferences`, score fields, and `confidence`.
- `lib/retrieval.ts` `isRetrievalReliable()` requires non-low confidence plus passage score, supporting references, or passage keywords. Broad one-word theological questions often fail this gate.
- `lib/retrieval.ts` uses regex query expansion, doctrinal routing, philosophical priors, global verse scoring, and book-lane scoring. It does not contain an open-ended question-understanding layer.
- `lib/app-data.ts` builds one `StoryCluster` per Bible book. Each book cluster primary is the book opening passage. This is useful for book context, but it is not a public-question semantic index.
- `lib/reflection.ts` deliberately returns the “더 구체적인 연결이 필요합니다” style low-confidence response when retrieval is unreliable.
- `app/[locale]/api/reflect/route.ts` follows a single primary path: prompt → RAG query plan → retrieval → reliability gate → supporting references → reflection.
- `lib/hermes-contract.ts` and `lib/hermes.ts` already enforce evidence-locked generation. That layer is reusable, but it cannot repair weak retrieval evidence.

## Architecture decision
Build an open-ended Bible QA pipeline:

```text
user input
→ question understanding
→ response policy selection
→ passage unit index search
→ hybrid retrieval
→ passage reranking
→ answer bundle assembly
→ evidence-locked response generation
```

Do not solve the problem by adding endless regex cases. Regex and curated topics may remain as fast-path hints, but the core system must use a Bible-wide semantic passage index and hybrid retrieval.

## Non-goals
- Do not let AI invent Bible references.
- Do not rely on a single primary verse for broad doctrinal questions.
- Do not remove low-confidence safety behavior for truly weak/off-topic matches.
- Do not put slow external AI calls unconditionally on synchronous request paths.
- Do not replace Bible evidence with generic pastoral advice.

## Target data model

### `BiblePassageUnit`
A passage unit is the searchable object. It should usually be a paragraph/pericope-sized unit, not an isolated verse unless the verse is self-contained.

```ts
export type BiblePassageUnit = {
  id: string;
  reference: BibleReference;
  locale: AppLocale;
  text: string;
  normalizedText: string;
  summary: string;
  themes: string[];
  doctrines: string[];
  humanConcerns: string[];
  questionsAnswered: string[];
  entities: string[];
  keywords: string[];
  canonicalWeight: number;
  crossReferenceDegree: number;
  embedding?: number[];
};
```

Required examples:
- `2TI 3:16-17`: Scripture, revelation, teaching, correction, formation.
- `EXO 3:14-15`: God’s self-identification.
- `GEN 1:1`: God as creator.
- `GEN 1:26-28`: humanity as image of God.
- `EPH 2:8-10`: grace, salvation, created for good works.
- `MAT 11:28-30`: weariness, rest, burden.
- `MAT 22:37-40`: love of God and neighbor.
- `JOH 14:6`: truth, way, life.

### `QuestionUnderstanding`
AI may help produce this object, but it must not choose Bible references.

```ts
export type QuestionUnderstanding = {
  original: string;
  normalized: string;
  locale: AppLocale;
  intent:
    | "definition"
    | "meaning"
    | "pastoral_care"
    | "doctrine"
    | "ethics"
    | "practice"
    | "biblical_context"
    | "everyday_wisdom"
    | "external_fact"
    | "empty_or_nonsense"
    | "safety_first";
  concernAxes: string[];
  theologicalAxes: string[];
  searchQueries: string[];
  answerMode:
    | "direct_bible_answer"
    | "survey_bundle"
    | "wisdom_principle"
    | "pastoral_care"
    | "safety_first"
    | "clarify_with_starters"
    | "limited_answer";
  confidence: "high" | "medium" | "low";
};
```

Examples:

```json
{
  "original": "하나님은 뭐야?",
  "normalized": "하나님은 누구인가",
  "intent": "definition",
  "theologicalAxes": ["God", "creator", "self-existence", "spirit", "love"],
  "searchQueries": ["하나님은 누구인가", "창조주", "스스로 있는 자", "하나님은 영", "하나님은 사랑"],
  "answerMode": "survey_bundle",
  "confidence": "high"
}
```

```json
{
  "original": "사람은 왜 사는거지?",
  "normalized": "사람은 왜 사는가",
  "intent": "meaning",
  "concernAxes": ["purpose", "identity", "worth"],
  "theologicalAxes": ["image of God", "creation", "calling", "love of God and neighbor"],
  "searchQueries": ["하나님의 형상", "사람의 목적", "선한 일", "하나님 사랑 이웃 사랑"],
  "answerMode": "survey_bundle",
  "confidence": "high"
}
```

### `PassageCandidate`
The retrieval candidate must explain how it matched the question.

```ts
export type PassageCandidate = {
  unit: BiblePassageUnit;
  lexicalScore: number;
  semanticScore: number;
  axisScore: number;
  crossReferenceScore: number;
  canonicalCoverageScore: number;
  finalScore: number;
  directness: "direct" | "supporting" | "background" | "weak";
  matchedAxes: string[];
  matchedQueries: string[];
  reason: string;
};
```

### `AnswerBundle`
This becomes the generation contract. It replaces “one primary reference plus maybe supporting references” as the main answer object.

```ts
export type AnswerBundle = {
  question: QuestionUnderstanding;
  primary: PassageCandidate;
  supporting: PassageCandidate[];
  confidence: "high" | "medium" | "low";
  answerPolicy: AnswerPolicy;
  relationMap: Array<{
    reference: string;
    answers: string;
    userConnection: string;
    limits?: string;
  }>;
  crossReferenceSupport: Array<{
    from: string;
    to: string;
    supportLabel: string;
  }>;
};
```

## Pipeline design

### 1. Question understanding
Module: `lib/question-understanding.ts`

Responsibilities:
- Normalize Korean and English public-user phrasing.
- Detect question shape: definition, meaning, pain, doctrine, ethics, practice, context, off-topic, crisis.
- Extract concern axes and theological axes.
- Generate multiple search queries.
- Select an answer mode.
- Never select Bible references.

Implementation policy:
- Use deterministic normalization first.
- Use optional AI only as a structured classifier and query expander.
- AI output must be JSON-validated.
- If AI is unavailable or times out, deterministic fallback must still produce a usable `QuestionUnderstanding`.
- Keep sync latency budget strict. External AI must be opt-in or bounded by a small timeout.

### 2. Passage index generation
Module: `scripts/build-passage-index.mjs` or `.ts`
Output: `data/passage-index/ko.json`, `data/passage-index/en.json`, optional `data/passage-index/*.sqlite` later.
Runtime module: `lib/bible-passage-index.ts`

Responsibilities:
- Load local Bible corpus from `world_english_bible/` and existing Korean corpus sources used by `lib/bible.ts`.
- Split Bible text into passage units.
- Attach metadata fields: summary, themes, doctrines, human concerns, questions answered, entities, keywords.
- Attach cross-reference degree from `lib/knowledge.ts` / `lib/crossref-graph.ts` where available.
- Optionally attach embeddings if a provider is explicitly configured for offline generation.

Passage splitting rules:
- Prefer paragraph/pericope-like contiguous units.
- If source text lacks paragraphs, use chapter-aware sliding windows with overlap:
  - 1–4 verses for poetry/proverbs.
  - 3–10 verses for narrative/epistle discourse.
  - Never cross book boundaries.
  - Avoid crossing chapter boundaries unless a known passage requires it.
- Preserve exact verse references.

Metadata generation policy:
- Deterministic seed metadata for core doctrine/pastoral topics is allowed.
- AI-assisted offline metadata is allowed only during index build, never as an uncached runtime dependency.
- Metadata must be stored with provenance/version fields.

### 3. Hybrid retrieval
Module: `lib/hybrid-retrieval.ts`

Search channels:
1. Lexical BM25/TF-IDF over passage text, summary, keywords, and questions answered.
2. Semantic vector search over passage embeddings when available.
3. Axis search over `themes`, `doctrines`, `humanConcerns`, and `questionsAnswered`.
4. Cross-reference support score from existing cross-reference datasets.
5. Canonical coverage score for broad questions that require multiple doctrinal anchors.

Scoring target:

```ts
finalScore =
  lexicalScore * 0.20 +
  semanticScore * 0.35 +
  axisScore * 0.25 +
  crossReferenceScore * 0.10 +
  canonicalCoverageScore * 0.10;
```

Weights may be tuned by QA, but the architecture must not collapse back to lexical-only scoring.

### 4. Reranking
Module: `lib/passage-reranker.ts`

Responsibilities:
- Re-evaluate top 20–40 candidates.
- Mark candidate directness: direct, supporting, background, weak.
- Penalize term-only matches where the passage does not answer the question.
- Prefer passage bundles that cover the question’s axes.
- Detect when a broad question needs a survey bundle.
- Keep safety policy upstream of interpretation.

Reranker criteria:
- Does this passage answer the actual question or only share a word?
- Is the passage context compatible with the intended use?
- Is the passage primary or supporting?
- Does the bundle cover the main axes of the question?
- Does the answer need a limit/caution statement?

### 5. Answer bundle assembly
Module: `lib/answer-bundle.ts`

Responsibilities:
- Pick one primary passage and 2–5 supporting passages.
- For broad questions, use a survey bundle.
- For pastoral questions, include comfort/care passages plus safety instructions when needed.
- For everyday wisdom questions, avoid claiming the Bible decides a concrete option.
- Build the relation map used by generation.

Bundle rules:
- `definition` / `meaning` questions should usually include 3–5 passages.
- `pastoral_care` questions may include one primary comfort text plus supporting texts.
- `ethics` questions should include both principle and caution texts where relevant.
- `external_fact` questions should not force a Bible answer unless the question asks for Bible framing.
- `empty_or_nonsense` should not fabricate a passage match.

### 6. Evidence-locked generation
Modules: `lib/hermes-contract.ts`, `lib/hermes.ts`, `lib/reflection.ts`

Responsibilities:
- Generate from `AnswerBundle`, not from a naked primary reference.
- Explain:
  1. how the system understood the question,
  2. why the primary passage was selected,
  3. how each supporting passage contributes,
  4. how this connects to the user’s question or concern,
  5. what the passages can help with,
  6. what they do not settle.
- Preserve existing safety-first behavior.
- Validate that every cited reference exists in the bundle.

Required Korean answer shape:
1. `질문 이해`
2. `중심 본문`
3. `왜 이 본문인가`
4. `함께 읽을 본문`
5. `당신의 질문/고민과의 연결`
6. `이 본문이 도와주는 것`
7. `조심해야 할 한계`
8. `다음 질문`

## Response policies

### `direct_bible_answer`
Use for specific Bible/doctrine questions with a clear answer target.

### `survey_bundle`
Use for broad questions such as:
- 성경은 뭐야?
- 하나님은 누구야?
- 사람은 왜 사는가?
- 믿음이 뭐야?
- 구원이 뭐야?

Must not return “더 구체적인 연결이 필요합니다.”

### `pastoral_care`
Use for worries, grief, anxiety, weariness, guilt, loneliness, anger, shame.

### `safety_first`
Use for crisis/self-harm/despair language. Safety wording comes before Bible explanation.

### `wisdom_principle`
Use for everyday decisions. The Bible may provide wisdom principles, but the app must not pretend to decide the concrete choice.

### `clarify_with_starters`
Use only for empty/nonsense prompts or prompts with no interpretable concern.

### `limited_answer`
Use for external facts or requests the Bible cannot directly answer.

## Work orders

### Work order 1 — Add broad-question regression tests first
Owner: Test engineer

Files:
- `qa/open-ended-bible-qa.json` new
- `scripts/run-open-ended-bible-qa.mjs` new or adapt existing benchmark runner
- optional: extend `qa/korean-concern-qa.json` only for safety-related cases

Tasks:
1. Add fixtures for definitional, existential, pastoral, ethical, practice, everyday-choice, external-fact, empty, and safety-first prompts.
2. Include Korean colloquial variants:
   - `성경은 뭐야?`
   - `하나님은 뭐야?`
   - `사람은 왜 사는거지?`
   - `믿음이 뭔데?`
   - `기도는 왜 해?`
   - `용서해야 돼?`
   - `회사 그만둘까?`
   - `그냥 아무거나`
3. Assert response policy, reliability, primary/supporting references, forbidden phrases, safety level, and latency.
4. Ensure current behavior fails at least the three known broad prompts before implementation.

Acceptance:
- The new QA runner reports failures for current broad prompts.
- Fixture schema is explicit enough to test policy and evidence, not just text snapshots.

### Work order 2 — Build question understanding module
Owner: Retrieval engineer

Files:
- `lib/question-understanding.ts` new
- `lib/question-understanding.test.ts` if test setup supports colocated tests; otherwise add runner coverage

Tasks:
1. Implement deterministic Korean/English normalization.
2. Implement answer mode classification.
3. Extract concern axes and theological axes.
4. Generate multiple search queries.
5. Add optional AI classifier interface behind explicit env gate.
6. Validate AI output with strict schema and deterministic fallback.

Acceptance:
- `성경은 뭐야?` → `intent=definition`, `answerMode=survey_bundle`, scripture axes.
- `하나님은 뭐야?` → God axes, survey bundle.
- `사람은 왜 사는거지?` → meaning/purpose axes, survey bundle.
- `회사 그만둘까?` → everyday wisdom, not direct Bible decision.
- Empty/nonsense → clarify with starters.
- Crisis wording → safety first.

### Work order 3 — Generate Bible passage index
Owner: Data/indexing engineer

Files:
- `scripts/build-passage-index.mjs` new
- `lib/bible-passage-index.ts` new
- `data/passage-index/ko.json` generated
- `data/passage-index/en.json` generated

Tasks:
1. Build passage units from local Bible corpus.
2. Add initial deterministic metadata for high-value doctrinal/pastoral anchors.
3. Compute lexical fields and lightweight term statistics.
4. Add cross-reference degree/count fields from existing cross-reference data.
5. Store index version and generation timestamp.
6. Keep generated files reasonably sized; do not ship massive duplicate corpus if runtime can load compact fields.

Acceptance:
- Index contains exact references and text for both locales.
- Index includes metadata for broad question anchors.
- Runtime load is cached and does not exceed current response-size budgets.
- Build script is deterministic without external AI.

### Work order 4 — Implement hybrid retrieval
Owner: Retrieval engineer

Files:
- `lib/hybrid-retrieval.ts` new
- `lib/retrieval.ts` modified or split to call hybrid retrieval

Tasks:
1. Search passage index using lexical terms.
2. Search axis metadata.
3. Use embeddings only if precomputed or explicitly enabled.
4. Merge candidates with weighted score.
5. Preserve existing off-topic and safety gates.
6. Return candidate explanations.

Acceptance:
- The three known broad prompts produce reliable candidates.
- Long-tail paraphrases produce semantically adjacent candidates.
- Everyday-choice prompts do not get fake direct answers.
- Runtime stays within latency target.

### Work order 5 — Add reranker and answer bundle
Owner: Retrieval/generation engineer

Files:
- `lib/passage-reranker.ts` new
- `lib/answer-bundle.ts` new
- `app/[locale]/api/reflect/route.ts` modified
- `app/[locale]/companion/page.tsx` modified

Tasks:
1. Rerank top candidates and mark direct/supporting/background/weak.
2. Build answer bundles per response policy.
3. Pass bundle to API/page response.
4. Preserve compatibility with existing UI fields during migration if needed, but do not add long-term duplicate pathways.
5. Use supporting passages before graph suggestions for broad survey answers.

Acceptance:
- API response includes answer bundle fields.
- Existing page still renders primary/supporting passages.
- Broad answers include multiple passages.
- Weak/off-topic prompts still avoid overclaiming.

### Work order 6 — Update evidence-locked generation
Owner: Generation engineer

Files:
- `lib/hermes-contract.ts`
- `lib/hermes.ts`
- `lib/reflection.ts`

Tasks:
1. Extend contract to accept `AnswerBundle`.
2. Validate citations against primary + supporting bundle references.
3. Add deterministic broad-answer branch.
4. Keep external generation opt-in for sync requests.
5. Add policy text for answer modes.

Acceptance:
- Broad prompts do not produce low-confidence “try again” copy.
- Every cited verse is in the evidence bundle.
- Safety-first prompts prioritize safety instructions.
- Everyday wisdom prompts do not claim God/the Bible chooses the user’s concrete option.

### Work order 7 — Update UI copy and result layout
Owner: Frontend engineer

Files:
- `app/[locale]/companion/page.tsx`
- relevant components under `components/`
- `lib/content.ts` if localized copy belongs there

Tasks:
1. Show `질문 이해` before the answer.
2. Show primary passage and supporting passages as a bundle.
3. Show relation explanations per passage.
4. Show answer policy and confidence in user-friendly language.
5. Keep loading page behavior unchanged unless response shape requires skeleton changes.

Acceptance:
- User sees why the selected passages relate to the question.
- Broad questions look intentional, not like a fallback.
- Low-confidence/off-topic state remains visibly different from survey answers.

### Work order 8 — QA, benchmark, and deployment gate
Owner: Verifier

Files:
- `qa/open-ended-bible-qa.json`
- `scripts/run-open-ended-bible-qa.mjs`
- existing QA scripts as needed

Tasks:
1. Run open-ended QA.
2. Run existing concern/philosophical QA.
3. Measure `/ko/api/reflect` latency and `/ko/companion` full HTML time.
4. Verify no response exceeds size budget.
5. Verify build/lint.

Acceptance:
- Open-ended QA: 95%+.
- Known critical prompts: 100% pass.
- `성경은 뭐야?`, `하나님은 뭐야?`, `사람은 왜 사는거지?` all reliable and not fallback copy.
- Sync API p95 target: under 4s on production host after warmup.
- Companion full HTML target: under 5s on production host after warmup.
- Build and lint pass.

## Implementation sequencing
1. Tests first: add open-ended QA fixtures and runner.
2. Question understanding module.
3. Passage index builder and runtime loader.
4. Hybrid retrieval.
5. Reranker and answer bundle.
6. Reflection/Hermes contract update.
7. UI layout update.
8. QA/performance/deploy.

Do not start by adding more regex routes. Regex can be temporary fallback only after the index/retrieval architecture is in place.

## Verification checklist

### Functional checklist
- [x] `성경은 뭐야?` returns a survey answer about Scripture, not low-confidence fallback.
- [x] `하나님은 뭐야?` returns a survey answer about God, not low-confidence fallback.
- [x] `사람은 왜 사는거지?` returns a purpose/identity answer, not low-confidence fallback.
- [x] Colloquial paraphrases of the above pass.
- [x] Pastoral concern prompts still return care-oriented passages.
- [x] Crisis prompts still trigger safety-first wording.
- [x] Everyday choices return wisdom-principle mode, not fake direct revelation.
- [x] Empty/nonsense inputs ask for clarification with starter choices.
- [x] External fact prompts state limits.

### Evidence checklist
- [x] Every cited reference exists in the answer bundle.
- [x] Primary passage has a directness reason.
- [x] Supporting passages each have a contribution reason.
- [x] Answer explains user-question connection.
- [x] Answer includes limits/cautions where needed.
- [x] No generated text adds uncited Bible references.

### Retrieval checklist
- [x] Hybrid retrieval uses more than lexical overlap.
- [x] Axis matches are visible in debug output.
- [x] Reranker penalizes word-only matches.
- [ ] Broad survey answers include 3–5 passages.
- [x] Off-topic prompts do not become arbitrary Bible answers.

### Performance checklist
- [x] Passage index loads from cache.
- [x] No runtime index generation on user request.
- [x] External AI is disabled by default or bounded by strict timeout.
- [x] `/ko/api/reflect` p95 under 4s warm production host.
- [x] `/ko/companion` full HTML under 5s warm production host.
- [x] Response payload remains under 250KB for normal answers.

### Regression checklist
- [x] `npm run lint` passes.
- [x] `npm run build` passes.
- [x] Existing Korean concern QA passes.
- [x] Philosophical QA passes or is updated with justified expectation changes.
- [x] New open-ended QA passes.
- [x] Remote smoke verifies latency, primary/supporting references, policy, confidence, and safety.

## ADR

### Decision
Adopt an open-ended Bible QA architecture based on question understanding, Bible passage semantic indexing, hybrid retrieval, reranking, answer bundles, and evidence-locked generation.

### Drivers
- Users are unknown and prompts are unbounded.
- Broad Bible/theology/life questions must be answered, not rejected as under-specified.
- The system must remain grounded in actual Bible passages.
- Synchronous responses must remain fast.
- Safety and evidence boundaries must remain enforceable.

### Alternatives considered
1. Add more regex routing rules.
   - Rejected: does not handle long-tail phrasing and will keep failing unknown prompts.
2. Ask AI to directly choose verses and write answers.
   - Rejected: hallucination risk, latency risk, weak citation control.
3. Keep current lexical retrieval and only tune confidence thresholds.
   - Rejected: would promote weak word-overlap matches and reduce trust.
4. Build a Bible-wide semantic passage index and keep AI limited to question understanding.
   - Chosen: best balance of open-ended coverage, grounding, speed, and maintainability.

### Consequences
- Requires new generated index artifact and QA suite.
- Requires response model migration from single-primary retrieval to answer bundles.
- Requires more sophisticated debugging output.
- Reduces dependence on synchronous external AI.
- Makes broad questions first-class instead of fallback cases.

### Follow-ups
- Add admin/debug view for question understanding and candidate ranking.
- Add offline index quality report.
- Add production telemetry for answer mode, confidence, latency, and fallback rate.
- Add periodic QA expansion from anonymized real prompt categories if privacy policy allows.


## Doctrine diversity extension

### Status
- Design only. Not implemented in runtime as of 2026-06-18.
- Purpose: extend the open-ended QA pipeline so doctrine prompts can distinguish shared Christian core claims from tradition-specific interpretations without hallucinating denominational positions.

### Problem
The current `AnswerBundle` model assumes one main bundle per prompt. That is appropriate for many questions, but not for doctrine topics where:
- the shared biblical center is real,
- later doctrinal formulation differs by tradition,
- a single unqualified answer can overstate consensus or hide disagreement.

### Decision
Add a second-layer doctrine presentation contract on top of the existing answer bundle:
1. `sharedCore` — evidence the app can state as broad Christian common ground.
2. `traditionViews` — optional, only when local tradition-source evidence exists.
3. `limits` — explicit note when the app is summarizing common ground only or when not all traditions are yet represented.

### Scope split
- **Shared-core doctrine**:
  - Examples: “예수님이 누구야?”, “예수님은 하나님이야?”, “예수님이 왜 죽으셨어?”
  - Expected result: shared core only, unless explicit tradition data is requested.
- **Tradition-divergent doctrine**:
  - Examples: baptism, Eucharist/Lord's Supper, salvation security, predestination/free will, spiritual gifts, church order, end-times sequencing.
  - Expected result: shared core plus labeled tradition views.
- **Tradition-requested doctrine**:
  - Example: “가톨릭에서는 성찬을 어떻게 보나?”
  - Expected result: requested tradition first, common core still visible, alternative traditions optionally collapsed below.

### Required data model addition
```ts
type TraditionKey =
  | "catholic"
  | "orthodox"
  | "reformed"
  | "lutheran"
  | "baptist_evangelical"
  | "wesleyan_arminian"
  | "pentecostal_charismatic";

type DoctrinePresentation = {
  topic: string;
  divergence: "low" | "medium" | "high";
  mode: "shared_core_only" | "shared_core_plus_views" | "tradition_requested";
  sharedCore: {
    summary: string;
    evidenceRefs: BibleReference[];
    confidence: "high" | "medium" | "low";
    limits?: string;
  };
  views: Array<{
    tradition: TraditionKey;
    summary: string;
    emphasis: string;
    evidenceRefs: BibleReference[];
    doctrineSourceRefs: string[];
    confidence: "high" | "medium" | "low";
    limits?: string;
  }>;
  requestedTradition?: TraditionKey;
};
```

### Source policy
- Bible passages alone may justify `sharedCore`.
- Denominational or tradition-specific claims require an ingested local doctrine-source layer.
- Valid doctrine-source categories:
  - creed
  - confession
  - catechism
  - conciliar / synodal definition
  - official denominational teaching document
- No tradition card is allowed without explicit `doctrineSourceRefs`.

### Work orders
#### Work order 9 — Add doctrine divergence classifier
Owner: Retrieval engineer

Files:
- `lib/question-understanding.ts`
- `qa/open-ended-bible-qa.json`

Acceptance:
- Doctrine prompts are classified as `shared_core`, `divergent`, or `tradition_requested`.
- Explicit tradition names in prompt are extracted into a requested-tradition field.

#### Work order 10 — Ingest tradition-source evidence
Owner: Theology/data engineer

Files:
- `data/doctrine-sources/*.json` or `.sqlite`
- `scripts/build-doctrine-source-index.*`
- `lib/doctrine-source-index.ts`

Acceptance:
- Each supported tradition has explicit source records with provenance.
- Each doctrine topic maps to both Bible evidence and tradition-source evidence.

#### Work order 11 — Extend answer contract and UI
Owner: Retrieval/frontend engineer

Files:
- `lib/answer-bundle.ts`
- `lib/reflection.ts`
- `app/[locale]/api/reflect/route.ts`
- `app/[locale]/companion/page.tsx`

Acceptance:
- API exposes `doctrinePresentation` when relevant.
- Companion shows shared core first.
- Tradition cards are collapsed by default on mobile.

#### Work order 12 — Add doctrine diversity QA
Owner: Verifier

Files:
- `qa/open-ended-bible-qa.json`
- `qa/doctrine-diversity-qa.json`
- `scripts/run-open-ended-bible-qa.mjs`
- `scripts/run-doctrine-diversity-qa.mjs`

Acceptance:
- Shared-core prompts do not show fake disagreement.
- Divergent prompts show labeled tradition views when source data exists.
- Requested-tradition prompts foreground the requested tradition.
- No tradition card ships without source references.

### Verification checklist
- [ ] Shared-core doctrine prompt can return `shared_core_only`.
- [ ] Divergent doctrine prompt can return `shared_core_plus_views`.
- [ ] Requested-tradition prompt can return `tradition_requested`.
- [ ] Shared core is visible before denomination-specific detail.
- [ ] Every tradition card contains Bible refs and doctrine-source refs.
- [ ] Missing tradition-source data falls back to explicit “common ground only” wording.
- [ ] Mobile UI keeps tradition-detail collapsed by default.

### Follow-up risk
- This extension adds doctrinal trust risk if source provenance is weak.
- Therefore implementation must not begin with generation-first UX; it must begin with source ingestion and explicit labeling.