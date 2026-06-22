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
import {
  getPassageCrossReferenceAggregates,
  type CrossReferenceAggregateRecord,
  type CrossReferenceAggregateEvidence as AggregateEvidence,
  type CrossReferenceRuntimeSource,
} from "@/lib/knowledge";

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
  runtimeSource?: CrossReferenceRuntimeSource;
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

const NETWORK_VERSION_GENERATED_AT = "2026-06-21T00:00:00Z";
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
  { section: "Wisdom", codes: ["JOB", "PSA", "PRO", "ECC", "SNG"] },
  { section: "Major Prophets", codes: ["ISA", "JER", "LAM", "EZK", "DAN"] },
  { section: "Minor Prophets", codes: ["HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL"] },
  { section: "Gospels", codes: ["MAT", "MRK", "LUK", "JHN"] },
  { section: "Acts", codes: ["ACT"] },
  { section: "Pauline Epistles", codes: ["ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM"] },
  { section: "General Epistles", codes: ["HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD"] },
  { section: "Apocalypse", codes: ["REV"] },
];
const RELATION_LABELS: Record<CrossReferenceRelationType, string> = {
  "consensus-link": "Consensus link",
  "vote-supported": "Vote supported",
  "phrase-anchor": "Phrase anchor",
  outgoing: "Outgoing",
  incoming: "Incoming",
  mutual: "Mutual",
};

function cloneReference(reference: ReferenceSpan): ReferenceSpan {
  return { ...reference };
}

function spanKey(reference: ReferenceSpan) {
  return serializeBibleReference(reference);
}

function directedEdgeKey(from: ReferenceSpan, to: ReferenceSpan) {
  return `${spanKey(from)}>${spanKey(to)}`;
}

function unorderedPairKey(from: ReferenceSpan, to: ReferenceSpan) {
  return [spanKey(from), spanKey(to)].sort().join("<>");
}

function linkedReference(edge: CrossReferenceEdge): ReferenceSpan {
  return edge.direction === "incoming" ? edge.from : edge.to;
}

function linkedReferenceForAggregate(aggregate: CrossReferenceAggregateRecord): ReferenceSpan {
  return aggregate.direction === "incoming" ? aggregate.from : aggregate.to;
}

function relationTypesFor(aggregate: CrossReferenceAggregateRecord, isMutual: boolean): CrossReferenceRelationType[] {
  const relations: CrossReferenceRelationType[] = [aggregate.direction];
  if (aggregate.votes > 0 && aggregate.phraseAnchors.length > 0) relations.push("consensus-link");
  if (aggregate.votes > 0) relations.push("vote-supported");
  if (aggregate.phraseAnchors.length > 0) relations.push("phrase-anchor");
  if (isMutual) relations.push("mutual");
  return [...new Set(relations)];
}

function edgeScore(aggregate: CrossReferenceAggregateRecord, isMutual: boolean) {
  return aggregate.score + aggregate.evidence.length * 25 + (isMutual ? 20 : 0);
}

function sortEdges(left: CrossReferenceEdge, right: CrossReferenceEdge): number {
  return right.score - left.score || left.displayReference.localeCompare(right.displayReference) || left.id.localeCompare(right.id);
}

function canonSectionFor(code: string): string {
  return CANON_SECTIONS.find((section) => section.codes.includes(code))?.section ?? "Canon";
}

function clampHighlightLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 4;
  return Math.max(1, Math.min(12, Math.trunc(limit ?? 4)));
}

function coverageNote(locale: AppLocale, dataQuality: CrossReferenceDataQuality) {
  const sourceNote = dataQuality.missingSources.length
    ? locale === "ko"
      ? `누락된 데이터셋: ${dataQuality.missingSources.join(", ")}`
      : `Missing datasets: ${dataQuality.missingSources.join(", ")}`
    : locale === "ko"
      ? "SQLite 기반 상호참조 데이터셋 전체 직접 연결입니다."
      : "All direct links available in the SQLite-backed cross-reference datasets.";
  return `${sourceNote} ${dataQuality.notes.join(" ")}`.trim();
}

function passagePayload(
  passage: { book: BookMeta | undefined; reference: string; verses: BibleVerse[] },
  reference: ReferenceSpan,
  locale: BibleLocale,
): PassagePayload {
  return {
    book: passage.book,
    reference: passage.reference,
    referenceSpan: cloneReference(reference),
    verses: passage.verses.map((verse) => ({ ...verse })),
    href: `/${locale}/passage/${serializeBibleReference(reference)}`,
  };
}

async function edgeFromAggregate(
  aggregate: CrossReferenceAggregateRecord,
  locale: BibleLocale,
  includeExcerpts: "preview" | "none" | "full",
  mutualEdgeKeys: Set<string>,
): Promise<CrossReferenceEdge> {
  const isMutual = mutualEdgeKeys.has(directedEdgeKey(aggregate.from, aggregate.to));
  const linked = linkedReferenceForAggregate(aggregate);
  const passage = await getPassage(linked, locale);
  const bookName = passage.book?.name ?? linked.code;
  const fullExcerpt = includeExcerpts === "none" ? "" : passage.verses.map((verse) => `${verse.verse}. ${verse.text}`).join(" ");
  const excerpt = includeExcerpts === "preview" && fullExcerpt.length > PREVIEW_LIMIT ? `${fullExcerpt.slice(0, PREVIEW_LIMIT)}…` : fullExcerpt;
  const id = `crossref:v2:${aggregate.direction}:${spanKey(aggregate.from)}:${spanKey(aggregate.to)}`;
  return {
    id,
    from: cloneReference(aggregate.from),
    to: cloneReference(aggregate.to),
    direction: aggregate.direction,
    relationTypes: relationTypesFor(aggregate, isMutual),
    evidence: aggregate.evidence.map((item) => ({ ...item, anchorVerses: item.anchorVerses.map(cloneReference) })) as CrossReferenceEdgeEvidence[],
    score: edgeScore(aggregate, isMutual),
    sourceCount: aggregate.evidence.length,
    totalVotes: aggregate.votes,
    anchorPhrases: [...aggregate.phraseAnchors],
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

function buildSummaryFromAggregates(
  reference: ReferenceSpan,
  aggregates: CrossReferenceAggregateRecord[],
  mutualPairKeys: Set<string>,
  books: Record<string, BookMeta>,
  locale: AppLocale,
  dataQuality: CrossReferenceDataQuality,
): CrossReferenceNetworkSummary {
  const bookCounts = new Map<string, { count: number; maxScore: number }>();
  const sectionCounts = new Map<string, number>();
  const sourceCounts = new Map<CrossReferenceSource, number>();
  let outgoingCount = 0;
  let incomingCount = 0;
  let consensusCount = 0;
  let voteSupportedCount = 0;
  let phraseAnchorCount = 0;

  for (const aggregate of aggregates) {
    if (aggregate.direction === "outgoing") outgoingCount += 1;
    else incomingCount += 1;

    const linked = linkedReferenceForAggregate(aggregate);
    const score = edgeScore(aggregate, mutualPairKeys.has(unorderedPairKey(aggregate.from, aggregate.to)));
    const existing = bookCounts.get(linked.code) ?? { count: 0, maxScore: 0 };
    existing.count += 1;
    existing.maxScore = Math.max(existing.maxScore, score);
    bookCounts.set(linked.code, existing);
    const section = canonSectionFor(linked.code);
    sectionCounts.set(section, (sectionCounts.get(section) ?? 0) + 1);

    for (const evidence of aggregate.evidence) {
      sourceCounts.set(evidence.source, (sourceCounts.get(evidence.source) ?? 0) + 1);
    }

    if (aggregate.votes > 0 && aggregate.phraseAnchors.length > 0) consensusCount += 1;
    if (aggregate.votes > 0) voteSupportedCount += 1;
    if (aggregate.phraseAnchors.length > 0) phraseAnchorCount += 1;
  }

  const booksTouched = [...bookCounts.entries()]
    .map(([code, value]) => ({ code, name: books[code]?.name ?? code, count: value.count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));

  return {
    reference,
    totalEdges: outgoingCount + incomingCount,
    outgoingCount,
    incomingCount,
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
    scopeLabel: locale === "ko" ? "SQLite 기반으로 수집된 상호참조 데이터셋의 직접 연결" : "Direct links available in the SQLite-backed cross-reference datasets.",
    coverageNote: coverageNote(locale, dataQuality),
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
  return buildSummaryFromAggregates(
    reference,
    [...outgoing, ...incoming].map((edge) => ({
      from: edge.from,
      to: edge.to,
      direction: edge.direction === "mutual" ? "outgoing" : edge.direction,
      votes: edge.totalVotes,
      phraseAnchors: edge.anchorPhrases,
      evidence: edge.evidence as AggregateEvidence[],
      score: edge.score,
    })),
    mutualPairKeys,
    books,
    locale,
    dataQuality,
  );
}

function buildReceptionLayers(code: string, _locale: AppLocale, surroundingContext: PassagePayload | null = null): CrossReferenceReceptionLayers {
  const metadata = getBookMetadata(code, _locale) ?? null;
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
    const bucket = grouped.get(code);
    if (bucket) bucket.push(edge);
    else grouped.set(code, [edge]);
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
    const key = canonSectionFor(linkedReference(edge).code);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(edge);
    else grouped.set(key, [edge]);
  }
  return [...grouped.entries()]
    .map(([section, groupEdges]) => ({ section, count: groupEdges.length, edges: groupEdges.sort(sortEdges) }))
    .sort((left, right) => right.count - left.count || left.section.localeCompare(right.section));
}

function groupByRelation(edges: CrossReferenceEdge[]): CrossReferenceRelationGroup[] {
  const grouped = new Map<CrossReferenceRelationType, CrossReferenceEdge[]>();
  for (const edge of edges) {
    for (const relation of edge.relationTypes) {
      const bucket = grouped.get(relation);
      if (bucket) bucket.push(edge);
      else grouped.set(relation, [edge]);
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
      const bucket = grouped.get(evidence.source);
      if (bucket) bucket.push(edge);
      else grouped.set(evidence.source, [edge]);
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
    coverageNote: locale === "ko"
      ? "배경 정보는 책 단위 메타데이터와 본문 주변 문맥을 사용합니다. 절별 역사 정보 전체를 저장하지 않습니다."
      : "Background uses book-level metadata and passage context; it does not pre-load full verse-level historical commentary.",
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
  const [bundle, books, primary] = await Promise.all([
    getPassageCrossReferenceAggregates(reference),
    loadBookMetadata(locale),
    getPassage(reference, locale),
  ]);

  const aggregates = [...bundle.outgoing, ...bundle.incoming];
  const directedKeys = new Set(aggregates.map((aggregate) => directedEdgeKey(aggregate.from, aggregate.to)));
  const mutualEdgeKeys = new Set<string>();
  const mutualPairKeys = new Set<string>();
  for (const aggregate of aggregates) {
    if (directedKeys.has(directedEdgeKey(aggregate.to, aggregate.from))) {
      mutualEdgeKeys.add(directedEdgeKey(aggregate.from, aggregate.to));
      mutualPairKeys.add(unorderedPairKey(aggregate.from, aggregate.to));
    }
  }

  const dataQuality: CrossReferenceDataQuality = {
    skippedSourceRows: 0,
    unsupportedRanges: 0,
    collapsedRanges: 0,
    missingCanonVerses: 0,
    normalizationLoss: [],
    missingSources: bundle.missingSources as CrossReferenceSource[],
    availableSources: bundle.availableSources as CrossReferenceSource[],
    runtimeSource: bundle.runtimeSource,
    notes: [
      "Network is one-hop direct only.",
      ...(bundle.runtimeSource === "sqlite"
        ? ["Live request path is SQLite-backed and does not build a full in-memory JSON graph index."]
        : []),
      ...bundle.notes,
    ],
  };
  const primaryPayload = passagePayload(primary, reference, locale);
  const sortedAggregates = [...aggregates].sort((left, right) => edgeScore(right, mutualEdgeKeys.has(directedEdgeKey(right.from, right.to))) - edgeScore(left, mutualEdgeKeys.has(directedEdgeKey(left.from, left.to))));

  if (options.summaryOnly) {
    const summary = buildSummaryFromAggregates(reference, aggregates, mutualPairKeys, books, locale, dataQuality);
    const highlightAggregates = sortedAggregates.slice(0, highlightLimit);
    const highlights = (await Promise.all(highlightAggregates.map((aggregate) => edgeFromAggregate(aggregate, locale, includeExcerpts, mutualEdgeKeys)))).sort(sortEdges);
    return {
      primary: primaryPayload,
      summary,
      highlights,
      all: { outgoing: [], incoming: [], mutual: [] },
      grouped: { byBook: [], byCanonSection: [], byRelation: [], bySource: [] },
      background: includeBackground
        ? buildBackground(reference, summary, locale, primaryPayload)
        : { primaryBook: buildReceptionLayers(reference.code, locale, primaryPayload), relatedBooks: [], coverageNote: summary.coverageNote },
      dataQuality,
      sources: bundle.sourceLinks,
      version: {
        generatedAt: NETWORK_VERSION_GENERATED_AT,
        sourceVersions: bundle.sourceVersions as Array<{ source: CrossReferenceSource; retrievedAt?: string; license?: string }>,
      },
    };
  }

  const hydrated = await Promise.all(sortedAggregates.map((aggregate) => edgeFromAggregate(aggregate, locale, includeExcerpts, mutualEdgeKeys)));
  const outgoing = hydrated.filter((edge) => edge.direction === "outgoing").sort(sortEdges);
  const incoming = hydrated.filter((edge) => edge.direction === "incoming").sort(sortEdges);
  const allEdges = [...outgoing, ...incoming].sort(sortEdges);
  const mutual = outgoing.filter((edge) => mutualEdgeKeys.has(directedEdgeKey(edge.from, edge.to))).map(copyAsMutual).sort(sortEdges);
  const summary = buildSummary(reference, allEdges, outgoing, incoming, mutualPairKeys, books, locale, dataQuality);

  return {
    primary: primaryPayload,
    summary,
    highlights: allEdges.slice(0, highlightLimit),
    all: { outgoing, incoming, mutual },
    grouped: {
      byBook: groupByBook(allEdges, books, locale),
      byCanonSection: groupByCanonSection(allEdges),
      byRelation: groupByRelation(allEdges),
      bySource: groupBySource(allEdges),
    },
    background: includeBackground
      ? buildBackground(reference, summary, locale, primaryPayload)
      : { primaryBook: buildReceptionLayers(reference.code, locale, primaryPayload), relatedBooks: [], coverageNote: summary.coverageNote },
    dataQuality,
    sources: bundle.sourceLinks,
    version: {
      generatedAt: NETWORK_VERSION_GENERATED_AT,
      sourceVersions: bundle.sourceVersions as Array<{ source: CrossReferenceSource; retrievedAt?: string; license?: string }>,
    },
  };
}
