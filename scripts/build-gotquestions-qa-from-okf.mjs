#!/usr/bin/env node
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const qaRoot = path.join(repoRoot, 'docs/okf/gotquestions/qa');
const outPath = path.join(repoRoot, 'qa/gotquestions-okf-cases.generated.json');

function parseJsonContract(markdown, fileName) {
  const match = markdown.match(/# QA contract\s*\n\s*```json\s*\n([\s\S]*?)\n```/);
  if (!match) throw new Error(`${fileName} missing # QA contract JSON block`);
  const parsed = JSON.parse(match[1]);
  if (!parsed.id || !parsed.query || !parsed.surface) throw new Error(`${fileName} QA contract must include id, query, and surface`);
  return parsed;
}

const cases = [];
if (existsSync(qaRoot)) {
  for (const name of (await readdir(qaRoot)).sort()) {
    if (!name.endsWith('.md') || name === 'index.md') continue;
    const fullPath = path.join(qaRoot, name);
    const markdown = await readFile(fullPath, 'utf8');
    cases.push({ ...parseJsonContract(markdown, name), source: path.relative(repoRoot, fullPath) });
  }
}

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(cases, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: 'ok', cases: cases.length, rag: cases.filter((row) => row.surface === 'rag').length, companion: cases.filter((row) => row.surface === 'companion').length, outPath: path.relative(repoRoot, outPath) }, null, 2));
