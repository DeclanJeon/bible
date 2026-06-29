---
type: System
title: 성경 하이퍼링크 컴패니언 overview
description: 한국어 성경 읽기, 컴패니언 RAG, 신앙 질문 API를 연결하는 Bible study app overview.
tags: [system, overview, bible, companion]
timestamp: 2026-06-29T00:00:00Z
---

# Purpose

성경 하이퍼링크 컴패니언은 사용자의 한국어 질문을 성경 본문, 문맥, 관련 성구, 안전한 외부 출처 메타데이터와 연결하는 성경 공부 앱입니다.

# Main surfaces

- `/ko/bible`: 성경 읽기 화면.
- `/ko/companion`: 질문 기반 본문 연결 화면.
- `/api/faith-questions`: 신앙 질문 API.
- `lib/gotquestions-rag.ts`: GotQuestions Korean 안전 메타데이터 검색 어댑터.
- `data/faith/gotquestions-ko.index.json`: 런타임 GotQuestions compact index.

# Knowledge boundary

OKF는 런타임 검색 포맷이 아닙니다. `docs/okf`는 설계·운영·QA 지식을 보관하고, 런타임은 JSON/SQLite compact index를 사용합니다.

# Related concepts

- [Companion RAG](companion-rag.md)
- [QA gates](qa-gates.md)
- [Body storage policy](/operations/body-storage-policy.md)
