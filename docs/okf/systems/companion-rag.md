---
type: System
title: Companion RAG hybrid architecture
description: OKF를 build/QA/curation layer로 두고 런타임은 compact index를 유지하는 성경 컴패니언 RAG 구조.
tags: [rag, okf, gotquestions, companion]
timestamp: 2026-06-29T00:00:00Z
---

# Runtime flow

```txt
/ko/companion 또는 /api/faith-questions
  -> lib/passage-response.ts
  -> lib/gotquestions-rag.ts
  -> data/faith/gotquestions-ko.index.json
```

# OKF role

OKF는 요청 처리 중 읽지 않습니다. OKF는 다음 지식을 관리합니다.

- RAG architecture와 운영 경계.
- GotQuestions Korean article/category 안전 메타데이터 mirror.
- QA aliases, negative examples, known failures.
- bodyStored:false 정책과 parity evidence.

# Source-of-truth phase

현재 Phase 1에서는 `data/faith/gotquestions-ko.index.json`이 런타임 source입니다. OKF mirror와 parity gate가 안정된 뒤에만 OKF -> JSON/SQLite 생성 경로로 source-of-truth 전환을 검토합니다.

# Invariants

- 런타임은 GotQuestions.org를 fetch하지 않습니다.
- GotQuestions article body/html/markdown/paragraph/excerpt/quote를 저장하지 않습니다.
- UI와 API는 제공된 성구, URL, resource id만 grounding에 사용합니다.
- OKF 문서는 사람/agent 검토용이며, 요청당 markdown 파싱을 하지 않습니다.

# References

- Design source: `docs/okf-rag-hybrid-design.md`
- [Body storage policy](/operations/body-storage-policy.md)
