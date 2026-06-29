#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const indexPath = path.join(repoRoot, 'data/faith/gotquestions-ko.index.json');
const outRoot = path.join(repoRoot, 'docs/okf/gotquestions');
const articlesRoot = path.join(outRoot, 'articles');
const categoriesRoot = path.join(outRoot, 'categories');
const forbidden = /\b(articleBody|answerBody|contentBody|textBody|htmlBody|markdownBody|paragraphs?|quotes?|excerpts?)\b/i;

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error('missing frontmatter');
  const fields = new Map();
  for (const rawLine of match[1].split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    fields.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^["']|["']$/g, ''));
  }
  return { fields, raw: match[1], body: content.slice(match[0].length) };
}

function readConcepts(root) {
  return readdirSync(root)
    .filter((name) => name.endsWith('.md') && name !== 'index.md')
    .sort()
    .map((name) => ({ name, path: path.join(root, name), content: readFileSync(path.join(root, name), 'utf8') }));
}

const index = JSON.parse(readFileSync(indexPath, 'utf8'));
const articleConcepts = readConcepts(articlesRoot);
const categoryConcepts = readConcepts(categoriesRoot);
const failures = [];

if (articleConcepts.length !== index.articles.length) failures.push(`article concept count ${articleConcepts.length} !== index articles ${index.articles.length}`);
if (categoryConcepts.length !== index.categories.length) failures.push(`category concept count ${categoryConcepts.length} !== index categories ${index.categories.length}`);

const articlesByKey = new Map(index.articles.map((article) => [`${article.id}|${article.url}`, article]));
for (const concept of articleConcepts) {
  const parsed = parseFrontmatter(concept.content);
  const id = parsed.fields.get('articleId');
  const resource = parsed.fields.get('resource');
  const article = articlesByKey.get(`${id}|${resource}`);
  if (!article) {
    failures.push(`${concept.name} has unknown article identity ${id}|${resource}`);
    continue;
  }
  if (parsed.fields.get('bodyStored') !== 'false') failures.push(`${concept.name} must have bodyStored:false`);
  if (parsed.fields.get('primaryCategoryId') !== article.primaryCategoryId) failures.push(`${concept.name} primaryCategoryId mismatch`);
  if (parsed.fields.get('referenceStatus') !== article.referenceStatus) failures.push(`${concept.name} referenceStatus mismatch`);
  if (forbidden.test(parsed.raw) || forbidden.test(parsed.body)) failures.push(`${concept.name} contains forbidden body-like storage key`);
}

const categoriesById = new Map(index.categories.map((category) => [category.id, category]));
for (const concept of categoryConcepts) {
  const parsed = parseFrontmatter(concept.content);
  const id = parsed.fields.get('categoryId');
  const category = categoriesById.get(id);
  if (!category) {
    failures.push(`${concept.name} has unknown categoryId ${id}`);
    continue;
  }
  if (concept.name !== `${category.id}.md`) failures.push(`${concept.name} does not match category id ${category.id}`);
  if (parsed.fields.get('bodyStored') !== 'false') failures.push(`${concept.name} must have bodyStored:false`);
  if (parsed.fields.get('resource') !== category.url) failures.push(`${concept.name} URL mismatch`);
  if (forbidden.test(parsed.raw) || forbidden.test(parsed.body)) failures.push(`${concept.name} contains forbidden body-like storage key`);
}

if (failures.length) {
  console.error(JSON.stringify({ status: 'failed', failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ status: 'passed', articles: articleConcepts.length, categories: categoryConcepts.length, bodyStored: false }, null, 2));
