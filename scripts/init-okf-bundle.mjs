#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const repoRoot = resolve(process.cwd());

const files = {
  '.okf.json': `{
  "bundleRoot": "docs/okf",
  "systemName": "성경 하이퍼링크 컴패니언",
  "validatorCommand": "node scripts/validate-okf-bundle.mjs",
  "initCommand": "node scripts/init-okf-bundle.mjs"
}
`,
  'docs/okf/index.md': `---
okf_version: "0.1"
---

# 성경 하이퍼링크 컴패니언 OKF bundle

# Systems

* [Project overview](systems/project-overview.md) - 앱 목적, 주요 표면, 지식 경계.
* [Companion RAG](systems/companion-rag.md) - 성경 컴패니언 RAG 데이터 흐름과 OKF 하이브리드 적용 방식.
* [QA gates](systems/qa-gates.md) - OKF/RAG/companion 검증 게이트.

# Operations

* [Production readiness](operations/production-readiness.md) - 배포 전 확인해야 할 운영 조건.
* [Body storage policy](operations/body-storage-policy.md) - GotQuestions 본문 미저장 정책.

# References

* [Repository README](references/repository-readme.md) - 저장소 요약.
* [GotQuestions source policy](references/gotquestions-source-policy.md) - GotQuestions Korean 소스 사용 경계.
`,
  'docs/okf/log.md': `# Directory Update Log

## 2026-06-29

* **Initialization**: Added OKF bundle skeleton for Bible companion RAG governance.
`,
  'docs/okf/systems/project-overview.md': `---
type: System
title: 성경 하이퍼링크 컴패니언 overview
description: 한국어 성경 읽기, 컴패니언 RAG, 신앙 질문 API를 연결하는 Bible study app overview.
tags: [system, overview, bible, companion]
timestamp: 2026-06-29T00:00:00Z
---

# Purpose

성경 하이퍼링크 컴패니언은 사용자의 한국어 질문을 성경 본문, 문맥, 관련 성구, 안전한 외부 출처 메타데이터와 연결하는 성경 공부 앱입니다.
`,
  'docs/okf/systems/companion-rag.md': `---
type: System
title: Companion RAG hybrid architecture
description: OKF를 build/QA/curation layer로 두고 런타임은 compact index를 유지하는 성경 컴패니언 RAG 구조.
tags: [rag, okf, gotquestions, companion]
timestamp: 2026-06-29T00:00:00Z
---

# Runtime flow

Runtime uses compact JSON/SQLite data, not OKF markdown per request.

# Invariants

- 런타임은 GotQuestions.org를 fetch하지 않습니다.
- GotQuestions article body/html/markdown/paragraph/excerpt/quote를 저장하지 않습니다.
- OKF 문서는 사람/agent 검토용입니다.

# References

- [Body storage policy](/operations/body-storage-policy.md)
`,
  'docs/okf/systems/qa-gates.md': `---
type: System
title: RAG and OKF QA gates
description: OKF 도입 후 유지해야 하는 검증 게이트와 실패 정책.
tags: [qa, okf, rag, verification]
timestamp: 2026-06-29T00:00:00Z
---

# Required gates

- npm run okf:validate
- npm run qa:gotquestions-rag
- npm run qa:companion-probes
- npm run qa:faith-questions
- npm run build
`,
  'docs/okf/operations/production-readiness.md': `---
type: Playbook
title: 성경 컴패니언 production readiness
description: RAG/OKF 변경을 운영에 반영하기 전 확인하는 release readiness entrypoint.
tags: [operations, readiness, release]
timestamp: 2026-06-29T00:00:00Z
---

# Readiness stance

프로덕션 배포 전에는 build, RAG QA, companion probes, faith-question API QA가 통과해야 합니다.
`,
  'docs/okf/operations/body-storage-policy.md': `---
type: Playbook
title: GotQuestions body storage policy
description: GotQuestions Korean 자료를 사용할 때 저장 가능한 메타데이터와 저장 금지 데이터를 구분하는 운영 정책.
tags: [gotquestions, copyright, storage, policy]
timestamp: 2026-06-29T00:00:00Z
---

# Policy

GotQuestions article body/html/markdown/paragraph/excerpt/quote를 저장하지 않습니다.
`,
  'docs/okf/references/repository-readme.md': `---
type: Reference
title: Bible companion repository README
description: 저장소의 maintainer-facing README 또는 프로젝트 설명을 요약하는 reference concept.
tags: [reference, readme]
timestamp: 2026-06-29T00:00:00Z
---

# Source artifact

README.md
`,
  'docs/okf/references/gotquestions-source-policy.md': `---
type: Reference
title: GotQuestions Korean source policy
description: GotQuestions Korean source usage boundary for Bible companion RAG.
resource: https://www.gotquestions.org/Korean/
tags: [gotquestions, source, policy]
timestamp: 2026-06-29T00:00:00Z
---

# Stored data boundary

The app stores safe metadata only: title, URL, category, topics, normalized Scripture references, and attribution.
`,
};

let written = 0;
for (const [relativePath, content] of Object.entries(files)) {
  const target = join(repoRoot, relativePath);
  if (existsSync(target)) continue;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
  written += 1;
}

console.log(`OKF bundle initialized; wrote ${written} missing files.`);
