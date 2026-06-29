---
type: Playbook
title: 성경 컴패니언 production readiness
description: RAG/OKF 변경을 운영에 반영하기 전 확인하는 release readiness entrypoint.
tags: [operations, readiness, release]
timestamp: 2026-06-29T00:00:00Z
---

# Readiness stance

프로덕션 배포 전에는 build, RAG QA, companion probes, faith-question API QA가 현재 worktree 기준으로 통과해야 합니다.

# Minimum expectations

- `npm run build` 통과.
- RAG/OKF 변경이면 `npm run okf:validate` 통과.
- GotQuestions 변경이면 curated/large QA 통과.
- Companion UI 변경이면 browser/probe evidence 확보.
- GotQuestions 본문 미저장 정책 위반 없음.

# Related concepts

- [QA gates](/systems/qa-gates.md)
- [Body storage policy](body-storage-policy.md)
