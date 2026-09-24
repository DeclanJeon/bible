# 말씀편지/빛의 릴레이 작업 보고서 — 2026-07-07

## 최종 상태

- 최종 커밋: `fb2083442ab012ec897f777298987e3edf239d9a`
- 브랜치: `main`
- 원격 반영: `origin/main`이 최종 커밋과 동일함
- 배포: `scripts/deploy-ponslink.sh`로 production 배포 완료
- 라이브 확인:
  - `https://bible.ponslink.com/ko/letters` 접근 확인
  - `https://bible.ponslink.com/api/runtime` 정상 JSON 응답 확인
- 배포 검증:
  - shadow `http://127.0.0.1:3110` 5개 URL 검증 성공
  - live `http://127.0.0.1:3100` 5개 URL 검증 성공
  - PM2 runtime shape 검증 성공: `bible` 2개 cluster worker, script `/home/declan/bible/node_modules/next/dist/bin/next`

## 커밋 이력

### 1. `527d6a93992e8e2a6da2a0e58a2d1e5b830bf0a0`

제목: `Reduce relay entry friction while hardening card media`

포함 작업:

- `/letters` 메인 페이지를 Google 검색창식 고민 입력 UI로 단순화.
- 미로그인 사용자가 고민을 작성하고 `보내기`를 누르면:
  1. 고민을 `sessionStorage`에 임시 저장.
  2. Google 로그인으로 이동.
  3. 로그인 후 `/letters`로 돌아옴.
  4. 저장된 고민을 Google session email과 함께 자동 전송.
  5. `/letters/sent` 완료 페이지로 이동.
- 릴레이 답변 페이지 성구 선택 UX 개선:
  - 시스템 추천 성구 최대 10개 제공.
  - 이전/다음 슬라이드 이동.
  - 추천 성구 dot selector 제공.
  - 직접 입력 모드 제공.
- 웹 페이지 카드 이미지 표시 안정화:
  - 웹 페이지에서는 Drive 원본 URL을 직접 `<img>`에 넣지 않음.
  - `/{locale}/api/letters/card/{cardId}/image` first-party route로 프록시.
  - 이메일 HTML은 기존 계약대로 returned Drive image URL 사용.
- 관련 QA 추가.

### 2. `fb2083442ab012ec897f777298987e3edf239d9a`

제목: `Generate relay images only after replies`

포함 작업:

- 이미지 생성 파이프라인 순서 수정.
- 기존 문제:
  - `createAnonymousLetter()`에서 고민 작성 직후 question card 이미지를 생성했음.
  - 릴레이 답변자가 성구와 답변을 확정하기 전에 이미지가 만들어지는 구조였음.
- 수정 후 흐름:
  1. 고민 작성자가 `/letters`에서 고민 작성.
  2. 서버가 릴레이 수신자에게 고민 전달.
  3. 이 시점에는 이미지를 생성하지 않음.
  4. 릴레이 답변자가 답변 페이지에서 성구 선택/직접 입력.
  5. 릴레이 답변자가 답변 작성.
  6. `답변 카드 보내기` 클릭.
  7. `createLetterAnswer()`에서 answer card 이미지 생성.
  8. 작성자에게 이미지 카드 포함 답변 알림 발송.
- question card는 `generationStatus: "skipped"`로 저장.
- question card는 답변 전 `imageUrl`을 갖지 않음.
- 릴레이 수신 이메일은 이미지 없는 HTML 카드 fallback 사용.
- answer card만 Codex Imagen/Drive image generation 대상.
- 성구 추천 UI 정리:
  - `high`, `medium`, `low` confidence 표시 제거.
  - 추천 이유/설명 문구 표시 제거.
  - `본문 자체가 메인 성구의 원칙을...`, `메인 성구를 보강하는 보조 본문입니다.` 같은 설명문 제거.
  - 추천 카드에는 성구 참조와 성구 본문만 표시.
  - related passage suggestion은 `related.excerpt` 설명 대신 실제 `getPassage()` 본문을 다시 조회해서 text로 사용.

## 변경 파일 요약

### `app/[locale]/letters/page.tsx`

- 기존 랜딩 CTA/flow/philosophy 중심 구조를 제거.
- 중앙 hero + 고민 입력 form 중심으로 단순화.
- `LetterQuickSendForm` 연결.
- 설정/내 편지함 링크는 유지.

### `components/letter-quick-send-form.tsx`

- 신규 파일.
- `/letters` 메인 입력 UI 담당.
- 주요 기능:
  - 고민 입력.
  - 로그인 상태 확인.
  - 미로그인 시 pending concern 저장 후 Google sign-in.
  - 로그인 후 pending concern 자동 전송.
  - accepted 후 `/letters/sent` 이동.

### `components/letter-forms.tsx`

- `LetterReplyForm` 확장.
- 성구 추천 슬라이더 추가.
- 직접 입력 모드 추가.
- 성구 추천 카드에서 confidence/reason 제거.
- 성구 참조와 본문만 보여주도록 UI 정리.

### `lib/letters.ts`

- `buildReplyScriptureSuggestions()` 추가/확장.
- reply bundle/suggest API에서 최대 10개 추천 성구 제공.
- 추천 성구 중복 제거.
- related passage text는 실제 Bible passage 본문 조회 결과를 사용.
- `createAnonymousLetter()`에서 question card image generation 제거.
- question card `generationStatus`를 `skipped`로 변경.
- `createLetterAnswer()`의 answer card image generation은 유지.
- `getStoredCardImageUrl()` 및 page image route 연계로 answer image proxy 지원.

### `components/letter-card-visual.tsx`

- 카드 이미지가 있는 경우 raw Drive URL 대신 first-party image route 사용.
- 이미지 없는 question card는 fallback visual 사용.

### `app/[locale]/api/letters/card/[cardId]/image/route.ts`

- 로컬 이미지가 없으면 저장된 remote image URL을 안전하게 proxy.
- 허용 host 기반으로 SSRF 방어.
- `image/*` content-type만 반환.
- redirect 최종 URL도 허용 host인지 검사.

### `app/[locale]/letters/reply/[token]/page.tsx`

- `LetterReplyForm`에 `scriptureSuggestions` 전달.

### `scripts/run-letters-qa.mjs`

추가/수정된 QA 계약:

- `/letters` quick-send flow:
  - 미로그인 제출은 Google sign-in으로 이동.
  - pending concern은 sessionStorage에 저장.
  - 로그인 후 pending concern 자동 POST.
  - POST payload는 Google session email을 authorEmail로 사용.
  - accepted 후 `/letters/sent` 이동.
- 성구 추천:
  - 최대 10개.
  - 중복 제거.
  - original system-selected scripture가 첫 번째.
  - suggestion API도 동일 계약.
  - UI에서 confidence/reason 미노출.
  - related suggestion은 설명문이 아니라 성구 본문만 포함.
- 이미지 파이프라인:
  - question card는 답변 전 이미지 생성 호출 없음.
  - question card는 imageUrl 없음, generationStatus skipped.
  - 릴레이 수신 이메일은 HTML card fallback.
  - answer card는 답변 제출 후 image generation 호출.
  - answer notification email은 Drive image URL hero 사용.
  - image proxy route는 answer card image만 resolve.

## 검증 이력

로컬 검증:

- `npm run qa:letters` 통과.
- `npm run lint` 통과.
- `npm run build` 통과.
- LSP diagnostics:
  - `lib/letters.ts`: OK
  - `scripts/run-letters-qa.mjs`: OK
  - `components/letter-forms.tsx`: error 없음. 기존 `FormEvent` deprecation hint만 있음.
  - `components/letter-quick-send-form.tsx`: error 없음. 기존 `FormEvent` deprecation hint만 있음.
  - `app/[locale]/letters/page.tsx`: OK

배포 검증:

- 원격 `npm ci` 성공.
- 원격 DB build 성공:
  - `npm run build:crossref-db`
  - `npm run build:bible-db`
  - `npm run build:passage-index-db`
- 원격 `npm run build` 성공.
- shadow validation 성공: `Validated 5 URLs at http://127.0.0.1:3110`
- live validation 성공: `Validated 5 URLs at http://127.0.0.1:3100`
- PM2 reload 성공:
  - `bible` id 15 online
  - `bible` id 16 online
- PM2 shape 검증 성공:
  - `Validated PM2 runtime shape for bible: 2 entries, mode cluster_mode, script /home/declan/bible/node_modules/next/dist/bin/next`

## 현재 로컬 상태 주의

- 작업 커밋/푸시/배포 대상은 모두 반영됨.
- 기존 untracked 파일은 이번 작업 산출물이 아니어서 제외함:
  - `reports/letter-email-image-ux-release-report-2026-07-06.md`
- 이 보고서 파일은 요청에 따라 로컬에 저장한 산출물:
  - `reports/letter-relay-work-report-2026-07-07.md`
