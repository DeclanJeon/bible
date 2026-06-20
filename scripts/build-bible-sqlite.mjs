import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "data", "bible");
const OUT_PATH = path.join(OUT_DIR, "bible.sqlite");
const KO_FALLBACK_ALLOWLIST_PATH = path.join(ROOT, "data", "passage-index", "ko-fallback-allowlist.json");

function getTranslationPaths(locale) {
  if (locale === "ko") {
    return {
      vplPath: path.join(ROOT, "korean_bible", "canon_66_vpl.txt"),
    };
  }

  return {
    vplPath: path.join(ROOT, "world_english_bible", "canon_66_vpl.txt"),
  };
}

function parseVpl(raw, sourceLocale) {
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      const match = line.match(/^([0-9A-Z]{3})\s+(\d+):(\d+)\s+(.*)$/);
      if (!match) {
        return [];
      }

      const [, code, chapter, verse, text] = match;
      return [
        {
          code,
          chapter: Number(chapter),
          verse: Number(verse),
          text,
          sourceLocale,
        },
      ];
    });
}

function mergeMissingVerses(primary, fallback, allowlist) {
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

async function loadKoFallbackAllowlist() {
  const raw = await readFile(KO_FALLBACK_ALLOWLIST_PATH, "utf8");
  const parsed = JSON.parse(raw);
  return new Set(parsed.allowedMissingVerseKeys ?? []);
}

async function loadLocaleVerses(locale) {
  const { vplPath } = getTranslationPaths(locale);
  const raw = await readFile(vplPath, "utf8");
  let verses = parseVpl(raw, locale);

  if (locale === "ko") {
    const fallbackRaw = await readFile(getTranslationPaths("en").vplPath, "utf8");
    const allowlist = await loadKoFallbackAllowlist();
    verses = mergeMissingVerses(verses, parseVpl(fallbackRaw, "en"), allowlist);
  }

  return verses;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await rm(OUT_PATH, { force: true });

  const [enVerses, koVerses] = await Promise.all([loadLocaleVerses("en"), loadLocaleVerses("ko")]);
  const db = new DatabaseSync(OUT_PATH);

  db.exec(`
    PRAGMA journal_mode = DELETE;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE verses (
      locale TEXT NOT NULL,
      code TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      text TEXT NOT NULL,
      source_locale TEXT NOT NULL,
      PRIMARY KEY (locale, code, chapter, verse)
    );

    CREATE INDEX verses_lookup_idx ON verses (locale, code, chapter, verse);
  `);

  const insertMeta = db.prepare(`INSERT INTO metadata (key, value) VALUES (?, ?)`);
  insertMeta.run("schema_version", "1");
  insertMeta.run("built_at", new Date().toISOString());
  insertMeta.run("locales", JSON.stringify(["en", "ko"]));

  const insertVerse = db.prepare(`
    INSERT INTO verses (locale, code, chapter, verse, text, source_locale)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  db.exec("BEGIN");
  try {
    for (const verse of enVerses) {
      insertVerse.run("en", verse.code, verse.chapter, verse.verse, verse.text, verse.sourceLocale);
    }
    for (const verse of koVerses) {
      insertVerse.run("ko", verse.code, verse.chapter, verse.verse, verse.text, verse.sourceLocale);
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
      {
        outPath: path.relative(ROOT, OUT_PATH),
        locales: {
          en: enVerses.length,
          ko: koVerses.length,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
