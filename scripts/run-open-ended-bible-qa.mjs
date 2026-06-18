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

function candidateRef(candidate) {
  if (!candidate) return null;
  return toRef(candidate.reference) ??
    toRef(candidate.unit?.reference) ??
    toRef(candidate.unit) ??
    toRef(candidate.passage?.reference) ??
    toRef(candidate.passage) ??
    (typeof candidate.displayReference === 'string' ? candidate.displayReference : null) ??
    (typeof candidate.reference === 'string' ? candidate.reference : null);
}

function refsFrom(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => candidateRef(item) ?? toRef(item)).filter(Boolean);
}

function isRetrievalReliable(retrieval) {
  if (!retrieval) return false;
  return retrieval.confidence !== 'low' && (
    Number(retrieval.passageScore || 0) >= 5 ||
    (retrieval.supportingReferences || []).length > 0 ||
    (retrieval.reasons?.passageKeywords || []).length >= 2
  );
}

function actualReliability(json) {
  const bundleReliable = json.answerBundle?.reliable ?? json.bundle?.reliable;
  if (typeof bundleReliable === 'boolean') return bundleReliable;
  const bundleConfidence = json.answerBundle?.confidence ?? json.bundle?.confidence;
  if (bundleConfidence) return bundleConfidence !== 'low';
  if (typeof json.reliable === 'boolean') return json.reliable;
  return isRetrievalReliable(json.retrieval);
}

function actualPolicy(json) {
  return json.answerBundle?.answerPolicy ??
    json.answerBundle?.policy ??
    json.answerBundle?.question?.answerMode ??
    json.bundle?.answerPolicy ??
    json.bundle?.policy ??
    json.policy ??
    json.responsePolicy ??
    json.question?.answerMode ??
    json.questionUnderstanding?.answerMode ??
    json.retrieval?.answerPolicy ??
    json.retrieval?.policy ??
    json.ragQuery?.answerPolicy ??
    json.ragQuery?.policy ??
    json.response?.answerPolicy ??
    json.response?.policy ??
    null;
}

function actualPrimaryRef(json) {
  if (json.answerBundle && Object.hasOwn(json.answerBundle, 'primary')) {
    return candidateRef(json.answerBundle.primary);
  }
  if (json.bundle && Object.hasOwn(json.bundle, 'primary')) {
    return candidateRef(json.bundle.primary);
  }
  return toRef(json.retrieval?.primaryReference) ??
    candidateRef(json.primary) ??
    null;
}

function actualSupportingRefs(json) {
  if (json.answerBundle && Object.hasOwn(json.answerBundle, 'supporting')) {
    return refsFrom(json.answerBundle.supporting);
  }
  if (json.bundle && Object.hasOwn(json.bundle, 'supporting')) {
    return refsFrom(json.bundle.supporting);
  }
  const retrievalSupporting = refsFrom(json.retrieval?.supportingReferences);
  if (retrievalSupporting.length) return retrievalSupporting;
  return refsFrom(json.supporting);
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
  possible += 8;

  if (!response.ok) {
    failures.push({ id: testCase.id, family: testCase.family, prompt: testCase.prompt, reason: `HTTP ${response.status}`, latencyMs });
    rows.push({ id: testCase.id, family: testCase.family, prompt: testCase.prompt, status: response.status, latencyMs, caseScore: 0, possible: 8 });
    continue;
  }

  let json;
  try {
    json = await response.json();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    failures.push({ id: testCase.id, family: testCase.family, prompt: testCase.prompt, reason: `Invalid JSON: ${reason}`, latencyMs });
    rows.push({ id: testCase.id, family: testCase.family, prompt: testCase.prompt, status: response.status, latencyMs, caseScore: 0, possible: 8 });
    continue;
  }
  const policy = actualPolicy(json);
  const reliable = actualReliability(json);
  const primary = actualPrimaryRef(json);
  const supportingRefs = actualSupportingRefs(json);
  const safetyLevel = json.safety?.level ?? null;
  const responseText = textParts({
    response: json.response,
    answerBundle: json.answerBundle ?? json.bundle,
    question: json.question ?? json.questionUnderstanding,
  }).join('\n');
  const maxLatencyMs = Number(testCase.maxLatencyMs ?? defaultMaxLatencyMs);
  const evidenceHits = countHits(responseText, testCase.expectedEvidenceTerms || []);
  const forbiddenHits = (testCase.forbiddenPhrases || []).filter((phrase) => responseText.includes(phrase));
  const minSupportingCount = Number(testCase.minSupportingCount || 0);
  const maxSupportingCount = testCase.maxSupportingCount == null ? Infinity : Number(testCase.maxSupportingCount);

  checks.push({ name: 'policy', ok: policy === testCase.expectedPolicy });
  checks.push({ name: 'reliable', ok: reliable === testCase.expectedReliable });
  checks.push({
    name: 'primary',
    ok: testCase.expectedReliable
      ? (testCase.expectedPrimaryRefs || []).includes(primary)
      : !primary || (testCase.expectedPrimaryRefs || []).length === 0 || (testCase.expectedPrimaryRefs || []).includes(primary),
  });
  checks.push({ name: 'supporting-count', ok: supportingRefs.length >= minSupportingCount && supportingRefs.length <= maxSupportingCount });
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
    primary,
    supportingCount: supportingRefs.length,
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
      responseText,
    });
  }
}

const percent = possible ? Number(((earned / possible) * 100).toFixed(1)) : 0;
console.log(JSON.stringify({ baseUrl, fixture: fixtureRel, locale, total: cases.length, earned, possible, percent, rows, failures }, null, 2));
if (failures.length) process.exit(1);
