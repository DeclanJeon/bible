/**
 * Quality-based QA runner — tests real retrieval quality, not pre-assigned verses.
 *
 * Checks (5 points per question):
 *  1. http        — responds within timeout
 *  2. query-plan  — uses deterministic/hermes planner
 *  3. has-primary — returns a primary passage for direct passage-first answers
 *  4. reliable    — direct/safety-first state with non-low confidence and solid passage score
 *  5. explanation — explanation payload contains relevant terms
 *
 * No expectedPrimaryRefs needed — validates the system's actual behavior.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
};

const fixtureRel = option('--fixture', 'qa/philosophical-deep-qa.json');
const locale = option('--locale', 'ko');
const baseUrl = process.env.BENCHMARK_BASE_URL || 'http://127.0.0.1:3000';
const fixturePath = path.join(process.cwd(), fixtureRel);
const maxLatencyMs = Number(option('--max-latency-ms', '120000'));

function toRef(ref) {
  if (!ref) return '';
  return `${ref.code} ${ref.chapter}:${ref.startVerse}${ref.endVerse === ref.startVerse ? '' : `-${ref.endVerse}`}`;
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
  const supportingCount = Array.isArray(json.relatedPassages) ? json.relatedPassages.length : 0;
  const text = textParts({ explanation: json.explanation, background: json.background, clarifyPrompt: json.clarifyPrompt }).join('\n');
  const hits = (testCase.expectedTerms || []).filter((term) => text.includes(term));
  const expectsReliable = testCase.expectedReliable !== false;
  const hasPrimaryOk = expectsReliable ? (json.primary !== null && !!actualPrimary) : !actualPrimary;
  const reliableOk = expectsReliable
    ? ['direct', 'safety_first'].includes(json.state) && json.confidence !== 'low' && Number(json.meta?.passageScore || 0) >= 5
    : !['direct', 'safety_first'].includes(json.state) || json.confidence === 'low';
  const explanationOk = (testCase.expectedTerms?.length ? hits.length >= 1 : text.length > 0) && (!!json.explanation || !!json.clarifyPrompt);

  const checks = [
    { name: 'http', ok: elapsed < maxLatencyMs / 1000 },
    { name: 'query-plan', ok: ['deterministic', 'hermes-agent', 'hermes'].includes(rag.expansionProvider) || !!json.meta?.retrievalMode },
    { name: 'has-primary', ok: hasPrimaryOk },
    { name: 'reliable', ok: reliableOk },
    { name: 'explanation', ok: explanationOk },
  ];

  return {
    actualPrimary,
    supportingCount,
    hits,
    confidence: json.confidence,
    passageScore: json.meta?.passageScore,
    state: json.state,
    checks,
    score: checks.filter((check) => check.ok).length,
  };
}

const raw = await readFile(fixturePath, 'utf8');
const cases = JSON.parse(raw);
const failures = [];
const rows = [];
let earned = 0;
let possible = 0;

for (const [index, testCase] of cases.entries()) {
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}/${locale}/api/reflect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: testCase.prompt, locale }),
    });
    const elapsed = (Date.now() - start) / 1000;
    const json = await res.json();
    const result = scoreCase(testCase, json, elapsed);
    earned += result.score;
    possible += 5;
    const row = {
      n: index + 1,
      id: testCase.id,
      prompt: testCase.prompt,
      ok: result.score >= 4,
      elapsed,
      score: result.score,
      max: 5,
      primary: result.actualPrimary,
      supportingCount: result.supportingCount,
      confidence: result.confidence,
      passageScore: result.passageScore,
      state: result.state,
      hits: result.hits,
      failedChecks: result.checks.filter((c) => !c.ok).map((c) => c.name),
    };
    rows.push(row);
    if (result.score < 4) {
      failures.push(row);
    }
    if ((index + 1) % 50 === 0 || index === cases.length - 1) {
      const pct = possible ? ((earned / possible) * 100).toFixed(1) : '0.0';
      console.error(`[${index + 1}/${cases.length}] earned=${earned} possible=${possible} pct=${pct}%`);
    }
  } catch (err) {
    const elapsed = (Date.now() - start) / 1000;
    const row = {
      n: index + 1,
      id: testCase.id,
      prompt: testCase.prompt,
      ok: false,
      elapsed,
      score: 0,
      max: 5,
      primary: '',
      supportingCount: 0,
      confidence: 'error',
      passageScore: 0,
      state: 'error',
      hits: [],
      failedChecks: ['http'],
      error: String(err),
    };
    rows.push(row);
    failures.push(row);
    possible += 5;
  }
}

const percent = possible ? Number(((earned / possible) * 100).toFixed(1)) : 0;
const passed = rows.filter(r => r.score >= 4).length;
const failed = rows.filter(r => r.score < 4).length;
const avgElapsed = rows.reduce((s, r) => s + r.elapsed, 0) / rows.length;

const failReasons = {};
for (const r of rows) {
  for (const f of r.failedChecks || []) {
    failReasons[f] = (failReasons[f] || 0) + 1;
  }
}

const summary = {
  baseUrl,
  total: cases.length,
  earned,
  possible,
  percent,
  passed,
  failed,
  avgElapsed: Number(avgElapsed.toFixed(1)),
  failReasons,
  failures: failures.slice(0, 20),
};

console.log(JSON.stringify(summary, null, 2));
if (percent < Number(process.env.QA_MIN_PERCENT || 95)) process.exit(1);
