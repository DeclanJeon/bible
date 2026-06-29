#!/usr/bin/env node
const { readFile } = await import("node:fs/promises");
const path = await import("node:path");

const ROOT = process.cwd();
const indexPath = path.join(ROOT, "data", "faith", "gotquestions-ko.index.json");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const LIMIT = Number(limitArg?.slice("--limit=".length) || 10000);
const MIN_RATE = Number(process.env.GOTQUESTIONS_LARGE_QA_MIN_RATE || 0.99);
const index = JSON.parse(await readFile(indexPath, "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeText(value) {
  return String(value).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
}

function normalizeKoreanTerm(value) {
  return value
    .replace(/적$/u, "")
    .replace(/(으로는|으로도|에게는|에게도|에서는|에서|에게|부터|까지|처럼|보다|라도|이며|이고|라는|이라|입니다|해요|어요|아요|이에요|예요|은|는|이|가|을|를|에|의|와|과|도|만|로|으로|요)$/u, "");
}

const STOP_WORDS = new Set(["그리고", "그러나", "무엇", "무엇인가", "어떻게", "왜", "있는가", "인가", "하나요", "입니까", "대한", "관한", "질문", "성경", "정말", "제가", "우리가", "알려줘", "설명해줘"]);
function tokenize(value) {
  return [...new Set(normalizeText(value).split(" ").map(normalizeKoreanTerm).filter((term) => term.length >= 2 && !STOP_WORDS.has(term)))];
}

function refKey(ref) {
  return `${ref.code}-${ref.chapter}-${ref.startVerse}-${ref.endVerse}`;
}

function scoreArticle(article, preparedQuery) {
  const terms = preparedQuery.terms;
  const normalizedQuery = preparedQuery.normalized;
  const queryTerms = normalizedQuery.split(" ").filter(Boolean);
  const normalizedTitle = article._qa.normalizedTitle;
  const normalizedQuestion = article._qa.normalizedQuestion;
  const normalizedSearch = article._qa.normalizedSearch;
  let score = 0;
  if (normalizedQuery && (normalizedTitle === normalizedQuery || normalizedQuestion === normalizedQuery)) score += 45;
  else if (
    normalizedQuery &&
    ((normalizedTitle.length >= 4 && normalizedQuery.includes(normalizedTitle)) ||
      (normalizedQuestion.length >= 4 && normalizedQuery.includes(normalizedQuestion)) ||
      (normalizedTitle.length >= 2 && queryTerms.includes(normalizedTitle)) ||
      (normalizedQuestion.length >= 2 && queryTerms.includes(normalizedQuestion)))
  ) score += 36;
  for (const term of terms) {
    if (normalizedTitle.includes(term) || normalizedQuestion.includes(term)) score += 8;
    else if (normalizedSearch.includes(term)) score += 3;
  }
  for (const normalizedKeyword of article._qa.normalizedKeywords) {
    if (normalizedQuery.includes(normalizedKeyword) || terms.some((term) => term.includes(normalizedKeyword) || normalizedKeyword.includes(term))) score += normalizedKeyword.length >= 3 ? 7 : 4;
  }
  const manualPriors = [
    [/구원|복음|영생|용서|죄.*구원/u, "salvation"],
    [/예수.*유일|유일한.*길|다른\s?종교/u, "jesus"],
    [/삼위일체|성부|성자|성령/u, "god"],
    [/성경.*(오류|모순|신뢰)|오류.*성경|모순.*성경/u, "bible"],
    [/천국|지옥|영생|새\s?하늘/u, "eternity"],
    [/직업|사업|일과|재정|소명/u, "life"],
  ];
  for (const [pattern, categoryId] of manualPriors) {
    if (pattern.test(preparedQuery.raw) && article.categoryIds?.includes(categoryId)) score += 20;
  }
  for (const topic of article.topics || []) {
    if (terms.includes(normalizeKoreanTerm(normalizeText(topic)))) score += 12;
  }
  if (article.categoryIds?.some((id) => ["salvation", "god", "jesus", "spirit", "bible", "eternity"].includes(id))) score += 2;
  return score;
}

function prepareQuery(query) {
  return { raw: query, normalized: normalizeText(query), terms: tokenize(query) };
}

function search(query) {
  const preparedQuery = prepareQuery(query);
  return index.articles
    .map((article) => ({ article, score: scoreArticle(article, preparedQuery) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.article.primaryCategoryId.localeCompare(b.article.primaryCategoryId) || a.article.slug.localeCompare(b.article.slug))
    .slice(0, 6);
}

function buildCases(limit) {
  const articles = index.articles.filter((article) => article.url && article.titleKo && article.references?.length);
  const variants = [
    (article) => article.questionTextKo || article.titleKo,
    (article) => `${article.questionTextKo || article.titleKo} 성경적으로 설명해줘`,
    (article) => `${article.titleKo.replace(/[?？]\s*$/u, "")} 관련 성구를 연결해줘`,
    (article) => `GotQuestions 기준으로 ${article.titleKo.replace(/[?？]\s*$/u, "")} 문답을 찾아줘`,
    (article) => `궁금합니다: ${article.questionTextKo || article.titleKo}`,
    (article) => `${(article.topics || article.keywords || [article.primaryCategoryId])[0]}에 대해 묻고 싶어요. ${article.titleKo}`,
    (article) => `회의적인 사람이 '${article.titleKo}'라고 물으면 어떻게 답하나요?`,
  ];
  const cases = [];
  let cursor = 0;
  while (cases.length < limit) {
    const article = articles[cursor % articles.length];
    const variant = variants[Math.floor(cursor / articles.length) % variants.length];
    cases.push({
      id: `large-${String(cases.length + 1).padStart(5, "0")}`,
      query: variant(article),
      expectedArticleUrl: article.url,
      expectedCategoryIds: article.categoryIds,
      expectedReferences: article.references.slice(0, 3).map(refKey),
    });
    cursor += 1;
  }
  return cases;
}

assert(index.version === 1, "index version must be 1");
assert(index.bodyStored === false, "index bodyStored must be false");
for (const article of index.articles) {
  article._qa = {
    normalizedTitle: normalizeText(article.titleKo || ""),
    normalizedQuestion: normalizeText(article.questionTextKo || ""),
    normalizedSearch: normalizeText([article.searchTextKo, ...(article.keywords || []), ...(article.topics || [])].join(" ")),
    normalizedKeywords: (article.keywords || []).map((keyword) => normalizeKoreanTerm(normalizeText(keyword))).filter(Boolean),
  };
}
const cases = buildCases(LIMIT);
let top1 = 0;
let top3 = 0;
let category = 0;
let reference = 0;
const failures = [];
for (const testCase of cases) {
  const hits = search(testCase.query);
  const hrefs = hits.map((hit) => hit.article.url);
  const categoryIds = new Set(hits.flatMap((hit) => hit.article.categoryIds || []));
  const refs = new Set(hits.flatMap((hit) => hit.article.references || []).map(refKey));
  const hitTop1 = hrefs[0] === testCase.expectedArticleUrl;
  const hitTop3 = hrefs.slice(0, 3).includes(testCase.expectedArticleUrl);
  const hitCategory = testCase.expectedCategoryIds.some((id) => categoryIds.has(id));
  const hitReference = testCase.expectedReferences.some((id) => refs.has(id));
  if (hitTop1) top1 += 1;
  if (hitTop3) top3 += 1;
  if (hitCategory) category += 1;
  if (hitReference) reference += 1;
  if (!(hitTop3 && hitCategory && hitReference) && failures.length < 100) {
    failures.push({ id: testCase.id, query: testCase.query, expectedArticleUrl: testCase.expectedArticleUrl, topUrls: hrefs.slice(0, 3), expectedReferences: testCase.expectedReferences, topReferences: [...refs].slice(0, 8) });
  }
}
const metrics = {
  total: cases.length,
  top1,
  top1Rate: top1 / cases.length,
  top3,
  top3Rate: top3 / cases.length,
  category,
  categoryRate: category / cases.length,
  reference,
  referenceRate: reference / cases.length,
};
const passed = metrics.top3Rate >= MIN_RATE && metrics.categoryRate >= MIN_RATE && metrics.referenceRate >= MIN_RATE;
console.log(JSON.stringify({ status: passed ? "passed" : "failed", minRate: MIN_RATE, indexArticles: index.articles.length, metrics, sampledFailures: failures }, null, 2));
if (!passed) process.exit(1);
