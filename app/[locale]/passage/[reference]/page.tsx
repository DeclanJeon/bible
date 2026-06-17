import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen, Compass, Sparkles } from "lucide-react";
import { notFound } from "next/navigation";
import { getChapterContext, getPassage, parseBibleReferenceSlug, type BibleReference } from "@/lib/bible";
import { STORY_CLUSTERS } from "@/lib/app-data";
import { localizeStoryCluster, UI_COPY } from "@/lib/content";
import { getPassageCrossReferences } from "@/lib/knowledge";
import { buildBibleHref, buildCompanionHref, buildGraphHref, buildLanesHref, buildStudyHref } from "@/lib/navigation";
import { buildPageMetadata } from "@/lib/page-metadata";
import { resolveLocale } from "@/lib/server-locale";
import { CrossReferenceSection } from "@/components/crossref-section";

const COPY = {
  en: {
    eyebrow: "Full passage reader",
    back: "Back to study lanes",
    selectedPassage: "Selected passage",
    selectedPassageBody: "The full verse range is shown without preview trimming.",
    surroundingContext: "Nearby context",
    surroundingContextBody: "A few surrounding verses are included so the passage is not read in isolation.",
    openStudy: "Open study desk",
    openGraph: "Open graph",
    startReflection: "Start reflection",
    relatedStudies: "Related study lanes",
    crossReferences: "More linked passages",
    noContext: "No surrounding context is available for this reference.",
  },
  ko: {
    eyebrow: "본문 전체 읽기",
    back: "스터디 목록으로 돌아가기",
    selectedPassage: "선택한 본문",
    selectedPassageBody: "미리보기로 줄이지 않고 해당 절 범위를 전부 보여줍니다.",
    surroundingContext: "앞뒤 문맥",
    surroundingContextBody: "본문을 고립해서 읽지 않도록 주변 절을 함께 보여줍니다.",
    openStudy: "스터디 데스크 열기",
    openGraph: "그래프 열기",
    startReflection: "묵상 시작",
    relatedStudies: "관련 스터디 레인",
    crossReferences: "더 연결된 본문",
    noContext: "이 본문에 표시할 주변 문맥이 없습니다.",
  },
} as const;

type Props = {
  params: Promise<{ locale: string; reference: string }>;
};

function overlaps(left: BibleReference, right: BibleReference) {
  return (
    left.code === right.code &&
    left.chapter === right.chapter &&
    !(right.endVerse < left.startVerse || right.startVerse > left.endVerse)
  );
}

function clusterReferences(cluster: (typeof STORY_CLUSTERS)[number]) {
  return [cluster.primary, ...cluster.supporting, ...cluster.linkedTexts.map((item) => item.reference)];
}

function verseIsSelected(reference: BibleReference, verse: { code: string; chapter: number; verse: number }) {
  return (
    verse.code === reference.code &&
    verse.chapter === reference.chapter &&
    verse.verse >= reference.startVerse &&
    verse.verse <= reference.endVerse
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale, reference: referenceSlug } = await params;
  const locale = await resolveLocale(requestedLocale);
  const reference = parseBibleReferenceSlug(referenceSlug);

  if (!reference) {
    return buildPageMetadata(locale, locale === "ko" ? "본문" : "Passage", "Bible passage", `/passage/${referenceSlug}`);
  }

  const passage = await getPassage(reference, locale);
  const description = passage.verses
    .map((verse) => `${verse.verse}. ${verse.text}`)
    .join(" ")
    .slice(0, 180);

  return buildPageMetadata(locale, passage.reference, description, `/passage/${referenceSlug}`);
}

export default async function PassagePage({ params }: Props) {
  const { locale: requestedLocale, reference: referenceSlug } = await params;
  const locale = await resolveLocale(requestedLocale);
  const copy = COPY[locale];
  const reference = parseBibleReferenceSlug(referenceSlug);

  if (!reference) {
    notFound();
  }

  const [passage, context, crossReferences] = await Promise.all([
    getPassage(reference, locale),
    getChapterContext(reference, 4, locale),
    getPassageCrossReferences(reference, 4, locale),
  ]);

  if (!passage.verses.length) {
    notFound();
  }

  const relatedClusters = STORY_CLUSTERS.filter((cluster) => clusterReferences(cluster).some((item) => overlaps(item, reference)))
    .slice(0, 3)
    .map((cluster) => localizeStoryCluster(cluster, locale));

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-8 lg:px-8">
      <header className="glass rounded-[28px] px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Link href={buildLanesHref({ locale })} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] transition hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            {copy.back}
          </Link>
          <div className="flex items-center gap-3">
            <Link href={buildBibleHref({ book: passage.book?.code, chapter: reference.chapter, locale })} className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)]">
              {UI_COPY[locale].sidebar.navBible}
            </Link>
            <div className="text-sm font-semibold text-white">{UI_COPY[locale].siteTitle}</div>
          </div>
        </div>
      </header>

      <section className="mt-8 glass rounded-[36px] p-7 lg:p-10">
        <div className="section-title text-base">{copy.eyebrow}</div>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-white lg:text-5xl">{passage.reference}</h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-[var(--muted)]">{copy.selectedPassageBody}</p>
      </section>

      <section className="mt-8 rounded-[32px] border border-[var(--gold)]/25 bg-[var(--gold)]/[0.08] p-6 lg:p-8">
        <div className="section-title text-base">{copy.selectedPassage}</div>
        <div className="mt-6 space-y-5 text-xl leading-9 text-[var(--text)]">
          {passage.verses.map((verse) => (
            <p key={`${verse.code}-${verse.chapter}-${verse.verse}`}>
              <span className="mr-4 align-baseline text-base font-semibold text-[var(--gold)]">{verse.verse}</span>
              {verse.text}
            </p>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] lg:items-start">
        <div className="glass rounded-[32px] p-6 lg:p-8">
          <div className="section-title text-base">{copy.surroundingContext}</div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{copy.surroundingContextBody}</p>
          {context.verses.length ? (
            <div className="mt-6 space-y-4 text-base leading-8 text-[var(--muted)]">
              {context.verses.map((verse) => {
                const selected = verseIsSelected(reference, verse);
                return (
                  <p
                    key={`context-${verse.code}-${verse.chapter}-${verse.verse}`}
                    className={selected ? "rounded-2xl border border-[var(--gold)]/20 bg-[var(--gold)]/[0.07] px-4 py-3 text-[var(--text)]" : "px-4"}
                  >
                    <span className="mr-3 font-semibold text-[var(--gold)]">{verse.verse}</span>
                    {verse.text}
                  </p>
                );
              })}
            </div>
          ) : (
            <p className="mt-6 text-base text-[var(--muted)]">{copy.noContext}</p>
          )}
        </div>

        <aside className="space-y-5">
          {relatedClusters.map((cluster) => (
            <div key={cluster.slug} className="soft-glass rounded-[28px] p-5">
              <div className="text-base font-semibold text-white">{cluster.title}</div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{cluster.pastoralPrompt}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={buildStudyHref(cluster.slug, locale)} className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[var(--accent)]/90">
                  <BookOpen className="h-3.5 w-3.5" />
                  {copy.openStudy}
                </Link>
                <Link href={buildGraphHref(cluster.slug, locale)} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-2.5 text-xs font-semibold text-white transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)]">
                  <Compass className="h-3.5 w-3.5" />
                  {copy.openGraph}
                </Link>
                <Link href={buildCompanionHref({ prompt: cluster.starterPrompt, locale })} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-2.5 text-xs font-semibold text-white transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)]">
                  <Sparkles className="h-3.5 w-3.5" />
                  {copy.startReflection}
                </Link>
              </div>
            </div>
          ))}
        </aside>
      </section>

      <div className="mt-8">
        <CrossReferenceSection suggestions={crossReferences} locale={locale} />
      </div>
    </main>
  );
}
