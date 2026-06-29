#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const configPath = join(repoRoot, '.okf.json');
const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : { bundleRoot: 'docs/okf' };
const bundleRoot = resolve(repoRoot, config.bundleRoot || 'docs/okf');
const bundleRootWithSep = `${bundleRoot}/`;
const rootIndexPath = join(bundleRoot, 'index.md');
const logPath = join(bundleRoot, 'log.md');
const forbiddenBodyKeys = /\b(articleBody|answerBody|contentBody|textBody|htmlBody|markdownBody|paragraphs?|quotes?|excerpts?)\b/i;

function walkMarkdown(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) return walkMarkdown(fullPath);
      return extname(entry.name) === '.md' ? [fullPath] : [];
    })
    .sort();
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return null;
  const fields = new Map();
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
    fields.set(key, value);
  }
  return { fields, raw: match[1], body: content.slice(match[0].length) };
}

function markdownLinks(content) {
  const links = [];
  const regex = /\[[^\]]+\]\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) links.push(match[1].trim());
  return links;
}

function resolveDocTarget(sourcePath, link) {
  if (!link || link.startsWith('http://') || link.startsWith('https://') || link.startsWith('mailto:') || link.startsWith('#')) return null;
  const cleanLink = link.split('#')[0].split('?')[0];
  const rawPath = cleanLink.startsWith('/') ? resolve(bundleRoot, `.${cleanLink}`) : resolve(dirname(sourcePath), cleanLink);
  if (rawPath !== bundleRoot && !rawPath.startsWith(bundleRootWithSep)) throw new Error(`${relative(bundleRoot, sourcePath)} links outside bundle: ${link}`);
  if (cleanLink.endsWith('/')) return join(rawPath, 'index.md');
  if (!extname(rawPath)) {
    try {
      if (statSync(rawPath).isDirectory()) return join(rawPath, 'index.md');
    } catch {
      return `${rawPath}.md`;
    }
  }
  return rawPath;
}

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const markdownFiles = walkMarkdown(bundleRoot);
assert(markdownFiles.length > 0, 'bundle has no markdown files');

for (const filePath of markdownFiles) {
  const relPath = relative(bundleRoot, filePath);
  const content = readFileSync(filePath, 'utf8');
  const frontmatter = parseFrontmatter(content);
  const name = basename(filePath);

  if (filePath === logPath) {
    assert(frontmatter === null, 'log.md must not contain frontmatter');
    assert(/^##\s+\d{4}-\d{2}-\d{2}/m.test(content), 'log.md should contain ISO 8601 date headings');
    continue;
  }

  if (name === 'index.md') {
    if (filePath === rootIndexPath) {
      assert(frontmatter !== null, 'root index.md must declare okf_version frontmatter');
      assert(frontmatter?.fields.get('okf_version') === '0.1', 'root index.md must declare okf_version 0.1');
    } else {
      assert(frontmatter === null, `${relPath} must not contain frontmatter`);
    }
  } else {
    assert(frontmatter !== null, `${relPath} must contain YAML frontmatter`);
    assert(Boolean(frontmatter?.fields.get('type')), `${relPath} must declare a non-empty type`);
    if (relPath.startsWith('gotquestions/')) {
      assert(frontmatter?.fields.get('bodyStored') === 'false', `${relPath} must declare bodyStored: false`);
      assert(!forbiddenBodyKeys.test(frontmatter?.raw ?? ''), `${relPath} frontmatter contains a forbidden body-like field`);
      assert(!forbiddenBodyKeys.test(frontmatter?.body ?? ''), `${relPath} body contains a forbidden body-like field`);
    }
  }

  const body = frontmatter?.body ?? content;
  for (const link of markdownLinks(body)) {
    try {
      const target = resolveDocTarget(filePath, link);
      if (!target) continue;
      readFileSync(target, 'utf8');
    } catch (error) {
      failures.push(error instanceof Error ? error.message : `${relPath} has an invalid link: ${link}`);
    }
  }
}

if (failures.length > 0) {
  console.error('OKF bundle validation failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`OKF bundle valid: ${relative(repoRoot, bundleRoot)}`);
