import { readFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
};

const fixtureRel = option('--fixture', 'qa/philosophical-prompt-qa.json');
const locale = option('--locale', 'ko');
const baseUrl = process.env.BENCHMARK_BASE_URL || 'http://127.0.0.1:3000';
const fixturePath = path.join(process.cwd(), fixtureRel);

function toRef(ref) {
  if (!ref) return '';
  return `${ref.code} ${ref.chapter}:${ref.startVerse}${ref.endVerse === ref.startVerse ? '' : `-${ref.endVerse}`}`;
}

function overlapsExpected(actual, expected) {
  const match = actual.match(/^([1-3]?[A-Z]{2,3}) (\d+):(\d+)(?:-(\d+))?$/);
  if (!match) return false;
  const [, code, chapterText, startText, endText] = match;
  const chapter = Number(chapterText);
  const start = Number(startText);
  const end = Number(endText || startText);

  return expected.some((ref) => {
    const expectedMatch = ref.match(/^([1-3]?[A-Z]{2,3}) (\d+):(\d+)(?:-(\d+))?$/);
    if (!expectedMatch) return false;
    const [, expectedCode, expectedChapterText, expectedStartText, expectedEndText] = expectedMatch;
    const expectedChapter = Number(expectedChapterText);
    const expectedStart = Number(expectedStartText);
    const expectedEnd = Number(expectedEndText || expectedStartText);
    return code === expectedCode && chapter === expectedChapter && start <= expectedEnd && end >= expectedStart;
  });
}

function textParts(value, parts = []) {
  if (value == null) return parts;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    parts.push(String(value));
    return parts;
  }
  if (Array.isArray(value)) {
    for (const item of value) textParts(item, parts);
    return parts;
  }
  if (typeof value === 'object') {
    for (const item of Object.values(value)) textParts(item, parts);
  }
  return parts;
}

function scoreCase(testCase, json, elapsed) {
  const rag = json.ragQuery || {};
  const actualPrimary = toRef(json.primary?.reference);
  const text = textParts({ explanation: json.explanation, background: json.background, clarifyPrompt: json.clarifyPrompt }).join('\n');
  const hits = (testCase.expectedTerms || []).filter((term) => text.includes(term));

  const checks = [
    { name: 'http', ok: elapsed < 120 },
    { name: 'query-plan', ok: ['deterministic', 'hermes-agent', 'hermes'].includes(rag.expansionProvider) },
    { name: 'reliable', ok: ['direct', 'safety_first'].includes(json.state) && json.confidence !== 'low' && Number(json.meta?.passageScore || 0) >= 5 },
    { name: 'expected-primary', ok: json.primary !== null && overlapsExpected(actualPrimary, testCase.expectedPrimaryRefs || []) },
    { name: 'explanation-terms', ok: hits.length >= 2 && !!json.explanation },
  ];
  return { actualPrimary, hits, checks, score: checks.filter((check) => check.ok).length };
}

const cases = JSON.parse(await readFile(fixturePath, 'utf8'));
const results = [];
for (const [index, testCase] of cases.entries()) {
  const started = Date.now();
  try {
    const response = await fetch(`${baseUrl}/${locale}/api/reflect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'Bible QA' },
      body: JSON.stringify({ prompt: testCase.prompt }),
    });
    const elapsed = (Date.now() - started) / 1000;
    if (!response.ok) {
      results.push({ n: index + 1, id: testCase.id, prompt: testCase.prompt, ok: false, elapsed: Number(elapsed.toFixed(1)), score: 0, max: 5, error: `HTTP ${response.status}` });
      console.log(JSON.stringify(results.at(-1), null, 0));
      continue;
    }
    const json = await response.json();
    const scored = scoreCase(testCase, json, elapsed);
    results.push({
      n: index + 1,
      id: testCase.id,
      prompt: testCase.prompt,
      ok: true,
      elapsed: Number(elapsed.toFixed(1)),
      score: scored.score,
      max: 5,
      baseUrl,
      primary: scored.actualPrimary,
      expectedPrimaryRefs: testCase.expectedPrimaryRefs,
      confidence: json.confidence,
      state: json.state,
      passageScore: json.meta?.passageScore,
      ragProvider: json.ragQuery?.expansionProvider,
      ragModel: json.ragQuery?.expansionModel,
      hits: scored.hits,
      failedChecks: scored.checks.filter((check) => !check.ok).map((check) => check.name),
      primaryReason: String(json.primary?.reason || '').slice(0, 240),
    });
    console.log(JSON.stringify(results.at(-1), null, 0));
  } catch (error) {
    const elapsed = (Date.now() - started) / 1000;
    results.push({ n: index + 1, id: testCase.id, prompt: testCase.prompt, ok: false, elapsed: Number(elapsed.toFixed(1)), score: 0, max: 5, error: error instanceof Error ? error.name : 'UnknownError', message: error instanceof Error ? error.message.slice(0, 180) : String(error) });
    console.log(JSON.stringify(results.at(-1), null, 0));
  }
}

const earned = results.reduce((sum, result) => sum + result.score, 0);
const possible = results.reduce((sum, result) => sum + result.max, 0);
const summary = {
  baseUrl,
  total: results.length,
  earned,
  possible,
  percent: Number(((earned / possible) * 100).toFixed(1)),
  passed4Plus: results.filter((result) => result.score >= 4).length,
  failedUnder4: results.filter((result) => result.score < 4).length,
  avgElapsed: Number((results.reduce((sum, result) => sum + result.elapsed, 0) / results.length).toFixed(1)),
  results,
};
console.log(`FINAL_SUMMARY ${JSON.stringify(summary)}`);
if (summary.percent < Number(process.env.PHILOSOPHY_QA_MIN_PERCENT || 95)) process.exit(1);
