import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data", "chapter-background");
const DB_PATH = path.join(DATA_DIR, "chapter-background.sqlite");

function parseJson(raw, label) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function loadChapters(locale) {
  const p = path.join(DATA_DIR, `${locale}.json`);
  const raw = await readFile(p, "utf8");
  const parsed = parseJson(raw, `${locale}.json`);
  return parsed;
}

async function main() {
  const [ko, en] = await Promise.all([loadChapters("ko"), loadChapters("en")]);

  await mkdir(DATA_DIR, { recursive: true });
  await rm(DB_PATH, { force: true });

  const db = new DatabaseSync(DB_PATH, { open: true });
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA temp_store = MEMORY;

    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE chapter_background (
      id TEXT PRIMARY KEY,
      locale TEXT NOT NULL,
      code TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      testament TEXT NOT NULL,
      overview TEXT NOT NULL,
      historical TEXT NOT NULL,
      literary TEXT NOT NULL,
      theological TEXT NOT NULL,
      key_verses_json TEXT NOT NULL,
      cautions_json TEXT NOT NULL,
      sources_json TEXT NOT NULL,
      version TEXT NOT NULL,
      generated_at TEXT NOT NULL
    );
    CREATE INDEX idx_chapter_background_code_chapter ON chapter_background (code, chapter);
    CREATE INDEX idx_chapter_background_locale ON chapter_background (locale);
  `);

  const insertMeta = db.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)");
  insertMeta.run("built_at", new Date().toISOString());
  insertMeta.run("version", en.version ?? ko.version ?? "chapter-background");
  insertMeta.run("ko_generatedAt", ko.generatedAt ?? "");
  insertMeta.run("en_generatedAt", en.generatedAt ?? "");
  insertMeta.run("ko_stats", JSON.stringify(ko.stats ?? null));
  insertMeta.run("en_stats", JSON.stringify(en.stats ?? null));

  const insert = db.prepare(`
    INSERT INTO chapter_background (
      id, locale, code, chapter, testament, overview, historical, literary, theological,
      key_verses_json, cautions_json, sources_json, version, generated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  db.exec("BEGIN");
  try {
    for (const payload of [ko, en]) {
      const locale = payload.locale;
      for (const ch of payload.chapters ?? []) {
        insert.run(
          `${ch.id}:${locale}`,
          locale,
          ch.code,
          ch.chapter,
          ch.testament ?? "",
          ch.overview ?? "",
          ch.historical ?? "",
          ch.literary ?? "",
          ch.theological ?? "",
          JSON.stringify(ch.keyVerses ?? []),
          JSON.stringify(ch.cautions ?? []),
          JSON.stringify(ch.sources ?? []),
          ch.version ?? payload.version ?? "",
          ch.generatedAt ?? payload.generatedAt ?? "",
        );
        count += 1;
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  db.exec("VACUUM");
  db.close();

  console.log(`wrote ${path.relative(ROOT, DB_PATH)}`);
  console.log(`rows: ${count} (ko: ${ko.chapters?.length ?? 0}, en: ${en.chapters?.length ?? 0})`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
