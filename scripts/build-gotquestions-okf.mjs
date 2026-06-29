#!/usr/bin/env node
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const indexPath = path.join(repoRoot, 'data/faith/gotquestions-ko.index.json');
const outRoot = path.join(repoRoot, 'docs/okf/gotquestions');
const articlesRoot = path.join(outRoot, 'articles');
const categoriesRoot = path.join(outRoot, 'categories');

function yamlString(value) {
  return JSON.stringify(String(value ?? ''));
}

function yamlList(values) {
  return `[${[...new Set(values.filter(Boolean))].map((value) => JSON.stringify(String(value))).join(', ')}]`;
}

function referenceKey(reference) {
  const verse = reference.startVerse === reference.endVerse ? `${reference.startVerse}` : `${reference.startVerse}-${reference.endVerse}`;
  return `${reference.code} ${reference.chapter}:${verse}`;
}

function safeArticleConcept(article, generatedAt) {
  const references = (article.references ?? []).map(referenceKey);
  const aliases = [article.questionTextKo, article.titleKo, ...(article.keywords ?? [])].filter(Boolean);
  return `---
type: GotQuestions Article Metadata
title: ${yamlString(article.titleKo)}
description: ${yamlString(article.questionTextKo || article.titleKo)}
resource: ${article.url}
tags: ${yamlList(['gotquestions', ...(article.categoryIds ?? [])])}
timestamp: ${generatedAt}
bodyStored: false
articleId: ${article.id}
slug: ${article.slug}
primaryCategoryId: ${article.primaryCategoryId}
referenceStatus: ${article.referenceStatus}
---

# Question

${article.questionTextKo || article.titleKo}

# Scripture links

${references.length ? references.map((reference) => `- ${reference}`).join('\n') : '- none-detected'}

# Retrieval hints

- canonical question: ${article.questionTextKo || article.titleKo}
- safe aliases: ${aliases.slice(0, 12).join(', ') || 'none'}
- category intent: ${article.primaryCategoryId}

# Boundaries

- bodyStored: false
- 원문 전문은 GotQuestions.org 링크에서 확인한다.
- 이 concept은 제목, 링크, 분류, 성구 연결만 보관한다.

# Citations

[GotQuestions Korean](${article.url})
`;
}

function safeCategoryConcept(category, articles, generatedAt) {
  const articleCount = articles.filter((article) => article.categoryIds?.includes(category.id)).length;
  return `---
type: GotQuestions Category Metadata
title: ${yamlString(category.titleKo)}
description: ${yamlString(`${category.titleKo} category metadata and retrieval policy.`)}
resource: ${category.url}
tags: ${yamlList(['gotquestions', 'category', category.id, ...(category.topics ?? [])])}
timestamp: ${generatedAt}
bodyStored: false
categoryId: ${category.id}
order: ${category.order}
articleCount: ${articleCount}
---

# Category

${category.titleKo}

# Retrieval topics

${category.topics?.length ? category.topics.map((topic) => `- ${topic}`).join('\n') : '- none'}

# Policy

- bodyStored: false
- Category concepts store category metadata only.
- Article source text is not stored here.
`;
}

const index = JSON.parse(readFileSync(indexPath, 'utf8'));
if (index.version !== 1 || index.bodyStored !== false || !Array.isArray(index.articles) || !Array.isArray(index.categories)) {
  throw new Error('Invalid GotQuestions index shape');
}
const idCounts = new Map();
for (const article of index.articles) {
  idCounts.set(article.id, (idCounts.get(article.id) ?? 0) + 1);
}

function articleFileName(article) {
  return idCounts.get(article.id) === 1 ? `${article.id}.md` : `${article.id}--${article.slug}.md`;
}


await mkdir(outRoot, { recursive: true });
await rm(articlesRoot, { recursive: true, force: true });
await rm(categoriesRoot, { recursive: true, force: true });
await mkdir(articlesRoot, { recursive: true });
await mkdir(categoriesRoot, { recursive: true });

const articleIndex = ['# GotQuestions article metadata', ''];
for (const article of [...index.articles].sort((a, b) => a.id.localeCompare(b.id) || a.slug.localeCompare(b.slug))) {
  const fileName = articleFileName(article);
  await writeFile(path.join(articlesRoot, fileName), safeArticleConcept(article, index.generatedAt), 'utf8');
  articleIndex.push(`* [${article.titleKo}](${fileName}) - ${article.primaryCategoryId}`);
}

const categoryIndex = ['# GotQuestions category metadata', ''];
for (const category of [...index.categories].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))) {
  await writeFile(path.join(categoriesRoot, `${category.id}.md`), safeCategoryConcept(category, index.articles, index.generatedAt), 'utf8');
  categoryIndex.push(`* [${category.titleKo}](${category.id}.md) - ${category.id}`);
}

await writeFile(path.join(outRoot, 'index.md'), [
  '# GotQuestions OKF mirror',
  '',
  'Generated safe metadata mirror for GotQuestions Korean RAG. Runtime requests do not read these markdown files.',
  '',
  `* Articles: ${index.articles.length}`,
  `* Categories: ${index.categories.length}`,
  '* bodyStored: false',
  '',
  '# Contents',
  '',
  '* [Articles](articles/)',
  '* [Categories](categories/)',
  '',
].join('\n'), 'utf8');
await writeFile(path.join(articlesRoot, 'index.md'), `${articleIndex.join('\n')}\n`, 'utf8');
await writeFile(path.join(categoriesRoot, 'index.md'), `${categoryIndex.join('\n')}\n`, 'utf8');

console.log(JSON.stringify({ status: 'ok', articles: index.articles.length, categories: index.categories.length, outRoot: path.relative(repoRoot, outRoot) }, null, 2));
