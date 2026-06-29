---
type: RAG QA Case
title: Heaven companion duplicate-output guard
description: Companion 화면에서 천국 질문이 요한계시록 21:1-5와 GotQuestions 링크를 보여 주고 질문 문장을 즉시 반복하지 않는지 검증한다.
tags: [gotquestions, qa, companion, duplicate-output]
timestamp: 2026-06-29T00:00:00Z
bodyStored: false
caseId: okf-companion-heaven-duplicate-output
---

# QA contract

```json
{
  "id": "okf-companion-heaven-duplicate-output",
  "surface": "companion",
  "query": "천국은 어떤 곳인가? 죽어서 가는 곳인가?",
  "requiredAll": ["GotQuestions 관련 문답"],
  "requiredAny": ["요한계시록 21:1-5", "새 하늘", "새 하늘과 새 땅"],
  "requiredAnyLinks": ["Korean-heaven-like", "Korean-Heaven-perfect", "Korean-afterlife", "Korean-life-after-death"],
  "forbidden": ["마태복음 16:16-20"],
  "noImmediateDuplicatePhrase": true
}
```

# Purpose

이 사례는 사용자가 지적한 중복 출력 문제와 천국 본문 회귀 문제를 OKF 지식으로 고정한다.
