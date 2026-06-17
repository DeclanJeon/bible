import { readFile } from 'node:fs/promises';
import path from 'node:path';

const confidenceRank = { low: 0, medium: 1, high: 2 };
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
};

const fixtureRel = option('--fixture', 'qa/korean-prompt-benchmark.json');
const locale = option('--locale', 'ko');
const fixturePath = path.join(process.cwd(), fixtureRel);
const baseUrl = process.env.BENCHMARK_BASE_URL || 'http://127.0.0.1:3000';

function toRef(ref) {
  return `${ref.code} ${ref.chapter}:${ref.startVerse}${ref.endVerse === ref.startVerse ? '' : `-${ref.endVerse}`}`;
}

function codeOf(reference) {
  return reference.split(' ')[0];
}

const raw = await readFile(fixturePath, 'utf8');
const cases = JSON.parse(raw);
const failures = [];
const rows = [];

for (const testCase of cases) {
  const targetLocale = testCase.locale || locale;
  const response = await fetch(`${baseUrl}/${targetLocale}/api/reflect`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: testCase.prompt }),
  });
  if (!response.ok) {
    failures.push({ family: testCase.family, prompt: testCase.prompt, reason: `HTTP ${response.status}` });
    continue;
  }
  const json = await response.json();
  const actualPrimary = toRef(json.retrieval.primaryReference);
  const actualConfidence = json.retrieval.confidence;
  const supportCodes = (json.retrieval.supportingReferences || []).map((ref) => ref.code);
  const graphCodes = (json.graphSuggestions || []).map((item) => item.target.code);

  const primaryOk = testCase.expectedPrimaryRefs.includes(actualPrimary);
  const confidenceOk = confidenceRank[actualConfidence] >= confidenceRank[testCase.minConfidence];
  const supportOk = testCase.expectedSupportCodes.every((code) => supportCodes.includes(code) || codeOf(json.primary.reference) === code || graphCodes.includes(code));
  const graphOk = testCase.expectedGraphCodes.some((code) => graphCodes.includes(code));

  rows.push({
    family: testCase.family,
    prompt: testCase.prompt,
    locale: targetLocale,
    primary: actualPrimary,
    confidence: actualConfidence,
    score: json.retrieval.score,
    supportCodes,
    graphCodes: graphCodes.slice(0, 4),
  });

  if (!primaryOk || !confidenceOk || !supportOk || !graphOk) {
    failures.push({
      family: testCase.family,
      prompt: testCase.prompt,
      locale: targetLocale,
      primaryOk,
      confidenceOk,
      supportOk,
      graphOk,
      actualPrimary,
      actualConfidence,
      supportCodes,
      graphCodes,
      rationale: json.retrieval.rationale,
    });
  }
}

console.log(JSON.stringify({ baseUrl, fixture: fixtureRel, locale, total: cases.length, passed: cases.length - failures.length, failed: failures.length, rows, failures }, null, 2));
if (failures.length) process.exit(1);
