import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_PATH = path.join(ROOT, "data", "knowledge", "crossrefs.sqlite");
const JSON_FALLBACK_OPEN = path.join(ROOT, "data", "knowledge", "openbible-crossrefs.json");
const JSON_FALLBACK_PHRASE = path.join(ROOT, "data", "knowledge", "crossreferences-kjv.json");
const OUT_DIR = path.join(ROOT, "data", "knowledge");
const OUT_CSV = path.join(OUT_DIR, "crossrefs.csv");
const OUT_VERSE_SUMMARY = path.join(OUT_DIR, "crossrefs-by-verse.csv");

function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const useDb = existsSync(DB_PATH);
  let rows = [];

  if (useDb) {
    const db = new DatabaseSync(DB_PATH, { readOnly: true });
    const openRows = db.prepare("SELECT from_key, to_code, to_chapter, to_start_verse, to_end_verse, to_label, votes FROM openbible_links").all();
    const phraseRows = db.prepare("SELECT from_key, to_code, to_chapter, to_start_verse, to_end_verse, to_label, anchor_phrase FROM phrase_links").all();
    db.close();

    for (const r of openRows) {
      const m = /^([1-3]?[A-Z]+)\s+(\d+):(\d+)$/.exec(r.from_key);
      if (!m) continue;
      rows.push({
        source_code: m[1],
        source_chapter: Number(m[2]),
        source_verse: Number(m[3]),
        target_code: r.to_code,
        target_chapter: r.to_chapter,
        target_start_verse: r.to_start_verse,
        target_end_verse: r.to_end_verse,
        votes: r.votes,
        anchor_phrase: "",
        source: "openbible",
        source_name: "OpenBible Cross References",
        license: "CC BY 4.0",
      });
    }
    for (const r of phraseRows) {
      const m = /^([1-3]?[A-Z]+)\s+(\d+):(\d+)$/.exec(r.from_key);
      if (!m) continue;
      rows.push({
        source_code: m[1],
        source_chapter: Number(m[2]),
        source_verse: Number(m[3]),
        target_code: r.to_code,
        target_chapter: r.to_chapter,
        target_start_verse: r.to_start_verse,
        target_end_verse: r.to_end_verse,
        votes: "",
        anchor_phrase: r.anchor_phrase ?? "",
        source: "crossreferences-kjv",
        source_name: "Bible Cross References KJV",
        license: "CC BY-SA 4.0",
      });
    }
  } else {
    const openRaw = JSON.parse(await readFile(JSON_FALLBACK_OPEN, "utf8"));
    const phraseRaw = JSON.parse(await readFile(JSON_FALLBACK_PHRASE, "utf8"));
    for (const [fromKey, links] of Object.entries(openRaw.byVerse ?? {})) {
      const m = /^([1-3]?[A-Z]+)\s+(\d+):(\d+)$/.exec(fromKey);
      if (!m) continue;
      for (const l of links) {
        rows.push({
          source_code: m[1], source_chapter: Number(m[2]), source_verse: Number(m[3]),
          target_code: l.to.code, target_chapter: l.to.chapter, target_start_verse: l.to.startVerse, target_end_verse: l.to.endVerse,
          votes: l.votes ?? "", anchor_phrase: "", source: "openbible", source_name: "OpenBible Cross References", license: "CC BY 4.0",
        });
      }
    }
    for (const [fromKey, links] of Object.entries(phraseRaw.byVerse ?? {})) {
      const m = /^([1-3]?[A-Z]+)\s+(\d+):(\d+)$/.exec(fromKey);
      if (!m) continue;
      for (const l of links) {
        rows.push({
          source_code: m[1], source_chapter: Number(m[2]), source_verse: Number(m[3]),
          target_code: l.to.code, target_chapter: l.to.chapter, target_start_verse: l.to.startVerse, target_end_verse: l.to.endVerse,
          votes: "", anchor_phrase: l.anchorPhrase ?? "", source: "crossreferences-kjv", source_name: "Bible Cross References KJV", license: "CC BY-SA 4.0",
        });
      }
    }
  }

  rows.sort((a, b) =>
    a.source_code.localeCompare(b.source_code) || a.source_chapter - b.source_chapter || a.source_verse - b.source_verse ||
    a.target_code.localeCompare(b.target_code) || a.target_chapter - b.target_chapter || a.target_start_verse - b.target_start_verse
  );

  const header = ["source_code","source_chapter","source_verse","source_ref","target_code","target_chapter","target_start_verse","target_end_verse","target_ref","votes","anchor_phrase","source","source_name","license"];
  const out = createWriteStream(OUT_CSV, { encoding: "utf8" });
  out.write(header.map(csvEscape).join(",") + "\n");
  for (const r of rows) {
    const sourceRef = `${r.source_code} ${r.source_chapter}:${r.source_verse}`;
    const targetRef = r.target_start_verse === r.target_end_verse ? `${r.target_code} ${r.target_chapter}:${r.target_start_verse}` : `${r.target_code} ${r.target_chapter}:${r.target_start_verse}-${r.target_end_verse}`;
    out.write([r.source_code, r.source_chapter, r.source_verse, sourceRef, r.target_code, r.target_chapter, r.target_start_verse, r.target_end_verse, targetRef, r.votes, r.anchor_phrase, r.source, r.source_name, r.license].map(csvEscape).join(",") + "\n");
  }
  await new Promise((res, rej) => { out.end((err) => err ? rej(err) : res()); });

  const byVerse = new Map();
  for (const r of rows) {
    const k = `${r.source_code} ${r.source_chapter}:${r.source_verse}`;
    byVerse.set(k, (byVerse.get(k) ?? 0) + 1);
  }
  const summaryHeader = ["verse_ref","source_code","source_chapter","source_verse","edge_count"];
  const out2 = createWriteStream(OUT_VERSE_SUMMARY, { encoding: "utf8" });
  out2.write(summaryHeader.map(csvEscape).join(",") + "\n");
  const sortedVerses = [...byVerse.entries()].sort((a, b) => b[1] - a[1]);
  for (const [ref, count] of sortedVerses) {
    const m = /^([1-3]?[A-Z]+)\s+(\d+):(\d+)$/.exec(ref);
    if (!m) continue;
    out2.write([ref, m[1], m[2], m[3], count].map(csvEscape).join(",") + "\n");
  }
  await new Promise((res, rej) => { out2.end((err) => err ? rej(err) : res()); });

  console.log(`wrote ${path.relative(ROOT, OUT_CSV)} rows=${rows.length}`);
  console.log(`wrote ${path.relative(ROOT, OUT_VERSE_SUMMARY)} verses=${byVerse.size}`);
  console.log(`top 5`, sortedVerses.slice(0, 5).map(([k, v]) => `${k}=${v}`).join(", "));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
