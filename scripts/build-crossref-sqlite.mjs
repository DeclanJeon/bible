import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data", "knowledge");
const OPENBIBLE_PATH = path.join(DATA_DIR, "openbible-crossrefs.json");
const PHRASE_PATH = path.join(DATA_DIR, "crossreferences-kjv.json");
const DB_PATH = path.join(DATA_DIR, "crossrefs.sqlite");

function parseJson(raw, label) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function insertOpenBible(db, payload) {
  const rows = payload?.byVerse && typeof payload.byVerse === "object" ? payload.byVerse : {};
  const insert = db.prepare(`
    INSERT INTO openbible_links (
      from_key,
      to_code,
      to_chapter,
      to_start_verse,
      to_end_verse,
      to_label,
      votes,
      source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  db.exec("BEGIN");
  try {
    for (const [fromKey, links] of Object.entries(rows)) {
      if (!Array.isArray(links)) continue;
      for (const link of links) {
        if (!link?.to || typeof link.toLabel !== "string") continue;
        insert.run(
          fromKey,
          link.to.code,
          link.to.chapter,
          link.to.startVerse,
          link.to.endVerse,
          link.toLabel,
          Number(link.votes ?? 0),
          String(link.source ?? "OpenBible Cross References"),
        );
        count += 1;
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return count;
}

function insertPhrase(db, payload) {
  const rows = payload?.byVerse && typeof payload.byVerse === "object" ? payload.byVerse : {};
  const insert = db.prepare(`
    INSERT INTO phrase_links (
      from_key,
      to_code,
      to_chapter,
      to_start_verse,
      to_end_verse,
      to_label,
      anchor_phrase,
      source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  db.exec("BEGIN");
  try {
    for (const [fromKey, links] of Object.entries(rows)) {
      if (!Array.isArray(links)) continue;
      for (const link of links) {
        if (!link?.to || typeof link.toLabel !== "string") continue;
        insert.run(
          fromKey,
          link.to.code,
          link.to.chapter,
          link.to.startVerse,
          link.to.endVerse,
          link.toLabel,
          String(link.anchorPhrase ?? ""),
          String(link.source ?? "Bible Cross References KJV"),
        );
        count += 1;
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return count;
}

async function main() {
  const [openBibleRaw, phraseRaw] = await Promise.all([
    readFile(OPENBIBLE_PATH, "utf8"),
    readFile(PHRASE_PATH, "utf8"),
  ]);
  const openBible = parseJson(openBibleRaw, path.basename(OPENBIBLE_PATH));
  const phrase = parseJson(phraseRaw, path.basename(PHRASE_PATH));

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

    CREATE TABLE openbible_links (
      from_key TEXT NOT NULL,
      to_code TEXT NOT NULL,
      to_chapter INTEGER NOT NULL,
      to_start_verse INTEGER NOT NULL,
      to_end_verse INTEGER NOT NULL,
      to_label TEXT NOT NULL,
      votes INTEGER NOT NULL,
      source TEXT NOT NULL
    );
    CREATE INDEX idx_openbible_from_key ON openbible_links (from_key);
    CREATE INDEX idx_openbible_to_span ON openbible_links (to_code, to_chapter, to_start_verse, to_end_verse);

    CREATE TABLE phrase_links (
      from_key TEXT NOT NULL,
      to_code TEXT NOT NULL,
      to_chapter INTEGER NOT NULL,
      to_start_verse INTEGER NOT NULL,
      to_end_verse INTEGER NOT NULL,
      to_label TEXT NOT NULL,
      anchor_phrase TEXT NOT NULL,
      source TEXT NOT NULL
    );
    CREATE INDEX idx_phrase_from_key ON phrase_links (from_key);
    CREATE INDEX idx_phrase_to_span ON phrase_links (to_code, to_chapter, to_start_verse, to_end_verse);
  `);

  const insertMetadata = db.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)");
  insertMetadata.run("built_at", new Date().toISOString());
  insertMetadata.run("openbible_source", JSON.stringify(openBible.source ?? null));
  insertMetadata.run("phrase_source", JSON.stringify(phrase.source ?? null));

  const openCount = insertOpenBible(db, openBible);
  const phraseCount = insertPhrase(db, phrase);
  db.close();

  console.log(`wrote ${path.relative(ROOT, DB_PATH)}`);
  console.log(`openbible rows: ${openCount}`);
  console.log(`phrase rows: ${phraseCount}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
