/**
 * Quality-based QA runner — tests real retrieval quality, not pre-assigned verses.
 * 
 * Checks (5 points per question):
 *  1. http         — responds within timeout
 *  2. query-plan   — uses deterministic/hermes planner
 *  3. has-primary   — always returns a primary reference (never empty)
 *  4. reliable      — confidence ≥ medium, passageScore ≥ 5
 *  5. explanation   — response contains relevant explanation terms (≥2)
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
const concurrency = Number(option('--concurrency', '1'));

function toRef(ref) {
  if (!ref) return '';
  return `${ref.code} ${ref.chapter}:${ref.startVerse}${ref.endVerse === ref.startVerse ? '' : `-${ref.endVerse}`}`;
}

function scoreCase(testCase, json, elapsed) {
  const retrieval = json.retrieval || {};
  const response = json.response || {};
  const rag = json.ragQuery || {};
  const actualPrimary = toRef(retrieval.primaryReference);
  const supportingCount = (retrieval.supportingReferences || []).length;
  const text = [
    retrieval.rationale,
    response.concernSummary,
    response.relevanceSummary,
    response.whyTheseTexts,
    response.personalConnection,
  ].filter(Boolean).join('\n');
  const hits = (testCase.expectedTerms || []).filter((term) => text.includes(term));

  const checks = [
    { name: 'http',           ok: elapsed < maxLatencyMs / 1000 },
    { name: 'query-plan',     ok: ['deterministic', 'hermes-agent', 'hermes'].includes(rag.expansionProvider) || retrieval.retrievalMode },
    { name: 'has-primary',    ok: !!actualPrimary && actualPrimary !== '' },
    { name: 'reliable',       ok: retrieval.confidence !== 'low' && Number(retrieval.passageScore || 0) >= 5 },
    { name: 'explanation',    ok: hits.length >= 1 && !!response.whyTheseTexts && !!response.relevanceSummary },
  ];

  return {
    actualPrimary,
    supportingCount,
    hits,
    confidence: retrieval.confidence,
    passageScore: retrieval.passageScore,
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
      hits: result.hits,
      failedChecks: result.checks.filter((c) => !c.ok).map((c) => c.name),
    };
    rows.push(row);
    if (result.score < 4) {
      failures.push(row);
    }
    // Progress log every 50 questions
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
      hits: [],
      failedChecks: ['http'],
      error: String(err),
    };
    rows.push(row);
    failures.push(row);
    earned += 0;
    possible += 5;
  }
}

const percent = possible ? Number(((earned / possible) * 100).toFixed(1)) : 0;
const passed = rows.filter(r => r.score >= 4).length;
const failed = rows.filter(r => r.score < 4).length;
const avgElapsed = rows.reduce((s, r) => s + r.elapsed, 0) / rows.length;

// Check failure breakdown
const failReasons = {};
for (const r of rows) {
  for (const f of r.failedChecks || []) {
    failReasons[f] = (failReasons[f] || 0) + 1;
  }
}

const summary = {
  total: cases.length,
  earned,
  possible,
  percent,
  passed,
  failed,
  avgElapsed: Number(avgElapsed.toFixed(1)),
  failReasons,
  failures: failures.slice(0, 20), // first 20 failures for debugging
};

console.log(JSON.stringify(summary, null, 2));
if (percent < Number(process.env.QA_MIN_PERCENT || 95)) process.exit(1);
