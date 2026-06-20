import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type BibleReference = {
  code: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
};

export type BibleVerse = {
  code: string;
  chapter: number;
  verse: number;
  text: string;
  sourceLocale: BibleLocale;
};

export type BookMeta = {
  code: string;
  name: string;
  testament: string;
  order: number;
  file: string;
  chapters: number;
  verses: number;
};

export type BibleLocale = "en" | "ko";

const ROOT = process.cwd();
const BIBLE_DB_PATH = path.join(ROOT, "data", "bible", "bible.sqlite");
const KO_FALLBACK_ALLOWLIST_PATH = path.join(ROOT, "data", "passage-index", "ko-fallback-allowlist.json");
const CHAPTER_CACHE_LIMIT = 64;

function resolveBibleLocale(locale?: string): BibleLocale {
  return locale === "ko" ? "ko" : "en";
}

function getTranslationPaths(locale: BibleLocale) {
  if (locale === "ko") {
    return {
      metadataPath: path.join(ROOT, "korean_bible", "metadata.json"),
      vplPath: path.join(ROOT, "korean_bible", "canon_66_vpl.txt"),
    };
  }

  return {
    metadataPath: path.join(ROOT, "world_english_bible", "metadata.json"),
    vplPath: path.join(ROOT, "world_english_bible", "canon_66_vpl.txt"),
  };
}

type KoFallbackAllowlist = {
  sourceLocale: BibleLocale;
  allowedMissingVerseKeys: string[];
};

function parseVpl(raw: string, sourceLocale: BibleLocale): BibleVerse[] {
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      const match = line.match(/^([0-9A-Z]{3})\s+(\d+):(\d+)\s+(.*)$/);
      if (!match) {
        return [];
      }

      const [, code, chapter, verse, text] = match;
      return [{ code, chapter: Number(chapter), verse: Number(verse), text, sourceLocale }];
    });
}

function mergeMissingVerses(primary: BibleVerse[], fallback: BibleVerse[], allowlist: Set<string>) {
  const existing = new Set(primary.map((verse) => `${verse.code} ${verse.chapter}:${verse.verse}`));
  const merged = [...primary];
  for (const verse of fallback) {
    const key = `${verse.code} ${verse.chapter}:${verse.verse}`;
    if (!existing.has(key) && allowlist.has(key)) {
      merged.push(verse);
      existing.add(key);
    }
  }
  return merged.sort(
    (left, right) =>
      left.code.localeCompare(right.code) ||
      left.chapter - right.chapter ||
      left.verse - right.verse,
  );
}

const bookMetaCache = new Map<string, Record<string, BookMeta>>();
const fallbackVersesCache = new Map<string, BibleVerse[]>();
const chapterCache = new Map<string, BibleVerse[]>();
let koFallbackAllowlistPromise: Promise<Set<string>> | null = null;
let bibleDatabase: DatabaseSync | null | undefined;

function getBibleDatabase() {
  if (bibleDatabase !== undefined) {
    return bibleDatabase;
  }

  bibleDatabase = existsSync(BIBLE_DB_PATH) ? new DatabaseSync(BIBLE_DB_PATH, { readOnly: true }) : null;
  return bibleDatabase;
}

async function loadKoFallbackAllowlist(): Promise<Set<string>> {
  if (!koFallbackAllowlistPromise) {
    koFallbackAllowlistPromise = readFile(KO_FALLBACK_ALLOWLIST_PATH, "utf8").then((raw) => {
      const parsed = JSON.parse(raw) as KoFallbackAllowlist;
      return new Set(parsed.allowedMissingVerseKeys);
    });
  }
  return koFallbackAllowlistPromise;
}

function cacheChapterVerses(cacheKey: string, verses: BibleVerse[]) {
  if (chapterCache.has(cacheKey)) {
    chapterCache.delete(cacheKey);
  }
  chapterCache.set(cacheKey, verses);
  if (chapterCache.size > CHAPTER_CACHE_LIMIT) {
    const oldestKey = chapterCache.keys().next().value;
    if (oldestKey) {
      chapterCache.delete(oldestKey);
    }
  }
  return verses;
}

function mapVerseRow(row: {
  code: string;
  chapter: number;
  verse: number;
  text: string;
  source_locale: string;
}): BibleVerse {
  return {
    code: row.code,
    chapter: Number(row.chapter),
    verse: Number(row.verse),
    text: row.text,
    sourceLocale: resolveBibleLocale(row.source_locale),
  };
}

async function loadFallbackVerses(locale: BibleLocale = "en"): Promise<BibleVerse[]> {
  const cached = fallbackVersesCache.get(locale);
  if (cached) return cached;

  const { vplPath } = getTranslationPaths(locale);
  const raw = await readFile(vplPath, "utf8");
  let result = parseVpl(raw, locale);

  if (locale === "ko") {
    const fallbackRaw = await readFile(getTranslationPaths("en").vplPath, "utf8");
    const allowlist = await loadKoFallbackAllowlist();
    result = mergeMissingVerses(result, parseVpl(fallbackRaw, "en"), allowlist);
  }

  fallbackVersesCache.set(locale, result);
  return result;
}

async function loadChapterVerses(locale: BibleLocale, code: string, chapter: number): Promise<BibleVerse[]> {
  const cacheKey = `${locale}:${code}:${chapter}`;
  const cached = chapterCache.get(cacheKey);
  if (cached) {
    chapterCache.delete(cacheKey);
    chapterCache.set(cacheKey, cached);
    return cached;
  }

  const db = getBibleDatabase();
  if (db) {
    const rows = db
      .prepare(
        `SELECT code, chapter, verse, text, source_locale
         FROM verses
         WHERE locale = ? AND code = ? AND chapter = ?
         ORDER BY verse ASC`,
      )
      .all(locale, code, chapter) as Array<{
      code: string;
      chapter: number;
      verse: number;
      text: string;
      source_locale: string;
    }>;
    return cacheChapterVerses(cacheKey, rows.map(mapVerseRow));
  }

  const verses = await loadFallbackVerses(locale);
  return cacheChapterVerses(
    cacheKey,
    verses.filter((verse) => verse.code === code && verse.chapter === chapter),
  );
}

export async function loadBookMetadata(locale: BibleLocale = "en"): Promise<Record<string, BookMeta>> {
  const cached = bookMetaCache.get(locale);
  if (cached) return cached;

  const { metadataPath } = getTranslationPaths(locale);
  const raw = await readFile(metadataPath, "utf8");
  const parsed = JSON.parse(raw) as {
    books: Array<{
      code: string;
      name: string;
      testament: string;
      order: number;
      file: string;
      chapters: number;
      verses: number;
    }>;
  };

  const result = Object.fromEntries(parsed.books.map((book) => [book.code, book]));
  bookMetaCache.set(locale, result);
  return result;
}

export async function loadVerses(locale: BibleLocale = "en"): Promise<BibleVerse[]> {
  const db = getBibleDatabase();
  if (db) {
    const rows = db
      .prepare(
        `SELECT code, chapter, verse, text, source_locale
         FROM verses
         WHERE locale = ?
         ORDER BY code ASC, chapter ASC, verse ASC`,
      )
      .all(locale) as Array<{
      code: string;
      chapter: number;
      verse: number;
      text: string;
      source_locale: string;
    }>;
    return rows.map(mapVerseRow);
  }

  return loadFallbackVerses(locale);
}

type BibleVerseIndex = {
  byBook: Map<string, Map<number, BibleVerse[]>>;
  chaptersByBook: Map<string, number[]>;
};

export async function loadVerseIndex(locale: BibleLocale = "en"): Promise<BibleVerseIndex> {
  const verses = await loadVerses(locale);
  const byBook = new Map<string, Map<number, BibleVerse[]>>();
  const chaptersByBook = new Map<string, number[]>();

  for (const verse of verses) {
    let book = byBook.get(verse.code);
    if (!book) {
      book = new Map<number, BibleVerse[]>();
      byBook.set(verse.code, book);
    }

    const chapterVerses = book.get(verse.chapter);
    if (chapterVerses) {
      chapterVerses.push(verse);
    } else {
      book.set(verse.chapter, [verse]);
    }
  }

  for (const [code, chapters] of byBook.entries()) {
    chaptersByBook.set(code, [...chapters.keys()].sort((a, b) => a - b));
  }

  return { byBook, chaptersByBook };
}

export function formatBibleReference(reference: BibleReference, bookName?: string) {
  const name = bookName ?? reference.code;
  if (reference.startVerse === reference.endVerse) {
    return `${name} ${reference.chapter}:${reference.startVerse}`;
  }

  return `${name} ${reference.chapter}:${reference.startVerse}-${reference.endVerse}`;
}

export function serializeBibleReference(reference: BibleReference) {
  return `${reference.code}-${reference.chapter}-${reference.startVerse}-${reference.endVerse}`;
}

export function parseBibleReferenceSlug(slug: string): BibleReference | null {
  const match = slug.match(/^([0-9A-Z]{3})-(\d+)-(\d+)(?:-(\d+))?$/);
  if (!match) {
    return null;
  }

  const [, code, chapter, startVerse, endVerse = startVerse] = match;
  const parsed = {
    code,
    chapter: Number(chapter),
    startVerse: Number(startVerse),
    endVerse: Number(endVerse),
  };

  if (
    !Number.isInteger(parsed.chapter) ||
    !Number.isInteger(parsed.startVerse) ||
    !Number.isInteger(parsed.endVerse) ||
    parsed.chapter < 1 ||
    parsed.startVerse < 1 ||
    parsed.endVerse < parsed.startVerse
  ) {
    return null;
  }

  return parsed;
}

export async function getPassage(reference: BibleReference, locale?: string) {
  const bibleLocale = resolveBibleLocale(locale);
  const [chapterVerses, books] = await Promise.all([
    loadChapterVerses(bibleLocale, reference.code, reference.chapter),
    loadBookMetadata(bibleLocale),
  ]);
  const passage = chapterVerses.filter(
    (verse) => verse.verse >= reference.startVerse && verse.verse <= reference.endVerse,
  );

  const book = books[reference.code];

  return {
    book,
    reference: formatBibleReference(reference, book?.name),
    verses: passage,
  };
}

export async function getChapterContext(reference: BibleReference, radius = 3, locale?: string) {
  const bibleLocale = resolveBibleLocale(locale);
  const [chapterVerses, books] = await Promise.all([
    loadChapterVerses(bibleLocale, reference.code, reference.chapter),
    loadBookMetadata(bibleLocale),
  ]);

  const from = Math.max(reference.startVerse - radius, 1);
  const to = reference.endVerse + radius;

  return {
    book: books[reference.code],
    verses: chapterVerses.filter((verse) => verse.verse >= from && verse.verse <= to),
  };
}

export async function getBibleBooks(locale?: string) {
  const bibleLocale = resolveBibleLocale(locale);
  const books = await loadBookMetadata(bibleLocale);
  return Object.values(books).sort((a, b) => a.order - b.order);
}

export async function getBibleReaderState({
  code,
  chapter,
  locale,
}: {
  code?: string;
  chapter?: number;
  locale?: string;
}) {
  const bibleLocale = resolveBibleLocale(locale);
  const booksByCode = await loadBookMetadata(bibleLocale);
  const books = Object.values(booksByCode).sort((a, b) => a.order - b.order);
  const requestedCode = code?.toUpperCase();
  const selectedBook = (requestedCode && booksByCode[requestedCode]) || books[0];

  if (!selectedBook) {
    return null;
  }

  const chapters = Array.from({ length: selectedBook.chapters }, (_, index) => index + 1);
  const fallbackChapter = chapters[0] ?? 1;
  const requestedChapter =
    typeof chapter === "number" && Number.isInteger(chapter) && chapter > 0 ? chapter : fallbackChapter;
  const selectedChapter = chapters.includes(requestedChapter) ? requestedChapter : fallbackChapter;
  const chapterVerses = await loadChapterVerses(bibleLocale, selectedBook.code, selectedChapter);

  const selectedBookIndex = books.findIndex((book) => book.code === selectedBook.code);
  const currentChapterIndex = chapters.indexOf(selectedChapter);

  const previous =
    currentChapterIndex > 0
      ? { code: selectedBook.code, chapter: chapters[currentChapterIndex - 1] }
      : selectedBookIndex > 0
        ? (() => {
            const previousBook = books[selectedBookIndex - 1];
            return { code: previousBook.code, chapter: previousBook.chapters };
          })()
        : null;

  const next =
    currentChapterIndex < chapters.length - 1
      ? { code: selectedBook.code, chapter: chapters[currentChapterIndex + 1] }
      : selectedBookIndex < books.length - 1
        ? (() => {
            const nextBook = books[selectedBookIndex + 1];
            return { code: nextBook.code, chapter: 1 };
          })()
        : null;

  return {
    books,
    selectedBook,
    chapters,
    selectedChapter,
    verses: chapterVerses,
    previous,
    next,
  };
}
