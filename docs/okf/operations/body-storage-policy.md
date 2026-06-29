---
type: Playbook
title: GotQuestions body storage policy
description: GotQuestions Korean 자료를 사용할 때 저장 가능한 메타데이터와 저장 금지 데이터를 구분하는 운영 정책.
tags: [gotquestions, copyright, storage, policy]
timestamp: 2026-06-29T00:00:00Z
---

# Policy

GotQuestions Korean은 성경 컴패니언의 외부 문답 기준으로 사용하지만, 이 앱은 원문 본문을 복제하거나 대체하지 않습니다.

# Allowed stored fields

- URL
- 제목과 질문 줄
- 카테고리와 topic/keyword
- normalized Scripture references
- article id / slug / lastmod
- source attribution
- `bodyStored: false`

# Forbidden stored fields

- article body
- HTML body
- markdown body
- paragraph
- excerpt
- quote
- long summary that substitutes for the source article
- generated answer that pretends to summarize unseen GotQuestions body text

# Runtime invariant

일반 사용자 요청 처리 중 GotQuestions.org 네트워크 호출은 금지됩니다. ingest/build/maintenance script에서만 허용됩니다.

# UI wording

Companion UI는 원문 전문을 GotQuestions.org 링크에서 확인하도록 안내해야 합니다.
