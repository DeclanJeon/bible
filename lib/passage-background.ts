import type { BibleReference } from "@/lib/bible";
import { findPassageUnit } from "@/lib/bible-passage-index";
import { getBookMetadata } from "@/lib/book-metadata";
import { resolveAppLocale, type AppLocale } from "@/lib/content";
import type { BackgroundSource, PassageBackgroundPack } from "@/lib/background-pack";
import { findYoutubeVideosByExactReference } from "@/lib/youtube-catalog";

export type PassageYoutubeResourceMatch = "exact" | "book" | "keyword";

export type PassageYoutubeResource = {
  videoId: string;
  title: string;
  url: string;
  channelId: string;
  channelTitle: string;
  channelHandle?: string;
  publishedAt?: string;
  durationSeconds?: number;
  summary?: string;
  transcriptStatus: "ok" | "missing" | "error";
  mentionedPassages: string[];
  keywords: string[];
  topics: string[];
  matchType: PassageYoutubeResourceMatch;
  matchedReference?: string;
  matchedBook?: string;
  matchedKeyword?: string;
};

const YOUTUBE_RESOURCE_LIMIT = 6;

type YoutubeCatalogVideoRecord = {
  videoId: string;
  title: string;
  url: string;
  channelId: string;
  channelTitle: string;
  channelHandle?: string;
  publishedAt?: string;
  durationSeconds?: number;
  summary?: string;
  transcriptStatus: "ok" | "missing" | "error";
  mentionedPassages?: string[];
  keywords?: string[];
  topics?: string[];
  resourceKind?: "teaching" | "music" | "mixed";
};

const STATIC_RETRIEVED_AT = "2026-06-20";

export type PassageBackgroundSummary = {
  bookName: string;
  author?: string;
  date?: string;
  place?: string;
  audience?: string;
  storyContext: string;
  canonicalContext?: string;
  sources: BackgroundSource[];
  youtubeResources?: PassageYoutubeResource[];
};

function source(id: string, title: string, sourceTier: BackgroundSource["sourceTier"]): BackgroundSource {
  return {
    id,
    title,
    retrievedAt: STATIC_RETRIEVED_AT,
    sourceTier,
  };
}

function canonicalContext(locale: AppLocale, bookName: string, genre: string, audience?: string) {
  if (locale === "ko") {
    return `${bookName}은 ${genre} 장르 안에서 읽어야 하며, 오늘의 적용은 먼저 원래 청중과 문맥을 지나서 세워야 합니다.${audience ? ` ${audience}` : ""}`;
  }

  return `${bookName} should be read within its ${genre} genre, and present application should move through the original audience and context first.${audience ? ` ${audience}` : ""}`;
}

function fallbackStoryContext(locale: AppLocale, bookName: string, reference: BibleReference) {
  if (locale === "ko") {
    return `${bookName} ${reference.chapter}장에서 선택된 본문입니다. 앞뒤 문맥은 해당 장 전체를 함께 읽으며 확인해야 합니다.`;
  }

  return `This passage is selected from ${bookName} chapter ${reference.chapter}. Its immediate story flow should be checked by reading the whole chapter.`;
}

function normalizeResourceTerms(values: string[] | undefined) {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function buildReferenceLabels(reference: BibleReference, bookName: string) {
  const range =
    reference.startVerse === reference.endVerse
      ? `${reference.chapter}:${reference.startVerse}`
      : `${reference.chapter}:${reference.startVerse}-${reference.endVerse}`;

  return [
    `${bookName} ${range}`,
    `${reference.code} ${range}`,
  ].map((value) => value.toLowerCase());
}

function mapYoutubeResource(
  video: YoutubeCatalogVideoRecord,
  matchType: PassageYoutubeResourceMatch,
  matchValue: string,
): PassageYoutubeResource {
  return {
    videoId: video.videoId,
    title: video.title,
    url: video.url,
    channelId: video.channelId,
    channelTitle: video.channelTitle,
    channelHandle: video.channelHandle,
    publishedAt: video.publishedAt,
    durationSeconds: video.durationSeconds,
    summary: video.summary,
    transcriptStatus: video.transcriptStatus,
    mentionedPassages: normalizeResourceTerms(video.mentionedPassages),
    keywords: normalizeResourceTerms(video.keywords),
    topics: normalizeResourceTerms(video.topics),
    matchType,
    matchedReference: matchType === "exact" ? matchValue : undefined,
    matchedBook: matchType === "book" ? matchValue : undefined,
    matchedKeyword: matchType === "keyword" ? matchValue : undefined,
  };
}

function sortYoutubeResources(left: PassageYoutubeResource, right: PassageYoutubeResource) {
  const mentionDelta = right.mentionedPassages.length - left.mentionedPassages.length;
  if (mentionDelta !== 0) return mentionDelta;

  const leftPublished = left.publishedAt ? Date.parse(left.publishedAt) : Number.NEGATIVE_INFINITY;
  const rightPublished = right.publishedAt ? Date.parse(right.publishedAt) : Number.NEGATIVE_INFINITY;
  if (leftPublished !== rightPublished) return rightPublished - leftPublished;

  return left.videoId.localeCompare(right.videoId);
}

export async function loadCachedYoutubeResources(
  reference: BibleReference,
  options: { locale?: string; prompt?: string; bookName?: string } = {},
): Promise<PassageYoutubeResource[]> {
  const appLocale = resolveAppLocale(options.locale);
  const bookName = options.bookName ?? getBookMetadata(reference.code, appLocale)?.title ?? reference.code;
  const referenceLabels = buildReferenceLabels(reference, bookName);
  try {
    const seen = new Set<string>();
    const exact: PassageYoutubeResource[] = [];

    for (const label of referenceLabels) {
      for (const video of await findYoutubeVideosByExactReference(label)) {
        if (video.resourceKind && video.resourceKind !== "teaching") continue;
        if (seen.has(video.videoId)) continue;
        seen.add(video.videoId);
        exact.push(mapYoutubeResource(video, "exact", label));
      }
    }

    return exact.sort(sortYoutubeResources).slice(0, YOUTUBE_RESOURCE_LIMIT);
  } catch {
    return [];
  }
}

export async function withCachedYoutubeResources(
  background: PassageBackgroundSummary,
  reference: BibleReference,
  options: { locale?: string; prompt?: string } = {},
): Promise<PassageBackgroundSummary> {
  const youtubeResources = await loadCachedYoutubeResources(reference, {
    locale: options.locale,
    prompt: options.prompt,
    bookName: background.bookName,
  });

  return {
    ...background,
    youtubeResources,
  };
}

export function summarizeBackgroundPack(pack: PassageBackgroundPack, locale?: string): PassageBackgroundSummary {
  const appLocale = resolveAppLocale(locale);
  return {
    bookName: pack.book.title,
    author: pack.book.authorship.body,
    date: pack.book.date.body,
    place: pack.book.place.body,
    audience: pack.book.audience.body,
    storyContext: pack.passageContext.literaryUnit || pack.passageContext.beforeAfter,
    canonicalContext:
      pack.passageContext.genreCaution ||
      canonicalContext(appLocale, pack.book.title, pack.book.genre, pack.book.audience.body),
    sources: pack.sources,
    youtubeResources: [],
  };
}

export async function buildLocalPassageBackground(
  reference: BibleReference,
  locale?: string,
): Promise<PassageBackgroundSummary> {
  const appLocale = resolveAppLocale(locale);
  const metadata = getBookMetadata(reference.code, appLocale);
  const bookName = metadata?.title ?? reference.code;
  const author = metadata?.notes.authorship.body;
  const date = metadata?.notes.date.body;
  const place = metadata?.notes.place.body;
  const audience = metadata?.notes.audience.body;
  const genre = metadata?.genre ?? (appLocale === "ko" ? "성경 문헌" : "Biblical literature");

  let storyContext = fallbackStoryContext(appLocale, bookName, reference);
  const sources: BackgroundSource[] = [source("local-book-metadata", "Local book metadata", 1)];

  try {
    const matchingUnit = await findPassageUnit(reference, appLocale);
    if (matchingUnit?.summary) {
      storyContext = matchingUnit.summary;
      sources.push(source("local-passage-index", "Local passage index", 2));
    }
  } catch {
    // Keep local metadata fallback only.
  }

  return {
    bookName,
    author,
    date,
    place,
    audience,
    storyContext,
    canonicalContext: canonicalContext(appLocale, bookName, genre, audience),
    sources,
    youtubeResources: [],
  };
}
