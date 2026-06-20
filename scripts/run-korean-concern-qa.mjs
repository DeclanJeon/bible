import { readFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
};

const fixtureRel = option('--fixture', 'qa/korean-concern-qa.json');
const locale = option('--locale', 'ko');
const baseUrl = process.env.BENCHMARK_BASE_URL || 'http://127.0.0.1:3000';
const fixturePath = path.join(process.cwd(), fixtureRel);

function toRef(ref) {
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  return `${ref.code} ${ref.chapter}:${ref.startVerse}${ref.endVerse === ref.startVerse ? '' : `-${ref.endVerse}`}`;
}

function isDirectState(state) {
  return state === 'direct' || state === 'safety_first';
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
  return terms.length === 0 || terms.some((term) => text.includes(term));
}

const raw = await readFile(fixturePath, 'utf8');
const cases = JSON.parse(raw);
const failures = [];
const rows = [];
let earned = 0;
let possible = 0;

for (const testCase of cases) {
  const response = await fetch(`${baseUrl}/${locale}/api/reflect`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: testCase.prompt }),
  });

  possible += testCase.expectedSafetyLevel ? 5 : 4;

  if (!response.ok) {
    failures.push({ family: testCase.family, prompt: testCase.prompt, reason: `HTTP ${response.status}` });
    continue;
  }

  const json = await response.json();
  const actualPrimary = toRef(json.primary?.reference);
  const actualReliable = isDirectState(json.state);
  const relatedPassages = Array.isArray(json.relatedPassages) ? json.relatedPassages : [];
  const explanationText = textParts(json.explanation).join('\n');
  const fallbackText = textParts({ clarifyPrompt: json.clarifyPrompt, state: json.state }).join('\n');
  const explanationSource = explanationText || fallbackText;

  const reliableOk = actualReliable === testCase.expectedReliable;
  const primaryOk = !testCase.expectedReliable || testCase.expectedPrimaryRefs.includes(actualPrimary);
  const expansionOk = testCase.expectedReliable
    ? relatedPassages.length > 0
    : relatedPassages.length === 0 || json.state === 'unsupported';
  const explanationOk = includesAny(explanationSource, testCase.expectedExplanationTerms || []);
  const safetyOk = testCase.expectedSafetyLevel
    ? json.safety?.level === testCase.expectedSafetyLevel
    : true;

  const caseScore = [reliableOk, primaryOk, expansionOk, explanationOk, ...(testCase.expectedSafetyLevel ? [safetyOk] : [])].filter(Boolean).length;
  earned += caseScore;

  rows.push({
    family: testCase.family,
    prompt: testCase.prompt,
    primary: actualPrimary,
    confidence: json.confidence,
    passageScore: json.meta?.passageScore,
    state: json.state,
    relatedCount: relatedPassages.length,
    reliable: actualReliable,
    caseScore,
    safety: json.safety?.level,
    possible: testCase.expectedSafetyLevel ? 5 : 4,
  });

  if (caseScore < (testCase.expectedSafetyLevel ? 5 : 4)) {
    failures.push({
      family: testCase.family,
      prompt: testCase.prompt,
      reliableOk,
      primaryOk,
      expansionOk,
      explanationOk,
      safetyOk,
      actualSafety: json.safety?.level,
      actualPrimary,
      actualReliable,
      confidence: json.confidence,
      passageScore: json.meta?.passageScore,
      state: json.state,
      relatedPassages,
      explanationSource,
    });
  }
}

const percent = possible ? Number(((earned / possible) * 100).toFixed(1)) : 0;
console.log(JSON.stringify({ baseUrl, fixture: fixtureRel, locale, total: cases.length, earned, possible, percent, rows, failures }, null, 2));
if (failures.length) process.exit(1);
