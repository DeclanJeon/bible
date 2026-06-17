import { readFile } from "node:fs/promises";
import path from "node:path";

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
};

export type BookMeta = {
  code: string;
  name: string;
  testament: string;
  order: number;
  file: string;
};

export type BibleLocale = "en" | "ko";

const ROOT = process.cwd();

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

const bookMetaCache = new Map<string, Record<string, BookMeta>>();
const versesCache = new Map<string, BibleVerse[]>();

export async function loadBookMetadata(locale: BibleLocale = "en"): Promise<Record<string, BookMeta>> {
  const cached = bookMetaCache.get(locale);
  if (cached) return cached;

  const { metadataPath } = getTranslationPaths(locale);
  const raw = await readFile(metadataPath, "utf8");
  const parsed = JSON.parse(raw) as {
    books: Array<{ code: string; name: string; testament: string; order: number; file: string }>;
  };

  const result = Object.fromEntries(parsed.books.map((book) => [book.code, book]));
  bookMetaCache.set(locale, result);
  return result;
}

export async function loadVerses(locale: BibleLocale = "en"): Promise<BibleVerse[]> {
  const cached = versesCache.get(locale);
  if (cached) return cached;

  const { vplPath } = getTranslationPaths(locale);
  const raw = await readFile(vplPath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);

  const result = lines.flatMap((line) => {
    const match = line.match(/^([0-9A-Z]{3})\s+(\d+):(\d+)\s+(.*)$/);
    if (!match) {
      return [];
    }

    const [, code, chapter, verse, text] = match;
    return [{ code, chapter: Number(chapter), verse: Number(verse), text }];
  });

  versesCache.set(locale, result);
  return result;
}

type BibleVerseIndex = {
  byBook: Map<string, Map<number, BibleVerse[]>>;
  chaptersByBook: Map<string, number[]>;
};

const verseIndexCache = new Map<string, BibleVerseIndex>();

export async function loadVerseIndex(locale: BibleLocale = "en"): Promise<BibleVerseIndex> {
  const cached = verseIndexCache.get(locale);
  if (cached) return cached;

  const verses = await loadVerses(locale);
  const byBook = new Map<string, Map<number, BibleVerse[]>>();
  const chaptersByBook = new Map<string, number[]>();

  for (const verse of verses) {
    let book = byBook.get(verse.code);
    if (!book) {
      book = new Map<number, BibleVerse[]>();
      byBook.set(verse.code, book);
    }

    const chapter = book.get(verse.chapter);
    if (chapter) {
      chapter.push(verse);
    } else {
      book.set(verse.chapter, [verse]);
    }
  }

  for (const [code, chapters] of byBook.entries()) {
    chaptersByBook.set(code, [...chapters.keys()].sort((a, b) => a - b));
  }

  const result = { byBook, chaptersByBook };
  verseIndexCache.set(locale, result);
  return result;
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
  const [index, books] = await Promise.all([loadVerseIndex(bibleLocale), loadBookMetadata(bibleLocale)]);
  const chapterVerses = index.byBook.get(reference.code)?.get(reference.chapter) ?? [];
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
  const [index, books] = await Promise.all([loadVerseIndex(bibleLocale), loadBookMetadata(bibleLocale)]);
  const chapterVerses = index.byBook.get(reference.code)?.get(reference.chapter) ?? [];

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
  const [booksByCode, index] = await Promise.all([loadBookMetadata(bibleLocale), loadVerseIndex(bibleLocale)]);
  const books = Object.values(booksByCode).sort((a, b) => a.order - b.order);
  const requestedCode = code?.toUpperCase();
  const selectedBook = (requestedCode && booksByCode[requestedCode]) || books[0];

  if (!selectedBook) {
    return null;
  }

  const chapters = index.chaptersByBook.get(selectedBook.code) ?? [];
  const fallbackChapter = chapters[0] ?? 1;
  const requestedChapter =
    typeof chapter === "number" && Number.isInteger(chapter) && chapter > 0 ? chapter : fallbackChapter;
  const selectedChapter = chapters.includes(requestedChapter) ? requestedChapter : fallbackChapter;
  const chapterVerses = index.byBook.get(selectedBook.code)?.get(selectedChapter) ?? [];

  const selectedBookIndex = books.findIndex((book) => book.code === selectedBook.code);
  const currentChapterIndex = chapters.indexOf(selectedChapter);

  const previous =
    currentChapterIndex > 0
      ? { code: selectedBook.code, chapter: chapters[currentChapterIndex - 1] }
      : selectedBookIndex > 0
        ? (() => {
            const previousBook = books[selectedBookIndex - 1];
            const previousBookChapters = index.chaptersByBook.get(previousBook.code) ?? [];
            const lastChapter = previousBookChapters.at(-1);
            return lastChapter ? { code: previousBook.code, chapter: lastChapter } : null;
          })()
        : null;

  const next =
    currentChapterIndex < chapters.length - 1
      ? { code: selectedBook.code, chapter: chapters[currentChapterIndex + 1] }
      : selectedBookIndex < books.length - 1
        ? (() => {
            const nextBook = books[selectedBookIndex + 1];
            const nextBookChapters = index.chaptersByBook.get(nextBook.code) ?? [];
            const firstChapter = nextBookChapters[0];
            return firstChapter ? { code: nextBook.code, chapter: firstChapter } : null;
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
