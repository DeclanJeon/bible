# Hanja Full-Link Harvest Design

## Goal

`/home/declan/Documents/Obsidian Vault/신학/관련링크.md`에 있는 링크들을 전부 열어,
각 링크의 실제 내용과 거기서 다루는 한자·성구·주장을 수집하고,
수동 seed 몇 개만 보여 주는 현재 구조를 **전체 자료 수확형 Hanja corpus**로 바꾼다.

이 설계의 결과는 다음이다.

1. Obsidian 링크 목록이 repo 안으로 동기화된다.
2. 각 링크는 가능한 한 **실제 본문/전사/검색 결과/메타데이터**까지 수집된다.
3. 각 자료에서 언급되는 **한자**, **성구**, **핵심 주장**, **지지/비판 성격**이 추출된다.
4. 수집 결과를 바탕으로 `/hanja`는 더 이상 3~9개의 seed 항목만 보여 주지 않고,
   **소스 전체에서 발견된 문자/주제별 카탈로그**를 보여 준다.
5. `/hanja/[slug]`는 수동 curated entry만이 아니라,
   **수집된 소스 증거 묶음 기반 상세 페이지**를 만들 수 있다.

---

## Current problem

현재 구조는 다음 두 단계에서 멈춰 있다.

- `data/hanja/import/related-links.md`를 파싱해서 `sources.json`만 만든다.
- `entries.json`에는 사람이 직접 몇 개의 seed entry만 넣는다.

즉 지금은:
- 링크는 많이 있는데
- 실제 본문 수집은 안 했고
- 어떤 한자가 몇 개 자료에서 다뤄지는지 집계도 없고
- 페이지도 seed 몇 개만 노출된다.

이걸 **링크 카탈로그**에서 **콘텐츠 수확 시스템**으로 바꿔야 한다.

---

## Non-negotiable product rules

1. **Vault 원본을 직접 runtime source로 쓰지 않는다.**
   - 런타임은 repo 안 복사본만 읽는다.
   - Vault 파일은 import source다.

2. **출처와 해석 성격을 분리한다.**
   - supportive / critical / unclear
   - source type별 수집 방식이 달라도 provenance는 유지한다.

3. **책 페이지/검색 페이지/채널 페이지는 성격이 다르다.**
   - 기사/블로그/논문/PDF: 본문 수집 우선
   - YouTube video/channel: 메타데이터 + transcript/description 우선
   - RISS/Baidu/Naver search: 결과 목록 snapshot 우선
   - 서점/도서 정보: 메타데이터 우선, full text 기대 금지

4. **자동 추출과 공개 노출을 분리한다.**
   - 수집은 넓게
   - 공개 노출은 confidence와 source coverage 기준으로 좁게

5. **한자 페이지는 더 이상 전부 수동 작성하지 않는다.**
   - 수동 curated entry는 남기되
   - harvested entry layer가 기본 카탈로그를 채운다.

---

## Target architecture

```text
Vault related-links.md
→ repo import sync
→ link manifest parse
→ source classifier
→ content fetchers by source type
→ normalized raw snapshots
→ extraction pipeline
   - hanja extraction
   - bible reference extraction
   - claim segment extraction
   - keyword/topic extraction
→ source evidence store
→ character/topic aggregate store
→ published hanja catalog / detail views
```

---

## Source classes

### 1. Article / news / church page / blog / reference page
Examples:
- Londontimes
- creation.kr
- fgnews
- KeepBible
- church article pages
- Naver blog posts

Harvest target:
- canonical URL
- title
- publisher
- author if present
- publish date if present
- extracted article text
- headings / sections
- hanja mentioned
- Bible references mentioned
- quoted claims
- stance

### 2. PDF / paper
Examples:
- Creation.com PDF
- Sino-Platonic Papers

Harvest target:
- title
- file URL
- extracted text
- page count if available
- hanja mentioned
- Bible references mentioned
- quoted claims
- stance

### 3. YouTube video
Harvest target:
- video metadata
- description
- transcript via local y2md path when available
- title/description/transcript에서 나온 한자
- title/description/transcript에서 나온 성구
- summary / key claims

### 4. YouTube channel
Harvest target:
- channel metadata
- channel video list
- each video normalized into the video harvest pipeline

### 5. Search page
Examples:
- RISS
- Baidu

Harvest target:
- query
- top result titles/urls/snippets
- snapshot time
- result page text if accessible
- direct claim extraction은 약하게, lead-only role 유지

### 6. Book metadata page
Examples:
- Kyobo / Yes24 / book pages

Harvest target:
- title
- author
- ISBN
- publisher
- summary blurb if exposed
- purchase/info links
- no full-book-text expectation

---

## Repo artifacts

### Input
- `data/hanja/import/related-links.md`
- optional sync source: `/home/declan/Documents/Obsidian Vault/신학/관련링크.md`

### Raw manifests
- `data/hanja/manifest.json`
  - parsed source list
  - source type
  - stance
  - import metadata

### Raw harvest outputs
- `data/hanja/harvest/pages/<source-id>.json`
- `data/hanja/harvest/pages/<source-id>.md`
- `data/hanja/harvest/youtube/<video-id>.json`
- `data/hanja/harvest/search/<source-id>.json`

### Normalized extracted outputs
- `data/hanja/extracted/source-evidence.json`
- `data/hanja/extracted/character-mentions.json`
- `data/hanja/extracted/bible-mentions.json`
- `data/hanja/extracted/claims.json`
- `data/hanja/extracted/topic-index.json`

### Published catalog outputs
- `data/hanja/sources.json`
- `data/hanja/entries.json` (manual curated + generated aggregate merge)
- `data/hanja/published-characters.json`

---

## Data contracts

### Normalized source document

```ts
type HanjaHarvestDocument = {
  sourceId: string;
  sourceType: "article" | "blog" | "paper" | "pdf" | "video" | "channel" | "search" | "book" | "reference";
  canonicalUrl: string;
  fetchedAt: string;
  title: string;
  publisher?: string | null;
  author?: string | null;
  publishDate?: string | null;
  language: "ko" | "en" | "zh" | "mixed";
  stance: "supportive" | "critical" | "unclear";
  contentText: string;
  contentMarkdown?: string | null;
  contentSummary?: string | null;
  metadata: Record<string, unknown>;
};
```

### Character mention

```ts
type HanjaCharacterMention = {
  sourceId: string;
  character: string;
  normalizedCharacter: string;
  reading?: string | null;
  count: number;
  titleMention: boolean;
  contexts: string[];
  confidence: "high" | "medium" | "low";
};
```

### Bible mention

```ts
type HanjaBibleMention = {
  sourceId: string;
  referenceLabel: string;
  normalizedReference?: BibleReference | null;
  mentionType: "explicit" | "implicit";
  contexts: string[];
  confidence: "high" | "medium" | "low";
};
```

### Claim segment

```ts
type HanjaClaimSegment = {
  sourceId: string;
  claimId: string;
  text: string;
  claimType: "etymology" | "theology" | "historical" | "apologetic" | "critical" | "summary";
  relatedCharacters: string[];
  relatedReferences: string[];
  confidence: "high" | "medium" | "low";
};
```

### Published character aggregate

```ts
type PublishedHanjaCharacter = {
  slug: string;
  character: string;
  reading?: string | null;
  title: { ko?: string; en?: string };
  sourceCount: number;
  supportiveCount: number;
  criticalCount: number;
  leadSourceIds: string[];
  relatedPassages: BibleReference[];
  keywordSummary: string[];
  curated: boolean;
};
```

---

## Fetching strategy by source type

### Article / blog / church page
- first try `read(URL)` for reader-mode extraction
- keep raw/canonical URL metadata
- if article shell is broken, fallback to browser open + extract text
- save normalized markdown/text snapshot

### PDF / paper
- use `read(URL)` for extraction
- save extracted text and page metadata

### YouTube video
- collect metadata from URL
- transcript via y2md-compatible backend path when available
- if no transcript, still save title/description/keywords

### YouTube channel
- expand channel into videos first
- then ingest per video
- never publish channel page itself as if it were evidence text

### Search page (RISS/Baidu)
- browser snapshot or reader extraction of result page
- save top-N result titles/snippets/urls
- mark `catalogRole: lead`
- do not treat result lists as equal to article evidence

### Book pages
- collect book metadata only
- title, author, ISBN, publisher, summary blurb
- no fake full text

---

## Extraction pipeline

### Step 1. Character extraction
Use Unicode Han ranges plus title heuristics.

Rules:
- extract every unique hanja character in title and body
- preserve compounds too
- count per source
- keep short context windows
- keep titleMention flag separate

Outputs:
- source → characters
- character → sources reverse index

### Step 2. Reference extraction
Reuse the project’s Bible reference normalizer.

Need to capture:
- explicit references: `창 1:1`, `요 1:1`, `Romans 3:21-26`
- implicit labels when safely mappable: `창세기 1장 1절`, `산상수훈`

### Step 3. Claim extraction
Split content into short claim-like segments.

Examples:
- `義는 양과 나로 구성되어 희생을 통한 의를 가리킨다`
- `이 해석은 설문해자보다 후대의 기독교적 독해일 수 있다`

Each segment stores:
- claim type
- related characters
- related Bible mentions
- source stance inheritance

### Step 4. Topic extraction
Generate normalized tags:
- creation
- fall
- sacrifice
- righteousness
- blessing
- clothing
- nakedness
- revelation
- spirit
- origin

### Step 5. Published aggregate generation
For each character:
- gather supportive/critical sources
- choose top references by frequency and confidence
- choose lead sources
- build fallback generated page model

---

## Published UX changes

### `/hanja`
Current:
- curated seed cards only

Target:
- tabs or filters:
  - curated
  - all harvested characters
  - by topic
  - by source coverage
- sort options:
  - most sources
  - most Bible references
  - newly harvested
  - supportive/critical mixed

### `/hanja/[slug]`
Target sections:
1. character + reading
2. generated summary or curated thesis
3. main related passages
4. supportive sources
5. critical sources
6. extracted claim segments
7. related characters
8. source coverage stats

Rule:
- curated entry exists → curated text wins
- otherwise generated aggregate page is rendered

---

## Migration plan

### Phase 1. Manifest + raw harvest
- sync vault markdown into repo import file
- build parsed manifest
- classify all links
- fetch and store raw snapshots

### Phase 2. Extraction
- character extraction
- Bible reference extraction
- claim segmentation
- source evidence JSON generation

### Phase 3. Published aggregate layer
- generate character aggregates
- expand `/hanja` list beyond curated entries
- support generated detail pages

### Phase 4. Curated merge
- keep hand-written entries for high-value characters
- generated entries fill the long tail

---

## Operational rules

1. Rebuild command should be explicit.
   - `sync -> harvest -> extract -> publish`

2. Network failures must not delete older snapshots.
   - last good harvest stays readable

3. Each source keeps provenance.
   - imported line
   - original URL
   - fetched timestamp
   - fetch method

4. Low-confidence implicit mappings are hidden by default.
   - stored internally
   - not surfaced as primary evidence unless reviewed

5. Search pages and book pages are not treated as equal to direct content pages.

---

## Acceptance criteria

The design is considered implemented only when:

1. `related-links.md`의 모든 링크가 manifest에 들어간다.
2. 각 링크는 source type으로 분류된다.
3. 가능한 링크는 raw text/markdown snapshot까지 저장된다.
4. 각 source에 대해 한자 mention과 성구 mention이 추출된다.
5. `/hanja`가 curated seed 몇 개만이 아니라 harvested characters를 보여 준다.
6. generated character pages가 supportive/critical source를 함께 보여 준다.
7. 수집 실패 source도 실패 상태와 함께 카탈로그에 남는다.
8. provenance 없이 게시되는 한자/성구/주장 정보가 없다.

---

## Immediate implication

지금 필요한 다음 구현은 seed entry 몇 개를 더 넣는 수준이 아니라,
**`related-links.md` 전체를 실제 콘텐츠 수확 파이프라인으로 바꾸는 것**이다.

즉 다음 작업의 중심은:
- parser 개선
- fetcher 추가
- source snapshot 저장
- character/reference extraction
- generated aggregate publishing

이다.
