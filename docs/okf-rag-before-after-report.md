# OKF 반영 전후 비교 분석 보고서

작성일: 2026-06-29  
대상: 성경 컴패니언 GotQuestions Korean RAG / OKF 하이브리드 적용

## 1. 요약

OKF 적용은 런타임 RAG 검색 엔진을 교체한 작업이 아니다. 기존 런타임은 계속 `data/faith/gotquestions-ko.index.json` 기반 compact local index를 사용한다. OKF는 `docs/okf/` 아래에 지식 관리, QA 회귀 사례, 운영 정책, GotQuestions safe metadata mirror를 보관하는 build/QA/curation 레이어로 추가되었다.

따라서 기대 효과는 요청당 검색 속도 개선이 아니라 다음이다.

- RAG 지식 구조의 설명 가능성 강화
- GotQuestions 문답/성구/카테고리 연결의 사람 검토 가능성 강화
- QA 실패 및 회귀 사례의 장기 축적
- 본문 미저장 정책의 검증 범위 확대
- 10,000문항 QA와 companion probe의 운영 안정성 강화

## 2. 반영 전후 비교표

| 항목 | OKF 반영 전 | OKF 반영 후 |
|---|---|---|
| RAG 런타임 구조 | `data/faith/gotquestions-ko.index.json`을 직접 검색 | 동일. 런타임은 여전히 compact JSON 기반이며 OKF markdown은 요청 중 읽지 않음 |
| OKF 역할 | 없음 | build/QA/curation 지식 레이어 |
| GotQuestions 데이터 관리 | JSON 인덱스 중심이라 사람이 개별 문답을 검토하기 어려움 | `docs/okf/gotquestions/articles/*.md`, `categories/*.md`로 1461개 article / 26개 category safe metadata mirror |
| 성능 영향 | JSON 직접 검색 | 런타임 변경 없음. 요청 성능 영향 없음 |
| 정확도 관리 | QA fixture와 코드 중심 | OKF QA concept로 회귀 사례를 지식화하고 기존 QA에 연결 |
| 천국 질문 회귀 방지 | 코드/fixture에만 의존 | `docs/okf/gotquestions/qa/heaven-after-death.md`로 고정 |
| 중복 출력 방지 | companion probe 내부 검사 | OKF QA case + companion probe 모두에서 검사 |
| 본문 저장 정책 | JSON/audit QA에서 검사 | OKF concept/validator/parity QA까지 확대 |
| GotQuestions 본문 저장 | 저장 안 함 | 계속 저장 안 함. `bodyStored:false`를 OKF에도 강제 |
| 검증 방식 | `qa:gotquestions-rag`, `qa:companion-probes`, `qa:faith-questions`, large QA | 기존 QA + `qa:gotquestions-okf` + `okf:gotquestions:qa-cases` 추가 |
| 사람이 읽는 설계/운영 지식 | `docs/gotquestions-rag-design.md` 중심 | `docs/okf/`에 시스템/운영/소스정책/QA 지식 분리 |
| QA 실패 축적 | 실패 원인 추적이 코드/로그 중심 | 실패·회귀 케이스를 OKF QA concept로 누적 가능 |
| generated data parity | JSON 자체 검증 | OKF mirror ↔ JSON index parity 검증 추가 |
| duplicate article id 처리 | JSON 내 중복 id 존재 가능 | slug-qualified 파일명으로 concept overwrite 방지 |
| 배포 여부 | 이전 배포 상태 유지 | 이번 OKF 반영 작업에서는 배포하지 않음 |

## 3. 최종 검증 수치

| 검증 항목 | 결과 |
|---|---:|
| GotQuestions OKF article concepts | 1461 |
| GotQuestions OKF category concepts | 26 |
| OKF QA cases | 2 |
| RAG curated QA | 통과 |
| Companion probes | 통과 |
| Faith-question QA | 통과 |
| Large QA | 10,000건 통과 |
| Large QA top1 | 99.68% |
| Large QA top3 | 100% |
| Large QA category | 100% |
| Large QA reference | 100% |
| Runtime parity | 100개 샘플 중 0개 실패 |

## 4. 추가된 주요 파일

| 파일/경로 | 역할 |
|---|---|
| `.okf.json` | OKF bundle root와 validator/init command 정의 |
| `docs/okf/` | OKF 지식 번들 root |
| `docs/okf/systems/companion-rag.md` | RAG 하이브리드 구조와 런타임 불변식 기록 |
| `docs/okf/operations/body-storage-policy.md` | GotQuestions 본문 미저장 정책 기록 |
| `docs/okf/gotquestions/articles/` | GotQuestions article safe metadata mirror |
| `docs/okf/gotquestions/categories/` | GotQuestions category safe metadata mirror |
| `docs/okf/gotquestions/qa/` | 회귀 QA case concept |
| `scripts/build-gotquestions-okf.mjs` | JSON index → OKF mirror 생성 |
| `scripts/validate-gotquestions-okf-parity.mjs` | OKF mirror ↔ JSON index parity 검증 |
| `scripts/build-gotquestions-qa-from-okf.mjs` | OKF QA concept → generated QA fixture 생성 |
| `scripts/validate-okf-bundle.mjs` | OKF bundle 구조/link/body-storage 정책 검증 |
| `qa/gotquestions-okf-cases.generated.json` | OKF QA concept에서 생성된 QA 입력 |

## 5. 최종 QA 명령과 결과

| 명령 | 결과 |
|---|---|
| `npm run qa:gotquestions-okf` | 통과 |
| `npm run okf:gotquestions:qa-cases` | 통과 |
| `npm run build` | 통과 |
| `npm run qa:gotquestions-rag` | 통과 |
| `npm run qa:companion-probes` | 통과 |
| `npm run qa:faith-questions` | 통과 |
| `npm run qa:gotquestions-large` | 통과 |

## 6. 발견 및 수정된 문제

최종 검증 중 `scripts/build-gotquestions-okf.mjs`가 `docs/okf/gotquestions` 전체를 재생성하면서 `docs/okf/gotquestions/qa` 회귀 case concept까지 삭제하는 문제가 발견되었다.

수정 내용:

- OKF mirror builder가 `articles/`, `categories/`만 재생성하도록 변경
- `docs/okf/gotquestions/qa`는 유지되도록 수정
- QA concept 복구 후 전체 최종 게이트 재실행

## 7. 운영상 의미

OKF 반영 후 운영 방식은 다음처럼 바뀐다.

1. GotQuestions metadata를 갱신하면 OKF mirror도 재생성한다.
2. OKF parity validator로 JSON index와 OKF concept 수/핵심 필드 일치를 검증한다.
3. 중요한 회귀나 실패 사례는 `docs/okf/gotquestions/qa/*.md`에 QA contract로 추가한다.
4. `npm run okf:gotquestions:qa-cases`로 QA fixture를 생성한다.
5. 기존 RAG/companion/faith-question/large QA를 실행해 런타임 동작을 검증한다.

## 8. 결론

OKF 반영 후에도 런타임 RAG 성능 구조는 그대로 유지되었다. 즉, 사용자 요청 처리 경로는 markdown OKF 파일을 읽지 않으므로 런타임 성능 손실이 없다.

대신 OKF는 다음을 강화했다.

- 지식 관리
- 회귀 방지
- QA 추적 가능성
- 본문 미저장 정책 검증
- GotQuestions 문답/성구 연결의 장기 유지보수성

현재 상태는 OKF를 RAG의 상위 지식/QA 레이어로 안정적으로 반영한 단계이며, 배포는 이번 작업 범위에서 수행하지 않았다.
