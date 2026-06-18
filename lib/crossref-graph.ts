import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  formatBibleReference,
  getPassage,
  loadBookMetadata,
  serializeBibleReference,
  type BibleLocale,
  type BibleReference,
  type BibleVerse,
  type BookMeta,
} from "@/lib/bible";
import type { ContextNote, SourceLink } from "@/lib/app-data";
import { getBookMetadata, type BookMetadata } from "@/lib/book-metadata";
import { resolveAppLocale, type AppLocale } from "@/lib/content";

export type ReferenceSpan = BibleReference;

export type CrossReferenceSource = "openbible" | "crossreferences-kjv" | "tsk" | "sefaria" | "curated";

export type CrossReferenceRelationType =
  | "consensus-link"
  | "vote-supported"
  | "phrase-anchor"
  | "incoming"
  | "outgoing"
  | "mutual";

export type CrossReferenceDirection = "outgoing" | "incoming" | "mutual";

export type CrossReferenceEdgeEvidence = {
  source: CrossReferenceSource;
  sourceName: string;
  sourceUrl?: string;
  license?: string;
  votes?: number;
  anchorPhrases: string[];
  anchorVerses: ReferenceSpan[];
  rawReferences: string[];
};

export type CrossReferenceEdge = {
  id: string;
  from: ReferenceSpan;
  to: ReferenceSpan;
  direction: CrossReferenceDirection;
  relationTypes: CrossReferenceRelationType[];
  evidence: CrossReferenceEdgeEvidence[];
  score: number;
  sourceCount: number;
  totalVotes: number;
  anchorPhrases: string[];
  displayReference: string;
  excerpt: string;
  href: string;
};

export type CrossReferenceDataQuality = {
  skippedSourceRows: number;
  unsupportedRanges: number;
  collapsedRanges: number;
  missingCanonVerses: number;
  normalizationLoss: Array<{ source: CrossReferenceSource; rawReference: string; normalized: ReferenceSpan; reason: string }>;
  missingSources: CrossReferenceSource[];
  availableSources: CrossReferenceSource[];
  notes: string[];
};

export type CrossReferenceNetworkSummary = {
  reference: BibleReference;
  totalEdges: number;
  outgoingCount: number;
  incomingCount: number;
  mutualCount: number;
  consensusCount: number;
  voteSupportedCount: number;
  phraseAnchorCount: number;
  booksTouched: Array<{ code: string; name: string; count: number }>;
  canonSectionsTouched: Array<{ section: string; count: number }>;
  strongestSources: Array<{ source: CrossReferenceSource; count: number }>;
  strongestBooks: Array<{ code: string; name: string; count: number; maxScore: number }>;
  scopeLabel: string;
  coverageNote: string;
};

export type PassagePayload = {
  book: BookMeta | undefined;
  reference: string;
  referenceSpan: BibleReference;
  verses: BibleVerse[];
  href: string;
};

export type CrossReferenceReceptionLayers = {
  originalContext: {
    metadata: BookMetadata | null;
    surroundingContext: PassagePayload | null;
  };
  reception: {
    jewishReception?: ContextNote;
    jesusLayer?: ContextNote;
    paulLayer?: ContextNote;
  };
};

export type CrossReferenceBookGroup = {
  code: string;
  name: string;
  count: number;
  edges: CrossReferenceEdge[];
  background: CrossReferenceReceptionLayers | null;
};

export type CrossReferenceCanonSectionGroup = {
  section: string;
  count: number;
  edges: CrossReferenceEdge[];
};

export type CrossReferenceRelationGroup = {
  relationType: CrossReferenceRelationType;
  label: string;
  count: number;
  edges: CrossReferenceEdge[];
};

export type CrossReferenceSourceGroup = {
  source: CrossReferenceSource;
  sourceName: string;
  count: number;
  edges: CrossReferenceEdge[];
};

export type CrossReferenceNetwork = {
  primary: PassagePayload;
  summary: CrossReferenceNetworkSummary;
  highlights: CrossReferenceEdge[];
  all: {
    outgoing: CrossReferenceEdge[];
    incoming: CrossReferenceEdge[];
    mutual: CrossReferenceEdge[];
  };
  grouped: {
    byBook: CrossReferenceBookGroup[];
    byCanonSection: CrossReferenceCanonSectionGroup[];
    byRelation: CrossReferenceRelationGroup[];
    bySource: CrossReferenceSourceGroup[];
  };
  background: {
    primaryBook: CrossReferenceReceptionLayers;
    relatedBooks: Array<{ code: string; name: string; edgeCount: number; context: CrossReferenceReceptionLayers }>;
    coverageNote: string;
  };
  dataQuality: CrossReferenceDataQuality;
  sources: SourceLink[];
  version: {
    generatedAt: string;
    sourceVersions: Array<{ source: CrossReferenceSource; retrievedAt?: string; license?: string }>;
  };
};

export type CrossReferenceNetworkOptions = {
  locale?: string;
  highlightLimit?: number;
  includeExcerpts?: "preview" | "none" | "full";
  includeBackground?: boolean;
  summaryOnly?: boolean;
};

type CrossReferenceStoreSource = {
  name: string;
  url?: string;
  license?: string;
  retrievedAt?: string;
};

type StoreStats = {
  anchors?: number;
  edges?: number;
  skipped?: number;
  skippedSourceRows?: number;
  unsupportedRanges?: number;
  collapsedRanges?: number;
};

type OpenBibleStore = {
  source: CrossReferenceStoreSource;
  stats?: StoreStats;
  byVerse: Record<string, Array<{ to: ReferenceSpan; toLabel?: string; votes: number; source?: string; rawFrom?: string; rawTo?: string; normalizationLoss?: boolean }>>;
};

type PhraseStore = {
  source: CrossReferenceStoreSource;
  stats?: StoreStats;
  byVerse: Record<string, Array<{ anchorPhrase: string; to: ReferenceSpan; toLabel?: string; source?: string; rawTarget?: string }>>;
};

type SourceEvidenceSeed = {
  source: CrossReferenceSource;
  sourceName: string;
  sourceUrl?: string;
  license?: string;
  votes: number;
  anchorPhrase?: string;
  anchorVerse: ReferenceSpan;
  rawReference?: string;
};

type EdgeSeed = {
  from: ReferenceSpan;
  to: ReferenceSpan;
  evidence: SourceEvidenceSeed;
};

type IndexedCrossReferences = {
  outgoingByAnchor: Map<string, EdgeSeed[]>;
  incomingByTarget: Map<string, EdgeSeed[]>;
  dataQuality: CrossReferenceDataQuality;
  sources: SourceLink[];
  sourceVersions: Array<{ source: CrossReferenceSource; retrievedAt?: string; license?: string }>;
};

type EdgeAggregate = {
  from: ReferenceSpan;
  to: ReferenceSpan;
  direction: Exclude<CrossReferenceDirection, "mutual">;
  evidenceBySource: Map<CrossReferenceSource, CrossReferenceEdgeEvidence>;
  totalVotes: number;
  anchorPhrases: Set<string>;
};

const ROOT = process.cwd();
const OPENBIBLE_PATH = path.join("data", "knowledge", "openbible-crossrefs.json");
const PHRASE_PATH = path.join("data", "knowledge", "crossreferences-kjv.json");
const NETWORK_VERSION_GENERATED_AT = "2026-06-18T00:00:00Z";
const PREVIEW_LIMIT = 220;

const SOURCE_NAMES: Record<CrossReferenceSource, string> = {
  openbible: "OpenBible Cross References",
  "crossreferences-kjv": "Bible Cross References KJV",
  tsk: "Treasury of Scripture Knowledge",
  sefaria: "Sefaria",
  curated: "Curated",
};

const CANON_SECTIONS: Array<{ section: string; codes: readonly string[] }> = [
  { section: "Torah", codes: ["GEN", "EXO", "LEV", "NUM", "DEU"] },
  { section: "History", codes: ["JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST"] },
  { section: "Poetry and Wisdom", codes: ["JOB", "PSA", "PRO", "ECC", "SOL"] },
  { section: "Major Prophets", codes: ["ISA", "JER", "LAM", "EZE", "DAN"] },
  { section: "Minor Prophets", codes: ["HOS", "JOE", "AMO", "OBA", "JON", "MIC", "NAH", "HAB", "ZEP", "HAG", "ZEC", "MAL"] },
  { section: "Gospels", codes: ["MAT", "MAR", "LUK", "JOH"] },
  { section: "Acts", codes: ["ACT"] },
  { section: "Pauline Letters", codes: ["ROM", "1CO", "2CO", "GAL", "EPH", "PHI", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM"] },
  { section: "General Letters", codes: ["HEB", "JAM", "1PE", "2PE", "1JO", "2JO", "3JO", "JUD"] },
  { section: "Apocalyptic", codes: ["REV"] },
];

const RELATION_LABELS: Record<CrossReferenceRelationType, string> = {
  "consensus-link": "Consensus link",
  "vote-supported": "OpenBible vote-supported",
  "phrase-anchor": "KJV phrase anchor",
  incoming: "Incoming",
  outgoing: "Outgoing",
  mutual: "Mutual",
};

async function loadJson<T>(relativePath: string): Promise<T | null> {
  try {
    const raw = await readFile(path.join(ROOT, relativePath), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function cloneReference(reference: ReferenceSpan): ReferenceSpan {
  return {
    code: reference.code,
    chapter: reference.chapter,
    startVerse: reference.startVerse,
    endVerse: reference.endVerse,
  };
}

function spanKey(reference: ReferenceSpan): string {
  return serializeBibleReference(reference);
}

function directedEdgeKey(from: ReferenceSpan, to: ReferenceSpan): string {
  return `${spanKey(from)}>${spanKey(to)}`;
}

function unorderedPairKey(from: ReferenceSpan, to: ReferenceSpan): string {
  const left = spanKey(from);
  const right = spanKey(to);
  return left < right ? `${left}<>${right}` : `${right}<>${left}`;
}

function verseKey(reference: ReferenceSpan, verse = reference.startVerse): string {
  return `${reference.code} ${reference.chapter}:${verse}`;
}

function parseVerseKey(key: string): ReferenceSpan | null {
  const match = key.match(/^([0-9A-Z]{3}) (\d+):(\d+)$/);
  if (!match) return null;
  const [, code, chapter, verse] = match;
  return { code, chapter: Number(chapter), startVerse: Number(verse), endVerse: Number(verse) };
}

function addToMapList<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) {
    list.push(value);
  } else {
    map.set(key, [value]);
  }
}

function eachVerseKey(reference: ReferenceSpan): string[] {
  const keys: string[] = [];
  for (let verse = reference.startVerse; verse <= reference.endVerse; verse += 1) {
    keys.push(verseKey(reference, verse));
  }
  return keys;
}

function overlaps(left: ReferenceSpan, right: ReferenceSpan): boolean {
  return left.code === right.code && left.chapter === right.chapter && !(right.endVerse < left.startVerse || right.startVerse > left.endVerse);
}

function addSeedToIncoming(index: Map<string, EdgeSeed[]>, seed: EdgeSeed): void {
  for (let verse = seed.to.startVerse; verse <= seed.to.endVerse; verse += 1) {
    addToMapList(index, verseKey(seed.to, verse), seed);
  }
}

function sourceLink(source: CrossReferenceStoreSource): SourceLink | null {
  return source.url ? { label: source.name, url: source.url } : null;
}

function addStats(dataQuality: CrossReferenceDataQuality, source: CrossReferenceSource, stats?: StoreStats): void {
  dataQuality.skippedSourceRows += stats?.skippedSourceRows ?? stats?.skipped ?? 0;
  dataQuality.unsupportedRanges += stats?.unsupportedRanges ?? 0;
  dataQuality.collapsedRanges += stats?.collapsedRanges ?? 0;
  if (stats && stats.collapsedRanges === undefined) {
    dataQuality.notes.push(`${SOURCE_NAMES[source]} store does not include per-row range-collapse accounting; current graph preserves available normalized spans only.`);
  }
}

function buildSourceEvidence(
  source: CrossReferenceSource,
  storeSource: CrossReferenceStoreSource,
  anchorVerse: ReferenceSpan,
  values: { votes?: number; anchorPhrase?: string; rawReference?: string },
): SourceEvidenceSeed {
  return {
    source,
    sourceName: storeSource.name,
    sourceUrl: storeSource.url,
    license: storeSource.license,
    votes: values.votes ?? 0,
    anchorPhrase: values.anchorPhrase,
    anchorVerse,
    rawReference: values.rawReference,
  };
}

function indexOpenBible(store: OpenBibleStore, index: IndexedCrossReferences): void {
  index.dataQuality.availableSources.push("openbible");
  addStats(index.dataQuality, "openbible", store.stats);
  const link = sourceLink(store.source);
  if (link) index.sources.push(link);
  index.sourceVersions.push({ source: "openbible", retrievedAt: store.source.retrievedAt, license: store.source.license });

  for (const [fromKey, links] of Object.entries(store.byVerse)) {
    const from = parseVerseKey(fromKey);
    if (!from) {
      index.dataQuality.skippedSourceRows += links.length;
      continue;
    }

    for (const link of links) {
      const to = cloneReference(link.to);
      const seed: EdgeSeed = {
        from,
        to,
        evidence: buildSourceEvidence("openbible", store.source, from, {
          votes: link.votes,
          rawReference: link.rawTo,
        }),
      };
      if (link.normalizationLoss) {
        index.dataQuality.normalizationLoss.push({
          source: "openbible",
          rawReference: link.rawTo ?? link.toLabel ?? spanKey(to),
          normalized: to,
          reason: "Source range crossed a book or chapter boundary and was normalized to a renderable span by ingest.",
        });
      }
      addToMapList(index.outgoingByAnchor, fromKey, seed);
      addSeedToIncoming(index.incomingByTarget, seed);
    }
  }
}

function indexPhraseStore(store: PhraseStore, index: IndexedCrossReferences): void {
  index.dataQuality.availableSources.push("crossreferences-kjv");
  addStats(index.dataQuality, "crossreferences-kjv", store.stats);
  const link = sourceLink(store.source);
  if (link) index.sources.push(link);
  index.sourceVersions.push({ source: "crossreferences-kjv", retrievedAt: store.source.retrievedAt, license: store.source.license });

  for (const [fromKey, links] of Object.entries(store.byVerse)) {
    const from = parseVerseKey(fromKey);
    if (!from) {
      index.dataQuality.skippedSourceRows += links.length;
      continue;
    }

    for (const link of links) {
      const to = cloneReference(link.to);
      const seed: EdgeSeed = {
        from,
        to,
        evidence: buildSourceEvidence("crossreferences-kjv", store.source, from, {
          anchorPhrase: link.anchorPhrase,
          rawReference: link.rawTarget,
        }),
      };
      addToMapList(index.outgoingByAnchor, fromKey, seed);
      addSeedToIncoming(index.incomingByTarget, seed);
    }
  }
}

const loadCrossReferenceIndex = cache(async (): Promise<IndexedCrossReferences> => {
  const [openBibleStore, phraseStore] = await Promise.all([
    loadJson<OpenBibleStore>(OPENBIBLE_PATH),
    loadJson<PhraseStore>(PHRASE_PATH),
  ]);
  const index: IndexedCrossReferences = {
    outgoingByAnchor: new Map(),
    incomingByTarget: new Map(),
    dataQuality: {
      skippedSourceRows: 0,
      unsupportedRanges: 0,
      collapsedRanges: 0,
      missingCanonVerses: 0,
      normalizationLoss: [],
      missingSources: [],
      availableSources: [],
      notes: ["Network is one-hop direct only. Incoming links are reverse-indexed from the same source stores."],
    },
    sources: [],
    sourceVersions: [],
  };

  if (openBibleStore) {
    indexOpenBible(openBibleStore, index);
  } else {
    index.dataQuality.missingSources.push("openbible");
    index.dataQuality.notes.push("OpenBible Cross References store is unavailable; vote-supported links are omitted.");
  }

  if (phraseStore) {
    indexPhraseStore(phraseStore, index);
  } else {
    index.dataQuality.missingSources.push("crossreferences-kjv");
    index.dataQuality.notes.push("Bible Cross References KJV store is unavailable; phrase-anchor links are omitted.");
  }

  return index;
});

function addEvidence(aggregate: EdgeAggregate, seed: EdgeSeed): void {
  const source = seed.evidence.source;
  let evidence = aggregate.evidenceBySource.get(source);
  if (!evidence) {
    evidence = {
      source,
      sourceName: seed.evidence.sourceName,
      sourceUrl: seed.evidence.sourceUrl,
      license: seed.evidence.license,
      votes: undefined,
      anchorPhrases: [],
      anchorVerses: [],
      rawReferences: [],
    };
    aggregate.evidenceBySource.set(source, evidence);
  }

  if (seed.evidence.votes > 0) {
    evidence.votes = (evidence.votes ?? 0) + seed.evidence.votes;
    aggregate.totalVotes += seed.evidence.votes;
  }

  if (seed.evidence.anchorPhrase && !evidence.anchorPhrases.includes(seed.evidence.anchorPhrase)) {
    evidence.anchorPhrases.push(seed.evidence.anchorPhrase);
    aggregate.anchorPhrases.add(seed.evidence.anchorPhrase);
  }

  const anchorKey = spanKey(seed.evidence.anchorVerse);
  if (!evidence.anchorVerses.some((item) => spanKey(item) === anchorKey)) {
    evidence.anchorVerses.push(cloneReference(seed.evidence.anchorVerse));
  }

  if (seed.evidence.rawReference && !evidence.rawReferences.includes(seed.evidence.rawReference)) {
    evidence.rawReferences.push(seed.evidence.rawReference);
  }
}

function collectAggregates(reference: ReferenceSpan, index: IndexedCrossReferences): EdgeAggregate[] {
  const aggregates = new Map<string, EdgeAggregate>();

  function add(direction: Exclude<CrossReferenceDirection, "mutual">, seed: EdgeSeed): void {
    if (direction === "outgoing" && overlaps(reference, seed.to)) return;
    if (direction === "incoming" && overlaps(reference, seed.from)) return;
    const from = seed.from;
    const to = seed.to;
    const key = `${direction}:${directedEdgeKey(from, to)}`;
    let aggregate = aggregates.get(key);
    if (!aggregate) {
      aggregate = {
        from: cloneReference(from),
        to: cloneReference(to),
        direction,
        evidenceBySource: new Map(),
        totalVotes: 0,
        anchorPhrases: new Set(),
      };
      aggregates.set(key, aggregate);
    }
    addEvidence(aggregate, seed);
  }

  const seenOutgoing = new Set<string>();
  const seenIncoming = new Set<string>();
  for (const key of eachVerseKey(reference)) {
    for (const seed of index.outgoingByAnchor.get(key) ?? []) {
      const seedKey = `${directedEdgeKey(seed.from, seed.to)}:${seed.evidence.source}:${seed.evidence.anchorPhrase ?? ""}:${seed.evidence.votes}`;
      if (seenOutgoing.has(seedKey)) continue;
      seenOutgoing.add(seedKey);
      add("outgoing", seed);
    }
    for (const seed of index.incomingByTarget.get(key) ?? []) {
      const seedKey = `${directedEdgeKey(seed.from, seed.to)}:${seed.evidence.source}:${seed.evidence.anchorPhrase ?? ""}:${seed.evidence.votes}`;
      if (seenIncoming.has(seedKey)) continue;
      seenIncoming.add(seedKey);
      add("incoming", seed);
    }
  }

  return [...aggregates.values()];
}

function relationTypesFor(aggregate: EdgeAggregate, isMutual: boolean): CrossReferenceRelationType[] {
  const relations: CrossReferenceRelationType[] = [aggregate.direction];
  if (aggregate.totalVotes > 0 && aggregate.anchorPhrases.size > 0) relations.push("consensus-link");
  if (aggregate.totalVotes > 0) relations.push("vote-supported");
  if (aggregate.anchorPhrases.size > 0) relations.push("phrase-anchor");
  if (isMutual) relations.push("mutual");
  return relations;
}

function edgeScore(aggregate: EdgeAggregate, isMutual: boolean): number {
  return aggregate.totalVotes + aggregate.anchorPhrases.size * 12 + aggregate.evidenceBySource.size * 25 + (isMutual ? 20 : 0);
}

function linkedReference(edge: CrossReferenceEdge): ReferenceSpan {
  return edge.direction === "incoming" ? edge.from : edge.to;
}

function sortEdges(left: CrossReferenceEdge, right: CrossReferenceEdge): number {
  return right.score - left.score || left.displayReference.localeCompare(right.displayReference) || left.id.localeCompare(right.id);
}

function canonSectionFor(code: string): string {
  return CANON_SECTIONS.find((section) => section.codes.includes(code))?.section ?? "Canon";
}

function clampHighlightLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 8;
  return Math.min(12, Math.max(4, Math.trunc(limit ?? 8)));
}

function coverageNote(locale: AppLocale, dataQuality: CrossReferenceDataQuality): string {
  const degraded = dataQuality.missingSources.length > 0;
  if (locale === "ko") {
    return degraded
      ? "일부 상호참조 저장소가 없어, 사용 가능한 수집 데이터셋 기준의 1-hop 직접 연결과 역색인된 들어오는 참조만 표시합니다."
      : "수집된 OpenBible 및 Bible Cross References KJV 데이터셋 기준 전체 1-hop 직접 연결입니다. 들어오는 참조는 같은 저장소에서 역색인했습니다.";
  }
  return degraded
    ? "Some cross-reference stores are unavailable, so this shows one-hop direct links and reverse-indexed incoming links from the available ingested datasets."
    : "All direct one-hop links available in the ingested OpenBible and Bible Cross References KJV datasets. Incoming links are reverse-indexed from the same stores.";
}

function passagePayload(passage: { book: BookMeta | undefined; reference: string; verses: BibleVerse[] }, reference: ReferenceSpan, locale: BibleLocale): PassagePayload {
  return {
    ...passage,
    referenceSpan: cloneReference(reference),
    href: `/${locale}/passage/${serializeBibleReference(reference)}`,
  };
}

async function edgeFromAggregate(
  aggregate: EdgeAggregate,
  locale: BibleLocale,
  includeExcerpts: "preview" | "none" | "full",
  mutualEdgeKeys: Set<string>,
): Promise<CrossReferenceEdge> {
  const isMutual = mutualEdgeKeys.has(directedEdgeKey(aggregate.from, aggregate.to));
  const linked = aggregate.direction === "outgoing" ? aggregate.to : aggregate.from;
  const passage = await getPassage(linked, locale);
  const bookName = passage.book?.name ?? linked.code;
  const fullExcerpt = includeExcerpts === "none" ? "" : passage.verses.map((verse) => `${verse.verse}. ${verse.text}`).join(" ");
  const excerpt = includeExcerpts === "preview" && fullExcerpt.length > PREVIEW_LIMIT ? `${fullExcerpt.slice(0, PREVIEW_LIMIT)}…` : fullExcerpt;
  const id = `crossref:v1:${aggregate.direction}:${spanKey(aggregate.from)}:${spanKey(aggregate.to)}`;
  return {
    id,
    from: cloneReference(aggregate.from),
    to: cloneReference(aggregate.to),
    direction: aggregate.direction,
    relationTypes: relationTypesFor(aggregate, isMutual),
    evidence: [...aggregate.evidenceBySource.values()].sort((left, right) => left.source.localeCompare(right.source)),
    score: edgeScore(aggregate, isMutual),
    sourceCount: aggregate.evidenceBySource.size,
    totalVotes: aggregate.totalVotes,
    anchorPhrases: [...aggregate.anchorPhrases].sort(),
    displayReference: formatBibleReference(linked, bookName),
    excerpt,
    href: `/${locale}/passage/${serializeBibleReference(linked)}`,
  };
}

function copyAsMutual(edge: CrossReferenceEdge): CrossReferenceEdge {
  return {
    ...edge,
    direction: "mutual",
    relationTypes: edge.relationTypes.includes("mutual") ? edge.relationTypes : [...edge.relationTypes, "mutual"],
  };
}

function buildSummary(
  reference: ReferenceSpan,
  edges: CrossReferenceEdge[],
  outgoing: CrossReferenceEdge[],
  incoming: CrossReferenceEdge[],
  mutualPairKeys: Set<string>,
  books: Record<string, BookMeta>,
  locale: AppLocale,
  dataQuality: CrossReferenceDataQuality,
): CrossReferenceNetworkSummary {
  const bookCounts = new Map<string, { count: number; maxScore: number }>();
  const sectionCounts = new Map<string, number>();
  const sourceCounts = new Map<CrossReferenceSource, number>();
  let consensusCount = 0;
  let voteSupportedCount = 0;
  let phraseAnchorCount = 0;

  for (const edge of edges) {
    const linked = linkedReference(edge);
    const existing = bookCounts.get(linked.code) ?? { count: 0, maxScore: 0 };
    existing.count += 1;
    existing.maxScore = Math.max(existing.maxScore, edge.score);
    bookCounts.set(linked.code, existing);
    const section = canonSectionFor(linked.code);
    sectionCounts.set(section, (sectionCounts.get(section) ?? 0) + 1);
    for (const evidence of edge.evidence) {
      sourceCounts.set(evidence.source, (sourceCounts.get(evidence.source) ?? 0) + 1);
    }
    if (edge.relationTypes.includes("consensus-link")) consensusCount += 1;
    if (edge.relationTypes.includes("vote-supported")) voteSupportedCount += 1;
    if (edge.relationTypes.includes("phrase-anchor")) phraseAnchorCount += 1;
  }

  const booksTouched = [...bookCounts.entries()]
    .map(([code, value]) => ({ code, name: books[code]?.name ?? code, count: value.count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));

  return {
    reference,
    totalEdges: outgoing.length + incoming.length,
    outgoingCount: outgoing.length,
    incomingCount: incoming.length,
    mutualCount: mutualPairKeys.size,
    consensusCount,
    voteSupportedCount,
    phraseAnchorCount,
    booksTouched,
    canonSectionsTouched: [...sectionCounts.entries()]
      .map(([section, count]) => ({ section, count }))
      .sort((left, right) => right.count - left.count || left.section.localeCompare(right.section)),
    strongestSources: [...sourceCounts.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((left, right) => right.count - left.count || left.source.localeCompare(right.source)),
    strongestBooks: [...bookCounts.entries()]
      .map(([code, value]) => ({ code, name: books[code]?.name ?? code, count: value.count, maxScore: value.maxScore }))
      .sort((left, right) => right.maxScore - left.maxScore || right.count - left.count || left.name.localeCompare(right.name)),
    scopeLabel: locale === "ko" ? "수집된 상호참조 데이터셋 기준 전체 직접 연결" : "All direct links available in the ingested cross-reference datasets.",
    coverageNote: coverageNote(locale, dataQuality),
  };
}

function buildReceptionLayers(code: string, locale: AppLocale, surroundingContext: PassagePayload | null = null): CrossReferenceReceptionLayers {
  const metadata = getBookMetadata(code, locale) ?? null;
  return {
    originalContext: {
      metadata,
      surroundingContext,
    },
    reception: {},
  };
}

function groupByBook(edges: CrossReferenceEdge[], books: Record<string, BookMeta>, locale: AppLocale): CrossReferenceBookGroup[] {
  const grouped = new Map<string, CrossReferenceEdge[]>();
  for (const edge of edges) {
    const code = linkedReference(edge).code;
    addToMapList(grouped, code, edge);
  }
  return [...grouped.entries()]
    .map(([code, groupEdges]) => ({
      code,
      name: books[code]?.name ?? code,
      count: groupEdges.length,
      edges: groupEdges.sort(sortEdges),
      background: buildReceptionLayers(code, locale),
    }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

function groupByCanonSection(edges: CrossReferenceEdge[]): CrossReferenceCanonSectionGroup[] {
  const grouped = new Map<string, CrossReferenceEdge[]>();
  for (const edge of edges) {
    addToMapList(grouped, canonSectionFor(linkedReference(edge).code), edge);
  }
  return [...grouped.entries()]
    .map(([section, groupEdges]) => ({ section, count: groupEdges.length, edges: groupEdges.sort(sortEdges) }))
    .sort((left, right) => right.count - left.count || left.section.localeCompare(right.section));
}

function groupByRelation(edges: CrossReferenceEdge[]): CrossReferenceRelationGroup[] {
  const grouped = new Map<CrossReferenceRelationType, CrossReferenceEdge[]>();
  for (const edge of edges) {
    for (const relation of edge.relationTypes) {
      addToMapList(grouped, relation, edge);
    }
  }
  return [...grouped.entries()]
    .map(([relationType, groupEdges]) => ({ relationType, label: RELATION_LABELS[relationType], count: groupEdges.length, edges: groupEdges.sort(sortEdges) }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function groupBySource(edges: CrossReferenceEdge[]): CrossReferenceSourceGroup[] {
  const grouped = new Map<CrossReferenceSource, CrossReferenceEdge[]>();
  for (const edge of edges) {
    for (const evidence of edge.evidence) {
      addToMapList(grouped, evidence.source, edge);
    }
  }
  return [...grouped.entries()]
    .map(([source, groupEdges]) => ({ source, sourceName: SOURCE_NAMES[source], count: groupEdges.length, edges: groupEdges.sort(sortEdges) }))
    .sort((left, right) => right.count - left.count || left.sourceName.localeCompare(right.sourceName));
}

function buildBackground(
  reference: ReferenceSpan,
  summary: CrossReferenceNetworkSummary,
  locale: AppLocale,
  primary: PassagePayload,
): CrossReferenceNetwork["background"] {
  return {
    primaryBook: buildReceptionLayers(reference.code, locale, primary),
    relatedBooks: summary.booksTouched.map((book) => ({
      code: book.code,
      name: book.name,
      context: buildReceptionLayers(book.code, locale),
      edgeCount: book.count,
    })),
    coverageNote: locale === "ko" ? "배경 정보는 현재 책 단위 메타데이터와 본문 주변 문맥입니다. 절별 역사 정보로 표시하지 않습니다." : "Background is currently book-level metadata and passage context, not verse-specific history.",
  };
}

export async function getCrossReferenceNetwork(
  reference: BibleReference,
  options: CrossReferenceNetworkOptions = {},
): Promise<CrossReferenceNetwork> {
  const locale = resolveAppLocale(options.locale);
  const includeExcerpts = options.includeExcerpts ?? "preview";
  const includeBackground = options.includeBackground ?? true;
  const highlightLimit = clampHighlightLimit(options.highlightLimit);
  const [index, books, primary] = await Promise.all([
    loadCrossReferenceIndex(),
    loadBookMetadata(locale),
    getPassage(reference, locale),
  ]);

  const aggregates = collectAggregates(reference, index);
  const directedKeys = new Set(aggregates.map((aggregate) => directedEdgeKey(aggregate.from, aggregate.to)));
  const mutualEdgeKeys = new Set<string>();
  const mutualPairKeys = new Set<string>();
  for (const aggregate of aggregates) {
    if (directedKeys.has(directedEdgeKey(aggregate.to, aggregate.from))) {
      mutualEdgeKeys.add(directedEdgeKey(aggregate.from, aggregate.to));
      mutualPairKeys.add(unorderedPairKey(aggregate.from, aggregate.to));
    }
  }
  const hydrated = await Promise.all(
    aggregates.map((aggregate) => edgeFromAggregate(aggregate, locale, includeExcerpts, mutualEdgeKeys)),
  );
  const outgoing = hydrated.filter((edge) => edge.direction === "outgoing").sort(sortEdges);
  const incoming = hydrated.filter((edge) => edge.direction === "incoming").sort(sortEdges);
  const allEdges = [...outgoing, ...incoming].sort(sortEdges);
  const mutual = outgoing.filter((edge) => mutualEdgeKeys.has(directedEdgeKey(edge.from, edge.to))).map(copyAsMutual).sort(sortEdges);
  const dataQuality = {
    ...index.dataQuality,
    missingSources: [...index.dataQuality.missingSources],
    availableSources: [...index.dataQuality.availableSources],
    normalizationLoss: [...index.dataQuality.normalizationLoss],
    notes: [...index.dataQuality.notes],
  };
  const summary = buildSummary(reference, allEdges, outgoing, incoming, mutualPairKeys, books, locale, dataQuality);

  const primaryPayload = passagePayload(primary, reference, locale);
  return {
    primary: primaryPayload,
    summary,
    highlights: allEdges.slice(0, highlightLimit),
    all: {
      outgoing,
      incoming,
      mutual,
    },
    grouped: {
      byBook: options.summaryOnly ? [] : groupByBook(allEdges, books, locale),
      byCanonSection: options.summaryOnly ? [] : groupByCanonSection(allEdges),
      byRelation: options.summaryOnly ? [] : groupByRelation(allEdges),
      bySource: options.summaryOnly ? [] : groupBySource(allEdges),
    },
    background: includeBackground ? buildBackground(reference, summary, locale, primaryPayload) : { primaryBook: buildReceptionLayers(reference.code, locale, primaryPayload), relatedBooks: [], coverageNote: summary.coverageNote },
    dataQuality,
    sources: [...index.sources],
    version: {
      generatedAt: NETWORK_VERSION_GENERATED_AT,
      sourceVersions: [...index.sourceVersions],
    },
  };
}
