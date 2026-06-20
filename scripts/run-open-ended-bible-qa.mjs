import { readFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
};

const fixtureRel = option('--fixture', 'qa/open-ended-bible-qa.json');
const locale = option('--locale', 'ko');
const baseUrl = process.env.BENCHMARK_BASE_URL || 'http://127.0.0.1:3000';
const fixturePath = path.join(process.cwd(), fixtureRel);
const defaultMaxLatencyMs = Number(option('--max-latency-ms', '4000'));

function toRef(ref) {
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  const code = ref.code ?? ref.bookCode ?? ref.book;
  const chapter = ref.chapter ?? ref.startChapter;
  const startVerse = ref.startVerse ?? ref.verse;
  const endVerse = ref.endVerse ?? startVerse;
  if (!code || !chapter || !startVerse) return null;
  return `${code} ${chapter}:${startVerse}${endVerse === startVerse ? '' : `-${endVerse}`}`;
}

function refsFromRelatedPassages(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => toRef(item?.reference)).filter(Boolean);
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

function includesAny(text, terms) {
  return !terms?.length || terms.some((term) => text.includes(term));
}

function countHits(text, terms) {
  if (!terms?.length) return 0;
  return terms.filter((term) => text.includes(term)).length;
}

const raw = await readFile(fixturePath, 'utf8');
const cases = JSON.parse(raw);
const failures = [];
const rows = [];
let earned = 0;
let possible = 0;

for (const testCase of cases) {
  const checks = [];
  const started = Date.now();
  let response;

  try {
    response = await fetch(`${baseUrl}/${locale}/api/reflect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: testCase.prompt }),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    failures.push({ id: testCase.id, family: testCase.family, prompt: testCase.prompt, reason });
    rows.push({ id: testCase.id, family: testCase.family, prompt: testCase.prompt, error: reason, caseScore: 0, possible: 1 });
    possible += 1;
    continue;
  }

  const latencyMs = Date.now() - started;
  possible += 9;

  if (!response.ok) {
    failures.push({ id: testCase.id, family: testCase.family, prompt: testCase.prompt, reason: `HTTP ${response.status}`, latencyMs });
    rows.push({ id: testCase.id, family: testCase.family, prompt: testCase.prompt, status: response.status, latencyMs, caseScore: 0, possible: 9 });
    continue;
  }

  let json;
  try {
    json = await response.json();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    failures.push({ id: testCase.id, family: testCase.family, prompt: testCase.prompt, reason: `Invalid JSON: ${reason}`, latencyMs });
    rows.push({ id: testCase.id, family: testCase.family, prompt: testCase.prompt, status: response.status, latencyMs, caseScore: 0, possible: 9 });
    continue;
  }

  const policy = json.meta?.answerMode ?? json.questionUnderstanding?.answerMode ?? null;
  const state = json.state ?? null;
  const reliable = ['direct', 'safety_first'].includes(state);
  const primary = toRef(json.primary?.reference);
  const relatedRefs = refsFromRelatedPassages(json.relatedPassages);
  const safetyLevel = json.safety?.level ?? null;
  const responseText = textParts({
    explanation: json.explanation,
    background: json.background,
    clarifyPrompt: json.clarifyPrompt,
    safety: json.safety,
    questionUnderstanding: json.questionUnderstanding,
    relatedPassages: json.relatedPassages,
    normalizedQuestion: json.normalizedQuestion,
    prompt: json.prompt,
  }).join('\n');
  const maxLatencyMs = Number(testCase.maxLatencyMs ?? defaultMaxLatencyMs);
  const evidenceHits = countHits(responseText, testCase.expectedEvidenceTerms || []);
  const forbiddenHits = (testCase.forbiddenPhrases || []).filter((phrase) => responseText.includes(phrase));
  const minSupportingCount = Number(testCase.minSupportingCount || 0);
  const maxSupportingCount = testCase.maxSupportingCount == null ? Infinity : Number(testCase.maxSupportingCount);

  checks.push({ name: 'policy', ok: policy === testCase.expectedPolicy });
  checks.push({ name: 'reliable', ok: reliable === testCase.expectedReliable });
  checks.push({
    name: 'state',
    ok: testCase.expectedReliable ? ['direct', 'safety_first'].includes(state) : ['tentative', 'unsupported'].includes(state),
  });
  checks.push({
    name: 'primary',
    ok: testCase.expectedReliable
      ? !!primary && (testCase.expectedPrimaryRefs || []).includes(primary)
      : true,
  });
  checks.push({ name: 'supporting-count', ok: relatedRefs.length >= minSupportingCount && relatedRefs.length <= maxSupportingCount });
  checks.push({ name: 'forbidden-phrases', ok: forbiddenHits.length === 0 });
  checks.push({ name: 'safety-level', ok: safetyLevel === testCase.expectedSafetyLevel });
  checks.push({ name: 'latency', ok: latencyMs <= maxLatencyMs });
  checks.push({
    name: 'evidence-terms',
    ok: includesAny(responseText, testCase.expectedEvidenceTerms || []) && evidenceHits >= Number(testCase.minEvidenceTermHits || 1),
  });

  const caseScore = checks.filter((check) => check.ok).length;
  earned += caseScore;

  const row = {
    id: testCase.id,
    family: testCase.family,
    prompt: testCase.prompt,
    policy,
    expectedPolicy: testCase.expectedPolicy,
    state,
    primary,
    relatedCount: relatedRefs.length,
    reliable,
    expectedReliable: testCase.expectedReliable,
    safety: safetyLevel,
    latencyMs,
    evidenceHits,
    forbiddenHits,
    caseScore,
    possible: checks.length,
  };
  rows.push(row);

  if (caseScore < checks.length) {
    failures.push({
      ...row,
      failedChecks: checks.filter((check) => !check.ok).map((check) => check.name),
      expectedPrimaryRefs: testCase.expectedPrimaryRefs || [],
      expectedSafetyLevel: testCase.expectedSafetyLevel,
      maxLatencyMs,
      expectedSupportingCount: { min: minSupportingCount, max: Number.isFinite(maxSupportingCount) ? maxSupportingCount : null },
      responseEvidenceTerms: testCase.expectedEvidenceTerms || [],
      relatedRefs,
      responseText,
    });
  }
}

const percent = possible ? Number(((earned / possible) * 100).toFixed(1)) : 0;
console.log(JSON.stringify({ baseUrl, fixture: fixtureRel, locale, total: cases.length, earned, possible, percent, rows, failures }, null, 2));
if (failures.length) process.exit(1);
