import Link from "next/link";
import { ArrowRight, Filter, Layers, ShieldCheck } from "lucide-react";
import type { BookMetadata } from "@/lib/book-metadata";
import type { BibleReference } from "@/lib/bible";
import type { SourceLink } from "@/lib/app-data";
import { SourceList } from "@/components/source-list";
import { PassagePanelLink } from "@/components/passage-panel";
import { buildBibleReferenceHref } from "@/lib/navigation";
import { localizeConfidenceLabel } from "@/lib/content";

export type CrossReferenceDirectionFilter = "all" | "outgoing" | "incoming" | "mutual";

export type CrossReferenceFiltersState = {
  direction: CrossReferenceDirectionFilter;
  relation: string;
  source: string;
  book: string;
  canon: string;
  phrase: string;
  minVotes: number | null;
};

type ReferenceSpan = BibleReference;

type CrossReferenceEvidence = {
  source: string;
  sourceName: string;
  sourceUrl?: string;
  license?: string;
  votes?: number;
  anchorPhrases?: string[];
  anchorVerses?: ReferenceSpan[];
};

export type CrossReferenceNetworkEdge = {
  id: string;
  from: ReferenceSpan;
  to: ReferenceSpan;
  direction: "outgoing" | "incoming" | "mutual";
  relationTypes: string[];
  evidence: CrossReferenceEvidence[];
  score: number;
  sourceCount: number;
  totalVotes: number;
  anchorPhrases: string[];
  displayReference: string;
  excerpt: string;
  href: string;
};

type CrossReferenceBookGroup = {
  code: string;
  name: string;
  count: number;
  edges: CrossReferenceNetworkEdge[];
  background?: CrossReferenceReceptionLayers | null;
};
type CrossReferenceCanonSectionGroup = {
  section: string;
  count: number;
  edges: CrossReferenceNetworkEdge[];
};


type CrossReferenceReceptionLayers = {
  originalContext?: {
    metadata?: BookMetadata | null;
  };
  reception?: Partial<Record<"jewishReception" | "jesusLayer" | "paulLayer", SourceBackedNote>>;
};

type SourceBackedNote = {
  title: string;
  body: string;
  confidence?: "high" | "medium" | "disputed";
  sources?: SourceLink[];
};

type RelatedBookBackground = {
  code: string;
  name: string;
  edgeCount: number;
  metadata?: BookMetadata | null;
  context?: CrossReferenceReceptionLayers | null;
};

export type CrossReferenceNetworkViewModel = {
  primary: {
    reference: string;
    referenceSpan?: BibleReference;
    book?: { code: string; name: string; testament?: string } | null;
    verses: Array<{ code: string; chapter: number; verse: number; text: string }>;
    href?: string;
  };
  summary: {
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
    strongestSources: Array<{ source: string; sourceName?: string; count: number }>;
    strongestBooks: Array<{ code: string; name: string; count: number; maxScore: number }>;
    scopeLabel: string;
    coverageNote: string;
  };
  highlights: CrossReferenceNetworkEdge[];
  all: {
    outgoing: CrossReferenceNetworkEdge[];
    incoming: CrossReferenceNetworkEdge[];
    mutual: CrossReferenceNetworkEdge[];
  };
  grouped: {
    byBook: CrossReferenceBookGroup[];
    byCanonSection?: CrossReferenceCanonSectionGroup[];
  };
  background: {
    primaryBook?: BookMetadata | CrossReferenceReceptionLayers | null;
    relatedBooks: RelatedBookBackground[];
    coverageNote?: string;
  };
  dataQuality: {
    status?: string;
    notes?: string[];
    skippedRecords?: number;
    normalizedRecords?: number;
    degradedSources?: string[];
    coverageNote?: string;
    skippedSourceRows?: number;
    unsupportedRanges?: number;
    collapsedRanges?: number;
    missingSources?: string[];
    availableSources?: string[];
    runtimeSource?: "sqlite" | "json-fallback" | "unavailable";
  };
  sources: SourceLink[];
  version: {
    generatedAt: string;
    sourceVersions: Array<{ source: string; retrievedAt?: string; license?: string }>;
  };
};

type Copy = {
  summary: string;
  primary: string;
  readPrimary: string;
  highlights: string;
  filters: string;
  clear: string;
  apply: string;
  allDirections: string;
  allRelations: string;
  allSources: string;
  allBooks: string;
  allCanon: string;
  phraseSearch: string;
  minVotes: string;
  completeList: string;
  loadFullNetwork: string;
  summaryModeNote: string;
  empty: string;
  noFilterMatches: string;
  background: string;
  sources: string;
  coverage: string;
  dataQuality: string;
  readFull: string;
  why: string;
  anchorPhrases: string;
  anchorVerses: string;
  votes: string;
  generated: string;
  booksTouched: string;
  directTotal: string;
  outgoing: string;
  incoming: string;
  mutual: string;
  consensus: string;
  voteSupported: string;
  phraseAnchor: string;
  interpretationGuard: string;
  qualityCounts: string;
};

const COPY: Record<"en" | "ko", Copy> = {
  en: {
    summary: "Network summary",
    primary: "Selected passage",
    readPrimary: "Read primary passage",
    highlights: "Strongest links",
    filters: "Filter complete network",
    clear: "Clear filters",
    apply: "Apply filters",
    allDirections: "All directions",
    allRelations: "All relation types",
    allSources: "All sources",
    allBooks: "All books",
    allCanon: "All canon sections",
    phraseSearch: "Phrase anchor contains",
    minVotes: "Minimum OpenBible votes",
completeList: "Complete grouped network",
loadFullNetwork: "Load complete grouped network",
summaryModeNote: "Initial render keeps only the summary and strongest links on the server. Load the grouped network only when you need the full one-hop graph.",
empty: "No direct links were found for this passage in the ingested cross-reference datasets.",
noFilterMatches: "No links match the current filters. The unfiltered network count remains shown above.",
background: "Book background and reception context",
sources: "Sources and provenance",
coverage: "Coverage",
dataQuality: "Data quality",
readFull: "Read full passage",
why: "Why connected",
anchorPhrases: "KJV phrase anchors",
anchorVerses: "Anchor verses",
votes: "OpenBible votes",
generated: "Generated",
booksTouched: "Books touched",
directTotal: "Direct links",
outgoing: "Outgoing",
incoming: "Incoming",
mutual: "Mutual",
consensus: "Consensus",
voteSupported: "Vote-supported",
phraseAnchor: "Phrase anchor",
interpretationGuard: "Interpretive safety: these are dataset-backed direct links, not a claim that every link has the same theological meaning. Read the cited passages before drawing conclusions.",
qualityCounts: "Normalization counts",
  },
  ko: {
    summary: "네트워크 요약",
    primary: "선택한 본문",
    readPrimary: "선택 본문 전체 읽기",
    highlights: "가장 강한 연결",
    filters: "전체 네트워크 필터",
    clear: "필터 지우기",
    apply: "필터 적용",
    allDirections: "모든 방향",
    allRelations: "모든 관계 유형",
    allSources: "모든 출처",
    allBooks: "모든 책",
    allCanon: "모든 정경 구간",
    phraseSearch: "구문 앵커 포함",
    minVotes: "OpenBible 최소 투표수",
completeList: "그룹별 전체 네트워크",
loadFullNetwork: "그룹별 전체 네트워크 불러오기",
summaryModeNote: "초기 화면은 서버 부담을 줄이기 위해 요약과 가장 강한 연결만 먼저 보여줍니다. 전체 1단계 네트워크는 필요할 때만 불러오세요.",
empty: "이 본문에 대해 수집된 상호참조 데이터셋에서 직접 연결을 찾지 못했습니다.",
noFilterMatches: "현재 필터에 맞는 연결이 없습니다. 필터 전 전체 개수는 위에 계속 표시됩니다.",
background: "책 배경과 수용 맥락",
sources: "출처와 근거",
coverage: "수록 범위",
dataQuality: "데이터 품질",
readFull: "전체 본문 보기",
why: "연결 근거",
anchorPhrases: "KJV 구문 앵커",
anchorVerses: "앵커 절",
votes: "OpenBible 투표",
generated: "생성 시각",
booksTouched: "연결된 책",
directTotal: "직접 연결",
outgoing: "나가는 참조",
incoming: "들어오는 참조",
mutual: "상호 링크",
consensus: "합의 링크",
voteSupported: "투표 근거",
phraseAnchor: "구문 앵커",
interpretationGuard: "해석 안전장치: 여기에 보이는 연결은 데이터셋에 근거한 직접 링크이며, 모든 링크가 같은 신학적 의미를 가진다는 주장이 아닙니다. 결론을 내리기 전에 인용 본문을 먼저 읽어야 합니다.",
qualityCounts: "정규화 수치",
  },
};

function localeKey(locale?: string) {
  return locale === "en" ? "en" : "ko";
}

function relationLabel(relation: string, copy: Copy) {
  if (relation === "consensus-link") return copy.consensus;
  if (relation === "vote-supported") return copy.voteSupported;
  if (relation === "phrase-anchor") return copy.phraseAnchor;
  if (relation === "incoming") return copy.incoming;
  if (relation === "outgoing") return copy.outgoing;
  if (relation === "mutual") return copy.mutual;
  return relation;
}


function formatReference(reference: ReferenceSpan) {
  const verse = reference.startVerse === reference.endVerse ? `${reference.startVerse}` : `${reference.startVerse}-${reference.endVerse}`;
  return `${reference.code} ${reference.chapter}:${verse}`;
}

function edgeReaderHref(edge: CrossReferenceNetworkEdge, locale: string) {
  return buildBibleReferenceHref(linkedReference(edge), { locale, from: "crossref" });
}

function uniqueEdges(network: CrossReferenceNetworkViewModel) {
  const byId = new Map<string, CrossReferenceNetworkEdge>();
  for (const edge of [...network.all.outgoing, ...network.all.incoming]) {
    byId.set(edge.id, edge);
  }
  return [...byId.values()];
}

function canonSectionsByEdge(network: CrossReferenceNetworkViewModel) {
  const byEdge = new Map<string, string[]>();
  for (const group of network.grouped.byCanonSection ?? []) {
    for (const edge of group.edges) {
      const sections = byEdge.get(edge.id);
      if (sections) {
        sections.push(group.section);
      } else {
        byEdge.set(edge.id, [group.section]);
      }
    }
  }
  return byEdge;
}

function linkedReference(edge: CrossReferenceNetworkEdge) {
  return edge.direction === "incoming" ? edge.from : edge.to;
}

function matchesFilters(edge: CrossReferenceNetworkEdge, filters: CrossReferenceFiltersState, edgeCanonSections: string[]) {
  if (filters.direction === "mutual" ? !edge.relationTypes.includes("mutual") : filters.direction !== "all" && edge.direction !== filters.direction) return false;
  if (filters.relation && !edge.relationTypes.includes(filters.relation)) return false;
  if (filters.source && !edge.evidence.some((item) => item.source === filters.source)) return false;
  if (filters.book && linkedReference(edge).code !== filters.book) return false;
  if (filters.canon && !edgeCanonSections.includes(filters.canon)) return false;
  if (filters.phrase) {
    const phrase = filters.phrase.toLocaleLowerCase();
    const hasPhrase = edge.anchorPhrases.some((item) => item.toLocaleLowerCase().includes(phrase));
    if (!hasPhrase) return false;
  }
  if (filters.minVotes !== null && edge.totalVotes < filters.minVotes) return false;
  return true;
}

function collectOptions(edges: CrossReferenceNetworkEdge[], network: CrossReferenceNetworkViewModel) {
  const relations = new Set<string>();
  const sources = new Map<string, string>();
  const books = new Map<string, string>();

  for (const edge of edges) {
    for (const relation of edge.relationTypes) relations.add(relation);
    for (const evidence of edge.evidence) sources.set(evidence.source, evidence.sourceName || evidence.source);
    books.set(edge.from.code, edge.from.code);
    books.set(edge.to.code, edge.to.code);
  }

  for (const book of network.summary.booksTouched) books.set(book.code, book.name);

  return {
    relations: [...relations].sort(),
    sources: [...sources.entries()].sort((left, right) => left[1].localeCompare(right[1])),
    books: [...books.entries()].sort((left, right) => left[1].localeCompare(right[1])),
    canonSections: network.summary.canonSectionsTouched.map((item) => item.section),
  };
}

function groupFilteredEdges(
  edges: CrossReferenceNetworkEdge[],
  edgeCanonSections: Map<string, string[]>,
  byBookGroups: CrossReferenceNetworkViewModel["grouped"]["byBook"],
  filters: CrossReferenceFiltersState,
) {
  const matching = edges.filter((edge) => matchesFilters(edge, filters, edgeCanonSections.get(edge.id) ?? []));
  const byBook = new Map<string, { name: string; edges: CrossReferenceNetworkEdge[]; total: number }>();

  for (const group of byBookGroups) {
    byBook.set(group.code, { name: group.name, edges: [], total: group.count });
  }

  for (const edge of matching) {
    const reference = linkedReference(edge);
    const existing = byBook.get(reference.code);
    if (existing) {
      existing.edges.push(edge);
    } else {
      byBook.set(reference.code, { name: reference.code, edges: [edge], total: 0 });
    }
  }

  return [...byBook.entries()]
    .map(([code, value]) => ({ code, ...value }))
    .filter((group) => group.edges.length > 0)
    .sort((left, right) => right.edges.length - left.edges.length || left.name.localeCompare(right.name));
}

function primaryMetadata(background: CrossReferenceNetworkViewModel["background"]) {
  const primary = background.primaryBook;
  if (!primary) return null;
  if ("notes" in primary) return primary;
  return primary.originalContext?.metadata ?? null;
}

function relatedMetadata(item: RelatedBookBackground) {
  return item.metadata ?? item.context?.originalContext?.metadata ?? null;
}


const CONFIDENCE_STYLES: Record<"high" | "medium" | "disputed", string> = {
  high: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  medium: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  disputed: "border-rose-400/30 bg-rose-400/10 text-rose-100",
};
function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="soft-glass rounded-2xl p-5">
      <div className="text-3xl font-bold tracking-tight text-[var(--ink)]">{value}</div>
      <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</div>
    </div>
  );
}

function RelationBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[var(--hairline)] bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">
      {label}
    </span>
  );
}

function EdgeCard({ edge, locale, copy }: { edge: CrossReferenceNetworkEdge; locale: string; copy: Copy }) {
  return (
    <li className="rounded-2xl border border-[var(--hairline)] bg-black/15 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <RelationBadge label={relationLabel(edge.direction, copy)} />
            {edge.relationTypes.map((relation) => (
              <RelationBadge key={`${edge.id}-${relation}`} label={relationLabel(relation, copy)} />
            ))}
          </div>
          <h3 className="mt-3 text-lg font-semibold tracking-tight text-[var(--ink)]">{edge.displayReference}</h3>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{edge.excerpt}</p>
        </div>
        <PassagePanelLink
          href={edgeReaderHref(edge, locale)}
          reference={linkedReference(edge)}
          locale={locale}
          contextTitle={copy.why}
          contextBody={[
            relationLabel(edge.direction, copy),
            ...edge.relationTypes.map((relation) => relationLabel(relation, copy)),
            edge.anchorPhrases.length ? `${copy.anchorPhrases}: ${edge.anchorPhrases.join(", ")}` : "",
            edge.totalVotes ? `${copy.votes}: ${edge.totalVotes}` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
          contextMeta={edge.displayReference}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border border-[var(--gold)]/25 px-4 py-2.5 text-sm font-semibold text-[var(--gold)] transition hover:bg-[var(--gold)]/[0.10]"
        >

          {copy.readFull}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </PassagePanelLink>
      </div>
      <div className="mt-5 rounded-xl border border-[var(--hairline)] bg-black/20 p-4">
        <div className="text-sm font-semibold text-[var(--ink)]">{copy.why}</div>
        <dl className="mt-3 grid gap-3 text-sm text-[var(--muted)] md:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-[0.14em] text-[var(--gold)]">{copy.sources}</dt>
            <dd className="mt-1">{edge.evidence.map((item) => item.sourceName || item.source).join(" · ")}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.14em] text-[var(--gold)]">{copy.votes}</dt>
            <dd className="mt-1">{edge.totalVotes}</dd>
          </div>
          {edge.anchorPhrases.length ? (
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-[var(--gold)]">{copy.anchorPhrases}</dt>
              <dd className="mt-1">{edge.anchorPhrases.join(", ")}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs uppercase tracking-[0.14em] text-[var(--gold)]">{copy.anchorVerses}</dt>
            <dd className="mt-1">
              {edge.evidence.flatMap((item) => item.anchorVerses ?? []).map(formatReference).join(" · ") || `${formatReference(edge.from)} → ${formatReference(edge.to)}`}
            </dd>
          </div>
        </dl>
      </div>
    </li>
  );
}

function BookNotes({ metadata, locale }: { metadata: BookMetadata; locale: string }) {
  return (
    <div className="rounded-2xl border border-[var(--hairline)] bg-black/15 p-5">
      <div className="text-base font-semibold text-[var(--ink)]">{metadata.title}</div>
      <div className="mt-1 text-sm text-[var(--gold)]">{metadata.genre}</div>
      <div className="mt-4 space-y-3">
        {Object.values(metadata.notes).map((note) => (
          <div key={note.title} className="rounded-xl border border-[var(--hairline)] bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-[var(--ink)]">{note.title}</div>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${CONFIDENCE_STYLES[note.confidence]}`}>
                {localizeConfidenceLabel(note.confidence, locale)}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{note.body}</p>
            <div className="mt-3">
              <SourceList sources={note.sources} compact locale={locale} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CrossReferenceNetworkReader({
  network,
  filters,
  locale,
  baseHref,
  fullNetworkLoaded,
}: {
  network: CrossReferenceNetworkViewModel;
  filters: CrossReferenceFiltersState;
  locale?: string;
  baseHref: string;
  fullNetworkLoaded: boolean;
}) {
  const appLocale = localeKey(locale);
  const copy = COPY[appLocale];
  const edges = fullNetworkLoaded ? uniqueEdges(network) : [];
  const edgeCanonSections = fullNetworkLoaded ? canonSectionsByEdge(network) : new Map<string, string[]>();
  const options = fullNetworkLoaded ? collectOptions(edges, network) : null;
  const groups = fullNetworkLoaded ? groupFilteredEdges(edges, edgeCanonSections, network.grouped.byBook, filters) : [];
  const visibleEdgeCount = groups.reduce((sum, group) => sum + group.edges.length, 0);
  const primaryBook = primaryMetadata(network.background);
  const hasAnyEdges = network.summary.totalEdges > 0;
  const loadFullHref = `${baseHref}?view=full`;

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-[var(--gold)]/25 bg-[var(--gold)]/[0.08] p-6 lg:p-8" aria-labelledby="primary-passage">
        <div className="section-title text-base">{copy.primary}</div>
        <h2 id="primary-passage" className="mt-3 text-2xl font-semibold tracking-tight text-[var(--ink)]">{network.primary.reference}</h2>
        <div className="mt-5 space-y-4 text-lg leading-8 text-[var(--text)]">
          {network.primary.verses.map((verse) => (
            <p key={`${verse.code}-${verse.chapter}-${verse.verse}`}>
              <span className="mr-3 text-base font-semibold text-[var(--gold)]">{verse.verse}</span>
              {verse.text}
            </p>
          ))}
        </div>
        <PassagePanelLink
          href={buildBibleReferenceHref(network.primary.referenceSpan ?? network.summary.reference, { locale: appLocale, from: "crossref" })}
          reference={network.primary.referenceSpan ?? network.summary.reference}
          locale={appLocale}
          contextTitle={copy.summary}
          contextBody={network.summary.coverageNote}
          contextMeta={network.primary.reference}
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--gold)]/25 px-4 py-2.5 text-sm font-semibold text-[var(--gold)] transition hover:bg-[var(--gold)]/[0.10]"
        >
          {copy.readPrimary}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </PassagePanelLink>
      </section>

      <section className="glass rounded-[32px] p-6 lg:p-8" aria-labelledby="network-summary">
        <div className="flex items-start gap-3">
          <Layers className="mt-1 h-5 w-5 text-[var(--gold)]" aria-hidden="true" />
          <div>
            <h2 id="network-summary" className="section-title text-base">{copy.summary}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]" aria-live="polite">
              {network.summary.scopeLabel} {network.summary.coverageNote}
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label={copy.directTotal} value={network.summary.totalEdges} />
          <MetricCard label={copy.outgoing} value={network.summary.outgoingCount} />
          <MetricCard label={copy.incoming} value={network.summary.incomingCount} />
          <MetricCard label={copy.mutual} value={network.summary.mutualCount} />
          <MetricCard label={copy.consensus} value={network.summary.consensusCount} />
          <MetricCard label={copy.booksTouched} value={network.summary.booksTouched.length} />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--hairline)] bg-black/15 p-5">
            <div className="text-sm font-semibold text-[var(--ink)]">{copy.sources}</div>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
              {network.summary.strongestSources.map((source) => (
                <li key={source.source} className="flex items-center justify-between gap-3">
                  <span>{source.sourceName ?? source.source}</span>
                  <span className="text-[var(--gold)]">{source.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-[var(--hairline)] bg-black/15 p-5">
            <div className="text-sm font-semibold text-[var(--ink)]">{copy.booksTouched}</div>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
              {network.summary.strongestBooks.slice(0, 6).map((book) => (
                <li key={book.code} className="flex items-center justify-between gap-3">
                  <span>{book.name}</span>
                  <span className="text-[var(--gold)]">{book.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {network.highlights.length ? (
        <section className="glass rounded-[32px] p-6 lg:p-8" aria-labelledby="network-highlights">
          <h2 id="network-highlights" className="section-title text-base">{copy.highlights}</h2>
          <ul className="mt-5 grid gap-4 lg:grid-cols-2">
            {network.highlights.map((edge) => (
              <EdgeCard key={`highlight-${edge.id}`} edge={edge} locale={appLocale} copy={copy} />
            ))}
          </ul>
        </section>
      ) : null}

      {fullNetworkLoaded ? (
        <section className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
          <aside className="glass rounded-[28px] p-5 lg:sticky lg:top-6" aria-labelledby="network-filters">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[var(--gold)]" aria-hidden="true" />
              <h2 id="network-filters" className="section-title text-base">{copy.filters}</h2>
            </div>
            <form action={baseHref} className="mt-5 space-y-4">
              <input type="hidden" name="view" value="full" />
              <label className="block text-sm font-semibold text-[var(--ink)]">
                Direction
                <select name="direction" defaultValue={filters.direction} className="mt-2 min-h-[44px] w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] px-3 text-sm text-[var(--ink)]">
                  <option value="all">{copy.allDirections}</option>
                  <option value="outgoing">{copy.outgoing}</option>
                  <option value="incoming">{copy.incoming}</option>
                  <option value="mutual">{copy.mutual}</option>
                </select>
              </label>
              <label className="block text-sm font-semibold text-[var(--ink)]">
                Relation
                <select name="relation" defaultValue={filters.relation} className="mt-2 min-h-[44px] w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] px-3 text-sm text-[var(--ink)]">
                  <option value="">{copy.allRelations}</option>
                  {options?.relations.map((relation) => <option key={relation} value={relation}>{relationLabel(relation, copy)}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-[var(--ink)]">
                Source
                <select name="source" defaultValue={filters.source} className="mt-2 min-h-[44px] w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] px-3 text-sm text-[var(--ink)]">
                  <option value="">{copy.allSources}</option>
                  {options?.sources.map(([source, label]) => <option key={source} value={source}>{label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-[var(--ink)]">
                Book
                <select name="book" defaultValue={filters.book} className="mt-2 min-h-[44px] w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] px-3 text-sm text-[var(--ink)]">
                  <option value="">{copy.allBooks}</option>
                  {options?.books.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-[var(--ink)]">
                Canon section
                <select name="canon" defaultValue={filters.canon} className="mt-2 min-h-[44px] w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] px-3 text-sm text-[var(--ink)]">
                  <option value="">{copy.allCanon}</option>
                  {options?.canonSections.map((section) => <option key={section} value={section}>{section}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-[var(--ink)]">
                {copy.phraseSearch}
                <input name="phrase" defaultValue={filters.phrase} className="mt-2 min-h-[44px] w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] px-3 text-sm text-[var(--ink)]" />
              </label>
              <label className="block text-sm font-semibold text-[var(--ink)]">
                {copy.minVotes}
                <input name="minVotes" type="number" min="0" defaultValue={filters.minVotes ?? ""} className="mt-2 min-h-[44px] w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] px-3 text-sm text-[var(--ink)]" />
              </label>
              <div className="pt-2">
                <button type="submit" className="min-h-[44px] rounded-xl bg-[var(--gold)] px-4 py-2.5 text-sm font-semibold text-[var(--canvas)] transition hover:bg-[var(--gold-hover)]">{copy.apply}</button>
              </div>
            </form>
            <form action={baseHref} className="mt-3">
              <button type="submit" className="min-h-[44px] rounded-xl border border-[var(--hairline)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)]">{copy.clear}</button>
            </form>
          </aside>

          <section className="glass rounded-[32px] p-6 lg:p-8" aria-labelledby="complete-network">
            <h2 id="complete-network" className="section-title text-base">{copy.completeList}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {visibleEdgeCount} / {network.summary.totalEdges}
            </p>
            {!hasAnyEdges ? <p className="mt-6 rounded-2xl border border-[var(--hairline)] bg-black/15 p-5 text-sm leading-7 text-[var(--muted)]">{copy.empty}</p> : null}
            {hasAnyEdges && !groups.length ? <p className="mt-6 rounded-2xl border border-[var(--hairline)] bg-black/15 p-5 text-sm leading-7 text-[var(--muted)]">{copy.noFilterMatches}</p> : null}
            <div className="mt-6 space-y-6">
              {groups.map((group) => (
                <section key={group.code} aria-labelledby={`book-${group.code}`} className="rounded-2xl border border-[var(--hairline)] bg-black/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 id={`book-${group.code}`} className="text-lg font-semibold text-[var(--ink)]">{group.name}</h3>
                    <span className="rounded-full border border-[var(--hairline)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">{group.edges.length} / {group.total || group.edges.length}</span>
                  </div>
                  <ul className="mt-4 space-y-4">
                    {group.edges.map((edge) => <EdgeCard key={edge.id} edge={edge} locale={appLocale} copy={copy} />)}
                  </ul>
                </section>
              ))}
            </div>
          </section>
        </section>
      ) : hasAnyEdges ? (
        <section className="glass rounded-[32px] p-6 lg:p-8" aria-labelledby="complete-network">
          <h2 id="complete-network" className="section-title text-base">{copy.completeList}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">{copy.summaryModeNote}</p>
          <div className="mt-5">
            <Link href={loadFullHref} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--gold)] px-4 py-2.5 text-sm font-semibold text-[var(--canvas)] transition hover:bg-[var(--gold-hover)]">
              {copy.loadFullNetwork}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      ) : (
        <section className="glass rounded-[32px] p-6 lg:p-8" aria-labelledby="complete-network">
          <h2 id="complete-network" className="section-title text-base">{copy.completeList}</h2>
          <p className="mt-6 rounded-2xl border border-[var(--hairline)] bg-black/15 p-5 text-sm leading-7 text-[var(--muted)]">{copy.empty}</p>
        </section>
      )}

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.75fr)]" aria-labelledby="network-background">
        <div className="glass rounded-[32px] p-6 lg:p-8">
          <h2 id="network-background" className="section-title text-base">{copy.background}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{network.background.coverageNote || network.summary.coverageNote}</p>
          <div className="mt-6 space-y-5">
            {primaryBook ? <BookNotes metadata={primaryBook} locale={appLocale} /> : null}
            {network.background.relatedBooks.slice(0, 6).map((item) => {
              const metadata = relatedMetadata(item);
              return metadata ? <BookNotes key={item.code} metadata={metadata} locale={appLocale} /> : null;
            })}
          </div>
        </div>

        <aside className="space-y-8">
          <div className="glass rounded-[28px] p-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--gold)]" aria-hidden="true" />
              <h2 className="section-title text-base">{copy.coverage}</h2>
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{network.summary.coverageNote}</p>
            <div className="mt-4 rounded-xl border border-[var(--gold)]/20 bg-[var(--gold)]/[0.07] p-4 text-sm leading-7 text-[var(--muted)]">
              {copy.interpretationGuard}
            </div>
            <div className="mt-5 rounded-xl border border-[var(--hairline)] bg-black/15 p-4">
              <div className="text-sm font-semibold text-[var(--ink)]">{copy.qualityCounts}</div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs text-[var(--muted)]">
                <div><dt>Skipped rows</dt><dd className="mt-1 text-[var(--gold)]">{network.dataQuality.skippedSourceRows ?? network.dataQuality.skippedRecords ?? 0}</dd></div>
                <div><dt>Unsupported ranges</dt><dd className="mt-1 text-[var(--gold)]">{network.dataQuality.unsupportedRanges ?? 0}</dd></div>
                <div><dt>Collapsed ranges</dt><dd className="mt-1 text-[var(--gold)]">{network.dataQuality.collapsedRanges ?? 0}</dd></div>
                <div><dt>Missing sources</dt><dd className="mt-1 text-[var(--gold)]">{network.dataQuality.missingSources?.length ?? network.dataQuality.degradedSources?.length ?? 0}</dd></div>
              </dl>
            </div>
            {network.dataQuality.notes?.length ? (
              <div className="mt-5">
                <div className="text-sm font-semibold text-[var(--ink)]">{copy.dataQuality}</div>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-[var(--muted)]">
                  {network.dataQuality.notes.map((note) => <li key={note}>{note}</li>)}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="glass rounded-[28px] p-6">
            <h2 className="section-title text-base">{copy.sources}</h2>
            <div className="mt-5"><SourceList sources={network.sources} locale={appLocale} /></div>
            <div className="mt-5 space-y-2 text-xs leading-5 text-[var(--muted)]">
              <div>{copy.generated}: {network.version.generatedAt}</div>
              {network.version.sourceVersions.map((source) => (
                <div key={`${source.source}-${source.retrievedAt ?? "unknown"}`}>{source.source}{source.license ? ` · ${source.license}` : ""}{source.retrievedAt ? ` · ${source.retrievedAt}` : ""}</div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
