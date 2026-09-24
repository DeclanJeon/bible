import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type ChapterKeyVerse = { reference: string; why: string };
export type ChapterBackgroundSource = {
  id: string;
  title: string;
  url?: string;
  license?: string;
  retrievedAt: string;
  sourceTier: 1 | 2 | 3;
};
export type ChapterBackground = {
  id: string;
  code: string;
  chapter: number;
  testament: string;
  locale: string;
  overview: string;
  historical: string;
  literary: string;
  theological: string;
  keyVerses: ChapterKeyVerse[];
  cautions: string[];
  sources: ChapterBackgroundSource[];
  version: string;
  generatedAt: string;
};

export type ChapterBackgroundRuntimeSource = "sqlite" | "json-fallback" | "unavailable";

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "data", "chapter-background", "chapter-background.sqlite");
const ALLOW_JSON_FALLBACK = process.env.CHAPTER_BACKGROUND_JSON_FALLBACK === "1" || process.env.NODE_ENV !== "production";

let db: DatabaseSync | null | undefined;
let jsonCache: Map<string, ChapterBackground> | null = null;

function openDb() {
  if (db !== undefined) return db;
  if (!existsSync(DB_PATH)) {
    db = null;
    return db;
  }
  db = new DatabaseSync(DB_PATH, { readOnly: true });
  db.exec("PRAGMA query_only = ON");
  return db;
}

export function getChapterBackgroundRuntimeStatus() {
  const d = openDb();
  return {
    dbAvailable: !!d,
    jsonFallbackEnabled: ALLOW_JSON_FALLBACK,
    runtimeSource: (d ? "sqlite" : ALLOW_JSON_FALLBACK ? "json-fallback" : "unavailable") satisfies ChapterBackgroundRuntimeSource,
  };
}

function rowToBackground(row: {
  id: string;
  locale: string;
  code: string;
  chapter: number;
  testament: string;
  overview: string;
  historical: string;
  literary: string;
  theological: string;
  key_verses_json: string;
  cautions_json: string;
  sources_json: string;
  version: string;
  generated_at: string;
}): ChapterBackground {
  let keyVerses: ChapterKeyVerse[] = [];
  let cautions: string[] = [];
  let sources: ChapterBackgroundSource[] = [];
  try { keyVerses = JSON.parse(row.key_verses_json) as ChapterKeyVerse[]; } catch {}
  try { cautions = JSON.parse(row.cautions_json) as string[]; } catch {}
  try { sources = JSON.parse(row.sources_json) as ChapterBackgroundSource[]; } catch {}
  const baseId = row.id.includes(":") ? row.id.split(":")[0] : row.id;
  return {
    id: baseId,
    code: row.code,
    chapter: Number(row.chapter),
    testament: row.testament,
    locale: row.locale,
    overview: row.overview,
    historical: row.historical,
    literary: row.literary,
    theological: row.theological,
    keyVerses,
    cautions,
    sources,
    version: row.version,
    generatedAt: row.generated_at,
  };
}

async function loadJsonFallback(): Promise<Map<string, ChapterBackground>> {
  if (jsonCache) return jsonCache;
  const map = new Map<string, ChapterBackground>();
  for (const locale of ["ko", "en"] as const) {
    const p = path.join(ROOT, "data", "chapter-background", `${locale}.json`);
    try {
      const raw = await readFile(p, "utf8");
      const parsed = JSON.parse(raw) as { locale: string; chapters: Array<Record<string, unknown>>; version?: string; generatedAt?: string };
      for (const ch of parsed.chapters ?? []) {
        const item = ch as unknown as ChapterBackground & { id: string };
        const key = `${item.id}:${locale}`;
        map.set(key, {
          id: item.id,
          code: item.code,
          chapter: Number(item.chapter),
          testament: String((item as unknown as Record<string, unknown>).testament ?? ""),
          locale,
          overview: String(item.overview ?? ""),
          historical: String(item.historical ?? ""),
          literary: String(item.literary ?? ""),
          theological: String(item.theological ?? ""),
          keyVerses: (item.keyVerses ?? []) as ChapterKeyVerse[],
          cautions: (item.cautions ?? []) as string[],
          sources: (item.sources ?? []) as ChapterBackgroundSource[],
          version: String(item.version ?? parsed.version ?? ""),
          generatedAt: String(item.generatedAt ?? parsed.generatedAt ?? ""),
        });
      }
    } catch {}
  }
  jsonCache = map;
  return map;
}

export async function getChapterBackground(params: { code: string; chapter: number; locale?: string }): Promise<ChapterBackground | null> {
  const locale = params.locale === "ko" ? "ko" : "en";
  const code = params.code.trim().toUpperCase();
  const chapter = Number(params.chapter);
  const d = openDb();
  if (d) {
    const row = d.prepare("SELECT * FROM chapter_background WHERE code = ? AND chapter = ? AND locale = ? LIMIT 1").get(code, chapter, locale) as
      | {
          id: string;
          locale: string;
          code: string;
          chapter: number;
          testament: string;
          overview: string;
          historical: string;
          literary: string;
          theological: string;
          key_verses_json: string;
          cautions_json: string;
          sources_json: string;
          version: string;
          generated_at: string;
        }
      | undefined;
    if (row) return rowToBackground(row);
    if (locale === "ko") {
      const fallback = d.prepare("SELECT * FROM chapter_background WHERE code = ? AND chapter = ? AND locale = ? LIMIT 1").get(code, chapter, "en") as typeof row | undefined;
      if (fallback) return rowToBackground(fallback);
    }
    return null;
  }
  if (ALLOW_JSON_FALLBACK) {
    const map = await loadJsonFallback();
    return map.get(`${code}-${chapter}:${locale}`) ?? (locale === "ko" ? map.get(`${code}-${chapter}:en`) ?? null : null);
  }
  return null;
}

export async function getChapterBackgroundsForBook(code: string, locale?: string): Promise<ChapterBackground[]> {
  const loc = locale === "ko" ? "ko" : "en";
  const c = code.trim().toUpperCase();
  const d = openDb();
  if (d) {
    const rows = d.prepare("SELECT * FROM chapter_background WHERE code = ? AND locale = ? ORDER BY chapter ASC").all(c, loc) as Array<{
      id: string;
      locale: string;
      code: string;
      chapter: number;
      testament: string;
      overview: string;
      historical: string;
      literary: string;
      theological: string;
      key_verses_json: string;
      cautions_json: string;
      sources_json: string;
      version: string;
      generated_at: string;
    }>;
    if (rows.length) return rows.map(rowToBackground);
    if (loc === "ko") {
      const fb = d.prepare("SELECT * FROM chapter_background WHERE code = ? AND locale = ? ORDER BY chapter ASC").all(c, "en") as typeof rows;
      return fb.map(rowToBackground);
    }
    return [];
  }
  if (ALLOW_JSON_FALLBACK) {
    const map = await loadJsonFallback();
    const out: ChapterBackground[] = [];
    for (const [k, v] of map) {
      if (v.code === c && v.locale === loc) out.push(v);
    }
    if (out.length) return out.sort((a, b) => a.chapter - b.chapter);
    if (loc === "ko") {
      const fb: ChapterBackground[] = [];
      for (const v of map.values()) if (v.code === c && v.locale === "en") fb.push(v);
      return fb.sort((a, b) => a.chapter - b.chapter);
    }
    return [];
  }
  return [];
}
