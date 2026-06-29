---
type: System
title: RAG and OKF QA gates
description: OKF 도입 후 유지해야 하는 검증 게이트와 실패 정책.
tags: [qa, okf, rag, verification]
timestamp: 2026-06-29T00:00:00Z
---

# Required gates

```txt
npm run okf:validate
npm run qa:gotquestions-rag
npm run qa:gotquestions-large
npm run qa:companion-probes
npm run qa:faith-questions
npm run build
```

# Gate responsibilities

- `okf:validate`: OKF frontmatter, reserved files, internal links, body-storage policy marker를 확인합니다.
- `qa:gotquestions-rag`: curated GotQuestions retrieval, category/reference/body guard를 확인합니다.
- `qa:gotquestions-large`: 10,000문항 대량 회귀 및 runtime parity를 확인합니다.
- `qa:companion-probes`: 실제 companion page HTML에 핵심 본문, GotQuestions 링크, 중복 출력 guard가 유지되는지 확인합니다.
- `qa:faith-questions`: API deterministic fallback, invalid input, resource/passages boundary를 확인합니다.

# OKF-specific additions

- OKF article/category mirror count와 runtime JSON index count parity.
- `bodyStored:false` 전역 일치.
- OKF QA case의 `safe aliases`와 `negative examples`가 curated QA에 반영되는지 확인.

# Completion rule

OKF 또는 RAG 변경은 위 게이트 중 영향 받는 범위를 통과해야 완료로 취급합니다. 배포는 별도 사용자 지시가 있을 때만 수행합니다.
