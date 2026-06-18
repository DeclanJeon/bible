import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BibleReference } from "@/lib/bible";
import { resolveAppLocale, type AppLocale } from "@/lib/content";

export type BiblePassageUnit = {
  id: string;
  reference: BibleReference;
  locale: AppLocale;
  text: string;
  normalizedText: string;
  summary: string;
  themes: string[];
  doctrines: string[];
  humanConcerns: string[];
  questionsAnswered: string[];
  entities: string[];
  keywords: string[];
  canonicalWeight: number;
  crossReferenceDegree: number;
  crossReferences?: string[];
  axes?: string[];
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
  };
  units: BiblePassageUnit[];
  stats: {
    unitCount: number;
    seedReferenceCount: number;
    crossReferenceDegreeTotal: number;
  };
};

const ROOT = process.cwd();
const indexCache = new Map<AppLocale, Promise<BiblePassageIndex>>();

function hasStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
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
    typeof candidate.text === "string" &&
    candidate.text.length > 0 &&
    typeof candidate.normalizedText === "string" &&
    typeof candidate.summary === "string" &&
    hasStringArray(candidate.themes) &&
    hasStringArray(candidate.doctrines) &&
    hasStringArray(candidate.humanConcerns) &&
    hasStringArray(candidate.questionsAnswered) &&
    hasStringArray(candidate.entities) &&
    hasStringArray(candidate.keywords) &&
    typeof candidate.canonicalWeight === "number" &&
    typeof candidate.crossReferenceDegree === "number"
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
    !Array.isArray(candidate.units) ||
    !candidate.units.every((unit) => isPassageUnit(unit, locale)) ||
    !candidate.stats ||
    candidate.stats.unitCount !== candidate.units.length
  ) {
    throw new Error(`Invalid Bible passage index for locale ${locale}`);
  }

  return candidate as BiblePassageIndex;
}

async function readPassageIndex(locale: AppLocale) {
  const raw = await readFile(path.join(ROOT, "data", "passage-index", `${locale}.json`), "utf8");
  return validateIndex(JSON.parse(raw), locale);
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
}

export async function loadBiblePassageUnits(locale?: string): Promise<BiblePassageUnit[]> {
  const index = await loadBiblePassageIndex(locale);
  return index.units;
}
