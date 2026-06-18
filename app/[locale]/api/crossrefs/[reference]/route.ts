import { NextResponse } from "next/server";
import { parseBibleReferenceSlug } from "@/lib/bible";
import { getCrossReferenceNetwork, type CrossReferenceDirection, type CrossReferenceNetwork } from "@/lib/crossref-graph";
import { resolveAppLocale } from "@/lib/content";

const EXCERPT_MODES: Record<string, true> = { preview: true, none: true, full: true };
const DIRECTIONS: Record<string, true> = { all: true, outgoing: true, incoming: true, mutual: true };
const GROUPS: Record<string, true> = { book: true, canon: true, relation: true, source: true, none: true };
const MAX_REFERENCE_SPAN = 80;

function parseHighlightLimit(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseExcerptMode(value: string | null) {
  return value && EXCERPT_MODES[value] ? (value as "preview" | "none" | "full") : "preview";
}

function parseDirection(value: string | null) {
  return value && DIRECTIONS[value] ? (value as "all" | CrossReferenceDirection) : "all";
}

function parseGroup(value: string | null) {
  return value && GROUPS[value] ? (value as "book" | "canon" | "relation" | "source" | "none") : "book";
}

function isRangeTooLarge(reference: { startVerse: number; endVerse: number }) {
  return reference.endVerse - reference.startVerse + 1 > MAX_REFERENCE_SPAN;
}

function withoutFullPayload(network: CrossReferenceNetwork) {
  return {
    primary: network.primary,
    summary: network.summary,
    highlights: network.highlights.map((edge) => ({ ...edge, excerpt: "" })),
    background: network.background,
    dataQuality: network.dataQuality,
    sources: network.sources,
    version: network.version,
  };
}

function filterDirection(network: CrossReferenceNetwork, direction: "all" | CrossReferenceDirection): CrossReferenceNetwork {
  if (direction === "all") return network;

  return {
    ...network,
    all: {
      outgoing: direction === "outgoing" ? network.all.outgoing : [],
      incoming: direction === "incoming" ? network.all.incoming : [],
      mutual: direction === "mutual" ? network.all.mutual : [],
    },
  };
}

function edgeIdsFor(network: CrossReferenceNetwork) {
  return new Set([...network.all.outgoing, ...network.all.incoming, ...network.all.mutual].map((edge) => edge.id));
}

function filteredGroups(network: CrossReferenceNetwork) {
  const ids = edgeIdsFor(network);
  return {
    byBook: network.grouped.byBook
      .map((group) => ({ ...group, edges: group.edges.filter((edge) => ids.has(edge.id)) }))
      .filter((group) => group.edges.length > 0)
      .map((group) => ({ ...group, count: group.edges.length })),
    byCanonSection: network.grouped.byCanonSection
      .map((group) => ({ ...group, edges: group.edges.filter((edge) => ids.has(edge.id)) }))
      .filter((group) => group.edges.length > 0)
      .map((group) => ({ ...group, count: group.edges.length })),
    byRelation: network.grouped.byRelation
      .map((group) => ({ ...group, edges: group.edges.filter((edge) => ids.has(edge.id)) }))
      .filter((group) => group.edges.length > 0)
      .map((group) => ({ ...group, count: group.edges.length })),
    bySource: network.grouped.bySource
      .map((group) => ({ ...group, edges: group.edges.filter((edge) => ids.has(edge.id)) }))
      .filter((group) => group.edges.length > 0)
      .map((group) => ({ ...group, count: group.edges.length })),
  };
}

function filterGroup(network: CrossReferenceNetwork, group: "book" | "canon" | "relation" | "source" | "none"): CrossReferenceNetwork {
  const groups = filteredGroups(network);
  return {
    ...network,
    grouped: {
      byBook: group === "book" ? groups.byBook : [],
      byCanonSection: group === "canon" ? groups.byCanonSection : [],
      byRelation: group === "relation" ? groups.byRelation : [],
      bySource: group === "source" ? groups.bySource : [],
    },
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string; reference: string }> },
) {
  const { locale: requestedLocale, reference: referenceSlug } = await params;
  const reference = parseBibleReferenceSlug(referenceSlug);
  if (!reference) {
    return NextResponse.json({ error: "invalid-reference" }, { status: 404 });
  }
  if (isRangeTooLarge(reference)) {
    return NextResponse.json({ error: "reference-range-too-large", maxVerses: MAX_REFERENCE_SPAN }, { status: 400 });
  }

  const url = new URL(request.url);
  const locale = resolveAppLocale(requestedLocale);
  const direction = parseDirection(url.searchParams.get("direction"));
  const group = parseGroup(url.searchParams.get("group"));
  const summaryOnly = url.searchParams.get("summaryOnly") === "1";
  const includeBackground = url.searchParams.get("includeBackground") !== "0";
  const network = await getCrossReferenceNetwork(reference, {
    locale,
    includeExcerpts: parseExcerptMode(url.searchParams.get("includeExcerpts")),
    includeBackground,
    highlightLimit: parseHighlightLimit(url.searchParams.get("highlightLimit")),
    summaryOnly,
  });

  if (!network.primary.verses.length) {
    return NextResponse.json({ error: "invalid-reference" }, { status: 404 });
  }

  const directed = filterDirection(network, direction);
  const grouped = summaryOnly ? directed : filterGroup(directed, group);
  return NextResponse.json(summaryOnly ? withoutFullPayload(grouped) : grouped);
}
