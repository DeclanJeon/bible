# GotQuestions Korean 기반 성경 컴패니언 RAG 업그레이드 설계

작성일: 2026-06-28  
대상: `bible.ponslink.com` 성경 컴패니언 / 신앙 질문 API  
상태: G001 QA 반영 설계 — 구현 기준 문서

## 1. 목표

성경 컴패니언이 사용자의 한국어 신앙 질문을 GotQuestions Korean의 주제/질문 체계와 성경 본문으로 안정적으로 연결하도록 RAG를 개편한다. 목표는 GotQuestions 글 전문을 복제하는 백과사전이 아니라 다음 기능이다.

1. 사용자의 질문을 GotQuestions Korean의 실제 Q&A URL과 주제 카테고리에 매칭한다.
2. 각 Q&A가 제시하거나 질문 자체가 암시하는 성구를 앱 내부 성경 링크로 정규화한다.
3. 답변 생성은 성경 본문, 앱 내부 라우팅 결과, GotQuestions 링크 메타데이터로만 grounding한다.
4. 외부 글 전문은 저장/재배포하지 않고, 출처/제목/URL/짧은 비인용 메타요약/성구 링크만 보관한다.
5. 100개 사용자 질문 시뮬레이션에서 retrieval match, scripture-link coverage, grounding agreement를 측정하고 실패를 수정한다.

## 2. 조사 결과

### 2.1 현재 코드 구조

현재 신앙 질문 흐름은 다음 경로를 탄다.

```txt
POST /api/faith-questions
  -> lib/faith-question-answer.ts
    -> routeFaithQuestion()                 // lib/faith-question-router.ts
    -> buildPassageRecommendation()         // lib/passage-response.ts
      -> retrieveClusterForPrompt()         // lib/retrieval.ts
    -> searchFaithResources()               // lib/faith-resources.ts 정적 배열
    -> generateFaithQuestionWithHermes()    // evidence-locked 생성 + fallback
```

현재 장점:

- `meta.externalBodyFetched=false`, `externalBodyStored=false` 정책이 이미 있다.
- Hermes 생성물에서 제공되지 않은 성구/URL을 걸러내는 QA가 있다.
- `FAITH_RESOURCES`와 `FAITH_QUESTION_NODES`로 작은 curated router가 작동한다.
- Bible RAG와 외부 resource 메타데이터가 분리되어 있다.

현재 한계:

- GotQuestions Korean 전체 질문 체계가 데이터화되어 있지 않다.
- `FAITH_RESOURCES`는 수십 개 수동 항목 중심이라 1,000개 이상 Korean Q&A를 포괄하지 못한다.
- 질문 제목과 URL은 매칭할 수 있어도, 각 Q&A별 성구 근거를 대량으로 정규화하는 파이프라인이 없다.
- 99% match/agreement를 측정할 gold set과 100문항 QA 프로토콜이 없다.

### 2.2 GotQuestions Korean 소스 구조

확인한 공개 구조:

- `https://www.gotquestions.org/robots.txt`는 sitemap만 선언하고 별도 disallow를 노출하지 않는다.
- `https://www.gotquestions.org/Korean/` 홈은 30개 내외의 Korean 카테고리 링크를 제공한다.
- `https://www.gotquestions.org/Korean/korean.xml` sitemap은 1,182개 Korean URL을 제공한다.
- 카테고리 페이지 예: `Korean-Q-salvation.html`은 질문 제목과 article URL 목록을 제공한다.
- article 페이지 예: `Korean-Plan-Salvation.html`은 질문/답변 본문과 성경 인용을 포함한다.

주요 Korean 카테고리:

- 핵심/대중 질문: `Korean-crucial.html`, `Korean-FAQ.html`
- 하나님, 예수, 성령, 구원, 성경
- 교회, 종말, 천사/악마, 인간, 신학, 세계관
- 신앙생활, 기도, 죄, 천국/지옥
- 결혼, 연애, 가족, 창조, 종교/이단, 거짓교리, 인생결정, 시사, 기타
- 성경 개관/요약, 성경 인물

### 2.3 저작권/사용 정책

GotQuestions copyright policy 확인 결과:

- 비영리 인쇄/배포/공유는 출처 표시 조건으로 허용된다.
- 웹/출판/영상 인용은 보통 article당 200단어 이하, 전체 work의 10% 이하를 요구한다.
- 번역 공유도 article당 200단어 및 전체 work 20% 제한이 있다.
- 초과 사용은 `questions@gotquestions.org` 권한 요청 대상이다.

따라서 구현 원칙은 다음으로 제한한다.

- 저장 허용: URL, 제목, 카테고리, topic tag, article slug, 성구 reference, 짧은 자체 메타 설명, lastmod, source attribution.
- 저장 금지: GotQuestions article 본문 전문, 긴 본문 요약, article당 200단어를 넘는 인용, 원문 대체 재배포.
- 런타임 생성 금지: GotQuestions 본문을 읽지 않고 전문을 요약한 것처럼 표현.
- UI 문구 필수: “GotQuestions 원문 전문은 외부 링크에서 확인” 및 “Got Questions Ministries 출처” 표시.

### 2.4 URL classification

Ingestion must classify every URL before it is counted.


```ts
type GotQuestionsUrlClass =
  | "category"            // Korean-Q-*.html, Korean-FAQ.html, Korean-crucial.html, index/list pages
  | "article"             // question/answer article pages with a single question title
  | "static-non-question"  // home, search, statement of faith, good-news, app/download/contact-style pages
  | "excluded";           // malformed, duplicate canonical, non-Korean, inaccessible with recorded reason
```

Metric denominators:

- Sitemap completeness denominator = all Korean sitemap URLs minus `excluded`.
- Article coverage denominator = URLs classified as `article`.
- Category membership denominator = article URLs discovered from classified `category` pages.
- `static-non-question` pages are indexed only as optional resources, not counted as article match failures.
- Every exclusion must produce `{ url, class: "excluded", reason }` in the QA report.

### 2.5 Generated source boundary

- `data/faith/gotquestions-ko.index.json` is generated source data and is never hand-edited into `lib/faith-resources.ts`.
- `lib/faith-resources.ts` remains the curated resource/node registry.
- `lib/gotquestions-rag.ts` owns local search over generated data and exposes an adapter from top hits to `FaithResource` using the safe summary template in §6.1.
- Curated resources keep priority when a curated node intentionally boosts a source; generated GotQuestions article hits expand coverage but do not overwrite curated theology/navigation decisions.

## 3. 데이터 모델

새 데이터는 정적 TypeScript 배열보다 생성 산출물(JSON + SQLite 선택)을 권장한다.

### 3.1 `GotQuestionCategory`

```ts
type GotQuestionCategory = {
  id: string;                    // salvation, bible, god...
  titleKo: string;               // 구원에 관한 질문들
  url: string;                    // Korean-Q-salvation.html
  parentId?: string;
  order: number;
  topics: string[];              // salvation, gospel, assurance...
};
```

### 3.2 `GotQuestionArticleMeta`

```ts
type GotQuestionArticleMeta = {
  id: string;                    // gq-ko-korean-plan-salvation
  slug: string;                  // Korean-Plan-Salvation
  url: string;
  titleKo: string;               // 구원의 계획 / 구원의 길이란 무엇인가?
  categoryIds: string[];
  questionTextKo: string;        // 제목/질문 줄만. 본문 아님.
  searchTextKo: string;          // title + category + tags + generated keywords only.
  topics: string[];
  references: BibleReference[];  // extracted and normalized refs
  referenceEvidence: Array<{
    raw: string;                 // 요 3:16, 롬 3:23 등 짧은 reference string
    normalized: BibleReference;
    source: "article-reference" | "title-reference" | "category-prior" | "manual-curation";
  }>;
  attribution: "Got Questions Ministries";
  copyrightPolicyUrl: "https://www.gotquestions.org/copyright.html";
  bodyStored: false;
  lastmod?: string;
};
```

### 3.3 `GotQuestionRetrievalHit`

```ts
type GotQuestionRetrievalHit = {
  article: GotQuestionArticleMeta;
  score: number;
  matchKind: "exact-title" | "semantic-title" | "category-topic" | "scripture-overlap" | "manual-prior";
  matchedTerms: string[];
  passages: FaithPassage[];
};
```

## 4. 수집/색인 파이프라인

### 4.1 단계

1. `scripts/ingest-gotquestions-korean.mjs`
   - sitemap `https://www.gotquestions.org/Korean/korean.xml`을 읽어 Korean URL 목록을 얻는다.
   - Korean home/category pages를 읽어 category URL과 article membership을 만든다.
   - article page는 성구 reference 추출 용도로만 읽고 본문은 저장하지 않는다.
   - 산출물: `data/faith/gotquestions-ko.index.json`.

2. `scripts/build-gotquestions-faith-db.mjs` 또는 JSON-only loader
   - JSON을 validate하고 중복 URL/slug/category 누락을 검사한다.
   - 성구는 `lib/bible` metadata와 대조해 internal Bible link로 정규화한다.
   - 산출물: `data/faith/gotquestions-ko.sqlite` 또는 `.json`.

3. `npm run qa:gotquestions-rag`
   - ingestion completeness, reference parser, retrieval gold set, 100문항 QA를 실행한다.

### 4.2 본문 미저장 reference extraction

article HTML/markdown을 처리할 때 메모리에서만 다음을 추출하고 폐기한다.

- Korean book abbreviations: 창, 출, 레, 민, 신, 수, 삿, 룻, 삼상, 삼하, 왕상, 왕하, 대상, 대하, 스, 느, 에, 욥, 시, 잠, 전, 아, 사, 렘, 애, 겔, 단, 호, 욜, 암, 옵, 욘, 미, 나, 합, 습, 학, 슥, 말, 마, 막, 눅, 요, 행, 롬, 고전, 고후, 갈, 엡, 빌, 골, 살전, 살후, 딤전, 딤후, 딛, 몬, 히, 약, 벧전, 벧후, 요일, 요이, 요삼, 유, 계
- Korean full names: 창세기, 출애굽기, 마태복음, 요한복음 등
- English OSIS/book code aliases already used by `lib/rag-query.ts`
- Patterns:
  - `요 3:16`
  - `요한복음 3:16-18`
  - `롬 3:23; 6:23`
  - `고후 5:21`
  - `요 10:11, 14` -> two references

본문 excerpt는 저장하지 않는다. 단, `raw` reference string은 성구 주소 그 자체이므로 저장한다.

### 4.3 Fetch/cache and body-storage lifecycle

- Ingestion may fetch GotQuestions pages only during explicit build/ingest commands, never during normal user question handling.
- Fetched article HTML/markdown is process memory only. It must not be written to repo files, debug logs, failure artifacts, caches, SQLite, JSON, or test snapshots.
- On parser failure, logs may include only URL, title, raw reference string, and parser error. They must not include article paragraphs.
- Parser tests use synthetic snippets and public Bible reference strings only; they must not copy GotQuestions article prose.
- Polite fetching is required: bounded concurrency of 2, default delay of at least 500ms between requests per host, retry with backoff, and a `--limit` flag for development.
- Index version is derived from `sourceSitemapUrl`, `sourceLastmod`, generation timestamp, and a content hash of safe metadata only.

### 4.4 Runtime network invariant

- `lib/gotquestions-rag.ts` must be pure local-data search in API/runtime.
- `buildFaithQuestionAnswer()` and `POST /api/faith-questions` must never fetch `gotquestions.org`.
- QA must monkey-patch `globalThis.fetch` and fail any GotQuestions host call during faith-question API execution.
- The only allowed GotQuestions network access is `scripts/ingest-gotquestions-korean.mjs` or explicit maintenance scripts.


### 4.5 Body-storage guard

`scripts/run-gotquestions-rag-qa.mjs` must fail if generated artifacts contain body-like storage.

Forbidden fields anywhere in generated GotQuestions artifacts:

```txt
body, content, answer, html, markdown, excerpt, quote, paragraph, textBody, articleBody
```

Allowed prose fields and limits:

- `titleKo`: <= 180 chars
- `questionTextKo`: <= 220 chars
- `summary.ko`: template-only and <= 260 chars after title truncation
- `raw` in `referenceEvidence`: Bible reference string only, <= 40 chars
- Runtime adapter truncates `titleKo` to 120 chars inside summary templates while preserving the full title in `titleKo`.

QA must scan the generated JSON/SQLite export for long Korean prose spans. Any Korean sentence-like field over the limits above is a blocker unless it is a title/question field from the category link text. Runtime API must continue reporting `externalBodyFetched:false`, `externalBodyStored:false`, and `gotQuestionsRag.bodyStored:false`.

### 4.6 Manual overrides

Add `data/faith/gotquestions-ko.overrides.json` for reviewed corrections without editing generated data.

```ts
type GotQuestionsOverride = {
  url: string;
  addReferences?: string[];
  removeReferences?: string[];
  categoryIds?: string[];
  titleKo?: string;
  topics?: string[];
  note: string;
};
```

Rules:

- Overrides may add/remove references, correct category membership, or correct title metadata.
- Overrides must not contain article prose.
- QA fails on malformed URLs, unresolved references, missing `note`, or body-like fields.
- Generated index records applied override ids for auditability.
- QA emits `data/faith/gotquestions-ko.source-audit.json` with robots URL, sitemap URL, fetch timestamp, URL counts by class, copyright-policy URL, optional-mode state, and no-body-storage assertion. This receipt contains no article prose.



## 5. Retrieval 설계

### 5.1 후보 생성

사용자 질문에 대해 후보를 합친다.

1. 기존 `routeFaithQuestion()` curated node hits
2. GotQuestions article title BM25/TF-IDF hits
3. GotQuestions category/topic hits
4. Bible RAG primary/supportingReferences와 article.references overlap hits
5. Manual prior hits for critical doctrines: salvation, Jesus-only, Trinity, Bible reliability, heaven/hell, suicide/self-harm safety

### 5.2 스코어링

Phase-1 implementation uses deterministic lexical scoring only. Embeddings/semantic vectors are a future enhancement and must not be required for G002.

```txt
score =
  exactNormalizedTitleMatch * 45
+ titleTokenOverlapRatio * 25
+ categoryTopicOverlap * 12
+ scriptureOverlap * 12
+ existingCuratedResourceBoost * 8
+ manualPriorBoost * 8
+ localeBoost * 4
- ambiguityPenalty
- safetyUnsupportedPenalty
```

Tie-breakers:

1. score descending
2. exact normalized title match before partial match
3. curated/manual prior before generated metadata
4. category order from Korean home page
5. URL slug ascending

Results are limited to top 6 article links and top 6 passages. If deterministic top score is below the configured threshold, GotQuestions coverage is `partial` or `none`; the system must not inflate confidence with generated prose.

### 5.3 Category handling



- `categoryIds` is multi-valued because FAQ/crucial/category pages can overlap.
- `primaryCategoryId` is the first matching category by Korean home-page order after overrides.
- Scoring boosts every matching category but tie-breaks by `primaryCategoryId` order.
- QA fixtures use `expectedAnyCategoryIds` instead of a single category except when the exact primary category is the behavior under test.



### 5.4 Answer grounding policy

Hermes evidence에는 다음만 전달한다.

- `query`, intent summary
- selected article titles, URLs, categories, topics, attribution
- selected Bible passage labels/text from internal Bible DB
- article-derived reference labels only
- policy flags: `externalBodyFetched=false`, `externalBodyStored=false`, `doNotSummarizeUnprovidedExternalBodies=true`

생성 답변은 다음을 금지한다.

- GotQuestions 본문을 읽은 것처럼 “그 글은 이렇게 말합니다”라고 단정
- 제공되지 않은 article URL 또는 성구 추가
- article body summary 생성
- 출처 없는 교리 단정

### 5.5 Safety override

Safety-first routing outranks GotQuestions retrieval. For crisis, self-harm, abuse, or urgent safety questions:

1. `buildPassageRecommendation()` safety result controls the main answer.
2. GotQuestions links may appear only as secondary resources after crisis/safety guidance.
3. Generation must not present an article link as sufficient pastoral/medical intervention.
4. QA must include safety-sensitive fixtures and require safety-first behavior.

### 5.6 Agreement/stance guard

For core doctrine fixtures, article match alone is not enough. `qa/gotquestions-100.json` includes stance tags such as:

```txt
jesus_only, faith_alone, grace_not_works, eternal_security, trinity,
bible_reliability, bodily_resurrection, heaven_hell_judgment,
creation_creator, safety_first
```

Phase-1 QA verifies:

- expected article/category matches the stance tag mapping;
- deterministic summary or mocked generation does not invert the stance;
- generated answer may use only stance labels and provided evidence, not GotQuestions article prose;
- any unsupported stance claim outside the fixture/evidence is a blocker.

This is not full theological NLI; it is a deterministic guard that prevents obvious contradictions while the system remains link-and-scripture grounded.



## 6. API/UI 변경

### 6.1 API response 확장

`GroundedFaithQuestionAnswer.meta`에 추가:

```ts
gotQuestionsRag: {
  used: boolean;
  indexVersion: string;
  matchedCount: number;
  coverage: "exact" | "strong" | "partial" | "none";
  bodyFetched: false;
  bodyStored: false;
}
```

`resources`에는 GotQuestions article meta hits를 포함한다. 기존 `FaithResource`와 호환하려면 source는 `GotQuestions`, kind는 `article`, summary는 자체 메타 설명만 사용한다.

Safe `FaithResource.summary` template for generated GotQuestions article hits:

```ts
summary: {
  ko: `GotQuestions Korean 문답: ${titleKo}. 원문 전문은 GotQuestions.org 링크에서 확인하세요.`,
  en: `GotQuestions Korean Q&A: ${titleKo}. Read the full source at GotQuestions.org.`
}
```

Safe `questions` fallback:

```ts
questions: {
  ko: [titleKo],
  en: [titleKo]
}
```

Do not generate English translations of Korean titles unless a licensed/verified English counterpart is explicitly mapped.

Allowed generated keyword sources:

- article title/question link text;
- category title and category topics;
- scripture reference labels;
- manual overrides in `gotquestions-ko.overrides.json`;
- deterministic Korean token normalization/synonym table maintained in source.

Forbidden keyword sources:

- article body prose;
- LLM summaries of article body;
- copied answer sentences;
- runtime external fetches.

Limits: max 24 keywords per article, max 32 chars per keyword, no keyword containing a sentence-ending punctuation pattern. QA fails keyword fields that contain long Korean prose spans or body-like phrasing.





### 6.2 UI

- 질문 결과에 “GotQuestions Korean 기준 관련 문답” 섹션 추가.
- 각 card: 제목, 카테고리, 연결 성구 chip, 원문 링크, 출처 표시.
- “원문 전문은 GotQuestions.org에서 확인하세요. 이 앱은 제목/링크/성구 연결만 보관합니다.” 고지.
- Mobile behavior: show at most 3 primary article cards before a “더 보기” expansion; passage chips wrap; attribution and external-link icon remain visible without expanding.


## 7. QA 및 99% 기준

99%는 막연한 품질 주장이 아니라 아래 metric을 모두 만족해야 한다.

### 7.1 Ingestion completeness

- Korean sitemap URL 수 대비 indexed URL 수: >= 99%
- Korean home/category에서 노출된 article URL 대비 indexed URL 수: >= 99%
- URL/title/category 중복/누락 fatal 0개

### 7.2 Scripture-link coverage

- 성구를 포함한 article sample에서 reference parser recall >= 99%
- parser precision >= 99%: 잘못된 book/chapter/verse link 1% 미만
- internal Bible DB에 없는 reference는 `unresolvedReferences`로 격리하고 answer evidence에는 넣지 않음

### 7.3 Retrieval match/agreement

Gold set 구성:

- category page title에서 100개 질문 생성
- 각 질문의 expected article URL은 원제목 article
- paraphrase 2개 이상을 추가해 총 100개 user-like questions 유지

Pass 기준:

- expected article top1 >= 90%
- expected article top3 >= 99%
- expected category top1 >= 99%
- generated answer unsupported URL/reference 0개
- GotQuestions body-summary violation 0개
- safety/self-harm 질문은 safety-first policy 100%

### 7.3.1 Fixture buckets

`qa/gotquestions-100.json` must split cases into buckets:

- `gold` (40): direct but natural user questions derived from article titles.
- `paraphrase` (35): indirect wording with no exact title substring where possible.
- `adversarial` (25): typo/spacing variants, multi-intent questions, scripture-only prompts, category-confusable prompts, and safety-sensitive prompts.

Bucket thresholds:

- `gold`: expected article top1 >= 95%, top3 >= 99%.
- `paraphrase`: expected article top3 >= 95%, expected category top1 >= 99%.
- `adversarial`: expected category top1 >= 95%; safety cases must pass safety override 100%.
- Overall: expected article top3 >= 99%, unsupported URL/reference 0, body-summary violation 0.

Stance agreement proxy denominator:

- Every fixture may declare `expectedStanceTags`.
- Agreement denominator = fixtures with non-empty `expectedStanceTags`.
- A case passes stance agreement when every returned deterministic/mocked generated stance tag is included in `expectedStanceTags`, no contradictory tag appears, and answer text does not contain a blocked contradiction phrase configured for that stance.
- Required G003 threshold: stance agreement proxy >= 99% over that denominator, and 100% for `safety_first`.
- This is the measurable phase-1 agreement oracle; it does not claim full theological NLI over GotQuestions body text.

### 7.3.2 Reference parser gold set

Parser precision/recall must not be self-scored from the broad crawl alone. Add two fixture layers:

1. `qa/gotquestions-reference-parser-gold.json`
   - at least 50 synthetic/reference-only snippets;
   - covers Korean abbreviations, full Korean book names, multi-reference separators, verse ranges, comma verses, and invalid references;
   - contains no GotQuestions article prose.

2. URL-level expectation cases inside `qa/gotquestions-100.json`
   - at least 30 real GotQuestions Korean URLs;
   - stores URL, title, and expected refs only, not article body;
   - used to verify extraction against known pages without preserving copyrighted paragraphs.

Broad ingestion may report extracted/unresolved reference counts, but only these fixtures prove the 99% parser claim.


### 7.3.3 Metadata completeness gate

Every classified `article` must pass a required-field checklist:

- nonempty `id`, `slug`, `url`, `titleKo`, `questionTextKo`, `categoryIds`, `attribution`, `copyrightPolicyUrl`;
- `bodyStored === false`;
- canonical URL is unique;
- every `categoryId` resolves to a category;
- every normalized reference resolves against the internal Bible DB;
- unresolved references are reported separately and excluded from answer evidence;
- zero-reference articles are reported as `referenceStatus:"none-detected"` so no-reference pages are distinguishable from parser failure.

Production/deploy guardrail:

- `GOTQUESTIONS_RAG_OPTIONAL=1` is allowed only in isolated local tests.
- QA output must include the optional-mode env value.
- Production build/deploy QA fails if optional mode is set or if the generated index is absent/corrupt.
- User-facing API still degrades safely at runtime if corruption is detected after deployment, but that degradation is a deploy-blocking QA failure.

### 7.3.4 No-AI deterministic QA path

- `qa:gotquestions-rag` runs with Hermes disabled or mocked by default.
- The default 100-question run evaluates retrieval hits, category hits, passage links, metadata policy, body-storage guard, and no-runtime-network guard.
- A separate mocked-generation subtest injects invalid Hermes output to prove unsupported URL/reference/body-summary text is rejected, following the existing `scripts/run-faith-question-qa.mjs` pattern.


### 7.4 100문항 시뮬레이션

생성 방법:

1. GotQuestions Korean category pages에서 질문 제목을 seed로 샘플링한다.
2. 카테고리 균형:
   - salvation 10
   - God/Jesus/Spirit 15
   - Bible/theology 15
   - church/end-times/angels 10
   - humanity/sin/eternity 15
   - marriage/relationships/family 10
   - creation/religions/false beliefs 15
   - life/topical/misc 10
3. 각 seed title을 사용자가 실제로 물을 법한 말투로 변형한다.
4. expected URL/category/reference expectations를 fixture에 기록한다.

Fixture 예:

```json
{
  "id": "gq-ko-salvation-plan-001",
  "query": "구원받으려면 정확히 뭘 믿어야 하나요?",
  "expectedArticleUrl": "https://www.gotquestions.org/Korean/Korean-Plan-Salvation.html",
  "expectedAnyCategoryIds": ["salvation"],
  "expectedAnyReferences": ["JHN-3-16", "ROM-3-23", "ROM-6-23"],
  "expectedStanceTags": ["grace_not_works"],
  "forbidden": ["externalBodyStored", "unsupportedReference"]
}
```

### 7.5 10,000문항 대량 회귀 QA

100문항 curated QA는 실제 품질 판단의 중심이고, 10,000문항 QA는 regression/fuzz layer로 둔다. 대량 QA는 “사용자가 반드시 이렇게 묻는다”는 gold truth가 아니라, GotQuestions Korean article metadata에서 자동 생성한 다양한 질문 표면이 ranking을 깨뜨리지 않는지 확인하는 장치다.

대량 QA case source:

1. Indexed article title/question exact form.
2. Title/question + “성경적으로 설명해줘” 같은 일반 사용자 suffix.
3. “관련 성구를 연결해줘” scripture-link intent.
4. “GotQuestions 기준으로 … 문답을 찾아줘” source-constrained intent.
5. “궁금합니다: …” conversational wrapper.
6. category/topic prefix + article title.
7. adversarial wrapper: “회의적인 사람이 ‘…’라고 물으면 어떻게 답하나요?”

대량 QA pass 기준:

- sample size: 기본 10,000 cases, `--limit`로 조정 가능.
- expected article top1 >= 99%를 목표 지표로 기록한다.
- expected article top3 >= 99%는 hard gate.
- expected category coverage >= 99% hard gate.
- expected reference overlap >= 99% hard gate.
- sampled failures는 최소 100개까지 JSON에 출력해 failure taxonomy를 바로 볼 수 있어야 한다.
- body-storage guard와 runtime network guard는 curated `qa:gotquestions-rag`에서 계속 hard gate로 유지한다.

대량 QA가 잡아야 하는 실패 유형:

- 짧은 성경 책명/title query가 “성경적/성경적인” 같은 일반 형용사 article로 밀리는 문제.
- exact title이 query token으로 들어있는데 category prior가 과도하게 이기는 문제.
- eternity/heaven/death 같은 manual prior가 책명·인명·정확 제목을 덮어쓰는 문제.
- category는 맞지만 reference overlap이 없는 관련 없는 article cluster.
- adversarial wrapper 때문에 핵심 title token이 희석되는 문제.

대량 QA가 증명하지 못하는 것:

- GotQuestions 본문 의미와 생성 답변의 완전한 신학적 NLI 일치.
- 사용자의 모든 open-ended companion 질문 품질.
- companion page의 main Bible passage routing 정확도.

따라서 release gate는 `qa:gotquestions-rag` + `qa:gotquestions-large` + representative companion-page probes + `qa:faith-questions` + `build`를 함께 요구한다. 대량 QA만 단독으로 “99% 완성”이라고 보고하지 않는다.

### 7.6 Companion page representative probes

`qa:gotquestions-large` proves local metadata ranking; it does not prove the actual `/ko/companion` user surface. Add a separate representative page probe gate before release.

Minimum probe set:

1. `천국은 어떤 곳인가? 죽어서 가는 곳인가?`
   - route: `/ko/companion?prompt=...`
   - must show `요한계시록 21:1-5` or `새 하늘과 새 땅` as the main Bible direction.
   - must not show `마태복음 16:16-20` as the main answer.
   - must show the GotQuestions section with a heaven/afterlife article such as `Korean-heaven-like`, `Korean-Heaven-perfect`, `Korean-afterlife`, or `Korean-life-after-death`.
2. `사탄은 누구인가?`
   - must show GotQuestions article `Korean-Satan.html` in the related Q&A section.
   - must include at least one scripture chip from the article metadata.
3. `구원받으려면 무엇을 믿어야 하나요?`
   - must prioritize salvation/plan-of-salvation resources and internal Bible links.
4. `창세기 성경적으로 설명해줘`
   - must not be captured by generic “성경적” articles when the exact book-title article exists in GotQuestions metadata.
5. `회의적인 사람이 '로마서'라고 물으면 어떻게 답하나요?`
   - must keep the exact book-title article in top results despite the adversarial wrapper.

Probe evidence format:

- JSON artifact with `{ route, query, status, assertions, matchedText, forbiddenTextAbsent }`.
- For local/dev runs, HTML text extraction is enough for first implementation.
- Browser automation plus non-uniform screenshot is required only when validating final visual UX changes; metadata/ranking-only changes may use HTML/API probes.
- Every probe must assert body-storage wording or metadata flags where available: no GotQuestions body storage and no runtime GotQuestions body fetch.

Package command:

- Add `qa:companion-probes` when the probe runner is implemented.
- Release gate command set becomes:
  - `npm run qa:gotquestions-rag`
  - `npm run qa:gotquestions-large`
  - `npm run qa:companion-probes`
  - `npm run qa:faith-questions`
  - `npm run build`

### 7.7 QA implementation gap backlog

The current design is accepted only when these implementation gaps are explicitly tracked for G002/G003:

- `qa:gotquestions-rag` must enforce, not merely print, the documented bucket thresholds: gold/paraphrase/adversarial and overall top1/top3/category/reference/stance rates.
- Category expectations must distinguish top1 category versus any top-N category coverage.
- Safety-first fixtures must be explicit and must fail if GotQuestions retrieval outranks safety routing.
- Stance contradiction fixtures must include blocked contradiction phrases, not only positive stance tags.
- GotQuestions-specific invalid generation rejection must be exercised with injected unsupported URL/reference/body-summary output.
- URL classification must keep FAQ/crucial/list pages out of the article denominator unless they represent a single article.
- Reference extraction must validate normalized references against the internal Bible DB and isolate unresolved references from answer evidence.
- Body-storage guard must scan generated artifacts, test artifacts, logs/snapshots created by QA, runtime summaries, and generated keyword fields for body-like prose, not only top-level JSON keys.

## 8. 구현 순서

1. `lib/bible-reference-parser.ts` 추가 또는 기존 parser 통합
2. `scripts/ingest-gotquestions-korean.mjs` 추가
3. `data/faith/gotquestions-ko.index.json` 생성
4. `lib/gotquestions-rag.ts` 추가: load/search/score
5. `lib/faith-question-answer.ts`에 evidence 병합
6. `components/faith-question-form.tsx` 결과 UI에 GotQuestions section 추가
7. `scripts/run-gotquestions-rag-qa.mjs`와 `qa/gotquestions-100.json` 추가
8. `package.json`에 `ingest:gotquestions`, `qa:gotquestions-rag`, `qa:gotquestions-large`, `qa:companion-probes` 추가
9. Fallback/corrupt-index behavior:
   - If the GotQuestions index is absent/corrupt in development or tests, preserve current curated `FAITH_RESOURCES` and `routeFaithQuestion()` behavior and set `meta.gotQuestionsRag.used=false`.
   - Production build/QA must fail if the generated index is absent unless `GOTQUESTIONS_RAG_OPTIONAL=1` is explicitly set for an isolated test.
   - Corrupt index must never crash the user-facing API; it degrades to the current curated router and records `coverage:"none"`.

### 8.1 Exact G002/G003 file targets

Expected implementation files:

- `scripts/ingest-gotquestions-korean.mjs`
- `scripts/run-gotquestions-rag-qa.mjs`
- `lib/bible-reference-parser.ts`
- `lib/gotquestions-rag.ts` search + adapter
- `lib/faith-question-answer.ts`
- `components/faith-question-form.tsx`
- `qa/gotquestions-100.json`
- `data/faith/gotquestions-ko.index.json`
- `qa/gotquestions-reference-parser-gold.json`
- `data/faith/gotquestions-ko.overrides.json`
- `data/faith/gotquestions-ko.source-audit.json`
- `package.json`

## 9. Non-goals

- GotQuestions 본문 전문 저장 또는 자체 article mirror 제공
- GotQuestions를 단일 무오 권위로 표현
- 영어 GotQuestions 전체까지 동시 구현
- 사용자 질문에 대해 외부 페이지를 실시간 fetch해서 본문 요약

## 10. 완료 조건

G002 구현 완료 조건:

- ingestion 산출물 생성 및 검증 통과
- faith question API와 companion page가 GotQuestions article hits와 scripture links를 반환
- `qa:gotquestions-rag`가 bucket/overall threshold, body-storage guard, runtime-network guard, invalid-generation rejection을 hard fail로 강제
- `qa:gotquestions-large`가 10,000개 기본 sweep에서 top3/category/reference >= 99%를 hard fail로 강제하고 top1을 보고
- `qa:companion-probes`가 대표 `/ko/companion` 질의의 HTML/API surface assertion을 hard fail로 강제
- 기존 `qa:faith-questions` 통과

G003 완료 조건:

- `qa/gotquestions-100.json` 100개 fixture 존재
- 100문항 실행 결과 top3 article match >= 99%, category coverage >= 99%, stance proxy >= 99%
- 10,000문항 large QA 결과 top3/category/reference >= 99%, top1 목표 >= 99% 또는 실패 taxonomy 기록 후 source fix
- companion representative probes 100% 통과
- unsupported generated URL/reference 0개
- body fetch/store false 100%
- `npm run qa:gotquestions-rag`, `npm run qa:gotquestions-large`, `npm run qa:companion-probes`, `npm run qa:faith-questions`, `npm run build` full rerun 통과
- 실패가 있으면 수정 후 full rerun
