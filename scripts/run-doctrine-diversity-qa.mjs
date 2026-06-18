import { readFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const fixtureArg = args.indexOf("--fixture");
const localeArg = args.indexOf("--locale");
const fixturePath = fixtureArg >= 0 ? args[fixtureArg + 1] : "qa/doctrine-diversity-qa.json";
const locale = localeArg >= 0 ? args[localeArg + 1] : "ko";
const baseUrl = process.env.BENCHMARK_BASE_URL || "http://127.0.0.1:3005";

const fixture = JSON.parse(await readFile(path.join(process.cwd(), fixturePath), "utf8"));

let passed = 0;
let failed = 0;
const failures = [];

for (const testCase of fixture) {
  const res = await fetch(`${baseUrl}/${locale}/api/reflect`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: testCase.prompt })
  });
  const data = await res.json();

  const checks = [];

  // Check doctrineDivergence
  const actualDivergence = data.questionUnderstanding?.doctrineDivergence;
  checks.push({
    name: "doctrineDivergence",
    expected: testCase.expectedDoctrineDivergence,
    actual: actualDivergence,
    pass: actualDivergence === testCase.expectedDoctrineDivergence
  });

  // Check doctrinePresentation.mode
  const actualMode = data.answerBundle?.doctrinePresentation?.mode;
  checks.push({
    name: "mode",
    expected: testCase.expectedMode,
    actual: actualMode,
    pass: actualMode === testCase.expectedMode
  });

  // Check view count
  const actualViewCount = data.answerBundle?.doctrinePresentation?.views?.length ?? 0;
  checks.push({
    name: "viewCount",
    expected: testCase.expectedViewCount,
    actual: actualViewCount,
    pass: actualViewCount === testCase.expectedViewCount
  });

  // Check requested tradition
  if (testCase.expectedRequestedTradition) {
    const actualTradition = data.answerBundle?.doctrinePresentation?.requestedTradition;
    checks.push({
      name: "requestedTradition",
      expected: testCase.expectedRequestedTradition,
      actual: actualTradition,
      pass: actualTradition === testCase.expectedRequestedTradition
    });
  }

  // Check doctrineTopic for divergent
  if (testCase.expectedDoctrineTopic) {
    const actualTopic = data.questionUnderstanding?.doctrineTopic;
    checks.push({
      name: "doctrineTopic",
      expected: testCase.expectedDoctrineTopic,
      actual: actualTopic,
      pass: actualTopic === testCase.expectedDoctrineTopic
    });
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
  total: fixture.length,
  passed,
  failed,
  percent: Math.round((passed / fixture.length) * 100),
  failures
}, null, 2));

if (failed > 0) process.exit(1);
