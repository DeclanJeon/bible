import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data", "passage-index");
const DB_PATH = path.join(DATA_DIR, "passage-index.sqlite");
const LOCALES = ["en", "ko"];

const ENGLISH_STOP_WORDS = new Set([
  "the", "and", "that", "with", "have", "this", "from", "your", "about", "what", "when", "where", "them", "they",
  "how", "why", "who", "does", "are", "for", "you", "can", "should", "would", "could", "will", "shall", "into",
]);

const KOREAN_STOP_WORDS = new Set([
  "그냥", "너무", "정말", "진짜", "계속", "요즘", "많이", "조금", "나는", "내가", "제가", "저는", "나를", "저를", "나의", "우리", "것", "뭐", "무엇",
]);

const KOREAN_SUFFIX_PATTERN = /(으로는|으로도|에게는|에게도|에서는|에서|에게|부터|까지|처럼|보다|라도|이며|이고|라는|이라|입니다|해요|어요|아요|이에요|예요|은|는|이|가|을|를|에|의|와|과|도|만|로|으로|요)$/u;

function tokenize(input) {
  return (input.toLowerCase().match(/[a-z]+|[가-힣]+/g) ?? []).flatMap((rawToken) => {
    if (/^[a-z]+$/.test(rawToken)) return rawToken.length > 2 && !ENGLISH_STOP_WORDS.has(rawToken) ? [rawToken] : [];
    const token = rawToken.replace(KOREAN_SUFFIX_PATTERN, "");
    return token.length > 1 && !KOREAN_STOP_WORDS.has(rawToken) && !KOREAN_STOP_WORDS.has(token) ? [token] : [];
  });
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function loadRuntimeIndex(locale) {
  const runtimePath = path.join(DATA_DIR, `${locale}-runtime.json`);
  const raw = await readFile(runtimePath, "utf8");
  return JSON.parse(raw);
}

function json(value) {
  return JSON.stringify(value ?? []);
}

function buildTerms(unit) {
  return unique([
    ...tokenize(unit.searchCorpus ?? ""),
    ...tokenize(unit.summary ?? ""),
    ...tokenize(unit.excerpt ?? ""),
    ...tokenize(unit.text ?? ""),
    ...(unit.axisValues ?? []).flatMap(tokenize),
    ...(unit.keywords ?? []).flatMap(tokenize),
    ...(unit.themes ?? []).flatMap(tokenize),
    ...(unit.doctrines ?? []).flatMap(tokenize),
    ...(unit.humanConcerns ?? []).flatMap(tokenize),
    ...(unit.questionsAnswered ?? []).flatMap(tokenize),
    ...(unit.entities ?? []).flatMap(tokenize),
    ...(unit.axes ?? []).flatMap(tokenize),
  ]);
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  await rm(DB_PATH, { force: true });

  const indexes = await Promise.all(LOCALES.map(async (locale) => [locale, await loadRuntimeIndex(locale)]));
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = DELETE;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE units (
      unit_id TEXT PRIMARY KEY,
      locale TEXT NOT NULL,
      book_code TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      start_verse INTEGER NOT NULL,
      end_verse INTEGER NOT NULL,
      display_reference TEXT NOT NULL,
      text TEXT,
      excerpt TEXT,
      summary TEXT NOT NULL,
      search_corpus TEXT,
      axis_values_json TEXT,
      normalized_text TEXT,
      themes_json TEXT,
      doctrines_json TEXT,
      human_concerns_json TEXT,
      questions_answered_json TEXT,
      entities_json TEXT,
      keywords_json TEXT,
      canonical_weight REAL NOT NULL,
      cross_reference_degree REAL NOT NULL,
      cross_references_json TEXT,
      axes_json TEXT,
      genre TEXT,
      verse_count INTEGER,
      index_version TEXT,
      provenance_method TEXT,
      provenance_genre TEXT,
      provenance_seed_overlay INTEGER,
      provenance_source_locale TEXT
    );

    CREATE TABLE unit_terms (
      locale TEXT NOT NULL,
      unit_id TEXT NOT NULL,
      term TEXT NOT NULL,
      PRIMARY KEY (locale, unit_id, term)
    );

    CREATE INDEX units_reference_idx ON units (locale, book_code, chapter, start_verse, end_verse);
    CREATE INDEX units_chapter_idx ON units (locale, book_code, chapter);
    CREATE INDEX unit_terms_term_idx ON unit_terms (locale, term);
  `);

  const insertMeta = db.prepare(`INSERT INTO metadata (key, value) VALUES (?, ?)`);
  const insertUnit = db.prepare(`
    INSERT INTO units (
      unit_id, locale, book_code, chapter, start_verse, end_verse, display_reference, text, excerpt, summary,
      search_corpus, axis_values_json, normalized_text, themes_json, doctrines_json, human_concerns_json,
      questions_answered_json, entities_json, keywords_json, canonical_weight, cross_reference_degree,
      cross_references_json, axes_json, genre, verse_count, index_version, provenance_method,
      provenance_genre, provenance_seed_overlay, provenance_source_locale
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertTerm = db.prepare(`INSERT INTO unit_terms (locale, unit_id, term) VALUES (?, ?, ?)`);

  insertMeta.run("schema_version", "1");
  insertMeta.run("built_at", new Date().toISOString());
  insertMeta.run("locales", JSON.stringify(LOCALES));

  db.exec("BEGIN");
  try {
    for (const [locale, index] of indexes) {
      for (const unit of index.units) {
        insertUnit.run(
          unit.id,
          locale,
          unit.reference.code,
          unit.reference.chapter,
          unit.reference.startVerse,
          unit.reference.endVerse,
          unit.displayReference,
          unit.text ?? null,
          unit.excerpt ?? null,
          unit.summary,
          unit.searchCorpus ?? null,
          json(unit.axisValues),
          unit.normalizedText ?? null,
          json(unit.themes),
          json(unit.doctrines),
          json(unit.humanConcerns),
          json(unit.questionsAnswered),
          json(unit.entities),
          json(unit.keywords),
          unit.canonicalWeight,
          unit.crossReferenceDegree,
          json(unit.crossReferences),
          json(unit.axes),
          unit.genre ?? null,
          unit.verseCount ?? null,
          unit.indexVersion ?? null,
          unit.provenance?.method ?? null,
          unit.provenance?.genre ?? null,
          unit.provenance ? (unit.provenance.seedOverlay ? 1 : 0) : null,
          unit.provenance?.sourceLocale ?? null,
        );

        for (const term of buildTerms(unit)) {
          insertTerm.run(locale, unit.id, term);
        }
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  db.exec("VACUUM;");
  db.close();

  console.log(
    JSON.stringify(
      Object.fromEntries(indexes.map(([locale, index]) => [locale, index.units.length])),
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
