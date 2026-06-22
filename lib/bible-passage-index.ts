import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BibleReference } from "@/lib/bible";
import { resolveAppLocale, type AppLocale } from "@/lib/content";
import { findExactPassageUnit as findExactPassageUnitInDb, findOverlappingPassageUnit as findOverlappingPassageUnitInDb, getPassageIndexDbStatus } from "@/lib/passage-index-db";

export type BiblePassageProvenance = {
  method: string;
  genre: string;
  seedOverlay: boolean;
  sourceLocale?: AppLocale | "mixed";
};

export type BiblePassageUnit = {
  id: string;
  reference: BibleReference;
  displayReference: string;
  locale: AppLocale;
  text?: string;
  excerpt?: string;
  summary: string;
  searchCorpus?: string;
  axisValues?: string[];
  normalizedText?: string;
  themes?: string[];
  doctrines?: string[];
  humanConcerns?: string[];
  questionsAnswered?: string[];
  entities?: string[];
  keywords?: string[];
  canonicalWeight: number;
  crossReferenceDegree: number;
  crossReferences?: string[];
  axes?: string[];
  genre?: string;
  verseCount?: number;
  indexVersion?: string;
  provenance?: BiblePassageProvenance;
  embedding?: number[];
};

export type BiblePassageIndex = {
  version: string;
  generatedAt: string;
  locale: AppLocale;
  source: {
    translation: string;
    corpus: string;
    metadata: string;
    runtimeProjection?: string;
  };
  units: BiblePassageUnit[];
  stats: {
    unitCount: number;
    seedReferenceCount: number;
    seedUnitCount?: number;
    bookCount?: number;
    chapterCount?: number;
    totalVerseCount?: number;
    averageUnitVerseCount?: number;
    crossReferenceDegreeTotal: number;
    genreCounts?: Record<string, number>;
  };
};

type BiblePassageLookup = {
  exact: Map<string, BiblePassageUnit>;
  byChapter: Map<string, BiblePassageUnit[]>;
};

const ROOT = process.cwd();
const indexCache = new Map<AppLocale, Promise<BiblePassageIndex>>();
const lookupCache = new Map<AppLocale, Promise<BiblePassageLookup>>();
const ALLOW_PASSAGE_INDEX_JSON_FALLBACK = process.env.PASSAGE_INDEX_JSON_FALLBACK === "1";
export type PassageIndexRuntimeSource = "sqlite" | "json-fallback" | "unavailable";



function hasStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function hasNumberRecord(value: unknown): value is Record<string, number> {
  return !!value && typeof value === "object" && Object.values(value).every((item) => typeof item === "number");
}

function referenceKey(reference: BibleReference) {
  return `${reference.code}:${reference.chapter}:${reference.startVerse}-${reference.endVerse}`;
}

function chapterKey(reference: BibleReference) {
  return `${reference.code}:${reference.chapter}`;
}

function overlapsReference(unit: BibleReference, target: BibleReference) {
  return (
    unit.code === target.code &&
    unit.chapter === target.chapter &&
    !(unit.endVerse < target.startVerse || unit.startVerse > target.endVerse)
  );
}

function isPassageUnit(value: unknown, locale: AppLocale): value is BiblePassageUnit {
  const candidate = value as Partial<BiblePassageUnit>;
  return (
    !!candidate &&
    typeof candidate.id === "string" &&
    candidate.locale === locale &&
    !!candidate.reference &&
    typeof candidate.reference.code === "string" &&
    Number.isInteger(candidate.reference.chapter) &&
    Number.isInteger(candidate.reference.startVerse) &&
    Number.isInteger(candidate.reference.endVerse) &&
    typeof candidate.displayReference === "string" &&
    (candidate.text === undefined || typeof candidate.text === "string") &&
    (candidate.excerpt === undefined || typeof candidate.excerpt === "string") &&
    (Boolean(candidate.text && candidate.text.length > 0) || Boolean(candidate.excerpt && candidate.excerpt.length > 0)) &&
    typeof candidate.summary === "string" &&
    typeof candidate.canonicalWeight === "number" &&
    typeof candidate.crossReferenceDegree === "number" &&
    (candidate.searchCorpus === undefined || typeof candidate.searchCorpus === "string") &&
    (candidate.axisValues === undefined || hasStringArray(candidate.axisValues)) &&
    (candidate.normalizedText === undefined || typeof candidate.normalizedText === "string") &&
    (candidate.themes === undefined || hasStringArray(candidate.themes)) &&
    (candidate.doctrines === undefined || hasStringArray(candidate.doctrines)) &&
    (candidate.humanConcerns === undefined || hasStringArray(candidate.humanConcerns)) &&
    (candidate.questionsAnswered === undefined || hasStringArray(candidate.questionsAnswered)) &&
    (candidate.entities === undefined || hasStringArray(candidate.entities)) &&
    (candidate.keywords === undefined || hasStringArray(candidate.keywords)) &&
    (candidate.crossReferences === undefined || hasStringArray(candidate.crossReferences)) &&
    (candidate.axes === undefined || hasStringArray(candidate.axes)) &&
    (candidate.genre === undefined || typeof candidate.genre === "string") &&
    (candidate.verseCount === undefined || Number.isInteger(candidate.verseCount)) &&
    (candidate.indexVersion === undefined || typeof candidate.indexVersion === "string") &&
    (candidate.provenance === undefined ||
      (typeof candidate.provenance.method === "string" &&
        typeof candidate.provenance.genre === "string" &&
        typeof candidate.provenance.seedOverlay === "boolean" &&
        (candidate.provenance.sourceLocale === undefined ||
          candidate.provenance.sourceLocale === "en" ||
          candidate.provenance.sourceLocale === "ko" ||
          candidate.provenance.sourceLocale === "mixed")))
  );
}

function validateIndex(value: unknown, locale: AppLocale): BiblePassageIndex {
  const candidate = value as Partial<BiblePassageIndex>;
  if (
    !candidate ||
    candidate.locale !== locale ||
    typeof candidate.version !== "string" ||
    typeof candidate.generatedAt !== "string" ||
    !candidate.source ||
    typeof candidate.source.translation !== "string" ||
    typeof candidate.source.corpus !== "string" ||
    typeof candidate.source.metadata !== "string" ||
    !Array.isArray(candidate.units) ||
    !candidate.units.every((unit) => isPassageUnit(unit, locale)) ||
    !candidate.stats ||
    !Number.isInteger(candidate.stats.unitCount) ||
    !Number.isInteger(candidate.stats.seedReferenceCount) ||
    typeof candidate.stats.crossReferenceDegreeTotal !== "number" ||
    candidate.stats.unitCount !== candidate.units.length ||
    (candidate.stats.seedUnitCount !== undefined && !Number.isInteger(candidate.stats.seedUnitCount)) ||
    (candidate.stats.bookCount !== undefined && !Number.isInteger(candidate.stats.bookCount)) ||
    (candidate.stats.chapterCount !== undefined && !Number.isInteger(candidate.stats.chapterCount)) ||
    (candidate.stats.totalVerseCount !== undefined && !Number.isInteger(candidate.stats.totalVerseCount)) ||
    (candidate.stats.averageUnitVerseCount !== undefined && typeof candidate.stats.averageUnitVerseCount !== "number") ||
    (candidate.stats.genreCounts !== undefined && !hasNumberRecord(candidate.stats.genreCounts))
  ) {
    throw new Error(`Invalid Bible passage index for locale ${locale}`);
  }

  return candidate as BiblePassageIndex;
}

async function readPassageIndex(locale: AppLocale) {
  if (!ALLOW_PASSAGE_INDEX_JSON_FALLBACK) {
    throw new Error(`Passage-index JSON fallback is disabled for locale ${locale}`);
  }

  const runtimePath = path.join(ROOT, "data", "passage-index", `${locale}-runtime.json`);
  try {
    const raw = await readFile(runtimePath, "utf8");
    return validateIndex(JSON.parse(raw), locale);
  } catch {
    const raw = await readFile(path.join(ROOT, "data", "passage-index", `${locale}.json`), "utf8");
    return validateIndex(JSON.parse(raw), locale);
  }
}

export function loadBiblePassageIndex(locale?: string): Promise<BiblePassageIndex> {
  const resolvedLocale = resolveAppLocale(locale);
  const cached = indexCache.get(resolvedLocale);
  if (cached) return cached;

  const loading = readPassageIndex(resolvedLocale);
  indexCache.set(resolvedLocale, loading);
  return loading;
}

export function clearBiblePassageIndexCache() {
  indexCache.clear();
  lookupCache.clear();
}

export async function loadBiblePassageUnits(locale?: string): Promise<BiblePassageUnit[]> {
  const index = await loadBiblePassageIndex(locale);
  return index.units;
}

async function buildLookup(locale: AppLocale): Promise<BiblePassageLookup> {
  const index = await loadBiblePassageIndex(locale);
  const exact = new Map<string, BiblePassageUnit>();
  const byChapter = new Map<string, BiblePassageUnit[]>();

  for (const unit of index.units) {
    exact.set(referenceKey(unit.reference), unit);
    const key = chapterKey(unit.reference);
    const bucket = byChapter.get(key);
    if (bucket) {
      bucket.push(unit);
    } else {
      byChapter.set(key, [unit]);
    }
  }

  return { exact, byChapter };
}

async function loadFallbackLookup(locale?: string) {
  if (!ALLOW_PASSAGE_INDEX_JSON_FALLBACK) return null;

  const resolvedLocale = resolveAppLocale(locale);
  const cached = lookupCache.get(resolvedLocale);
  if (cached) return cached;

  const loading = buildLookup(resolvedLocale);
  lookupCache.set(resolvedLocale, loading);
  return loading;
}

export function getPassageIndexRuntimeStatus() {
  const { dbAvailable, dbDisabled } = getPassageIndexDbStatus();
  return {
    dbAvailable,
    dbDisabled,
    jsonFallbackEnabled: ALLOW_PASSAGE_INDEX_JSON_FALLBACK,
    runtimeSource: (dbAvailable
      ? "sqlite"
      : ALLOW_PASSAGE_INDEX_JSON_FALLBACK
        ? "json-fallback"
        : "unavailable") satisfies PassageIndexRuntimeSource,
  };
}

// Normal request flow should resolve from passage-index.sqlite only.

export async function findPassageUnit(reference: BibleReference, locale?: string): Promise<BiblePassageUnit | null> {
  const exact = await findExactPassageUnitInDb(reference, locale);
  if (exact) return exact;

  const overlapping = await findOverlappingPassageUnitInDb(reference, locale);
  if (overlapping) return overlapping;

  const lookup = await loadFallbackLookup(locale);
  const fallbackExact = lookup?.exact.get(referenceKey(reference));
  if (fallbackExact) return fallbackExact;
  const chapterUnits = lookup?.byChapter.get(chapterKey(reference)) ?? [];
  return chapterUnits.find((unit) => overlapsReference(unit.reference, reference)) ?? null;
}
