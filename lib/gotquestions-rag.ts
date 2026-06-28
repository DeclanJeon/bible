import { readFileSync } from "node:fs";
import path from "node:path";
import type { BibleReference } from "@/lib/bible";
import { getBookMetadata } from "@/lib/book-metadata";
import type { AppLocale, FaithPassage, FaithResource } from "@/lib/faith-resources";
import { formatBibleReferenceKey } from "@/lib/bible-reference-parser";

export type GotQuestionsCategory = {
  id: string;
  titleKo: string;
  url: string;
  order: number;
  topics: string[];
};

export type GotQuestionsArticleMeta = {
  id: string;
  slug: string;
  url: string;
  titleKo: string;
  categoryIds: string[];
  primaryCategoryId: string;
  questionTextKo: string;
  searchTextKo: string;
  topics: string[];
  keywords: string[];
  references: BibleReference[];
  referenceEvidence: Array<{ raw: string; normalized: BibleReference; source: string }>;
  attribution: "Got Questions Ministries";
  copyrightPolicyUrl: "https://www.gotquestions.org/copyright.html";
  bodyStored: false;
  referenceStatus: "linked" | "none-detected" | "unresolved";
  lastmod?: string;
};

export type GotQuestionsIndex = {
  version: 1;
  indexVersion: string;
  generatedAt: string;
  sourceSitemapUrl: string;
  bodyStored: false;
  categories: GotQuestionsCategory[];
  articles: GotQuestionsArticleMeta[];
};

export type GotQuestionsRagCoverage = "exact" | "strong" | "partial" | "none";

export type GotQuestionsRagHit = {
  article: GotQuestionsArticleMeta;
  score: number;
  matchKind: "exact-title" | "title-token" | "category-topic" | "scripture-overlap" | "manual-prior";
  matchedTerms: string[];
  passages: FaithPassage[];
};

export type GotQuestionsRagResult = {
  used: boolean;
  indexVersion: string | null;
  matchedCount: number;
  coverage: GotQuestionsRagCoverage;
  bodyFetched: false;
  bodyStored: false;
  hits: GotQuestionsRagHit[];
  resources: FaithResource[];
  passages: FaithPassage[];
};

const INDEX_PATH = path.join(process.cwd(), "data", "faith", "gotquestions-ko.index.json");
const MAX_HITS = 6;
const MAX_PASSAGES = 6;
const KOREAN_STOP_WORDS = new Set(["그리고", "그러나", "무엇", "무엇인가", "어떻게", "왜", "있는가", "인가", "하나요", "입니까", "대한", "관한", "질문", "성경", "정말", "제가", "우리가"]);

let indexCache: GotQuestionsIndex | null | undefined;

function safeReadIndex(): GotQuestionsIndex | null {
  if (indexCache !== undefined) return indexCache;
  try {
    const parsed = JSON.parse(readFileSync(INDEX_PATH, "utf8")) as GotQuestionsIndex;
    if (parsed?.version !== 1 || parsed.bodyStored !== false || !Array.isArray(parsed.articles)) {
      indexCache = null;
      return indexCache;
    }
    indexCache = parsed;
    return indexCache;
  } catch {
    indexCache = null;
    return indexCache;
  }
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
}

function normalizeKoreanTerm(value: string) {
  return value.replace(/(으로는|으로도|에게는|에게도|에서는|에서|에게|부터|까지|처럼|보다|라도|이며|이고|라는|이라|입니다|해요|어요|아요|이에요|예요|은|는|이|가|을|를|에|의|와|과|도|만|로|으로|요)$/u, "");
}

function tokenize(value: string) {
  return [...new Set(normalizeText(value).split(" ").map(normalizeKoreanTerm).filter((term) => term.length >= 2 && !KOREAN_STOP_WORDS.has(term)))];
}

function referenceLabel(reference: BibleReference, locale: AppLocale) {
  const book = getBookMetadata(reference.code, locale)?.title ?? reference.code;
  const verse = reference.startVerse === reference.endVerse ? `${reference.startVerse}` : `${reference.startVerse}-${reference.endVerse}`;
  return `${book} ${reference.chapter}:${verse}`;
}

function toFaithPassage(reference: BibleReference, locale: AppLocale, titleKo: string): FaithPassage {
  const label = referenceLabel(reference, locale);
  return {
    label,
    reference,
    note: {
      ko: `GotQuestions Korean “${titleKo}” 문답에 연결된 성구입니다.`,
      en: `Scripture linked from the GotQuestions Korean Q&A “${titleKo}.”`,
    },
  };
}

function truncate(value: string, limit: number) {
  return value.length <= limit ? value : `${value.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

export function gotQuestionsArticleToFaithResource(article: GotQuestionsArticleMeta): FaithResource {
  const shortTitle = truncate(article.titleKo, 120);
  return {
    id: article.id,
    title: article.titleKo,
    href: article.url,
    source: "GotQuestions",
    language: "ko",
    kind: "article",
    level: "intro",
    topics: article.topics,
    questions: { ko: [article.titleKo], en: [article.titleKo] },
    summary: {
      ko: truncate(`GotQuestions Korean 문답: ${shortTitle}. 원문 전문은 GotQuestions.org 링크에서 확인하세요.`, 260),
      en: truncate(`GotQuestions Korean Q&A: ${shortTitle}. Read the full source at GotQuestions.org.`, 260),
    },
  };
}

function scoreArticle(article: GotQuestionsArticleMeta, query: string, terms: string[], queryReferences: Set<string>) {
  const normalizedTitle = normalizeText(article.titleKo);
  const normalizedQuestion = normalizeText(article.questionTextKo);
  const normalizedSearch = normalizeText([article.searchTextKo, article.keywords.join(" "), article.topics.join(" ")].join(" "));
  const normalizedQuery = normalizeText(query);
  const matchedTerms: string[] = [];
  let score = 0;
  let matchKind: GotQuestionsRagHit["matchKind"] = "category-topic";

  if (normalizedQuery && (normalizedTitle === normalizedQuery || normalizedQuestion === normalizedQuery)) {
    score += 45;
    matchKind = "exact-title";
  }

  for (const term of terms) {
    if (normalizedTitle.includes(term) || normalizedQuestion.includes(term)) {
      score += 8;
      matchedTerms.push(term);
      if (matchKind !== "exact-title") matchKind = "title-token";
    } else if (normalizedSearch.includes(term)) {
      score += 3;
      matchedTerms.push(term);
    }
  }

  for (const keyword of article.keywords) {
    const normalizedKeyword = normalizeKoreanTerm(normalizeText(keyword));
    if (!normalizedKeyword) continue;
    if (normalizedQuery.includes(normalizedKeyword) || terms.some((term) => term.includes(normalizedKeyword) || normalizedKeyword.includes(term))) {
      score += normalizedKeyword.length >= 3 ? 7 : 4;
      matchedTerms.push(keyword);
      if (matchKind !== "exact-title") matchKind = "title-token";
    }
  }

  const manualPriors: Array<[RegExp, string]> = [
    [/구원|복음|영생|용서|죄.*구원/u, "salvation"],
    [/예수.*유일|유일한.*길|다른\s?종교/u, "jesus"],
    [/삼위일체|성부|성자|성령/u, "god"],
    [/성경.*(오류|모순|신뢰)|오류.*성경|모순.*성경/u, "bible"],
    [/천국|지옥|영생|새\s?하늘/u, "eternity"],
    [/직업|사업|일과|재정|소명/u, "life"],
  ];
  for (const [pattern, categoryId] of manualPriors) {
    if (pattern.test(query) && article.categoryIds.includes(categoryId)) {
      score += 20;
      matchKind = "manual-prior";
    }
  }
  if (/구원받|구원의?\s?(계획|길)|무엇.*믿/u.test(query) && article.id === "gq-ko-plan-salvation") {
    score += 18;
    matchKind = "manual-prior";
  }
  for (const topic of article.topics) {
    if (terms.includes(normalizeKoreanTerm(normalizeText(topic)))) {
      score += 12;
      matchedTerms.push(topic);
      if (matchKind === "category-topic") matchKind = "category-topic";
    }
  }

  for (const reference of article.references) {
    if (queryReferences.has(formatBibleReferenceKey(reference))) {
      score += 12;
      matchKind = "scripture-overlap";
    }
  }

  if (article.categoryIds.some((id) => ["salvation", "god", "jesus", "spirit", "bible", "eternity"].includes(id))) score += 2;

  return { score, matchKind, matchedTerms: [...new Set(matchedTerms)] };
}

function coverageFor(hits: GotQuestionsRagHit[]): GotQuestionsRagCoverage {
  const best = hits[0]?.score ?? 0;
  if (best >= 45) return "exact";
  if (best >= 24) return "strong";
  if (best > 0) return "partial";
  return "none";
}

function uniquePassages(hits: GotQuestionsRagHit[], locale: AppLocale) {
  const seen = new Set<string>();
  const passages: FaithPassage[] = [];
  const maxArticleRefs = Math.max(0, ...hits.map((hit) => hit.article.references.length));
  for (let refIndex = 0; refIndex < maxArticleRefs; refIndex += 1) {
    for (const hit of hits) {
      const reference = hit.article.references[refIndex];
      if (!reference) continue;
      const key = formatBibleReferenceKey(reference);
      if (seen.has(key)) continue;
      seen.add(key);
      passages.push(toFaithPassage(reference, locale, hit.article.titleKo));
      if (passages.length >= MAX_PASSAGES) return passages;
    }
  }
  return passages;
}

export function searchGotQuestionsRag(query: string, locale: AppLocale, queryReferences: BibleReference[] = []): GotQuestionsRagResult {
  const index = safeReadIndex();
  if (!index) {
    return { used: false, indexVersion: null, matchedCount: 0, coverage: "none", bodyFetched: false, bodyStored: false, hits: [], resources: [], passages: [] };
  }

  const terms = tokenize(query);
  const referenceKeys = new Set(queryReferences.map(formatBibleReferenceKey));
  const hits = index.articles
    .map((article) => {
      const scored = scoreArticle(article, query, terms, referenceKeys);
      const passages = article.references.slice(0, MAX_PASSAGES).map((reference) => toFaithPassage(reference, locale, article.titleKo));
      return { article, score: scored.score, matchKind: scored.matchKind, matchedTerms: scored.matchedTerms, passages } satisfies GotQuestionsRagHit;
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.article.primaryCategoryId.localeCompare(b.article.primaryCategoryId) || a.article.slug.localeCompare(b.article.slug))
    .slice(0, MAX_HITS);

  return {
    used: hits.length > 0,
    indexVersion: index.indexVersion,
    matchedCount: hits.length,
    coverage: coverageFor(hits),
    bodyFetched: false,
    bodyStored: false,
    hits,
    resources: hits.map((hit) => gotQuestionsArticleToFaithResource(hit.article)),
    passages: uniquePassages(hits, locale),
  };
}

export function loadGotQuestionsIndexForQa() {
  return safeReadIndex();
}
