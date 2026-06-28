#!/usr/bin/env node
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "gotquestions-rag-qa-key";
process.env.OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://gotquestions-rag-qa.invalid";
process.env.OPENAI_MODEL = process.env.OPENAI_MODEL || "gotquestions-rag-qa-model";
process.env.HERMES_CHAT_COMPLETIONS_FIRST = "1";

const { readFile } = await import("node:fs/promises");
const path = await import("node:path");

const ROOT = process.cwd();
const indexPath = path.join(ROOT, "data", "faith", "gotquestions-ko.index.json");
const auditPath = path.join(ROOT, "data", "faith", "gotquestions-ko.source-audit.json");
const fixturePath = path.join(ROOT, "qa", "gotquestions-100.json");
const parserGoldPath = path.join(ROOT, "qa", "gotquestions-reference-parser-gold.json");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const index = JSON.parse(await readFile(indexPath, "utf8"));
const audit = JSON.parse(await readFile(auditPath, "utf8"));
assert(index.version === 1, "index version must be 1");
assert(index.bodyStored === false, "index must report bodyStored false");
assert(audit.bodyStored === false, "audit must report bodyStored false");
assert(process.env.GOTQUESTIONS_RAG_OPTIONAL !== "1", "GOTQUESTIONS_RAG_OPTIONAL must not be enabled for QA");
assert(Array.isArray(index.articles) && index.articles.length > 0, "index must contain articles");

const forbiddenKeys = /^(body|content|answer|html|markdown|excerpt|quote|paragraph|textBody|articleBody)$/i;
const requiredArticleFields = ["id", "slug", "url", "titleKo", "questionTextKo", "categoryIds", "attribution", "copyrightPolicyUrl"];
const categories = new Set(index.categories.map((category) => category.id));
const urls = new Set();
for (const article of index.articles) {
  for (const field of requiredArticleFields) assert(article[field] && (!Array.isArray(article[field]) || article[field].length), `article ${article.id} missing ${field}`);
  assert(article.bodyStored === false, `article ${article.id} must not store body`);
  assert(!urls.has(article.url), `duplicate article url ${article.url}`);
  urls.add(article.url);
  for (const categoryId of article.categoryIds) assert(categories.has(categoryId), `article ${article.id} has unknown category ${categoryId}`);
  assert((article.titleKo || "").length <= 180, `article ${article.id} title too long`);
  assert((article.questionTextKo || "").length <= 220, `article ${article.id} question text too long`);
}

function scanForbidden(value, trail = []) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert(!forbiddenKeys.test(key), `forbidden body-like key ${[...trail, key].join(".")}`);
    scanForbidden(child, [...trail, key]);
  }
}
scanForbidden(index);

const BOOK_ALIASES = new Map([
  ["gen", "GEN"],
  ["창세기", "GEN"],
  ["창", "GEN"],
  ["exo", "EXO"],
  ["출애굽기", "EXO"],
  ["출", "EXO"],
  ["lev", "LEV"],
  ["레위기", "LEV"],
  ["레", "LEV"],
  ["num", "NUM"],
  ["민수기", "NUM"],
  ["민", "NUM"],
  ["deu", "DEU"],
  ["신명기", "DEU"],
  ["신", "DEU"],
  ["jos", "JOS"],
  ["여호수아", "JOS"],
  ["수", "JOS"],
  ["jdg", "JDG"],
  ["사사기", "JDG"],
  ["삿", "JDG"],
  ["rut", "RUT"],
  ["룻기", "RUT"],
  ["룻", "RUT"],
  ["1sa", "1SA"],
  ["사무엘상", "1SA"],
  ["삼상", "1SA"],
  ["2sa", "2SA"],
  ["사무엘하", "2SA"],
  ["삼하", "2SA"],
  ["1ki", "1KI"],
  ["열왕기상", "1KI"],
  ["왕상", "1KI"],
  ["2ki", "2KI"],
  ["열왕기하", "2KI"],
  ["왕하", "2KI"],
  ["1ch", "1CH"],
  ["역대상", "1CH"],
  ["대상", "1CH"],
  ["2ch", "2CH"],
  ["역대하", "2CH"],
  ["대하", "2CH"],
  ["ezr", "EZR"],
  ["에스라", "EZR"],
  ["스", "EZR"],
  ["neh", "NEH"],
  ["느헤미야", "NEH"],
  ["느", "NEH"],
  ["est", "EST"],
  ["에스더", "EST"],
  ["에", "EST"],
  ["job", "JOB"],
  ["욥기", "JOB"],
  ["욥", "JOB"],
  ["psa", "PSA"],
  ["시편", "PSA"],
  ["시", "PSA"],
  ["pro", "PRO"],
  ["잠언", "PRO"],
  ["잠", "PRO"],
  ["ecc", "ECC"],
  ["전도서", "ECC"],
  ["전", "ECC"],
  ["sng", "SNG"],
  ["아가", "SNG"],
  ["아", "SNG"],
  ["isa", "ISA"],
  ["이사야", "ISA"],
  ["사", "ISA"],
  ["jer", "JER"],
  ["예레미야", "JER"],
  ["렘", "JER"],
  ["lam", "LAM"],
  ["예레미야애가", "LAM"],
  ["애가", "LAM"],
  ["애", "LAM"],
  ["ezk", "EZK"],
  ["에스겔", "EZK"],
  ["겔", "EZK"],
  ["dan", "DAN"],
  ["다니엘", "DAN"],
  ["단", "DAN"],
  ["hos", "HOS"],
  ["호세아", "HOS"],
  ["호", "HOS"],
  ["jol", "JOL"],
  ["요엘", "JOL"],
  ["욜", "JOL"],
  ["amo", "AMO"],
  ["아모스", "AMO"],
  ["암", "AMO"],
  ["oba", "OBA"],
  ["오바댜", "OBA"],
  ["옵", "OBA"],
  ["jon", "JON"],
  ["요나", "JON"],
  ["욘", "JON"],
  ["mic", "MIC"],
  ["미가", "MIC"],
  ["미", "MIC"],
  ["nam", "NAM"],
  ["나훔", "NAM"],
  ["나", "NAM"],
  ["hab", "HAB"],
  ["하박국", "HAB"],
  ["합", "HAB"],
  ["zep", "ZEP"],
  ["스바냐", "ZEP"],
  ["습", "ZEP"],
  ["hag", "HAG"],
  ["학개", "HAG"],
  ["학", "HAG"],
  ["zec", "ZEC"],
  ["스가랴", "ZEC"],
  ["슥", "ZEC"],
  ["mal", "MAL"],
  ["말라기", "MAL"],
  ["말", "MAL"],
  ["mat", "MAT"],
  ["마태복음", "MAT"],
  ["마", "MAT"],
  ["mrk", "MRK"],
  ["마가복음", "MRK"],
  ["막", "MRK"],
  ["luk", "LUK"],
  ["누가복음", "LUK"],
  ["눅", "LUK"],
  ["jhn", "JHN"],
  ["요한복음", "JHN"],
  ["요", "JHN"],
  ["act", "ACT"],
  ["사도행전", "ACT"],
  ["행", "ACT"],
  ["rom", "ROM"],
  ["로마서", "ROM"],
  ["롬", "ROM"],
  ["1co", "1CO"],
  ["고린도전서", "1CO"],
  ["고전", "1CO"],
  ["2co", "2CO"],
  ["고린도후서", "2CO"],
  ["고후", "2CO"],
  ["gal", "GAL"],
  ["갈라디아서", "GAL"],
  ["갈", "GAL"],
  ["eph", "EPH"],
  ["에베소서", "EPH"],
  ["엡", "EPH"],
  ["php", "PHP"],
  ["빌립보서", "PHP"],
  ["빌", "PHP"],
  ["col", "COL"],
  ["골로새서", "COL"],
  ["골", "COL"],
  ["1th", "1TH"],
  ["데살로니가전서", "1TH"],
  ["살전", "1TH"],
  ["2th", "2TH"],
  ["데살로니가후서", "2TH"],
  ["살후", "2TH"],
  ["1ti", "1TI"],
  ["디모데전서", "1TI"],
  ["딤전", "1TI"],
  ["2ti", "2TI"],
  ["디모데후서", "2TI"],
  ["딤후", "2TI"],
  ["tit", "TIT"],
  ["디도서", "TIT"],
  ["딛", "TIT"],
  ["phm", "PHM"],
  ["빌레몬서", "PHM"],
  ["몬", "PHM"],
  ["heb", "HEB"],
  ["히브리서", "HEB"],
  ["히", "HEB"],
  ["jas", "JAS"],
  ["야고보서", "JAS"],
  ["약", "JAS"],
  ["1pe", "1PE"],
  ["베드로전서", "1PE"],
  ["벧전", "1PE"],
  ["2pe", "2PE"],
  ["베드로후서", "2PE"],
  ["벧후", "2PE"],
  ["1jn", "1JN"],
  ["요한일서", "1JN"],
  ["요일", "1JN"],
  ["2jn", "2JN"],
  ["요한이서", "2JN"],
  ["요이", "2JN"],
  ["3jn", "3JN"],
  ["요한삼서", "3JN"],
  ["요삼", "3JN"],
  ["jud", "JUD"],
  ["유다서", "JUD"],
  ["유", "JUD"],
  ["rev", "REV"],
  ["요한계시록", "REV"],
  ["계시록", "REV"],
  ["계", "REV"],
]);
const BOOK_PATTERN = [...BOOK_ALIASES.keys()].sort((a, b) => b.length - a.length).map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
const REFERENCE_PATTERN = new RegExp(`(?<![\\p{L}\\p{N}])(${BOOK_PATTERN})\\s*(\\d{1,3})\\s*[:：]\\s*(\\d{1,3})(?:\\s*[-–~]\\s*(\\d{1,3}))?(?:\\s*,\\s*(\\d{1,3})(?:\\s*[-–~]\\s*(\\d{1,3}))?)*`, "giu");
const TAIL_VERSE_PATTERN = /,\s*(\d{1,3})(?:\s*[-–~]\s*(\d{1,3}))?/gu;

function referenceKey(reference) {
  return `${reference.code}-${reference.chapter}-${reference.startVerse}-${reference.endVerse}`;
}

function buildReference(code, chapter, startVerse, endVerse = startVerse) {
  if (!Number.isInteger(chapter) || !Number.isInteger(startVerse) || !Number.isInteger(endVerse)) return null;
  if (chapter < 1 || startVerse < 1 || endVerse < startVerse) return null;
  return { code, chapter, startVerse, endVerse };
}

function parseReferences(text) {
  const references = [];
  const seen = new Set();
  for (const match of text.matchAll(REFERENCE_PATTERN)) {
    const code = BOOK_ALIASES.get(match[1].toLowerCase()) || BOOK_ALIASES.get(match[1]);
    if (!code) continue;
    const chapter = Number(match[2]);
    const first = buildReference(code, chapter, Number(match[3]), match[4] ? Number(match[4]) : Number(match[3]));
    if (first && !seen.has(referenceKey(first))) {
      seen.add(referenceKey(first));
      references.push(first);
    }
    const firstTail = match[0].search(/,\s*\d/u);
    if (firstTail === -1) continue;
    for (const tailMatch of match[0].slice(firstTail).matchAll(TAIL_VERSE_PATTERN)) {
      const tailRef = buildReference(code, chapter, Number(tailMatch[1]), tailMatch[2] ? Number(tailMatch[2]) : Number(tailMatch[1]));
      if (tailRef && !seen.has(referenceKey(tailRef))) {
        seen.add(referenceKey(tailRef));
        references.push(tailRef);
      }
    }
  }
  return references;
}

const parserGold = JSON.parse(await readFile(parserGoldPath, "utf8"));
assert(parserGold.length >= 50, `parser gold must contain at least 50 cases, got ${parserGold.length}`);
for (const row of parserGold) {
  const actual = parseReferences(row.input).map(referenceKey);
  assert(JSON.stringify(actual) === JSON.stringify(row.expected), `parser gold ${row.id} expected ${JSON.stringify(row.expected)} got ${JSON.stringify(actual)}`);
}

function passageKey(passage) {
  const ref = passage.reference;
  if (!ref) return "";
  return `${ref.code}-${ref.chapter}-${ref.startVerse}-${ref.endVerse}`;
}

function expectedReferenceMatches(expected, actual) {
  return actual === expected || actual.replace(/-(\d+)$/, "") === expected;
}

const articleByUrl = new Map(index.articles.map((article) => [article.url, article]));
const articleByResourceId = new Map(index.articles.map((article) => [article.id, article]));

const STANCE_TAGS_BY_ARTICLE = new Map([
  ["gq-ko-plan-salvation", ["grace_not_works", "gospel"]],
  ["gq-ko-jesus-only", ["jesus_only", "salvation"]],
  ["gq-ko-trinity", ["trinity", "god"]],
  ["gq-ko-bible-errors", ["bible_reliability", "scripture_authority"]],
  ["gq-ko-heaven", ["eternity", "heaven", "heaven_hell_judgment"]],
  ["gq-ko-bible-work", ["vocation", "work"]],
]);

function resourceIds(answer) {
  return answer.resources?.map((resource) => resource.id) ?? [];
}

function resourceHrefs(answer) {
  return answer.resources?.map((resource) => resource.href) ?? [];
}

function resourceArticles(answer) {
  return resourceIds(answer).map((id) => articleByResourceId.get(id)).filter(Boolean);
}

function stanceTagsForArticle(id) {
  const tags = new Set(STANCE_TAGS_BY_ARTICLE.get(id) ?? []);
  const article = articleByResourceId.get(id);
  for (const categoryId of article?.categoryIds ?? []) tags.add(categoryId);
  for (const topic of article?.topics ?? []) tags.add(String(topic).toLowerCase());
  return tags;
}

function hasExpectedStance(answer, expectedTags) {
  if (!expectedTags?.length) return true;
  const actual = new Set();
  for (const id of resourceIds(answer)) {
    for (const tag of stanceTagsForArticle(id)) actual.add(tag);
  }
  return expectedTags.some((tag) => actual.has(String(tag).toLowerCase()) || actual.has(tag));
}

let fixtures = [];
try {
  fixtures = JSON.parse(await readFile(fixturePath, "utf8"));
} catch {
  fixtures = [];
}

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  assert(!url.includes("gotquestions.org"), `runtime must not fetch GotQuestions: ${url}`);
  if (url.startsWith("https://gotquestions-rag-qa.invalid")) {
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ summary: "QA fallback", caveat: "QA", biblicalDirection: "QA", passageReasons: [], resourceReasons: [], nextQuestions: [] }) } }] }), { status: 200, headers: { "content-type": "application/json" } });
  }
  return originalFetch(input, init);
};

const routeModule = await import("../.next/server/app/api/faith-questions/route.js");
const post = routeModule.default?.routeModule?.userland?.POST ?? routeModule.routeModule?.userland?.POST;
assert(typeof post === "function", "Built faith-questions route POST handler not found. Run npm run build first.");

async function callFaithQuestion(query) {
  const request = new Request("http://localhost/api/faith-questions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, locale: "ko" }),
  });
  const response = await post(request);
  return { status: response.status, data: await response.json() };
}

const cases = fixtures.length ? fixtures : [
  { id: "salvation", query: "구원받으려면 무엇을 믿어야 하나요?", expectedArticleUrl: "https://www.gotquestions.org/Korean/Korean-Plan-Salvation.html", expectedAnyReferences: ["JHN-3-16"] },
  { id: "work", query: "사업과 직업을 성경적으로 어떻게 봐야 하나요?", expectedArticleUrl: "https://www.gotquestions.org/Korean/Korean-Bible-work.html", expectedAnyReferences: ["COL-3-23-24"] },
  { id: "heaven", query: "천국은 어떤 곳인가요?", expectedArticleUrl: "https://www.gotquestions.org/Korean/Korean-heaven-like.html", expectedAnyReferences: ["REV-21-1-5"] },
];

const results = [];
const metrics = new Map();
for (const testCase of cases) {
  const result = await callFaithQuestion(testCase.query);
  assert(result.status === 200, `${testCase.id} should return 200`);
  assert(result.data.meta?.externalBodyFetched === false, `${testCase.id} externalBodyFetched must be false`);
  assert(result.data.meta?.externalBodyStored === false, `${testCase.id} externalBodyStored must be false`);
  assert(result.data.meta?.gotQuestionsRag?.bodyFetched === false, `${testCase.id} GQ bodyFetched must be false`);
  assert(result.data.meta?.gotQuestionsRag?.bodyStored === false, `${testCase.id} GQ bodyStored must be false`);
  assert((result.data.meta?.gotQuestionsRag?.matchedCount ?? 0) > 0, `${testCase.id} should have GotQuestions matches`);

  const hrefs = resourceHrefs(result.data);
  const topResourceIds = resourceIds(result.data).slice(0, 3);
  const bucket = testCase.bucket ?? "unbucketed";
  const bucketMetrics = metrics.get(bucket) ?? { total: 0, top1: 0, top3: 0, category: 0, reference: 0, stance: 0, stanceApplicable: 0 };
  bucketMetrics.total += 1;

  if (testCase.expectedArticleUrl) {
    assert(articleByUrl.has(testCase.expectedArticleUrl), `${testCase.id} expected article missing from local index ${testCase.expectedArticleUrl}`);
    assert(hrefs.includes(testCase.expectedArticleUrl), `${testCase.id} should include expected article ${testCase.expectedArticleUrl}`);
    if (hrefs[0] === testCase.expectedArticleUrl) bucketMetrics.top1 += 1;
    if (hrefs.slice(0, 3).includes(testCase.expectedArticleUrl)) bucketMetrics.top3 += 1;
  }

  if (testCase.expectedAnyCategoryIds?.length) {
    const actualCategories = new Set(resourceArticles(result.data).flatMap((article) => article.categoryIds));
    const categoryMatched = testCase.expectedAnyCategoryIds.some((categoryId) => actualCategories.has(categoryId));
    assert(categoryMatched, `${testCase.id} should include one expected category ${testCase.expectedAnyCategoryIds.join(",")}`);
    bucketMetrics.category += 1;
  }

  if (testCase.expectedAnyReferences?.length) {
    const actualPassages = (result.data.passages ?? []).map(passageKey);
    const referenceMatched = testCase.expectedAnyReferences.some((expected) => actualPassages.some((actual) => expectedReferenceMatches(expected, actual)));
    assert(referenceMatched, `${testCase.id} should include one expected passage`);
    bucketMetrics.reference += 1;
  }

  if (testCase.expectedStanceTags?.length) {
    bucketMetrics.stanceApplicable += 1;
    assert(hasExpectedStance(result.data, testCase.expectedStanceTags), `${testCase.id} should include one expected stance tag ${testCase.expectedStanceTags.join(",")}`);
    bucketMetrics.stance += 1;
  }

  for (const forbidden of testCase.forbidden ?? []) {
    if (forbidden === "externalBodyStored") {
      assert(result.data.meta?.externalBodyStored === false && result.data.meta?.gotQuestionsRag?.bodyStored === false, `${testCase.id} must not store external bodies`);
    }
    if (forbidden === "unsupportedReference") {
      assert((result.data.passages ?? []).every((passage) => passage.reference?.code && passage.reference.chapter > 0), `${testCase.id} must not emit unsupported references`);
    }
    if (forbidden === "bodySummary") {
      const combined = [result.data.summary, result.data.caveat, ...(result.data.resources ?? []).map((resource) => resource.summary?.ko ?? "")].join(" ");
      assert(!/원문은 다음과 말한다|GotQuestions.*답변은.*입니다/u.test(combined), `${testCase.id} must not summarize unstored GotQuestions body text`);
    }
  }

  metrics.set(bucket, bucketMetrics);
  results.push({ id: testCase.id, bucket, coverage: result.data.meta?.gotQuestionsRag?.coverage, matchedCount: result.data.meta?.gotQuestionsRag?.matchedCount, topResources: topResourceIds });
}

for (const [bucket, bucketMetrics] of metrics) {
  if (bucket === "gold") {
    assert(bucketMetrics.top3 === bucketMetrics.total, `gold bucket top3 must be 100%, got ${bucketMetrics.top3}/${bucketMetrics.total}`);
    assert(bucketMetrics.category === bucketMetrics.total, `gold bucket category coverage must be 100%, got ${bucketMetrics.category}/${bucketMetrics.total}`);
    assert(bucketMetrics.reference === bucketMetrics.total, `gold bucket reference coverage must be 100%, got ${bucketMetrics.reference}/${bucketMetrics.total}`);
    assert(bucketMetrics.stance === bucketMetrics.stanceApplicable, `gold bucket stance coverage must be 100%, got ${bucketMetrics.stance}/${bucketMetrics.stanceApplicable}`);
  }
}

globalThis.fetch = originalFetch;
console.log(JSON.stringify({ status: "passed", optionalMode: process.env.GOTQUESTIONS_RAG_OPTIONAL === "1", indexArticles: index.articles.length, parserGoldCases: parserGold.length, metrics: Object.fromEntries(metrics), checkedCases: results }, null, 2));
