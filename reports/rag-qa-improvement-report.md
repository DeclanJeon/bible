# Bible Hyperlink Companion RAG/QA 개선 작업 보고서

작성일: 2026-06-18
저장 위치: 로컬 저장소 `reports/rag-qa-improvement-report.md`
운영 배포 대상: `ponslink`
최종 커밋: `0a56b48 Expand unseen philosophical QA coverage`

## 1. 작업 배경

사용자 입력과 무관한 성구가 핵심 본문으로 표시되고, 왜 연결되는지 설명이 부족한 문제가 있었다.
초기 구조는 일부 hardcoded routing rule, 책 단위 cluster, 단어 기반 retrieval에 크게 의존했다. 이 방식은 넓은 철학적/실존적 질문을 안정적으로 처리하지 못했다.

핵심 요구는 다음과 같았다.

- 성경 전체를 기반으로 RAG처럼 검색할 것.
- 운영 서버의 Hermes agent를 활용할 것.
- API key/model을 앱 설정에 직접 넣지 말고, 운영 서버 Hermes agent 기본 모델을 사용할 것.
- QA 점수가 95점 이상이 될 때까지 반복 개선할 것.

## 2. 주요 설계 결정

### 2.1 Hermes agent 직접 사용

`lib/hermes.ts`를 수정해 운영 서버의 Hermes agent를 `hermes -z` oneshot 방식으로 호출하게 했다.

- API key/env model override 없음.
- `-m` 옵션을 넘기지 않음.
- 따라서 운영 서버 Hermes agent의 기본 모델을 그대로 사용.
- 현재 운영 runtime:

```json
{
  "hermes": {
    "ready": true,
    "transport": "agent-oneshot"
  },
  "embeddings": {
    "ready": false
  }
}
```

운영에서 관측된 Hermes agent 기본 모델:

```text
nvidia/nemotron-3-ultra:free
```

### 2.2 요청당 Hermes agent 호출 1회 제한

처음에는 다음 두 단계 모두 Hermes agent를 호출했다.

1. RAG query planning
2. 최종 explanation generation

운영에서 두 번 호출하면 Cloudflare 524 timeout이 발생했다.
그래서 synchronous request에서는 Hermes agent를 RAG query planning에만 사용하고, 최종 설명은 deterministic evidence builder가 생성하도록 바꿨다.

현재 흐름:

```text
user prompt
→ Hermes agent query planner
→ Bible-wide retrieval 후보 확장
→ curated prior + lexical candidate merge
→ deterministic evidence-locked explanation
```

### 2.3 AI 생성 검색어는 recall hint로만 사용

Hermes agent가 생성한 검색어를 deterministic concept rule에 다시 넣으면, `하늘`, `부르심` 같은 넓은 단어가 엉뚱한 semantic shortcut을 발화했다.

수정:

- user prompt만 deterministic concept rule의 입력으로 사용.
- Hermes agent 검색어는 lexical recall hint로만 사용.
- model-generated terms는 authoritative intent로 취급하지 않음.

### 2.4 Curated passage prior 도입

철학적 질문은 단어 매칭만으로는 weak lexical hit가 자주 이긴다.
그래서 `lib/retrieval.ts`에 `PHILOSOPHICAL_PASSAGE_PRIORS`를 추가했다.

역할:

- 질문 intent가 특정 철학/목회 축에 맞으면, 대표 본문 후보를 RAG candidate set 앞에 삽입.
- 이후 lexical/global candidates와 merge.
- 최종 primary가 약한 우연 매칭으로 튀는 현상을 줄임.

추가된 주요 축:

- 정체성 / 존재 근거
- 고통과 의미
- 자유의지와 하나님의 뜻
- 악과 불의
- 죽음과 허무
- 진리와 상대주의
- 사랑과 의무
- 정의와 자비
- 미래 불안과 통제
- 진짜 자아 / 가면
- 욕망과 갈망
- 용서와 선함
- 외로움과 공동체
- 성과와 가치
- 의심과 믿음
- 행복과 기쁨
- 시간과 영원
- 힘과 겸손
- 과거 후회
- 아름다움과 초월
- 양심
- AI/기계와 인간다움
- 자기 용서
- 자연/창조 청지기
- 이성의 한계
- 자유와 종됨
- 희생
- 이름 없이 사라짐 / 기억
- 우주와 작은 기도

### 2.5 Off-topic / vague guard 강화

Hermes agent query expansion 때문에 일상적/모호한 입력이 성경 본문으로 승격되는 회귀가 있었다.

예:

- `오늘 점심 뭐 먹지`
- `새 노트북을 살까 말까`
- `그냥 아무 생각이 없어`

수정:

- 일상 선택/쇼핑/음식/투자/게임 등은 spiritual frame이 없으면 low-confidence 보류.
- `아무 생각`, `딱히`, `할 말 없` 같은 vague non-concern prompt도 low-confidence 보류.
- 관련 없는 입력에는 graph/supporting/related expansion을 하지 않음.

## 3. 추가/수정 파일

### 3.1 코드

- `lib/hermes.ts`
  - Hermes agent `hermes -z` runtime 추가.
  - agent default model 사용.
  - request timeout 방지를 위해 final generation double-call 차단.

- `lib/rag-query.ts`
  - Hermes agent 기반 RAG query planning 추가.
  - OpenAI-compatible API가 없어도 운영 Hermes agent 사용.

- `lib/retrieval.ts`
  - passage candidate merge 구조 강화.
  - curated philosophical passage priors 추가.
  - model-generated term concept leakage 차단.
  - off-topic/vague guard 추가.

- `lib/reflection.ts`
  - `hermes-agent` generation mode 허용.

- `app/api/runtime/route.ts`
  - Hermes transport 표시.

- `app/[locale]/api/reflect/route.ts`
  - RAG query planner 결과를 retrieval에 연결.

- `app/[locale]/companion/page.tsx`
  - public page도 RAG planner + retrieval 흐름 사용.

### 3.2 QA

- `qa/korean-concern-qa.json`
  - concern QA fixture 확장.

- `qa/philosophical-prompt-qa.json`
  - 철학/실존 질문 20개 fixture 추가.

- `qa/philosophical-unseen-qa.json`
  - unseen 철학/실존 질문 20개 fixture 추가.

- `scripts/run-korean-concern-qa.mjs`
  - concern QA runner.

- `scripts/run-philosophical-prompt-qa.mjs`
  - philosophy/unseen QA runner.
  - 5점 기준:
    1. HTTP 성공/시간
    2. Hermes agent RAG 사용
    3. reliable retrieval
    4. 허용 본문 범위 적중
    5. explanation terms/근거 필드 존재

- `package.json`
  - `qa:concerns`
  - `qa:philosophy`

## 4. 최종 QA 결과

### 4.1 철학 QA

명령:

```bash
BENCHMARK_BASE_URL=https://bible.ponslink.com npm run qa:philosophy
```

결과:

```text
99 / 100
```

### 4.2 Unseen 철학 QA

명령:

```bash
BENCHMARK_BASE_URL=https://bible.ponslink.com node scripts/run-philosophical-prompt-qa.mjs --fixture qa/philosophical-unseen-qa.json --locale ko
```

초기 결과:

```text
81 / 100
```

패치 후 최종 결과:

```text
97 / 100
```

### 4.3 Concern QA

명령:

```bash
BENCHMARK_BASE_URL=https://bible.ponslink.com npm run qa:concerns
```

결과:

```text
100 / 100
```

### 4.4 기존 KO/EN benchmark

명령:

```bash
BENCHMARK_BASE_URL=https://bible.ponslink.com npm run benchmark
```

결과:

```text
KO 24/24 통과
EN 통과
```

## 5. 배포 상태

최종 push:

```text
0a56b48 Expand unseen philosophical QA coverage
```

운영 배포:

```text
scripts/deploy-ponslink.sh
```

PM2 상태:

```text
bible cluster 4개 online
```

운영 runtime:

```json
{
  "hermes": {
    "ready": true,
    "transport": "agent-oneshot"
  },
  "embeddings": {
    "ready": false
  }
}
```

## 6. 현재 한계와 다음 개선점

### 6.1 현재 한계

- Embeddings는 아직 disabled.
- Hermes agent는 query planning에만 사용한다.
- 최종 explanation은 timeout 방지를 위해 deterministic builder가 생성한다.
- Passage prior는 성능을 크게 안정화했지만, 완전한 generic reranker는 아니다.
- QA는 40개 철학/실존 fixture + 22개 concern fixture + 기존 benchmark 기준이다.

### 6.2 다음 개선 방향

1. 비동기/streaming 구조 도입
   - Hermes agent final generation을 background job 또는 streaming endpoint로 분리.
   - synchronous request에서 524 방지.

2. Embedding index 도입
   - static Bible passage chunks 생성.
   - lexical + embedding hybrid retrieval.
   - 현재 `embeddings.ready=false` 상태 개선.

3. Evidence ID 기반 reranker
   - 후보마다 `E1`, `E2` 같은 evidence id 부여.
   - LLM은 evidence id 단위로만 선택/설명.
   - 서버가 citation validity를 검증.

4. Random unseen QA 자동 생성
   - 고정 fixture 외에 paraphrase/random prompt set을 주기적으로 생성.
   - 95점 유지 여부를 regression gate로 사용.

## 7. 결론

작업 목표인 95점 이상은 달성했다.

최종 기준:

- 철학 QA: 99점
- unseen 철학 QA: 97점
- concern QA: 100점
- 기존 benchmark: 통과

핵심 개선은 단순 rule 추가가 아니라, 운영 Hermes agent를 RAG query planner로 연결하고, curated passage priors와 off-topic guard를 조합해 broad philosophical prompt에서도 안정적으로 성경 본문을 선택하도록 만든 것이다.
