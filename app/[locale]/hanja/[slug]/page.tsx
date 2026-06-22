import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ExternalLink } from "lucide-react";

import { PassagePanelLink } from "@/components/passage-panel";
import { HanjaSourceList } from "@/components/hanja-source-list";
import { getPassage } from "@/lib/bible";
import { getHanjaEntries, getHanjaEntryView } from "@/lib/hanja-catalog";
import { buildBibleReferenceHref } from "@/lib/navigation";
import { buildPageMetadata } from "@/lib/page-metadata";
import { resolveLocale } from "@/lib/server-locale";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

function formatReferenceLabel(reference: { code: string; chapter: number; startVerse: number; endVerse: number }) {
  return `${reference.code} ${reference.chapter}:${reference.startVerse}${reference.endVerse > reference.startVerse ? `-${reference.endVerse}` : ""}`;
}

function localizeStrings(locale: "ko" | "en") {
  return {
    supportive: locale === "ko" ? "지지 자료" : "Supportive sources",
    critical: locale === "ko" ? "비판 자료" : "Critical sources",
    supportiveBody: locale === "ko"
      ? "이 해석을 뒷받침하거나 비슷한 방향으로 읽는 자료입니다."
      : "These sources reinforce the entry's reading or travel in the same interpretive direction.",
    criticalBody: locale === "ko"
      ? "이 해석의 한계를 짚거나 다른 해석 방향을 제안하는 자료입니다."
      : "These sources challenge the entry, qualify it, or suggest a different direction.",
    mainPassages: locale === "ko" ? "주요 본문" : "Primary passages",
    relatedPassages: locale === "ko" ? "관련 본문" : "Related passages",
    passagesBody: locale === "ko"
      ? "넓은 화면에서는 우측 패널에서 본문을 먼저 읽고, 더 길게 보려면 공용 성경 리더 전체 화면으로 이어서 열 수 있습니다."
      : "On wider screens, passage links open in a side panel first, with the shared Bible reader available when you want the full chapter context.",
    openOriginal: locale === "ko" ? "원문 열기" : "Open source",
    backToCatalog: locale === "ko" ? "카탈로그로 돌아가기" : "Back to catalog",
    thesis: locale === "ko" ? "핵심 논지" : "Core thesis",
    keywords: locale === "ko" ? "키워드" : "Keywords",
    readInBible: locale === "ko" ? "성경에서 읽기" : "Read in Bible",
    relatedEntries: locale === "ko" ? "연결 항목" : "Related entries",
    coverage: locale === "ko" ? "출처 범위" : "Source coverage",
    sourceMeaning: locale === "ko" ? "링크 본문에서 정리한 뜻" : "Meaning from linked sources",
    sourceMeaningBody: locale === "ko"
      ? "수집한 링크 본문에서 이 한자를 실제로 어떻게 풀어 설명하는지 먼저 보여 줍니다."
      : "This section foregrounds the meaning lines taken directly from the harvested source bodies.",
    sampleContexts: locale === "ko" ? "수집된 문맥 예시" : "Sample contexts",
  };
}

async function PassageSection({
  title,
  references,
  locale,
  contextTitle,
  contextBody,
  contextMeta,
}: {
  title: string;
  references: { code: string; chapter: number; startVerse: number; endVerse: number }[];
  locale: "ko" | "en";
  contextTitle?: string;
  contextBody?: string;
  contextMeta?: string;
}) {
  if (!references.length) return null;
  const copy = localizeStrings(locale);
  const passages = await Promise.all(references.map((reference) => getPassage(reference, locale)));

  return (
    <section>
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <p className="mt-1.5 text-sm text-ink-muted">{copy.passagesBody}</p>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {passages.map((passage, index) => {
          const reference = references[index];
          return (
            <article key={`${passage.reference}-${index}`} className="rounded-card border border-[var(--hairline)] bg-surface-1 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-ink">{passage.reference}</div>
                  <div className="mt-1 text-xs text-gold">{formatReferenceLabel(reference)}</div>
                </div>
                <PassagePanelLink
                  href={buildBibleReferenceHref(reference, { locale, from: "hanja" })}
                  reference={reference}
                  locale={locale}
                  contextTitle={contextTitle}
                  contextBody={contextBody}
                  contextMeta={contextMeta}
                  className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-input border border-[var(--hairline)] px-3 py-2 text-xs font-semibold text-ink transition hover:border-[var(--hairline-hover)] hover:text-gold"
                >
                  {copy.readInBible}
                </PassagePanelLink>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{passage.verses.map((verse) => `${verse.verse}. ${verse.text}`).join(" ")}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export async function generateStaticParams() {
  const entries = await getHanjaEntries();
  return entries.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale, slug } = await params;
  const locale = await resolveLocale(requestedLocale);
  const entry = await getHanjaEntryView(slug, locale);
  const title = entry ? `${entry.character} · ${entry.resolvedTitle}` : locale === "ko" ? "한자" : "Hanja";
  const description = entry?.resolvedExplanation ?? entry?.resolvedThesis ?? (locale === "ko" ? "한자 항목 상세" : "Hanja entry detail");

  return buildPageMetadata(locale, title, description, `/hanja/${slug}`);
}

export default async function HanjaDetailPage({ params }: Props) {
  const { locale: requestedLocale, slug } = await params;
  const locale = await resolveLocale(requestedLocale);
  const entry = await getHanjaEntryView(slug, locale);
  if (!entry) notFound();

  const copy = localizeStrings(locale);
  const relatedEntries = entry.relatedEntries.slice(0, 8);
  const contextBody = [entry.resolvedThesis, entry.resolvedExplanation].filter(Boolean).join(" ");

  return (
    <main className="mx-auto min-h-screen max-w-content px-gutter py-8">
      {/* Back link */}
      <Link
        href={`/${locale}/hanja`}
        className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-ink-muted transition hover:text-gold"
      >
        <ArrowRight className="h-4 w-4 rotate-180" />
        {copy.backToCatalog}
      </Link>

      {/* Hero: character + title */}
      <header className="mt-6">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">{entry.reading || entry.character}</div>
        <h1 className="mt-2 text-5xl font-bold tracking-tight text-ink sm:text-7xl">{entry.character}</h1>
        <div className="mt-3 text-2xl font-semibold tracking-tight text-ink">{entry.resolvedTitle}</div>
      </header>

      {/* Main 2-column layout */}
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.6fr)] lg:gap-12">
        {/* Left: main content */}
        <div className="space-y-10">
          {/* Thesis */}
          <section>
            <h2 className="text-lg font-bold text-ink">{copy.thesis}</h2>
            <p className="mt-3 text-base leading-relaxed text-ink-muted">{entry.resolvedThesis}</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-subtle">{entry.resolvedExplanation}</p>
          </section>

          {/* Meaning from sources */}
          {entry.resolvedMeaningSummary || entry.meaningEvidence.length ? (
            <section>
              <h2 className="text-lg font-bold text-ink">{copy.sourceMeaning}</h2>
              <p className="mt-1.5 text-sm text-ink-muted">{copy.sourceMeaningBody}</p>
              {entry.resolvedMeaningSummary ? (
                <p className="mt-4 text-base leading-relaxed text-ink">{entry.resolvedMeaningSummary}</p>
              ) : null}
              {entry.meaningEvidence.length ? (
                <ul className="mt-5 space-y-4">
                  {entry.meaningEvidence.slice(0, 3).map((evidence) => (
                    <li key={`${evidence.sourceId}-${evidence.text}`} className="rounded-card border border-[var(--hairline)] bg-surface-1 p-5">
                      <blockquote className="text-base leading-relaxed text-ink">{evidence.text}</blockquote>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-xs text-ink-subtle">
                          {evidence.source.title}
                          {evidence.stance === "critical"
                            ? ` · ${locale === "ko" ? "비판 자료" : "Critical source"}`
                            : evidence.stance === "supportive"
                              ? ` · ${locale === "ko" ? "지지 자료" : "Supportive source"}`
                              : ` · ${locale === "ko" ? "참고 자료" : "Reference source"}`}
                        </div>
                        <a
                          href={evidence.source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-input border border-[var(--hairline)] px-3 py-2 text-xs font-semibold text-ink transition hover:border-[var(--hairline-hover)] hover:text-gold"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {copy.openOriginal}
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {/* Main passages */}
          <PassageSection
            title={copy.mainPassages}
            references={entry.mainPassages}
            locale={locale}
            contextTitle={locale === "ko" ? `${entry.resolvedTitle}와 연결되는 이유` : `Why this passage connects to ${entry.resolvedTitle}`}
            contextBody={contextBody}
            contextMeta={entry.reading || entry.character}
          />

          {/* Related passages */}
          <PassageSection
            title={copy.relatedPassages}
            references={entry.relatedPassages}
            locale={locale}
            contextTitle={locale === "ko" ? `${entry.resolvedTitle}와 연결되는 이유` : `Why this passage connects to ${entry.resolvedTitle}`}
            contextBody={contextBody}
            contextMeta={entry.reading || entry.character}
          />

          {/* Related entries */}
          {relatedEntries.length ? (
            <section>
              <h2 className="text-lg font-bold text-ink">{copy.relatedEntries}</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {relatedEntries.map((relatedEntry) => (
                  <Link
                    key={relatedEntry.slug}
                    href={`/${locale}/hanja/${relatedEntry.slug}`}
                    className="rounded-pill border border-[var(--hairline)] px-3.5 py-1.5 text-sm font-medium text-ink transition hover:border-[var(--hairline-hover)] hover:text-gold"
                  >
                    {relatedEntry.character} · {(relatedEntry.title[locale] ?? relatedEntry.title.ko ?? relatedEntry.title.en ?? relatedEntry.slug)}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {/* Right: sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-[calc(var(--nav-height)+1.5rem)]">
          {/* Keywords */}
          <section className="rounded-card border border-[var(--hairline)] bg-surface-1 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-gold">{copy.keywords}</h3>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {entry.keywords.map((keyword) => (
                <span key={keyword} className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs text-ink-muted">{keyword}</span>
              ))}
            </div>
          </section>

          {/* Source coverage */}
          <section className="rounded-card border border-[var(--hairline)] bg-surface-1 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-gold">{copy.coverage}</h3>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-pill bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-300">
                {locale === "ko" ? `출처 ${entry.sourceCount ?? entry.supportiveSourceIds.length + entry.criticalSourceIds.length}` : `${entry.sourceCount ?? entry.supportiveSourceIds.length + entry.criticalSourceIds.length} sources`}
              </span>
              <span className="rounded-pill bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                {locale === "ko" ? `지지 ${entry.supportiveSourceIds.length}` : `${entry.supportiveSourceIds.length} supportive`}
              </span>
              <span className="rounded-pill bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-300">
                {locale === "ko" ? `비판 ${entry.criticalSourceIds.length}` : `${entry.criticalSourceIds.length} critical`}
              </span>
            </div>
            {entry.sampleContexts?.length ? (
              <div className="mt-4">
                <h4 className="text-xs font-semibold text-ink">{copy.sampleContexts}</h4>
                <ul className="mt-2 space-y-1.5">
                  {entry.sampleContexts.slice(0, 3).map((context) => (
                    <li key={context} className="text-xs leading-relaxed text-ink-muted">{context}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </aside>
      </div>

      {/* Source lists — full width below */}
      <div className="mt-12 space-y-8">
        <HanjaSourceList
          title={copy.supportive}
          body={copy.supportiveBody}
          sources={entry.supportiveSources}
          tone="supportive"
          locale={locale}
          copy={{ openOriginal: copy.openOriginal }}
        />
        <HanjaSourceList
          title={copy.critical}
          body={copy.criticalBody}
          sources={entry.criticalSources}
          tone="critical"
          locale={locale}
          copy={{ openOriginal: copy.openOriginal }}
        />
      </div>
    </main>
  );
}
