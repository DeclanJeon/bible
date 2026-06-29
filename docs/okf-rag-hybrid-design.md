# OKF 기반 성경 컴패니언 RAG 하이브리드 설계

작성일: 2026-06-29  
대상: `bible.ponslink.com` 성경 컴패니언 / 신앙 질문 API / GotQuestions Korean 메타데이터  
상태: 구현 전 설계 문서

## 1. 결론

OKF(Open Knowledge Format)는 현재 GotQuestions RAG 런타임을 대체하지 않는다. OKF는 검색 엔진이 아니라 사람이 읽고 agent가 검토하기 좋은 지식 번들 형식이다. 따라서 적용 방향은 다음 하이브리드 구조가 맞다.

```txt
OKF bundle: docs/okf/                         # 사람/agent/QA가 검토하는 지식 원본과 운영 지식
  -> OKF validator                             # 구조, frontmatter, 링크 검증
  -> generated compact index                   # 런타임용 JSON/SQLite
  -> lib/gotquestions-rag.ts                   # 현재처럼 빠른 local-data retrieval
  -> companion / faith-question API
```

기대 효과는 요청당 검색 속도 향상이 아니라 다음이다.

1. GotQuestions 문답-성구-카테고리 연결을 더 명시적으로 관리한다.
2. QA fixture와 실패 사례를 지식 번들 안에 지속적으로 축적한다.
3. RAG가 왜 특정 문답/성구를 선택했는지 추적 가능하게 만든다.
4. 생성 산출물과 저작권 경계(`bodyStored:false`)를 문서/검증으로 고정한다.
5. 장기적으로 10,000문항 QA 실패를 OKF concept 단위로 보정할 수 있게 한다.

## 2. 현재 상태 요약

현재 RAG 설계의 핵심 문서는 `docs/gotquestions-rag-design.md`다. 현재 구현은 다음 경계를 가진다.

- 런타임 검색: `lib/gotquestions-rag.ts`
- 생성 인덱스: `data/faith/gotquestions-ko.index.json`
- 원본 감사: `data/faith/gotquestions-ko.source-audit.json`
- 수동 보정: `data/faith/gotquestions-ko.overrides.json`
- QA:
  - `scripts/run-gotquestions-rag-qa.mjs`
  - `scripts/run-gotquestions-large-qa.mjs`
  - `scripts/run-companion-probes.mjs`
  - `scripts/run-faith-question-qa.mjs`

현재의 좋은 점:

- 런타임은 GotQuestions.org 네트워크 호출 없이 로컬 인덱스로 동작한다.
- GotQuestions 본문 전문을 저장하지 않고 제목/URL/분류/성구 메타데이터만 보관한다.
- 10,000문항 QA로 match/top3/category/reference를 측정한다.

현재의 약점:

- JSON 인덱스는 기계 처리에는 좋지만 사람이 개별 문답의 의도/실패 패턴을 검토하기 어렵다.
- QA 실패가 장기 지식으로 축적되지 않으면 같은 유형의 실패가 반복될 수 있다.
- 설계 문서, 운영 지식, generated data, QA fixture가 서로 흩어져 있다.

## 3. OKF 적용 원칙

### 3.1 대체가 아니라 상위 지식 레이어

OKF를 런타임 검색 포맷으로 직접 사용하지 않는다. Markdown 파일 1,000개 이상을 매 요청마다 읽고 파싱하면 JSON/SQLite보다 불리하다. OKF는 build/QA/curation 레이어로만 사용한다.

### 3.2 런타임 불변식 유지

다음 정책은 변경하지 않는다.

- `/ko/companion`과 `/api/faith-questions`는 GotQuestions.org를 fetch하지 않는다.
- GotQuestions article body/html/markdown/paragraph/excerpt를 저장하지 않는다.
- UI는 원문 전문을 GotQuestions.org에서 확인하도록 안내한다.
- 생성 모델은 제공된 성구/URL/resource만 사용할 수 있다.

### 3.3 OKF concept은 안전 메타데이터만 포함

OKF article concept에 저장 가능한 항목:

- article id
- slug
- canonical URL
- Korean title/question line
- category ids
- topics/keywords
- normalized Scripture references
- QA aliases/paraphrases
- known ambiguous patterns
- source/copyright attribution
- `bodyStored: false`

저장 금지:

- GotQuestions 본문 전문
- 긴 본문 요약
- article paragraph/excerpt/quote
- HTML/markdown body cache
- 원문을 대체할 정도의 해설

## 4. 목표 구조

```txt
.okf.json
AGENTS.md                                      # OKF 읽기/갱신 규칙 추가 또는 병합
scripts/
  init-okf-bundle.mjs                         # create-okf-app 기반 skeleton
  validate-okf-bundle.mjs                     # OKF 구조/link/frontmatter 검증
  build-gotquestions-okf.mjs                  # 현재 safe JSON -> OKF concepts 생성
  build-gotquestions-index-from-okf.mjs       # OKF concepts -> runtime compact index 생성

docs/okf/
  index.md
  log.md
  systems/
    project-overview.md
    companion-rag.md
    gotquestions-ingestion.md
    faith-question-generation.md
    qa-gates.md
  operations/
    production-readiness.md
    rag-release-checklist.md
    body-storage-policy.md
  references/
    repository-readme.md
    gotquestions-source-policy.md
  gotquestions/
    index.md
    categories/
      salvation.md
      eternity.md
      bible.md
    articles/
      gq-ko-plan-salvation.md
      gq-ko-satan.md
      ...
    qa/
      known-failures.md
      large-qa-policy.md
      companion-probes.md
```

## 5. Concept 설계

### 5.1 `GotQuestions Article Metadata`

파일 경로:

```txt
docs/okf/gotquestions/articles/<article-id>.md
```

`article-id`를 파일명으로 사용한다. URL slug만 사용하면 충돌 가능성이 있으므로 금지한다.

예시:

```md
---
type: GotQuestions Article Metadata
title: "구원의 계획 / 구원의 길이란 무엇인가?"
description: "구원의 계획 / 구원의 길이란 무엇인가?"
resource: https://www.gotquestions.org/Korean/Korean-Plan-Salvation.html
tags: [gotquestions, salvation]
timestamp: 2026-06-29T00:00:00Z
bodyStored: false
articleId: gq-ko-plan-salvation
slug: Korean-Plan-Salvation
primaryCategoryId: salvation
referenceStatus: linked
---

# Question

구원의 계획 / 구원의 길이란 무엇인가?

# Scripture links

- 요한복음 3:16
- 로마서 3:23
- 로마서 6:23

# Retrieval hints

- canonical question: 구원의 계획 / 구원의 길이란 무엇인가?
- safe aliases: 구원받으려면 무엇을 믿어야 하나요, 구원의 길
- category intent: salvation

# Boundaries

- bodyStored: false
- 원문 전문은 GotQuestions.org 링크에서 확인한다.
- 이 concept은 제목, 링크, 분류, 성구 연결만 보관한다.

# Citations

[GotQuestions Korean](https://www.gotquestions.org/Korean/Korean-Plan-Salvation.html)
```

### 5.2 `GotQuestions Category`

파일 경로:

```txt
docs/okf/gotquestions/categories/<category-id>.md
```

내용:

- category id/title/url/order
- 포함 article count
- 대표 topics
- 우선순위 및 manual prior 규칙
- 관련 QA expectations

### 5.3 `RAG QA Case`

파일 경로:

```txt
docs/okf/gotquestions/qa/<case-id>.md
```

용도:

- 10,000문항 중 실패/경계 사례를 사람이 읽을 수 있게 보관한다.
- 단순 pass 케이스 전체를 OKF에 저장하지 않는다. 전체 대량 케이스는 generated artifact로 유지하고, OKF에는 실패/대표/회귀 케이스만 둔다.

필드:

- query
- expectedArticleIds
- expectedCategoryIds
- expectedReferenceKeys
- forbiddenArticleIds
- failureMode
- resolution

## 6. 데이터 흐름

### 6.1 초기 도입 흐름

```txt
create-okf-app generic skeleton
  -> docs/okf baseline 생성
  -> 현재 docs/gotquestions-rag-design.md 내용을 systems/companion-rag.md에 요약/링크
  -> 현재 data/faith/gotquestions-ko.index.json에서 safe metadata만 OKF article concepts로 생성
  -> validate-okf-bundle
```

초기에는 runtime index를 OKF에서 역생성하지 않는다. 먼저 OKF bundle이 현재 인덱스를 정확히 표현하는지 검증한다.

### 6.2 안정화 이후 흐름

```txt
scripts/ingest-gotquestions-korean.mjs
  -> safe raw metadata/audit
  -> scripts/build-gotquestions-okf.mjs
  -> docs/okf/gotquestions/**/*.md
  -> scripts/validate-okf-bundle.mjs
  -> scripts/build-gotquestions-index-from-okf.mjs
  -> data/faith/gotquestions-ko.index.json
  -> QA gates
```

이 단계부터 OKF가 source-of-truth가 된다. 단, GotQuestions 본문은 여전히 저장하지 않는다.

## 7. 검색 품질 개선 지점

OKF 도입만으로 검색 점수가 좋아지지는 않는다. 품질 개선은 OKF에 다음 정보를 명시하면서 발생한다.

1. `safe aliases`
   - 사용자가 실제로 묻는 자연어 변형을 concept별로 기록한다.
   - 예: “천국은 죽어서 가는 곳인가”, “사후세계는 어떤 곳인가”.

2. `ambiguous patterns`
   - 같은 단어가 여러 category에 걸치는 경우 disambiguation 규칙을 기록한다.
   - 예: “하늘”은 물리적 하늘/천국/새 하늘과 새 땅을 구분해야 한다.

3. `expected references`
   - article별 핵심 성구를 normalized key로 기록한다.
   - QA가 top hit뿐 아니라 성구 연결의 일치도까지 검증한다.

4. `negative examples`
   - 잘못 매칭되면 안 되는 article/category를 명시한다.
   - 예: 천국 질문이 `MAT 16:16-20`으로 떨어지는 회귀를 금지한다.

5. `probe coverage`
   - companion UI에서 실제 표시되는 문장 중복, GotQuestions 링크, 성구 본문을 함께 검증한다.

## 8. QA 게이트 설계

OKF 도입 후 필수 게이트:

```txt
npm run okf:validate
npm run qa:gotquestions-rag
npm run qa:gotquestions-large
npm run qa:companion-probes
npm run qa:faith-questions
npm run build
```

추가할 검증:

1. OKF body-storage guard
   - `docs/okf/gotquestions/**/*.md`에 금지 필드/본문 흔적이 있는지 검사한다.
   - 금지어: `articleBody`, `html`, `markdown`, `paragraph`, `quote`, `excerpt`, `answerBody`, `contentBody`.

2. OKF/index parity
   - OKF article count와 generated JSON article count 일치.
   - article id/url/category/referenceStatus 일치.
   - `bodyStored:false` 전역 일치.

3. QA fixture extraction
   - OKF `safe aliases`와 `negative examples`를 QA fixture로 추출한다.
   - 실패 사례가 OKF에 등록되면 다음 QA부터 자동 회귀 케이스가 된다.

4. Companion duplicate guard
   - representative probes에서 질문 문장 즉시 반복, 같은 설명 블록 반복을 실패 처리한다.

## 9. 단계별 구현 계획

### Phase 1 — OKF skeleton 도입

변경 파일:

- `.okf.json`
- `docs/okf/index.md`
- `docs/okf/log.md`
- `docs/okf/systems/project-overview.md`
- `docs/okf/systems/companion-rag.md`
- `docs/okf/operations/body-storage-policy.md`
- `docs/okf/references/gotquestions-source-policy.md`
- `scripts/init-okf-bundle.mjs`
- `scripts/validate-okf-bundle.mjs`
- `package.json` scripts

Acceptance:

- `npm run okf:validate` 통과.
- 기존 RAG runtime 동작 변경 없음.

### Phase 2 — GotQuestions OKF mirror 생성

변경 파일:

- `scripts/build-gotquestions-okf.mjs`
- `docs/okf/gotquestions/articles/*.md`
- `docs/okf/gotquestions/categories/*.md`
- `docs/okf/gotquestions/index.md`

Acceptance:

- OKF article count = `data/faith/gotquestions-ko.index.json.articles.length`.
- OKF concept는 safe metadata만 포함.
- `npm run okf:validate` 통과.
- `npm run qa:gotquestions-rag` 통과.

### Phase 3 — OKF QA cases 연동

변경 파일:

- `scripts/build-gotquestions-qa-from-okf.mjs`
- `scripts/run-gotquestions-rag-qa.mjs`
- `scripts/run-gotquestions-large-qa.mjs`
- `scripts/run-companion-probes.mjs`
- `docs/okf/gotquestions/qa/*.md`

Acceptance:

- OKF QA cases가 curated QA fixture에 반영된다.
- “천국은 어떤 곳인가? 죽어서 가는 곳인가?” 회귀 금지 케이스 포함.
- 중복 출력 guard 포함.

### Phase 4 — OKF source-of-truth 전환

변경 파일:

- `scripts/build-gotquestions-index-from-okf.mjs`
- `scripts/ingest-gotquestions-korean.mjs`
- `data/faith/gotquestions-ko.index.json` 생성 경로

Acceptance:

- OKF -> JSON 생성물이 기존 JSON과 parity를 유지한다.
- 대량 QA top1/top3/category/reference 기준 유지 또는 개선.
- runtime 성능 회귀 없음.

## 10. 성능 판단

OKF markdown direct runtime parse는 권장하지 않는다. 사전 프로토타입 기준으로 JSON 검색과 OKF markdown 검색은 같은 hit 수를 냈지만, OKF는 파일 walk/parse 비용과 운영 복잡도가 있다. 런타임은 다음 중 하나를 유지한다.

1. 현재 JSON in-memory index
2. SQLite FTS 또는 prebuilt compact search table

OKF는 build-time source/QA layer로만 둔다.

## 11. 위험과 대응

| 위험 | 대응 |
| --- | --- |
| OKF article concept 1,400개 이상으로 repo noise 증가 | generated marker와 deterministic formatting 적용 |
| 본문 저장 정책 위반 | body-storage guard를 OKF validator와 RAG QA 양쪽에 적용 |
| OKF와 JSON 불일치 | parity test 필수화 |
| 성능 저하 | runtime은 OKF를 읽지 않고 compact index만 사용 |
| 수동 수정과 generated file 충돌 | OKF article concept의 generated 영역과 manual curation 영역 분리 |
| agent가 OKF를 문서만 보고 런타임 사실로 오해 | `systems/companion-rag.md`에 source-of-truth 단계 명시 |

## 12. 구현 전 체크리스트

- [ ] 현재 로컬 미커밋 변경 확인 및 사용자 작업 분리.
- [ ] `create-okf-app --here --template generic --skip-git --force`를 직접 적용할지, 필요한 파일만 이식할지 결정.
- [ ] `AGENTS.md`가 없으면 새로 만들되, 기존 agent 지침과 충돌하지 않게 작성.
- [ ] OKF skeleton만 먼저 커밋 가능한 단위로 도입.
- [ ] GotQuestions OKF mirror는 별도 커밋/PR 단위로 도입.
- [ ] QA case 연동은 mirror 안정화 후 진행.

## 13. 최종 권고

바로 RAG를 OKF로 바꾸지 말고, 다음 순서로 적용한다.

1. OKF skeleton과 validator를 repo에 추가한다.
2. 현재 RAG 설계와 운영 정책을 OKF systems/operations concept로 옮긴다.
3. GotQuestions safe metadata를 OKF article/category concepts로 mirror한다.
4. OKF QA cases를 curated QA에 연결한다.
5. parity가 안정되면 OKF -> runtime JSON/SQLite 생성으로 source-of-truth를 전환한다.

이 방식이면 검색 속도는 유지하면서, RAG 품질 관리·회귀 방지·사람/agent 검토 가능성이 좋아진다.
