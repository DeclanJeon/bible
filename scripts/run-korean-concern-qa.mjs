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
  return `${ref.code} ${ref.chapter}:${ref.startVerse}${ref.endVerse === ref.startVerse ? '' : `-${ref.endVerse}`}`;
}

function isReliable(retrieval) {
  return retrieval.confidence !== 'low' && (
    retrieval.passageScore >= 5 ||
    (retrieval.supportingReferences || []).length > 0 ||
    (retrieval.reasons?.passageKeywords || []).length >= 2
  );
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

  possible += 4;

  if (!response.ok) {
    failures.push({ family: testCase.family, prompt: testCase.prompt, reason: `HTTP ${response.status}` });
    continue;
  }

  const json = await response.json();
  const retrieval = json.retrieval;
  const actualPrimary = toRef(retrieval.primaryReference);
  const actualReliable = isReliable(retrieval);
  const responseText = [
    json.response?.concernSummary,
    json.response?.relevanceSummary,
    json.response?.whyTheseTexts,
    json.response?.personalConnection,
  ].filter(Boolean).join('\n');

  const reliableOk = actualReliable === testCase.expectedReliable;
  const primaryOk = !testCase.expectedReliable || testCase.expectedPrimaryRefs.includes(actualPrimary);
  const expansionOk = testCase.expectedReliable
    ? (json.graphSuggestions || []).length > 0 || (retrieval.supportingReferences || []).length > 0
    : (json.graphSuggestions || []).length === 0 && (json.supporting || []).length === 0 && (json.relatedClusters || []).length === 0;
  const explanationOk = includesAny(responseText, testCase.expectedExplanationTerms || []);

  const caseScore = [reliableOk, primaryOk, expansionOk, explanationOk].filter(Boolean).length;
  earned += caseScore;

  rows.push({
    family: testCase.family,
    prompt: testCase.prompt,
    primary: actualPrimary,
    confidence: retrieval.confidence,
    passageScore: retrieval.passageScore,
    reliable: actualReliable,
    caseScore,
    possible: 4,
  });

  if (caseScore < 4) {
    failures.push({
      family: testCase.family,
      prompt: testCase.prompt,
      reliableOk,
      primaryOk,
      expansionOk,
      explanationOk,
      actualPrimary,
      actualReliable,
      confidence: retrieval.confidence,
      passageScore: retrieval.passageScore,
      rationale: retrieval.rationale,
      responseText,
    });
  }
}

const percent = possible ? Number(((earned / possible) * 100).toFixed(1)) : 0;
console.log(JSON.stringify({ baseUrl, fixture: fixtureRel, locale, total: cases.length, earned, possible, percent, rows, failures }, null, 2));
if (failures.length) process.exit(1);
