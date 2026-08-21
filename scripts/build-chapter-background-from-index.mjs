/**
 * Build chapter backgrounds from the real per-passage LLM summaries in passage-index.
 *
 * Replaces the genre-template in ingest_chapter_background.py which never read the actual
 * chapter text (see design: 이어봄-성경-참조-데이터-100활용-설계 v1.0 §2 §6).
 * - overview: real per-passage unit summaries for the chapter, joined
 * - keyVerses: strongest verses by crossReferenceDegree within the chapter
 *   (removes hardcoded "장의 시작/중간" selection)
 * - theological: theme axes from real axisValues; empty fields omitted (absence is quiet)
 * - cautions: genre-based + single-verse warning, no fixed template pollution
 *
 * Deterministic, zero additional LLM cost — reuses the generated corpus.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "data", "chapter-background");
const VERSION = "chapter-background-2026-08-v2";
const GENERATED_AT = new Date().toISOString();

const GENRE_KO = {
  narrative: "서사",
  epistle: "서신",
  prophetic: "예언",
  apocalyptic: "묵시",
  law: "율법",
  poetry: "시가",
  gospel: "복음서",
  wisdom: "지혜 문헌",
};

const GENRE_EN = {
  narrative: "Narrative",
  epistle: "Epistle",
  prophetic: "Prophecy",
  apocalyptic: "Apocalyptic",
  law: "Law",
  poetry: "Poetry",
  gospel: "Gospel",
  wisdom: "Wisdom",
};

function clean(text) {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function genreLabel(locale, genre) {
  const table = locale === "ko" ? GENRE_KO : GENRE_EN;
  return (genre && table[genre]) || (locale === "ko" ? "성경 문헌" : "Biblical literature");
}

function verseLead(unit) {
  const t = clean(unit.excerpt || "");
  const stripped = t.replace(/^\d+\.\s*/u, "");
  if (!stripped) return clean(unit.summary || "");
  // 여러 절로 된 유닛에서는 첫 절 문장까지만 요약으로 사용
  const m = stripped.match(/^[^.!?。]*[.!?。]\s*/);
  return (m ? m[0] : stripped).slice(0, 200);
}

function pickKeyVerses(code, chapter, units) {
  const pool = units
    .filter((u) => u.reference && Number.isInteger(u.crossReferenceDegree))
    .sort((a, b) => b.crossReferenceDegree - a.crossReferenceDegree);
  const chosen = pool.slice(0, 2).map((u, i) => ({
    reference: `${code} ${chapter}:${u.reference.startVerse}${u.reference.endVerse > u.reference.startVerse ? `-${u.reference.endVerse}` : ""}`,
    why: i === 0 ? "연결 성구가 가장 많은 절 (본문 기준 자동 선택)" : "연결 성구가 많은 절 (본문 기준 자동 선택)",
  }));
  return chosen.length
    ? chosen
    : [{ reference: `${code} ${chapter}:1`, why: "이 장의 첫 절" }];
}

function buildOverview(code, chapter, units, bookName) {
  const full = units.map((u) => clean(u.excerpt || "")).filter(Boolean).join(" ");
  if (!full) return "";
  // 절 번호를 걷어내고 실제 본문을 읽기 좋게 이어 붙인다
  const prose = full.replace(/\d+\.\s*/gu, "").trim();
  return `${bookName} ${chapter}장 본문 미리보기 — ${prose.slice(0, 360)}`;
}

function buildTheological(units) {
  const axes = [...new Set(units.flatMap((u) => u.axisValues ?? []))].filter((t) => /[가-힣]/.test(String(t)));
  if (!axes.length) return "";
  return `붙잡아 볼 축: ${axes.slice(0, 8).join(" · ")}.`;
}

function buildCautions(genre) {
  const caveats = [];
  if (genre) caveats.push(`이 장은 ${genreLabel("ko", genre)} 장르 텍스트입니다. 앞뒤 문맥 안에서 읽으세요.`);
  if (genre === "poetry") caveats.push("한 절만 떼어 해석하지 말고 시 전체의 흐름 안에서 읽으세요.");
  return caveats;
}

async function loadBookMeta(locale) {
  const p = locale === "ko"
    ? path.join(ROOT, "korean_bible", "metadata.json")
    : path.join(ROOT, "world_english_bible", "metadata.json");
  return JSON.parse(await readFile(p, "utf8"));
}

async function buildIndex(locale) {
  const raw = JSON.parse(await readFile(path.join(ROOT, "data", "passage-index", `${locale}-runtime.json`), "utf8"));
  const meta = await loadBookMeta(locale);
  const units = raw.units ?? [];
  const chapters = [];

  for (const book of meta.books) {
    const code = book.code;
    const chapterCount = book.chapters;
    const testament = locale === "ko"
      ? (book.testament.includes("신약") ? "신약" : "구약")
      : (book.testament === "New Testament" ? "New Testament" : book.testament || "Old Testament");

    for (let chapter = 1; chapter <= chapterCount; chapter++) {
      const unitChapter = units.filter((u) => u.reference?.code === code && u.reference.chapter === chapter);
      const item = {
        id: `${code}-${chapter}`,
        code,
        chapter,
        testament,
        locale,
        overview: buildOverview(code, chapter, unitChapter, book.name),
        theological: buildTheological(unitChapter),
        cautions: buildCautions(unitChapter[0]?.genre),
        keyVerses: pickKeyVerses(code, chapter, unitChapter),
        sources: [
          { id: "passage-index", title: "Passage index (LLM 요약 + 본문 발췌)", url: "local://data/passage-index", license: "Internal", retrievedAt: GENERATED_AT, sourceTier: 2 },
          { id: "world-english-bible", title: "World English Bible", url: "https://ebible.org/bible/details.php?id=eng-web&all=1", license: "Public domain", retrievedAt: GENERATED_AT, sourceTier: 1 },
        ],
        version: VERSION,
        generatedAt: GENERATED_AT,
      };
      for (const k of Object.keys(item)) {
        const v = item[k];
        if (v === "" || (Array.isArray(v) && v.length === 0)) delete item[k];
      }
      chapters.push(item);
    }
  }

  return {
    version: VERSION,
    generatedAt: GENERATED_AT,
    locale,
    source: { name: "Passage-index chapter backgrounds", note: "Reconstructed from real per-passage LLM summaries + verse text.", license: "Internal", retrievedAt: GENERATED_AT },
    stats: { totalChapters: chapters.length, bookCount: meta.books.length },
    chapters,
  };
}

for (const locale of ["ko", "en"]) {
  const payload = await buildIndex(locale);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, `${locale}.json`), JSON.stringify(payload, null, 2));
  console.log(`wrote ${locale}.json chapters=${payload.stats.totalChapters}`);
}
