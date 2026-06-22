import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { BibleReference } from "@/lib/bible";
import { resolveAppLocale } from "@/lib/content";
import type { BiblePassageProvenance, BiblePassageUnit } from "@/lib/bible-passage-index";

const ROOT = process.cwd();
const PASSAGE_INDEX_DB_PATH = path.join(ROOT, "data", "passage-index", "passage-index.sqlite");
const PASSAGE_INDEX_DB_DISABLED = process.env.PASSAGE_INDEX_DB_DISABLED === "1";

let passageIndexDb: DatabaseSync | null | undefined;

function getPassageIndexDb() {
  if (passageIndexDb !== undefined) {
    return passageIndexDb;
  }

  passageIndexDb = !PASSAGE_INDEX_DB_DISABLED && existsSync(PASSAGE_INDEX_DB_PATH)
    ? new DatabaseSync(PASSAGE_INDEX_DB_PATH, { readOnly: true })
    : null;
  return passageIndexDb;
}

export function getPassageIndexDbStatus() {
  const db = getPassageIndexDb();
  return {
    dbAvailable: !!db,
    dbDisabled: PASSAGE_INDEX_DB_DISABLED,
  };
}

function parseJsonArray(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : undefined;
}

function parseProvenance(row: PassageUnitRow): BiblePassageProvenance | undefined {
  if (!row.provenance_method || !row.provenance_genre || row.provenance_seed_overlay === null) {
    return undefined;
  }

  return {
    method: row.provenance_method,
    genre: row.provenance_genre,
    seedOverlay: Boolean(row.provenance_seed_overlay),
    sourceLocale:
      row.provenance_source_locale === "en" || row.provenance_source_locale === "ko" || row.provenance_source_locale === "mixed"
        ? row.provenance_source_locale
        : undefined,
  };
}

type PassageUnitRow = {
  unit_id: string;
  locale: string;
  book_code: string;
  chapter: number;
  start_verse: number;
  end_verse: number;
  display_reference: string;
  text: string | null;
  excerpt: string | null;
  summary: string;
  search_corpus: string | null;
  axis_values_json: string | null;
  normalized_text: string | null;
  themes_json: string | null;
  doctrines_json: string | null;
  human_concerns_json: string | null;
  questions_answered_json: string | null;
  entities_json: string | null;
  keywords_json: string | null;
  canonical_weight: number;
  cross_reference_degree: number;
  cross_references_json: string | null;
  axes_json: string | null;
  genre: string | null;
  verse_count: number | null;
  index_version: string | null;
  provenance_method: string | null;
  provenance_genre: string | null;
  provenance_seed_overlay: number | null;
  provenance_source_locale: string | null;
};

function mapUnitRow(row: PassageUnitRow): BiblePassageUnit {
  return {
    id: row.unit_id,
    locale: resolveAppLocale(row.locale),
    reference: {
      code: row.book_code,
      chapter: Number(row.chapter),
      startVerse: Number(row.start_verse),
      endVerse: Number(row.end_verse),
    },
    displayReference: row.display_reference,
    text: row.text ?? undefined,
    excerpt: row.excerpt ?? undefined,
    summary: row.summary,
    searchCorpus: row.search_corpus ?? undefined,
    axisValues: parseJsonArray(row.axis_values_json),
    normalizedText: row.normalized_text ?? undefined,
    themes: parseJsonArray(row.themes_json),
    doctrines: parseJsonArray(row.doctrines_json),
    humanConcerns: parseJsonArray(row.human_concerns_json),
    questionsAnswered: parseJsonArray(row.questions_answered_json),
    entities: parseJsonArray(row.entities_json),
    keywords: parseJsonArray(row.keywords_json),
    canonicalWeight: Number(row.canonical_weight),
    crossReferenceDegree: Number(row.cross_reference_degree),
    crossReferences: parseJsonArray(row.cross_references_json),
    axes: parseJsonArray(row.axes_json),
    genre: row.genre ?? undefined,
    verseCount: row.verse_count === null ? undefined : Number(row.verse_count),
    indexVersion: row.index_version ?? undefined,
    provenance: parseProvenance(row),
  };
}

function normalizeTerms(terms: string[]) {
  return [...new Set(terms.map((term) => term.trim().toLowerCase()).filter((term) => term.length > 1))];
}

export async function findExactPassageUnit(reference: BibleReference, locale?: string): Promise<BiblePassageUnit | null> {
  const db = getPassageIndexDb();
  if (!db) return null;
  const appLocale = resolveAppLocale(locale);
  const row = db
    .prepare(
      `SELECT *
       FROM units
       WHERE locale = ? AND book_code = ? AND chapter = ? AND start_verse = ? AND end_verse = ?
       LIMIT 1`,
    )
    .get(appLocale, reference.code, reference.chapter, reference.startVerse, reference.endVerse) as PassageUnitRow | undefined;
  return row ? mapUnitRow(row) : null;
}

export async function findOverlappingPassageUnit(reference: BibleReference, locale?: string): Promise<BiblePassageUnit | null> {
  const db = getPassageIndexDb();
  if (!db) return null;
  const appLocale = resolveAppLocale(locale);
  const row = db
    .prepare(
      `SELECT *
       FROM units
       WHERE locale = ?
         AND book_code = ?
         AND chapter = ?
         AND NOT (end_verse < ? OR start_verse > ?)
       ORDER BY canonical_weight DESC, cross_reference_degree DESC, verse_count ASC, unit_id ASC
       LIMIT 1`,
    )
    .get(appLocale, reference.code, reference.chapter, reference.startVerse, reference.endVerse) as PassageUnitRow | undefined;
  return row ? mapUnitRow(row) : null;
}

export async function findCandidatePassageUnits(
  options: { locale?: string; terms: string[]; limit?: number },
): Promise<BiblePassageUnit[] | null> {
  const db = getPassageIndexDb();
  if (!db) return null;

  const terms = normalizeTerms(options.terms);
  if (!terms.length) return [];

  const appLocale = resolveAppLocale(options.locale);
  const limit = Math.max(1, Math.min(options.limit ?? 80, 200));
  const innerLimit = Math.max(limit * 6, 80);
  const placeholders = terms.map(() => "?").join(", ");
  const statement = db.prepare(
    `SELECT u.*
     FROM units u
     JOIN (
       SELECT unit_id, COUNT(DISTINCT term) AS term_hits
       FROM unit_terms
       WHERE locale = ? AND term IN (${placeholders})
       GROUP BY unit_id
       ORDER BY term_hits DESC, unit_id ASC
       LIMIT ?
     ) hits ON hits.unit_id = u.unit_id
     WHERE u.locale = ?
     ORDER BY hits.term_hits DESC, u.canonical_weight DESC, u.cross_reference_degree DESC, u.unit_id ASC
     LIMIT ?`,
  );
  const rows = statement.all(appLocale, ...terms, innerLimit, appLocale, limit) as PassageUnitRow[];
  return rows.map(mapUnitRow);
}
