---
type: RAG QA Case
title: Heaven after death RAG regression
description: 천국 질문이 종말/새 하늘과 새 땅 category와 요한계시록 21:1-5 성구로 연결되는지 검증한다.
tags: [gotquestions, qa, rag, eternity]
timestamp: 2026-06-29T00:00:00Z
bodyStored: false
caseId: okf-heaven-after-death
---

# QA contract

```json
{
  "id": "okf-heaven-after-death",
  "bucket": "paraphrase",
  "surface": "rag",
  "query": "천국은 어떤 곳인가? 죽어서 가는 곳인가?",
  "expectedAnyCategoryIds": ["eternity"],
  "expectedAnyReferences": ["REV-21-1-5"],
  "forbidden": ["externalBodyStored", "bodySummary"]
}
```

# Purpose

이 사례는 천국 질문이 마태복음 16장 후보로 회귀하지 않고, 새 하늘과 새 땅/영원 카테고리와 연결되는지 확인한다.
