import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ExternalLink, Languages } from "lucide-react";
import { SecondaryNav } from "@/components/secondary-nav";
import { getPassage } from "@/lib/bible";
import { getHanjaEntries, getHanjaEntryView, type HanjaSource } from "@/lib/hanja-catalog";
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
    supportiveBody:
      locale === "ko"
        ? "이 해석을 뒷받침하거나 비슷한 방향으로 읽는 자료입니다."
        : "These sources reinforce the entry’s reading or travel in the same interpretive direction.",
    criticalBody:
      locale === "ko"
        ? "이 해석의 한계를 짚거나 다른 해석 방향을 제안하는 자료입니다."
        : "These sources challenge the entry, qualify it, or suggest a different direction.",
    mainPassages: locale === "ko" ? "주요 본문" : "Primary passages",
    relatedPassages: locale === "ko" ? "관련 본문" : "Related passages",
    passagesBody:
      locale === "ko"
        ? "모든 본문 링크는 공용 성경 리더로 열리며, 현재 항목 맥락을 유지한 채 본문으로 이동합니다."
        : "Every passage link opens in the shared Bible reader while preserving the current Hanja context.",
    sourceMeta: locale === "ko" ? "자료 메타" : "Source metadata",
    openOriginal: locale === "ko" ? "원문 열기" : "Open source",
    backToCatalog: locale === "ko" ? "카탈로그로 돌아가기" : "Back to catalog",
    thesis: locale === "ko" ? "핵심 논지" : "Core thesis",
    keywords: locale === "ko" ? "키워드" : "Keywords",
    noSources: locale === "ko" ? "등록된 자료가 아직 없습니다." : "No sources are attached yet.",
    readInBible: locale === "ko" ? "성경에서 읽기" : "Read in Bible",
    publisherMissing: locale === "ko" ? "출처 표기 없음" : "Publisher not listed",
    section: locale === "ko" ? "섹션" : "Section",
    relatedEntries: locale === "ko" ? "연결 항목" : "Related entries",
    sampleContexts: locale === "ko" ? "수집된 문맥 예시" : "Sample harvested contexts",
    coverage: locale === "ko" ? "출처 범위" : "Source coverage",
    sourceMeaning: locale === "ko" ? "링크 본문에서 정리한 뜻" : "Meaning distilled from linked sources",
    sourceMeaningBody:
      locale === "ko"
        ? "수집한 링크 본문에서 이 한자를 실제로 어떻게 풀어 설명하는지 먼저 보여 줍니다."
        : "This section foregrounds the meaning lines taken directly from the harvested source bodies.",
  };
}

function SourceSection({
  locale,
  title,
  body,
  sources,
  tone,
}: {
  locale: "ko" | "en";
  title: string;
  body: string;
  sources: HanjaSource[];
  tone: "supportive" | "critical";
}) {
  const copy = localizeStrings(locale);
  const toneClass =
    tone === "supportive"
      ? {
          panel: "border-emerald-500/20 bg-emerald-500/5",
          badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
        }
      : {
          panel: "border-rose-500/25 bg-rose-500/10",
          badge: "border-rose-500/25 bg-rose-500/10 text-rose-200",
        };

  return (
    <section className={`rounded-2xl border p-5 sm:p-6 ${toneClass.panel}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="section-title text-base">{title}</div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{body}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass.badge}`}>{sources.length}</span>
      </div>

      {sources.length ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {sources.map((source) => (
            <article key={source.id} className="rounded-xl border border-black/10 bg-black/10 p-4 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold tracking-tight text-[var(--ink)]">{source.title}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--ink-subtle)]">
                    <span className="chip text-xs text-[var(--ink)]">{source.kind}</span>
                    <span className={`rounded-full border px-2 py-0.5 font-semibold ${toneClass.badge}`}>{title}</span>
                    <span className="rounded-full border border-[var(--hairline)] px-2 py-0.5">{source.language}</span>
                  </div>
                </div>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg border border-[var(--hairline-strong)] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)]"
                >
                  <ExternalLink className="h-4 w-4" />
                  {copy.openOriginal}
                </a>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-2">
                <div>
                  <div className="font-semibold text-[var(--ink)]">{copy.sourceMeta}</div>
                  <p className="mt-1">{source.publisher ?? copy.publisherMissing}</p>
                </div>
                <div>
                  <div className="font-semibold text-[var(--ink)]">{copy.section}</div>
                  <p className="mt-1">{source.subsection ? `${source.section} · ${source.subsection}` : source.section}</p>
                </div>
              </div>

              {source.notes ? <p className="mt-4 text-sm leading-relaxed text-[var(--ink-subtle)]">{source.notes}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-[var(--hairline)] bg-black/10 p-4 text-sm text-[var(--muted)]">{copy.noSources}</div>
      )}
    </section>
  );
}

async function PassageSection({
  title,
  references,
  locale,
}: {
  title: string;
  references: { code: string; chapter: number; startVerse: number; endVerse: number }[];
  locale: "ko" | "en";
}) {
  if (!references.length) return null;
  const copy = localizeStrings(locale);
  const passages = await Promise.all(references.map((reference) => getPassage(reference, locale)));

  return (
    <section className="glass rounded-xl p-5 sm:rounded-2xl sm:p-8 lg:p-10">
      <div className="section-title text-base">{title}</div>
      <p className="mt-2 text-base leading-relaxed text-[var(--muted)]">{copy.passagesBody}</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {passages.map((passage, index) => {
          const reference = references[index];
          return (
            <article key={`${passage.reference}-${index}`} className="soft-glass rounded-xl p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold tracking-tight text-[var(--ink)]">{passage.reference}</div>
                  <div className="mt-2 text-sm text-[var(--gold)]">{formatReferenceLabel(reference)}</div>
                </div>
                <Link
                  href={buildBibleReferenceHref(reference, { locale, from: "hanja" })}
                  className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg border border-[var(--hairline-strong)] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)]"
                >
                  {copy.readInBible}
                </Link>
              </div>
              <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{passage.verses.map((verse) => `${verse.verse}. ${verse.text}`).join(" ")}</p>
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

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <SecondaryNav locale={locale} active="hanja" title={entry.resolvedTitle} />

      <section className="mt-8 space-y-8">
        <section className="glass rounded-xl p-5 sm:rounded-2xl sm:p-6 lg:p-8">
          <Link
            href={`/${locale}/hanja`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--hairline-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)]"
          >
            <ArrowRight className="h-4 w-4 rotate-180" />
            {copy.backToCatalog}
          </Link>

          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">{entry.reading || entry.character}</div>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-[var(--ink)] sm:text-5xl">{entry.character}</h1>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-[var(--ink)]">{entry.resolvedTitle}</div>
              <div className="mt-5 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-2)] p-5">
                <div className="section-title text-sm">{copy.thesis}</div>
                <p className="mt-3 text-base leading-relaxed text-[var(--muted)]">{entry.resolvedThesis}</p>
                <p className="mt-3 text-sm leading-relaxed text-[var(--ink-subtle)]">{entry.resolvedExplanation}</p>
              </div>
              {entry.resolvedMeaningSummary || entry.meaningEvidence.length ? (
                <div className="mt-4 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-5">
                  <div className="section-title text-sm">{copy.sourceMeaning}</div>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{copy.sourceMeaningBody}</p>
                  {entry.resolvedMeaningSummary ? (
                    <p className="mt-4 text-base leading-relaxed text-[var(--ink)]">{entry.resolvedMeaningSummary}</p>
                  ) : null}
                  {entry.meaningEvidence.length ? (
                    <ul className="mt-4 space-y-3">
                      {entry.meaningEvidence.slice(0, 3).map((evidence) => (
                        <li key={`${evidence.sourceId}-${evidence.text}`} className="rounded-xl border border-[var(--hairline)] px-4 py-3">
                          <div className="text-sm leading-relaxed text-[var(--ink)]">{evidence.text}</div>
                          <div className="mt-2 text-xs text-[var(--ink-subtle)]">
                            {evidence.source.title}
                            {evidence.stance === "critical"
                              ? locale === "ko"
                                ? " · 비판 자료"
                                : " · Critical source"
                              : evidence.stance === "supportive"
                                ? locale === "ko"
                                  ? " · 지지 자료"
                                  : " · Supportive source"
                                : locale === "ko"
                                  ? " · 참고 자료"
                                  : " · Reference source"}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="soft-glass rounded-xl p-4">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--gold)]/[0.12] text-[var(--gold)]">
                  <Languages className="h-5 w-5" />
                </div>
                <div className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">{copy.keywords}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ink)]">
                  {entry.keywords.map((keyword) => (
                    <span key={keyword} className="rounded-full border border-[var(--hairline)] px-2.5 py-1">{keyword}</span>
                  ))}
                </div>
              </div>
              <div className="soft-glass rounded-xl p-4">
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">{copy.coverage}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ink)]">
                  <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-1 font-semibold text-sky-200">
                    {locale === "ko" ? `출처 ${entry.sourceCount ?? entry.supportiveSourceIds.length + entry.criticalSourceIds.length}` : `Sources ${entry.sourceCount ?? entry.supportiveSourceIds.length + entry.criticalSourceIds.length}`}
                  </span>
                  <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-200">
                    {locale === "ko" ? `지지 ${entry.supportiveSourceIds.length}` : `Supportive ${entry.supportiveSourceIds.length}`}
                  </span>
                  <span className="rounded-full border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 font-semibold text-rose-200">
                    {locale === "ko" ? `비판 ${entry.criticalSourceIds.length}` : `Critical ${entry.criticalSourceIds.length}`}
                  </span>
                </div>
                {entry.sampleContexts?.length ? (
                  <div className="mt-4">
                    <div className="text-sm font-semibold text-[var(--ink)]">{copy.sampleContexts}</div>
                    <ul className="mt-2 space-y-2 text-sm leading-relaxed text-[var(--muted)]">
                      {entry.sampleContexts.slice(0, 3).map((context) => (
                        <li key={context} className="rounded-xl border border-[var(--hairline)] px-3 py-2">{context}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <PassageSection locale={locale} title={copy.mainPassages} references={entry.mainPassages} />
        <PassageSection locale={locale} title={copy.relatedPassages} references={entry.relatedPassages} />

        {relatedEntries.length ? (
          <section className="glass rounded-xl p-5 sm:rounded-2xl sm:p-8 lg:p-10">
            <div className="section-title text-base">{copy.relatedEntries}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {relatedEntries.map((relatedEntry) => (
                <Link
                  key={relatedEntry.slug}
                  href={`/${locale}/hanja/${relatedEntry.slug}`}
                  className="rounded-full border border-[var(--hairline-strong)] px-3 py-1.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)]"
                >
                  {relatedEntry.character} · {(relatedEntry.title[locale] ?? relatedEntry.title.ko ?? relatedEntry.title.en ?? relatedEntry.slug)}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <div className="grid gap-8 xl:grid-cols-2">
          <SourceSection locale={locale} title={copy.supportive} body={copy.supportiveBody} sources={entry.supportiveSources} tone="supportive" />
          <SourceSection locale={locale} title={copy.critical} body={copy.criticalBody} sources={entry.criticalSources} tone="critical" />
        </div>
      </section>
    </main>
  );
}
