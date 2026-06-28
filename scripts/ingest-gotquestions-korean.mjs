#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "data", "faith");
const OUT_PATH = path.join(OUT_DIR, "gotquestions-ko.index.json");
const AUDIT_PATH = path.join(OUT_DIR, "gotquestions-ko.source-audit.json");
const SITEMAP_URL = "https://www.gotquestions.org/Korean/korean.xml";
const ROBOTS_URL = "https://www.gotquestions.org/robots.txt";
const COPYRIGHT_URL = "https://www.gotquestions.org/copyright.html";
const HOME_URL = "https://www.gotquestions.org/Korean/";
const DELAY_MS = Number(process.env.GOTQUESTIONS_FETCH_DELAY_MS || 500);

const CATEGORY_TOPICS = {
  salvation: ["구원", "복음", "믿음", "은혜"],
  god: ["하나님", "삼위일체", "속성"],
  jesus: ["예수", "그리스도", "부활", "속죄"],
  spirit: ["성령", "은사", "인도"],
  bible: ["성경", "영감", "정경", "신뢰성"],
  eternity: ["천국", "지옥", "영생", "심판"],
  life: ["삶", "직업", "재정", "분별"],
};

const CATEGORIES = [
  ["salvation", "구원에 관한 질문들", "https://www.gotquestions.org/Korean/Korean-Q-salvation.html"],
  ["god", "하나님에 관한 질문들", "https://www.gotquestions.org/Korean/Korean-Q-God.html"],
  ["jesus", "예수 그리스도에 관한 질문들", "https://www.gotquestions.org/Korean/Korean-Q-Jesus.html"],
  ["spirit", "성령에 관한 질문들", "https://www.gotquestions.org/Korean/Korean-Q-Spirit.html"],
  ["bible", "성경에 관한 질문들", "https://www.gotquestions.org/Korean/Korean-Q-Bible.html"],
  ["eternity", "천국과 지옥에 관한 질문들", "https://www.gotquestions.org/Korean/Korean-Q-eternity.html"],
  ["life", "인생결정에 관한 질문들", "https://www.gotquestions.org/Korean/Korean-Q-life.html"],
];

function argValue(name, fallback = null) {
  const hit = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : fallback;
}

function flag(name) {
  return process.argv.includes(name);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url, attempt = 1) {
  const res = await fetch(url, { headers: { "user-agent": "bible.ponslink.com GotQuestions metadata indexer" } });
  await sleep(DELAY_MS);
  if (!res.ok) {
    if (attempt < 3 && [408, 429, 500, 502, 503, 504].includes(res.status)) {
      await sleep(DELAY_MS * attempt * 2);
      return fetchText(url, attempt + 1);
    }
    throw new Error(`Fetch failed ${res.status} ${url}`);
  }
  return res.text();
}

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
}

function extractLinks(html) {
  const links = [];
  for (const match of html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = new URL(match[1], HOME_URL).toString();
    const title = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (href.includes("/Korean/") && title) links.push({ href, title });
  }
  return links;
}

function slugFromUrl(url) {
  return path.basename(new URL(url).pathname, ".html");
}

function categoryIdFromUrl(url) {
  return slugFromUrl(url).toLowerCase().replace(/^korean-q-/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "misc";
}

function isCategoryUrl(url) {
  return /\/Korean\/Korean-Q-[^/]+\.html$/i.test(new URL(url).pathname);
}

function classifyKoreanUrl(url, categoryUrls) {
  const parsed = new URL(url);
  const pathname = parsed.pathname;
  const slug = slugFromUrl(url);
  if (!pathname.startsWith("/Korean/")) return { kind: "excluded", reason: "non-korean" };
  if (url === HOME_URL || pathname === "/Korean/") return { kind: "static", reason: "home" };
  if (!pathname.endsWith(".html")) return { kind: "static", reason: "non-html" };
  if (categoryUrls.has(url) || isCategoryUrl(url)) return { kind: "category", reason: null };
  if (/Korean-search|statement|copyright|privacy|about|contact|donate|question-week|good-news/i.test(slug)) {
    return { kind: "excluded", reason: "static-or-non-question" };
  }
  return { kind: "article", reason: null };
}

function summarizeClassifications(locs, categoryUrls) {
  const counts = { article: 0, category: 0, static: 0, excluded: 0 };
  const excludedReasons = {};
  const rows = [];
  for (const url of locs) {
    const classified = classifyKoreanUrl(url, categoryUrls);
    counts[classified.kind] += 1;
    if (classified.reason) excludedReasons[classified.reason] = (excludedReasons[classified.reason] || 0) + 1;
    rows.push({ url, ...classified });
  }
  return { counts, excludedReasons, rows };
}

function idFromUrl(url) {
  return `gq-ko-${slugFromUrl(url).toLowerCase().replace(/^korean-/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function tokenize(value) {
  return [...new Set(value.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter((term) => term.length >= 2))].slice(0, 24);
}

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
  const evidence = [];
  const seen = new Set();
  for (const match of text.matchAll(REFERENCE_PATTERN)) {
    const code = BOOK_ALIASES.get(match[1].toLowerCase()) || BOOK_ALIASES.get(match[1]);
    if (!code) continue;
    const chapter = Number(match[2]);
    const first = buildReference(code, chapter, Number(match[3]), match[4] ? Number(match[4]) : Number(match[3]));
    if (first && !seen.has(referenceKey(first))) {
      seen.add(referenceKey(first));
      references.push(first);
      evidence.push({ raw: match[0].slice(0, 40), normalized: first, source: "article-reference" });
    }
    const firstTail = match[0].search(/,\s*\d/u);
    if (firstTail === -1) continue;
    for (const tailMatch of match[0].slice(firstTail).matchAll(TAIL_VERSE_PATTERN)) {
      const tailRef = buildReference(code, chapter, Number(tailMatch[1]), tailMatch[2] ? Number(tailMatch[2]) : Number(tailMatch[1]));
      if (tailRef && !seen.has(referenceKey(tailRef))) {
        seen.add(referenceKey(tailRef));
        references.push(tailRef);
        evidence.push({ raw: tailMatch[0].slice(0, 40), normalized: tailRef, source: "article-reference" });
      }
    }
  }
  return { references, evidence };
}

async function enrichArticleReferences(article) {
  const html = await fetchText(article.url);
  const title = titleFromHtml(html);
  if (title && (!article.titleKo || article.titleKo === article.slug.replace(/^Korean-/, "").replace(/-/g, " "))) {
    article.titleKo = title.slice(0, 180);
    article.questionTextKo = title.slice(0, 220);
    article.searchTextKo = [...new Set([...article.topics, ...tokenize(title), title])].join(" ").slice(0, 500);
    article.keywords = [...new Set([...article.keywords, ...tokenize(title)])].slice(0, 24);
  }
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  const parsed = parseReferences(text);
  article.references = parsed.references;
  article.referenceEvidence = parsed.evidence;
  article.referenceStatus = parsed.references.length ? "linked" : "none-detected";
}

function articleFromLink(link, category, lastmodByUrl) {
  const slug = slugFromUrl(link.href);
  const topics = [...new Set([...(CATEGORY_TOPICS[category.id] || []), ...tokenize(link.title).slice(0, 6)])];
  return {
    id: idFromUrl(link.href),
    slug,
    url: link.href,
    titleKo: link.title.slice(0, 180),
    categoryIds: [category.id],
    primaryCategoryId: category.id,
    questionTextKo: link.title.slice(0, 220),
    searchTextKo: [...topics, link.title].join(" ").slice(0, 500),
    topics,
    keywords: topics.slice(0, 24),
    references: [],
    referenceEvidence: [],
    attribution: "Got Questions Ministries",
    copyrightPolicyUrl: COPYRIGHT_URL,
    bodyStored: false,
    referenceStatus: "none-detected",
    lastmod: lastmodByUrl.get(link.href),
  };
}

function titleFromHtml(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const title = h1 || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  return title.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/ \\| GotQuestions\\.org.*$/i, "").trim();
}

function articleFromUrl(url, category, lastmodByUrl) {
  return articleFromLink({ href: url, title: slugFromUrl(url).replace(/^Korean-/, "").replace(/-/g, " ") }, category, lastmodByUrl);
}

async function main() {
  const limit = Number(argValue("--limit", "0"));
  const fetchCategories = !flag("--sitemap-only");
  const articleLimit = Number(argValue("--article-limit", "0"));
  const fetchArticleReferences = !flag("--skip-article-fetch");
  await mkdir(OUT_DIR, { recursive: true });

  const robots = await fetchText(ROBOTS_URL);
  const sitemap = await fetchText(SITEMAP_URL);
  const locs = extractLocs(sitemap);
  const lastmodByUrl = new Map([...sitemap.matchAll(/<url>\s*<loc>(.*?)<\/loc>\s*<lastmod>(.*?)<\/lastmod>\s*<\/url>/gs)].map((match) => [match[1], match[2]]));

  const categoryByUrl = new Map(CATEGORIES.map(([id, titleKo, url], index) => [url, { id, titleKo, url, order: index + 1, topics: CATEGORY_TOPICS[id] || [] }]));
  if (fetchCategories) {
    const homeHtml = await fetchText(HOME_URL);
    for (const link of extractLinks(homeHtml)) {
      if (!isCategoryUrl(link.href) || categoryByUrl.has(link.href)) continue;
      const id = categoryIdFromUrl(link.href);
      categoryByUrl.set(link.href, {
        id,
        titleKo: link.title.slice(0, 120),
        url: link.href,
        order: categoryByUrl.size + 1,
        topics: CATEGORY_TOPICS[id] || tokenize(link.title),
      });
    }
  }

  const categories = [...categoryByUrl.values()].sort((a, b) => a.order - b.order);
  const categoryUrls = new Set(categories.map((category) => category.url));
  const classification = summarizeClassifications(locs, categoryUrls);
  const articleMap = new Map();

  if (fetchCategories) {
    for (const category of categories) {
      const html = await fetchText(category.url);
      for (const link of extractLinks(html)) {
        if (!link.href.endsWith(".html")) continue;
        const classified = classifyKoreanUrl(link.href, categoryUrls);
        if (classified.kind !== "article") continue;
        const existing = articleMap.get(link.href);
        if (existing) {
          if (!existing.categoryIds.includes(category.id)) existing.categoryIds.push(category.id);
          continue;
        }
        articleMap.set(link.href, articleFromLink(link, category, lastmodByUrl));
        if (limit > 0 && articleMap.size >= limit) break;
      }
      if (limit > 0 && articleMap.size >= limit) break;
    }
  }
  const fallbackCategory = categories.find((category) => category.id === "miscellaneous") ?? categories[0];
  if (fallbackCategory) {
    for (const row of classification.rows) {
      if (row.kind !== "article" || articleMap.has(row.url)) continue;
      articleMap.set(row.url, articleFromUrl(row.url, fallbackCategory, lastmodByUrl));
      if (limit > 0 && articleMap.size >= limit) break;
    }
  }
  if (fetchArticleReferences) {
    const articles = [...articleMap.values()].slice(0, articleLimit > 0 ? articleLimit : articleMap.size);
    for (const article of articles) await enrichArticleReferences(article);
  }

  const safePayload = { categories, articles: [...articleMap.values()] };
  const hash = crypto.createHash("sha256").update(JSON.stringify(safePayload)).digest("hex").slice(0, 16);
  const index = {
    version: 1,
    indexVersion: `gotquestions-ko-${hash}`,
    generatedAt: new Date().toISOString(),
    sourceSitemapUrl: SITEMAP_URL,
    bodyStored: false,
    categories,
    articles: safePayload.articles,
  };
  const audit = {
    schemaVersion: 1,
    generatedAt: index.generatedAt,
    robotsUrl: ROBOTS_URL,
    sitemapUrl: SITEMAP_URL,
    copyrightPolicyUrl: COPYRIGHT_URL,
    robotsMentionsSitemap: robots.includes("Sitemap:"),
    urlCounts: {
      sitemapObserved: locs.length,
      category: categories.length,
      article: index.articles.length,
      sitemapArticleCandidates: classification.counts.article,
      staticNonQuestion: classification.counts.static,
      excluded: classification.counts.excluded,
    },
    classificationCounts: classification.counts,
    excludedReasons: classification.excludedReasons,
    classificationSample: classification.rows.slice(0, 50),
    articleReferenceFetch: {
      enabled: fetchArticleReferences,
      attempted: fetchArticleReferences ? (articleLimit > 0 ? Math.min(articleLimit, index.articles.length) : index.articles.length) : 0,
      linked: index.articles.filter((article) => article.referenceStatus === "linked").length,
      noneDetected: index.articles.filter((article) => article.referenceStatus === "none-detected").length,
    },
    optionalMode: process.env.GOTQUESTIONS_RAG_OPTIONAL === "1",
    bodyStored: false,
    bodyFetchedAtRuntime: false,
    assertion: "This receipt contains URL/title/category metadata and extracted scripture-reference metadata only; article prose is not stored or redistributed.",
  };

  await writeFile(OUT_PATH, `${JSON.stringify(index, null, 2)}\n`);
  await writeFile(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
  console.log(JSON.stringify({ status: "passed", articles: index.articles.length, indexVersion: index.indexVersion }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
