import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { notFound } from "next/navigation";
import { CrossReferenceNetworkReader, type CrossReferenceDirectionFilter, type CrossReferenceFiltersState, type CrossReferenceNetworkViewModel } from "@/components/crossref-network";
import { buildCrossReferenceNetworkHref } from "@/components/full-network-cta";
import { getPassage, parseBibleReferenceSlug } from "@/lib/bible";
import { getCrossReferenceNetwork } from "@/lib/crossref-graph";
import { buildBibleReferenceHref } from "@/lib/navigation";
import { UI_COPY } from "@/lib/content";
import { buildPageMetadata } from "@/lib/page-metadata";
import { resolveLocale } from "@/lib/server-locale";

const COPY = {
  en: {
    eyebrow: "Full Scripture network",
    body: "All direct outgoing and incoming links available in the ingested cross-reference datasets, with provenance and book-level context kept separate from interpretation.",
    back: "Back to passage",
    totalSuffix: "direct links",
  },
  ko: {
    eyebrow: "전체 관련 성구 네트워크",
    body: "수집된 상호참조 데이터셋 기준으로 확인 가능한 모든 직접 나가는 참조와 들어오는 참조를 출처 및 책 배경과 분리해 보여줍니다.",
    back: "본문으로 돌아가기",
    totalSuffix: "직접 연결",
  },
} as const;

type Props = {
  params: Promise<{ locale: string; reference: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const MAX_REFERENCE_SPAN = 80;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseDirection(value: string | undefined): CrossReferenceDirectionFilter {
  if (value === "outgoing" || value === "incoming" || value === "mutual") return value;
  return "all";
}

function parseMinVotes(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseFilters(searchParams: Record<string, string | string[] | undefined>): CrossReferenceFiltersState {
  return {
    direction: parseDirection(firstParam(searchParams.direction)),
    relation: firstParam(searchParams.relation)?.trim() ?? "",
    source: firstParam(searchParams.source)?.trim() ?? "",
    book: firstParam(searchParams.book)?.trim().toUpperCase() ?? "",
    canon: firstParam(searchParams.canon)?.trim() ?? "",
    phrase: firstParam(searchParams.phrase)?.trim() ?? "",
    minVotes: parseMinVotes(firstParam(searchParams.minVotes)),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale, reference: referenceSlug } = await params;
  const locale = await resolveLocale(requestedLocale);
  const reference = parseBibleReferenceSlug(referenceSlug);

  if (!reference) {
    return buildPageMetadata(locale, COPY[locale].eyebrow, COPY[locale].body, `/crossrefs/${referenceSlug}`);
  }

  const passage = await getPassage(reference, locale);
  const title = passage.verses.length ? `${passage.reference} · ${COPY[locale].eyebrow}` : COPY[locale].eyebrow;
  const description = passage.verses.length
    ? passage.verses.map((verse) => `${verse.verse}. ${verse.text}`).join(" ").slice(0, 180)
    : COPY[locale].body;

  return buildPageMetadata(locale, title, description, `/crossrefs/${referenceSlug}`);
}

export default async function CrossReferencesPage({ params, searchParams }: Props) {
  const { locale: requestedLocale, reference: referenceSlug } = await params;
  const locale = await resolveLocale(requestedLocale);
  const reference = parseBibleReferenceSlug(referenceSlug);

  if (!reference) {
    notFound();
  }
  if (reference.endVerse - reference.startVerse + 1 > MAX_REFERENCE_SPAN) {
    notFound();
  }


  const passage = await getPassage(reference, locale);
  const expectedVerseCount = reference.endVerse - reference.startVerse + 1;
  const exactCoverage =
    passage.verses.length === expectedVerseCount &&
    passage.verses[0]?.verse === reference.startVerse &&
    passage.verses.at(-1)?.verse === reference.endVerse;
  if (!exactCoverage) {
    notFound();
  }
  const [network, query] = await Promise.all([
    getCrossReferenceNetwork(reference, {
      locale,
      highlightLimit: 8,
      includeExcerpts: "preview",
      includeBackground: true,
      summaryOnly: false,
    }) as Promise<CrossReferenceNetworkViewModel>,
    searchParams ?? Promise.resolve({}),
  ]);

  if (!network.primary.verses.length) {
    notFound();
  }

  const copy = COPY[locale];
  const baseHref = buildCrossReferenceNetworkHref(reference, locale);
  const filters = parseFilters(query);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8 lg:px-8">
      <header className="glass rounded-[28px] px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Link href={buildBibleReferenceHref(network.summary.reference, { locale, from: "crossref" })} className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-[var(--muted)] transition hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {copy.back}
          </Link>
          <div className="flex items-center gap-3 text-sm font-semibold text-white">
            <BookOpen className="h-4 w-4 text-[var(--gold)]" aria-hidden="true" />
            {UI_COPY[locale].siteTitle}
          </div>
        </div>
      </header>

      <section className="mt-8 glass rounded-[36px] p-7 lg:p-10">
        <div className="section-title text-base">{copy.eyebrow}</div>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold leading-tight text-white lg:text-5xl">{network.primary.reference}</h1>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-[var(--muted)]">{copy.body}</p>
          </div>
          <div className="rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold)]/[0.08] px-5 py-4 text-center">
            <div className="text-4xl font-bold tracking-tight text-[var(--ink)]">{network.summary.totalEdges}</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--gold)]">{copy.totalSuffix}</div>
          </div>
        </div>
      </section>

      <div className="mt-8">
        <CrossReferenceNetworkReader network={network} filters={filters} locale={locale} baseHref={baseHref} />
      </div>
    </main>
  );
}
