import { cache } from "react";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { formatBibleReference, getPassage, loadBookMetadata, type BibleReference } from "@/lib/bible";
import { localizeCrossReferenceSupportType, resolveAppLocale } from "@/lib/content";
import type { SourceLink } from "@/lib/app-data";

export type CrossReferenceSupportType = "consensus-link" | "vote-supported" | "phrase-anchor";
export type CrossReferenceDatasetSource = "openbible" | "crossreferences-kjv";
export type CrossReferenceAggregateDirection = "outgoing" | "incoming";

export type CrossReferenceSuggestion = {
  target: BibleReference;
  targetLabel: string;
  displayReference: string;
  title: string;
  excerpt: string;
  score: number;
  supportType: CrossReferenceSupportType;
  supportLabel: string;
  supportLine: string;
  sources: string[];
};

export type CrossReferenceAggregateEvidence = {
  source: CrossReferenceDatasetSource;
  sourceName: string;
  sourceUrl?: string;
  license?: string;
  votes?: number;
  anchorPhrases: string[];
  anchorVerses: BibleReference[];
  rawReferences: string[];
};

export type CrossReferenceAggregateRecord = {
  from: BibleReference;
  to: BibleReference;
  direction: CrossReferenceAggregateDirection;
  votes: number;
  phraseAnchors: string[];
  evidence: CrossReferenceAggregateEvidence[];
  score: number;
};

export type CrossReferenceRuntimeSource = "sqlite" | "json-fallback" | "unavailable";

export type CrossReferenceAggregateBundle = {
  outgoing: CrossReferenceAggregateRecord[];
  incoming: CrossReferenceAggregateRecord[];
  availableSources: CrossReferenceDatasetSource[];
  missingSources: CrossReferenceDatasetSource[];
  runtimeSource: CrossReferenceRuntimeSource;
  notes: string[];
  sourceLinks: SourceLink[];
  sourceVersions: Array<{ source: CrossReferenceDatasetSource; retrievedAt?: string; license?: string }>;
};

type SourceMetadata = { name: string; url?: string; license?: string; retrievedAt?: string };

type OpenBibleStore = {
  source: { name: string; url: string; license: string; retrievedAt: string };
  stats: { anchors: number; edges: number; skipped: number };
  byVerse: Record<string, Array<{ to: BibleReference; toLabel: string; votes: number; source: string }>>;
};

type PhraseStore = {
  source: { name: string; url: string; license: string; retrievedAt: string };
  stats: { anchors: number; edges: number; skipped: number };
  byVerse: Record<string, Array<{ anchorPhrase: string; to: BibleReference; toLabel: string; source: string }>>;
};

type OpenBibleRow = {
  from_key: string;
  to_code: string;
  to_chapter: number;
  to_start_verse: number;
  to_end_verse: number;
  to_label: string;
  votes: number;
};

type PhraseRow = {
  from_key: string;
  to_code: string;
  to_chapter: number;
  to_start_verse: number;
  to_end_verse: number;
  to_label: string;
  anchor_phrase: string;
};

type AggregateBucket = {
  from: BibleReference;
  to: BibleReference;
  direction: CrossReferenceAggregateDirection;
  votes: number;
  phraseAnchors: Set<string>;
  evidenceBySource: Map<CrossReferenceDatasetSource, {
    source: CrossReferenceDatasetSource;
    sourceName: string;
    sourceUrl?: string;
    license?: string;
    votes: number;
    anchorPhrases: Set<string>;
    anchorVerses: Map<string, BibleReference>;
    rawReferences: Set<string>;
  }>;
};

const ROOT = process.cwd();
const CROSSREF_DB_PATH = path.join(ROOT, "data", "knowledge", "crossrefs.sqlite");
const ALLOW_CROSSREF_JSON_FALLBACK = process.env.CROSSREF_JSON_FALLBACK === "1" || process.env.NODE_ENV !== "production";
const SOURCE_DEFAULTS: Record<CrossReferenceDatasetSource, SourceMetadata> = {
  openbible: {
    name: "OpenBible Cross References",
    url: "https://github.com/openbibleinfo/Bible-Passage-Reference-Parser",
    license: "OpenBible data",
  },
  "crossreferences-kjv": {
    name: "Bible Cross References KJV",
    url: "https://github.com/scrollmapper/bible_databases",
    license: "Public domain / derived index",
  },
};

let crossRefDb: DatabaseSync | null | undefined;
let sourceMetadataCache: Map<CrossReferenceDatasetSource, SourceMetadata> | null | undefined;

function verseKey(reference: BibleReference, verse: number) {
  return `${reference.code} ${reference.chapter}:${verse}`;
}

function directedKey(from: BibleReference, to: BibleReference) {
  return `${from.code}:${from.chapter}:${from.startVerse}-${from.endVerse}>${to.code}:${to.chapter}:${to.startVerse}-${to.endVerse}`;
}

function overlaps(source: BibleReference, target: BibleReference) {
  return (
    source.code === target.code &&
    source.chapter === target.chapter &&
    !(target.endVerse < source.startVerse || target.startVerse > source.endVerse)
  );
}

function parseVerseKeyLabel(key: string): BibleReference | null {
  const match = /^([1-3]?[A-Z]+)\s+(\d+):(\d+)$/i.exec(key.trim());
  if (!match) return null;
  const chapter = Number(match[2]);
  const verse = Number(match[3]);
  if (!Number.isInteger(chapter) || !Number.isInteger(verse) || chapter < 1 || verse < 1) return null;
  return { code: match[1].toUpperCase(), chapter, startVerse: verse, endVerse: verse };
}

function classifySupportType(votes: number, phraseAnchors: Set<string>) {
  if (votes > 0 && phraseAnchors.size > 0) return "consensus-link" satisfies CrossReferenceSupportType;
  if (votes > 0) return "vote-supported" satisfies CrossReferenceSupportType;
  return "phrase-anchor" satisfies CrossReferenceSupportType;
}

function openCrossRefDb() {
  if (crossRefDb !== undefined) return crossRefDb;
  if (!existsSync(CROSSREF_DB_PATH)) {
    crossRefDb = null;
    return crossRefDb;
  }

  crossRefDb = new DatabaseSync(CROSSREF_DB_PATH, { open: true, readOnly: true });
  crossRefDb.exec("PRAGMA query_only = ON");
  return crossRefDb;
}

export function getCrossReferenceRuntimeStatus() {
  const db = openCrossRefDb();
  return {
    dbAvailable: !!db,
    jsonFallbackEnabled: ALLOW_CROSSREF_JSON_FALLBACK,
    runtimeSource: (db
      ? "sqlite"
      : ALLOW_CROSSREF_JSON_FALLBACK
        ? "json-fallback"
        : "unavailable") satisfies CrossReferenceRuntimeSource,
  };
}

function mapRowReference(row: OpenBibleRow | PhraseRow): BibleReference {
  return {
    code: row.to_code,
    chapter: row.to_chapter,
    startVerse: row.to_start_verse,
    endVerse: row.to_end_verse,
  };
}

function selectOpenBibleRows(keys: string[]) {
  const db = openCrossRefDb();
  if (!db || !keys.length) return [] as OpenBibleRow[];
  const placeholders = keys.map(() => "?").join(", ");
  return db.prepare(`
    SELECT from_key, to_code, to_chapter, to_start_verse, to_end_verse, to_label, votes
    FROM openbible_links
    WHERE from_key IN (${placeholders})
  `).all(...keys) as OpenBibleRow[];
}

function selectPhraseRows(keys: string[]) {
  const db = openCrossRefDb();
  if (!db || !keys.length) return [] as PhraseRow[];
  const placeholders = keys.map(() => "?").join(", ");
  return db.prepare(`
    SELECT from_key, to_code, to_chapter, to_start_verse, to_end_verse, to_label, anchor_phrase
    FROM phrase_links
    WHERE from_key IN (${placeholders})
  `).all(...keys) as PhraseRow[];
}

function selectIncomingOpenBibleRows(reference: BibleReference) {
  const db = openCrossRefDb();
  if (!db) return [] as OpenBibleRow[];
  return db.prepare(`
    SELECT from_key, to_code, to_chapter, to_start_verse, to_end_verse, to_label, votes
    FROM openbible_links
    WHERE to_code = ?
      AND to_chapter = ?
      AND to_start_verse <= ?
      AND to_end_verse >= ?
  `).all(reference.code, reference.chapter, reference.endVerse, reference.startVerse) as OpenBibleRow[];
}

function selectIncomingPhraseRows(reference: BibleReference) {
  const db = openCrossRefDb();
  if (!db) return [] as PhraseRow[];
  return db.prepare(`
    SELECT from_key, to_code, to_chapter, to_start_verse, to_end_verse, to_label, anchor_phrase
    FROM phrase_links
    WHERE to_code = ?
      AND to_chapter = ?
      AND to_start_verse <= ?
      AND to_end_verse >= ?
  `).all(reference.code, reference.chapter, reference.endVerse, reference.startVerse) as PhraseRow[];
}

function readDbMetadata(key: string): unknown {
  const db = openCrossRefDb();
  if (!db) return null;
  const row = db.prepare("SELECT value FROM metadata WHERE key = ?").get(key) as { value?: string } | undefined;
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

function loadSourceMetadataFromDb() {
  if (sourceMetadataCache !== undefined) return sourceMetadataCache;
  const db = openCrossRefDb();
  if (!db) {
    sourceMetadataCache = null;
    return sourceMetadataCache;
  }

  const metadata = new Map<CrossReferenceDatasetSource, SourceMetadata>();
  const openBible = readDbMetadata("openbible_source") as Partial<SourceMetadata> | null;
  const phrase = readDbMetadata("phrase_source") as Partial<SourceMetadata> | null;
  if (openBible?.name) metadata.set("openbible", { ...SOURCE_DEFAULTS.openbible, ...openBible });
  if (phrase?.name) metadata.set("crossreferences-kjv", { ...SOURCE_DEFAULTS["crossreferences-kjv"], ...phrase });
  sourceMetadataCache = metadata;
  return sourceMetadataCache;
}

function sourceMetaFor(source: CrossReferenceDatasetSource) {
  return loadSourceMetadataFromDb()?.get(source) ?? SOURCE_DEFAULTS[source];
}

function buildSourceBundle() {
  const metadata = loadSourceMetadataFromDb();
  const availableSources = [...(metadata?.keys() ?? [])] as CrossReferenceDatasetSource[];
  const missingSources = (["openbible", "crossreferences-kjv"] as const).filter((source) => !availableSources.includes(source));
  const sourceLinks: SourceLink[] = [];
  const sourceVersions: Array<{ source: CrossReferenceDatasetSource; retrievedAt?: string; license?: string }> = [];

  for (const source of availableSources) {
    const meta = sourceMetaFor(source);
    if (meta.url) sourceLinks.push({ label: meta.name, url: meta.url });
    sourceVersions.push({ source, retrievedAt: meta.retrievedAt, license: meta.license });
  }

  return { availableSources, missingSources, sourceLinks, sourceVersions };
}

async function loadJson<T>(relativePath: string): Promise<T | null> {
  const filePath = path.join(ROOT, relativePath);
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const loadOpenBibleStore = cache(async () =>
  loadJson<OpenBibleStore>(path.join("data", "knowledge", "openbible-crossrefs.json")),
);

export const loadPhraseStore = cache(async () =>
  loadJson<PhraseStore>(path.join("data", "knowledge", "crossreferences-kjv.json")),
);

function addEvidence(
  aggregates: Map<string, AggregateBucket>,
  direction: CrossReferenceAggregateDirection,
  from: BibleReference,
  to: BibleReference,
  source: CrossReferenceDatasetSource,
  values: { votes?: number; anchorPhrase?: string; rawReference?: string },
) {
  const key = directedKey(from, to);
  const bucket = aggregates.get(key) ?? {
    from,
    to,
    direction,
    votes: 0,
    phraseAnchors: new Set<string>(),
    evidenceBySource: new Map(),
  } satisfies AggregateBucket;

  const meta = sourceMetaFor(source);
  const evidence = bucket.evidenceBySource.get(source) ?? {
    source,
    sourceName: meta.name,
    sourceUrl: meta.url,
    license: meta.license,
    votes: 0,
    anchorPhrases: new Set<string>(),
    anchorVerses: new Map<string, BibleReference>(),
    rawReferences: new Set<string>(),
  };

  if (values.votes) {
    bucket.votes += values.votes;
    evidence.votes += values.votes;
  }
  if (values.anchorPhrase) {
    bucket.phraseAnchors.add(values.anchorPhrase);
    evidence.anchorPhrases.add(values.anchorPhrase);
  }
  if (values.rawReference) {
    evidence.rawReferences.add(values.rawReference);
  }

  evidence.anchorVerses.set(directedKey(from, from), from);
  bucket.evidenceBySource.set(source, evidence);
  aggregates.set(key, bucket);
}

function finalizeAggregates(aggregates: Map<string, AggregateBucket>) {
  return [...aggregates.values()]
    .map((bucket) => ({
      from: bucket.from,
      to: bucket.to,
      direction: bucket.direction,
      votes: bucket.votes,
      phraseAnchors: [...bucket.phraseAnchors].sort(),
      evidence: [...bucket.evidenceBySource.values()]
        .map((item) => ({
          source: item.source,
          sourceName: item.sourceName,
          sourceUrl: item.sourceUrl,
          license: item.license,
          votes: item.votes,
          anchorPhrases: [...item.anchorPhrases].sort(),
          anchorVerses: [...item.anchorVerses.values()].sort((left, right) => left.chapter - right.chapter || left.startVerse - right.startVerse),
          rawReferences: [...item.rawReferences].sort(),
        }))
        .sort((left, right) => left.source.localeCompare(right.source)),
      score: bucket.votes + bucket.phraseAnchors.size * 12,
    } satisfies CrossReferenceAggregateRecord))
    .sort((left, right) => right.score - left.score
      || left.to.code.localeCompare(right.to.code)
      || left.to.chapter - right.to.chapter
      || left.to.startVerse - right.to.startVerse
      || left.from.code.localeCompare(right.from.code)
      || left.from.chapter - right.from.chapter
      || left.from.startVerse - right.from.startVerse);
}

function aggregateViaSqlite(reference: BibleReference): CrossReferenceAggregateBundle {
  const selectedKeys: string[] = [];
  for (let verse = reference.startVerse; verse <= reference.endVerse; verse += 1) {
    selectedKeys.push(verseKey(reference, verse));
  }
  const selectedKeySet = new Set(selectedKeys);
  const outgoing = new Map<string, AggregateBucket>();
  const incoming = new Map<string, AggregateBucket>();

  for (const row of selectOpenBibleRows(selectedKeys)) {
    const from = parseVerseKeyLabel(row.from_key);
    if (!from) continue;
    const to = mapRowReference(row);
    if (overlaps(reference, to)) continue;
    addEvidence(outgoing, "outgoing", from, to, "openbible", { votes: row.votes, rawReference: row.to_label });
  }

  for (const row of selectPhraseRows(selectedKeys)) {
    const from = parseVerseKeyLabel(row.from_key);
    if (!from) continue;
    const to = mapRowReference(row);
    if (overlaps(reference, to)) continue;
    addEvidence(outgoing, "outgoing", from, to, "crossreferences-kjv", { anchorPhrase: row.anchor_phrase, rawReference: row.to_label });
  }

  for (const row of selectIncomingOpenBibleRows(reference)) {
    const from = parseVerseKeyLabel(row.from_key);
    if (!from) continue;
    const to = mapRowReference(row);
    if (!overlaps(to, reference) || selectedKeySet.has(row.from_key) || overlaps(from, reference)) continue;
    addEvidence(incoming, "incoming", from, to, "openbible", { votes: row.votes, rawReference: row.to_label });
  }

  for (const row of selectIncomingPhraseRows(reference)) {
    const from = parseVerseKeyLabel(row.from_key);
    if (!from) continue;
    const to = mapRowReference(row);
    if (!overlaps(to, reference) || selectedKeySet.has(row.from_key) || overlaps(from, reference)) continue;
    addEvidence(incoming, "incoming", from, to, "crossreferences-kjv", { anchorPhrase: row.anchor_phrase, rawReference: row.to_label });
  }

  const sourceBundle = buildSourceBundle();
  return {
    outgoing: finalizeAggregates(outgoing),
    incoming: finalizeAggregates(incoming),
    runtimeSource: "sqlite",
    ...sourceBundle,
    notes: ["Incoming links are reverse-indexed from the same SQLite-backed source stores."],
  };
}

async function aggregateViaJsonFallback(reference: BibleReference): Promise<CrossReferenceAggregateBundle> {
  const [openBibleStore, phraseStore] = await Promise.all([loadOpenBibleStore(), loadPhraseStore()]);
  const selectedKeys: string[] = [];
  for (let verse = reference.startVerse; verse <= reference.endVerse; verse += 1) {
    selectedKeys.push(verseKey(reference, verse));
  }
  const selectedKeySet = new Set(selectedKeys);
  const outgoing = new Map<string, AggregateBucket>();
  const incoming = new Map<string, AggregateBucket>();

  for (const key of selectedKeys) {
    const from = parseVerseKeyLabel(key);
    if (!from) continue;

    for (const link of openBibleStore?.byVerse[key] ?? []) {
      if (overlaps(reference, link.to)) continue;
      addEvidence(outgoing, "outgoing", from, link.to, "openbible", { votes: link.votes, rawReference: link.toLabel });
    }
    for (const link of phraseStore?.byVerse[key] ?? []) {
      if (overlaps(reference, link.to)) continue;
      addEvidence(outgoing, "outgoing", from, link.to, "crossreferences-kjv", { anchorPhrase: link.anchorPhrase, rawReference: link.toLabel });
    }
  }

  for (const [fromKey, links] of Object.entries(openBibleStore?.byVerse ?? {})) {
    const from = parseVerseKeyLabel(fromKey);
    if (!from || selectedKeySet.has(fromKey) || overlaps(from, reference)) continue;
    for (const link of links) {
      if (!overlaps(link.to, reference)) continue;
      addEvidence(incoming, "incoming", from, link.to, "openbible", { votes: link.votes, rawReference: link.toLabel });
    }
  }

  for (const [fromKey, links] of Object.entries(phraseStore?.byVerse ?? {})) {
    const from = parseVerseKeyLabel(fromKey);
    if (!from || selectedKeySet.has(fromKey) || overlaps(from, reference)) continue;
    for (const link of links) {
      if (!overlaps(link.to, reference)) continue;
      addEvidence(incoming, "incoming", from, link.to, "crossreferences-kjv", { anchorPhrase: link.anchorPhrase, rawReference: link.toLabel });
    }
  }

  const availableSources: CrossReferenceDatasetSource[] = [];
  if (openBibleStore?.source) availableSources.push("openbible");
  if (phraseStore?.source) availableSources.push("crossreferences-kjv");
  const missingSources = (["openbible", "crossreferences-kjv"] as const).filter((source) => !availableSources.includes(source));
  const sourceLinks: SourceLink[] = [];
  if (openBibleStore?.source?.url) sourceLinks.push({ label: openBibleStore.source.name, url: openBibleStore.source.url });
  if (phraseStore?.source?.url) sourceLinks.push({ label: phraseStore.source.name, url: phraseStore.source.url });
  const sourceVersions: Array<{ source: CrossReferenceDatasetSource; retrievedAt?: string; license?: string }> = [];
  if (openBibleStore?.source) sourceVersions.push({ source: "openbible", retrievedAt: openBibleStore.source.retrievedAt, license: openBibleStore.source.license });
  if (phraseStore?.source) sourceVersions.push({ source: "crossreferences-kjv", retrievedAt: phraseStore.source.retrievedAt, license: phraseStore.source.license });

  return {
    outgoing: finalizeAggregates(outgoing),
    incoming: finalizeAggregates(incoming),
    availableSources,
    missingSources,
    runtimeSource: "json-fallback",
    notes: ["Incoming links are reverse-indexed from the same source stores.", "JSON fallback path is enabled."],
    sourceLinks,
    sourceVersions,
  };
}

export async function getPassageCrossReferenceAggregates(reference: BibleReference): Promise<CrossReferenceAggregateBundle> {
  if (openCrossRefDb()) {
    return aggregateViaSqlite(reference);
  }
  if (ALLOW_CROSSREF_JSON_FALLBACK) {
    return aggregateViaJsonFallback(reference);
  }
  return {
    outgoing: [],
    incoming: [],
    availableSources: [],
    missingSources: ["openbible", "crossreferences-kjv"],
    runtimeSource: "unavailable",
    notes: ["Cross-reference SQLite store is unavailable and JSON fallback is disabled."],
    sourceLinks: [],
    sourceVersions: [],
  };
}

export async function getPassageCrossReferences(reference: BibleReference, limit = 6, locale?: string) {
  const appLocale = resolveAppLocale(locale);
  const books = await loadBookMetadata(appLocale);
  const aggregated = await getPassageCrossReferenceAggregates(reference);
  const ranked = aggregated.outgoing.slice(0, limit);

  return Promise.all(
    ranked.map(async (entry) => {
      const passage = await getPassage(entry.to, appLocale);
      const title = passage.book?.name ?? books[entry.to.code]?.name ?? entry.to.code;
      const excerpt = passage.verses.map((verse) => `${verse.verse}. ${verse.text}`).join(" ");
      const parts: string[] = [];
      if (entry.votes > 0) {
        parts.push(appLocale === "ko" ? `OpenBible 투표 ${entry.votes}` : `${entry.votes} OpenBible votes`);
      }
      if (entry.phraseAnchors.length > 0) {
        const phrases = entry.phraseAnchors.slice(0, 3).join(", ");
        parts.push(appLocale === "ko" ? `KJV 앵커: ${phrases}` : `KJV anchors: ${phrases}`);
      }
      const supportType = classifySupportType(entry.votes, new Set(entry.phraseAnchors));
      const targetLabel = formatBibleReference(entry.to, title);
      return {
        target: entry.to,
        targetLabel: appLocale === "ko" ? targetLabel : targetLabel,
        displayReference: targetLabel,
        title,
        excerpt: excerpt.length > 200 ? `${excerpt.slice(0, 200)}…` : excerpt,
        score: entry.score,
        supportType,
        supportLabel: localizeCrossReferenceSupportType(supportType, appLocale),
        supportLine: parts.join(" · "),
        sources: [...new Set(entry.evidence.map((item) => item.sourceName))],
      } satisfies CrossReferenceSuggestion;
    }),
  );
}
