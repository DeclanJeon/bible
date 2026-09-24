# 말씀편지 이메일 이미지 카드뉴스 UX 수정 및 운영 검증 보고서

- 작성일: 2026-07-06
- 대상 서비스: `https://bible.ponslink.com`
- 대상 기능: 말씀편지 고민/답변 이메일 HTML
- 최종 상태: 수정, 커밋, push, 운영 배포, 실제 Gmail smoke 검증 완료

## 1. 배경

말씀편지 이메일에 Drive 이미지 카드뉴스가 정상 포함되도록 이전 작업에서 이미지 생성/업로드 파이프라인을 복구했다.
그 후 UX 관점에서 추가 문제가 확인됐다.

이미지 카드뉴스가 성공적으로 표시되는 경우에도, 이메일 하단에 같은 성경 본문과 고민/답변 텍스트가 강한 HTML 카드 형태로 다시 렌더링되고 있었다.
이는 다음 문제를 만든다.

- 이미지 카드뉴스와 HTML 카드가 같은 내용을 반복한다.
- 모바일 이메일에서 CTA 도달이 늦어진다.
- 카드뉴스가 hero가 아니라 첨부 미리보기처럼 약해진다.
- 사용자가 “위 이미지와 아래 카드 중 무엇을 읽어야 하는가”를 다시 판단해야 한다.

단, 텍스트를 완전히 제거하는 것도 맞지 않다.
이메일 클라이언트는 이미지를 차단하거나 프록시 처리할 수 있고, 스크린리더/검색/복사/보관을 위해 텍스트 fallback이 필요하다.

따라서 결정은 “중복 텍스트 삭제”가 아니라 “중복 텍스트 위계 낮추기”다.

## 2. UX 결정

이미지 생성이 성공해 `imageUrl`이 있는 이메일은 다음 구조를 사용한다.

```text
이미지 카드뉴스
→ CTA
→ 프라이버시 문구
→ 텍스트로 읽기 fallback
```

이미지 생성이 실패하거나 `imageUrl`이 없는 이메일은 기존처럼 HTML 카드가 메인 콘텐츠가 된다.

```text
HTML 카드
→ 성경 본문
→ 성경 구절
→ 고민/답변 텍스트
→ CTA
→ 프라이버시 문구
```

이 결정은 다음 균형을 맞춘다.

- 이미지가 있으면 카드뉴스가 주 콘텐츠가 된다.
- CTA가 이미지 바로 아래에 와서 행동 경로가 짧아진다.
- 텍스트 fallback은 유지되어 이미지 차단, 접근성, 검색을 지원한다.
- 이미지 실패 시에도 이메일은 완전한 HTML 카드로 읽을 수 있다.

## 3. 변경 파일

### `lib/letters.ts`

`buildLetterEmailHtml`의 렌더링 구조를 분리했다.

- `imageUrl` 있음:
  - Drive/remote image를 hero로 렌더링
  - CTA와 privacy block을 이미지 바로 아래 배치
  - `텍스트로 읽기` label이 붙은 낮은 위계 fallback block 렌더링
- `imageUrl` 없음:
  - 기존 강한 HTML scripture card 유지
  - 기존처럼 본문/요약/CTA를 카드 안에 표시

주요 사용자-facing fallback 문구:

```text
텍스트로 읽기
이미지가 보이지 않을 때를 위해 같은 내용을 텍스트로 남겨두었습니다.
```

영문 fallback 문구:

```text
Read as text
The same content is included as text in case the image does not load.
```

### `scripts/run-letters-qa.mjs`

이메일 HTML 회귀 QA를 강화했다.

새로 방어하는 계약:

- 생성된 Drive 이미지가 CTA보다 먼저 있어야 한다.
- CTA가 `텍스트로 읽기` fallback보다 먼저 있어야 한다.
- fallback label이 성경 본문/요약/답장 텍스트보다 먼저 있어야 한다.
- localized/root internal image route가 이메일 HTML에 노출되지 않아야 한다.
- raw email, token field, generation metadata, provider error가 이메일 HTML에 노출되지 않아야 한다.
- 이미지가 없는 경우 기존 HTML scripture card fallback은 계속 유지되어야 한다.

추가/수정된 대표 계약 문구:

```text
${label} email HTML must render the generated image as the hero, place the CTA before the visible text fallback, and label the fallback block
```

```text
generated letter and reply email HTML must use returned Drive image URLs as the hero before privacy-safe CTAs, reject localized/root server image routes, and expose only a labeled text fallback after the CTA
```

```text
letter and reply email HTML use returned Drive image URLs as the hero before privacy-safe CTAs, reject localized/root server card image routes, expose only a labeled text fallback after the CTA, and keep designed scripture card blocks when images are missing
```

## 4. 커밋 및 배포

커밋:

```text
360b30b Make image-backed letter emails read like a single card
```

push 후 최종 원격 main:

```text
1d16c64 main
```

운영 배포 버전:

```text
bible-hyperlink-companion@0.1.38
```

배포 결과:

```text
PM2 bible cluster online
Validated 5 URLs at http://127.0.0.1:3110
Validated 5 URLs at http://127.0.0.1:3100
Validated PM2 runtime shape for bible: 2 entries, mode cluster_mode
```

## 5. 검증 결과

### 5.1 로컬 검증

실행:

```text
npm run qa:letters
npm run lint
npm run build
```

결과:

- `npm run qa:letters`: 통과
- `npm run lint`: 통과
- `npm run build`: 통과

### 5.2 운영 QA

실행:

```text
ssh ponslink 'cd /home/declan/bible && npm run qa:letters'
```

결과:

```json
{
  "status": "passed"
}
```

운영 QA 계약에는 새 이메일 UX 계약이 포함됐다.

```text
letter and reply email HTML use returned Drive image URLs as the hero before privacy-safe CTAs, reject localized/root server card image routes, expose only a labeled text fallback after the CTA, and keep designed scripture card blocks when images are missing
```

### 5.3 운영 runtime 확인

확인 URL:

```text
https://bible.ponslink.com/api/runtime
```

결과 요약:

```json
{
  "hermes": {
    "ready": true,
    "transport": "agent-oneshot",
    "probeStatus": "ready"
  },
  "runtime": {
    "bible": {
      "dbAvailable": true,
      "runtimeSource": "sqlite"
    },
    "passageIndex": {
      "dbAvailable": true,
      "runtimeSource": "sqlite"
    },
    "crossrefs": {
      "dbAvailable": true,
      "runtimeSource": "sqlite"
    }
  }
}
```

## 6. 실제 Gmail smoke 검증

운영 배포 후 실제 로그인된 Gmail/Chrome 세션에서 smoke를 수행했다.

### 6.1 고민 도착 이메일

운영 UI에서 새 고민 제출.

Smoke 본문:

```text
배포 후 이메일 UX smoke입니다. 이미지 카드뉴스가 hero로 보이고 CTA가 먼저 나오며 텍스트 fallback은 아래에 있어야 합니다.
```

생성된 카드:

```text
cardId: f3c9eb92-587b-4dbb-a37b-ac471b602c27
generationStatus: ready
imageUrl: https://drive.google.com/uc?export=view&id=1GJyObvmHhWdu0LyHsKGFPop7oWQIurOa
```

Gmail DOM 확인:

```json
{
  "heroImg": {
    "alt": "익명의 고민",
    "w": 1254,
    "h": 1254
  },
  "cta": {
    "text": "답변과 성구 보내기"
  },
  "fallbackText": "텍스트로 읽기",
  "order": {
    "imageBeforeCta": true,
    "ctaBeforeFallback": true,
    "fallbackBeforeBody": true,
    "ok": true
  }
}
```

확인된 순서:

```text
익명의 고민 이미지 카드뉴스
→ 답변과 성구 보내기
→ 이메일 privacy 문구
→ 텍스트로 읽기
→ fallback 성경/본문 텍스트
```

### 6.2 답변 도착 이메일

위 smoke 고민의 reply link로 실제 답변 제출.

Smoke 답변 본문:

```text
답변 이메일 UX smoke입니다. 카드 이미지가 먼저 보이고 답변 카드 보기 CTA 다음에 텍스트 fallback이 보여야 합니다. EMAIL-UX-ANSWER-RELEASE-20260706185113
```

생성된 답변 카드:

```text
cardId: 48c72c81-92df-4d62-8795-2e91e67bb05f
generationStatus: ready
imageUrl: https://drive.google.com/uc?export=view&id=1kaF01NKQiDulQqEAnXUh_KT1occzuq1J
```

Gmail DOM 확인:

```json
{
  "hasHeroImage": true,
  "ctaIndex": 580,
  "fallbackIndex": 639,
  "markerIndex": 806,
  "ok": true
}
```

확인된 순서:

```text
익명의 답장 이미지 카드뉴스
→ 답변 카드 보기
→ 이메일 privacy 문구
→ 텍스트로 읽기
→ fallback 성경/답장 텍스트
```

## 7. 참고 사항

고민 smoke 제출 중 브라우저 evaluate 인자 누락으로 smoke marker가 `undefined` 문자열로 들어간 테스트 메일이 하나 생성됐다.
기능 검증에는 영향이 없다.
해당 메일은 실제 운영 흐름으로 생성됐고, body의 고유 문장과 server data/cardId로 추적해 검증했다.
답변 smoke에는 명시 marker `EMAIL-UX-ANSWER-RELEASE-20260706185113`가 정상 포함됐다.

## 8. 최종 결론

수정은 의도대로 적용됐다.

- 이미지 카드뉴스가 성공한 이메일은 이미지가 hero다.
- CTA가 중복 텍스트보다 먼저 나온다.
- 중복 텍스트는 `텍스트로 읽기` fallback으로 낮은 위계에 배치된다.
- 이미지가 없는 경우 기존 HTML 카드 fallback은 유지된다.
- 고민 도착 이메일과 답변 도착 이메일 모두 실제 Gmail에서 새 순서가 확인됐다.
- 운영 QA, runtime, PM2 배포 상태 모두 정상이다.

최종 상태:

```text
완료: 수정 + QA + 커밋 + push + 운영 배포 + 실제 Gmail smoke 검증
```
