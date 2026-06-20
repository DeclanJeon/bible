import { readFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const fixtureArg = args.indexOf("--fixture");
const localeArg = args.indexOf("--locale");
const fixturePath = fixtureArg >= 0 ? args[fixtureArg + 1] : "qa/doctrine-diversity-qa.json";
const locale = localeArg >= 0 ? args[localeArg + 1] : "ko";
const baseUrl = process.env.BENCHMARK_BASE_URL || "http://127.0.0.1:3000";

const fixture = JSON.parse(await readFile(path.join(process.cwd(), fixturePath), "utf8"));

let passed = 0;
let failed = 0;
const failures = [];

function hasPassageFirstReflectShape(data) {
  return Boolean(data)
    && data.state === "direct"
    && typeof data.meta?.answerMode === "string"
    && data.primary
    && data.primary.reference
    && typeof data.primary.text === "string"
    && typeof data.primary.reason === "string"
    && typeof data.primary.score === "number"
    && data.explanation
    && typeof data.explanation.userConcernSummary === "string"
    && typeof data.explanation.connectionToUser === "string"
    && typeof data.explanation.whyThisPassage === "string";
}

function omitsLegacyDoctrinePayload(data) {
  return !Object.hasOwn(data, "answerBundle")
    && !Object.hasOwn(data, "bundle")
    && !Object.hasOwn(data, "doctrinePresentation");
}

for (const testCase of fixture) {
  const res = await fetch(`${baseUrl}/${locale}/api/reflect`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: testCase.prompt })
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  const checks = [];

  checks.push({
    name: "http",
    expected: 200,
    actual: res.status,
    pass: res.ok
  });

  if (data) {
    const actualDivergence = data.questionUnderstanding?.doctrineDivergence;
    checks.push({
      name: "doctrineDivergence",
      expected: testCase.expectedDoctrineDivergence,
      actual: actualDivergence,
      pass: actualDivergence === testCase.expectedDoctrineDivergence
    });

    checks.push({
      name: "answerMode",
      expected: "survey_bundle",
      actual: data.meta?.answerMode,
      pass: data.meta?.answerMode === "survey_bundle"
    });

    checks.push({
      name: "passageFirstShape",
      expected: "direct state with primary and explanation",
      actual: {
        state: data.state,
        hasPrimary: Boolean(data.primary),
        hasExplanation: Boolean(data.explanation)
      },
      pass: hasPassageFirstReflectShape(data)
    });

    checks.push({
      name: "legacyDoctrinePayloadRemoved",
      expected: true,
      actual: omitsLegacyDoctrinePayload(data),
      pass: omitsLegacyDoctrinePayload(data)
    });

    if (testCase.expectedRequestedTradition) {
      const actualTradition = data.questionUnderstanding?.requestedTradition;
      checks.push({
        name: "requestedTradition",
        expected: testCase.expectedRequestedTradition,
        actual: actualTradition,
        pass: actualTradition === testCase.expectedRequestedTradition
      });
    }

    if (testCase.expectedDoctrineTopic) {
      const actualTopic = data.questionUnderstanding?.doctrineTopic;
      checks.push({
        name: "doctrineTopic",
        expected: testCase.expectedDoctrineTopic,
        actual: actualTopic,
        pass: actualTopic === testCase.expectedDoctrineTopic
      });
    }
  }

  const caseChecks = checks.filter(c => c.pass).length;
  const caseTotal = checks.length;

  if (caseChecks === caseTotal) {
    passed++;
  } else {
    failed++;
    failures.push({
      id: testCase.id,
      prompt: testCase.prompt,
      failedChecks: checks.filter(c => !c.pass)
    });
  }
}

console.log(JSON.stringify({
  baseUrl,
  total: fixture.length,
  passed,
  failed,
  percent: Math.round((passed / fixture.length) * 100),
  failures
}, null, 2));

if (failed > 0) process.exit(1);
