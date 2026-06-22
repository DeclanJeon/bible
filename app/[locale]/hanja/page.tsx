import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenText, Languages } from "lucide-react";
import { SecondaryNav } from "@/components/secondary-nav";
import { PassagePanelLink } from "@/components/passage-panel";
import { getHanjaCatalogListEntries, getHanjaPublishedCharacterCount, type HanjaCatalogListEntry, type LocalizedHanjaText } from "@/lib/hanja-catalog";
import { buildBibleReferenceHref } from "@/lib/navigation";
import { buildPageMetadata } from "@/lib/page-metadata";
import { resolveLocale } from "@/lib/server-locale";

type Props = {
  params: Promise<{ locale: string }>;
};

function localizeText(text: LocalizedHanjaText, locale: "ko" | "en") {
  return text[locale] ?? text.ko ?? text.en ?? "";
}

function formatReferenceLabel(reference: { code: string; chapter: number; startVerse: number; endVerse: number }) {
  return `${reference.code} ${reference.chapter}:${reference.startVerse}${reference.endVerse > reference.startVerse ? `-${reference.endVerse}` : ""}`;
}

function summarizeEntry(entry: HanjaCatalogListEntry, locale: "ko" | "en") {
  const meaningSummary = localizeText(entry.meaningSummary ?? {}, locale);
  return {
    title: localizeText(entry.title, locale),
    thesis: localizeText(entry.thesis, locale),
    explanation: meaningSummary || localizeText(entry.explanation, locale),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  const title = locale === "ko" ? "한자" : "Hanja";
  const description =
    locale === "ko"
      ? "관련 링크 전체 수확으로 만든 한자 카탈로그와 연결 성경 본문, 지지 자료와 비판 자료를 별도 학습 면에서 탐색합니다."
      : "Browse the harvested Hanja catalog, linked Bible passages, and supportive or critical source lanes on a separate study surface.";

  return buildPageMetadata(locale, title, description, "/hanja");
}

export default async function HanjaPage({ params }: Props) {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  const [entries, generatedCount] = await Promise.all([getHanjaCatalogListEntries(), getHanjaPublishedCharacterCount()]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <SecondaryNav locale={locale} active="hanja" title={locale === "ko" ? "한자" : "Hanja"} />

      <section className="mt-8 space-y-8">
        <section className="glass rounded-xl p-5 sm:rounded-2xl sm:p-6 lg:p-8">
          <div className="section-title text-base">{locale === "ko" ? "전체 링크 수확 카탈로그" : "Full-link harvested catalog"}</div>
          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-4xl lg:text-5xl">
                {locale === "ko" ? "성경 본문과 함께 읽는 한자" : "Hanja read alongside Scripture"}
              </h1>
              <p className="mt-4 text-base leading-relaxed text-[var(--muted)] sm:text-lg">
                {locale === "ko"
                  ? "이 면은 관련링크.md에서 수집한 자료와 로컬 curated 항목을 함께 사용합니다. 각 카드는 문자별 출처 수, 연결 본문, 지지 자료와 비판 자료를 함께 보여 주며, 수동 항목이 없는 문자도 수집 결과를 바탕으로 생성된 상세 면으로 들어갈 수 있습니다."
                  : "This surface combines harvested source evidence from the related-links note with local curated entries. Each card shows source coverage, linked passages, and supportive or critical material, including generated detail pages for characters that were not hand-curated."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="soft-glass rounded-xl p-4">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--gold)]/[0.12] text-[var(--gold)]">
                  <Languages className="h-5 w-5" />
                </div>
                <div className="mt-4 text-2xl font-semibold tracking-tight text-[var(--ink)]">{entries.length}</div>
                <div className="mt-1 text-sm text-[var(--muted)]">{locale === "ko" ? "카탈로그 항목" : "Catalog entries"}</div>
              </div>
              <div className="soft-glass rounded-xl p-4">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--gold)]/[0.12] text-[var(--gold)]">
                  <BookOpenText className="h-5 w-5" />
                </div>
                <div className="mt-4 text-2xl font-semibold tracking-tight text-[var(--ink)]">
                  {entries.reduce((sum, entry) => sum + entry.mainPassages.length + entry.relatedPassages.length, 0)}
                </div>
                <div className="mt-1 text-sm text-[var(--muted)]">{locale === "ko" ? "연결 성경 본문" : "Linked Bible passages"}</div>
              </div>
              <div className="soft-glass rounded-xl p-4">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--gold)]/[0.12] text-[var(--gold)]">
                  <ArrowRight className="h-5 w-5" />
                </div>
                <div className="mt-4 text-2xl font-semibold tracking-tight text-[var(--ink)]">{generatedCount}</div>
                <div className="mt-1 text-sm text-[var(--muted)]">{locale === "ko" ? "수확 기반 문자 집계" : "Harvested character aggregates"}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="glass rounded-xl p-5 sm:rounded-2xl sm:p-8 lg:p-10">
          <div>
            <div className="section-title text-base">{locale === "ko" ? "카탈로그" : "Catalog"}</div>
            <p className="mt-2 text-base leading-relaxed text-[var(--muted)]">
              {locale === "ko"
                ? "각 항목 카드에서 문자, 핵심 논지, 연결 본문, 출처 수를 확인한 뒤 상세 면으로 들어갑니다. 수동 curated 항목은 먼저 보이고, 그 뒤에 수집 결과만으로 생성된 문자 항목이 이어집니다."
                : "Each card previews its character, thesis, linked passages, and source coverage before you open the detail view. Curated entries appear first, followed by generated entries built purely from harvested evidence."}
            </p>
          </div>

          {entries.length ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {entries.map((entry) => {
                const summary = summarizeEntry(entry, locale);
                const primaryReference = entry.mainPassages[0] ?? entry.relatedPassages[0] ?? null;
                const coverage = entry.sourceCount ?? entry.supportiveSourceIds.length + entry.criticalSourceIds.length;
                return (
                  <article key={entry.slug} className="soft-glass rounded-xl p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
                          {entry.reading || entry.character}
                        </div>
                        <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--ink)]">{entry.character}</h2>
                        <div className="mt-2 text-lg font-semibold tracking-tight text-[var(--ink)]">{summary.title}</div>
                      </div>
                      <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-[var(--gold)]" />
                    </div>

                    <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{summary.thesis}</p>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--ink-subtle)]">{summary.explanation}</p>

                    <div className="mt-5 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-[var(--hairline-strong)] px-2.5 py-1 font-semibold text-[var(--ink)]">
                        {entry.entryType === "curated"
                          ? locale === "ko"
                            ? "curated"
                            : "curated"
                          : locale === "ko"
                            ? "generated"
                            : "generated"}
                      </span>
                      <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-1 font-semibold text-sky-200">
                        {locale === "ko" ? `출처 ${coverage}` : `Sources ${coverage}`}
                      </span>
                      <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-200">
                        {locale === "ko" ? `지지 ${entry.supportiveSourceIds.length}` : `Supportive ${entry.supportiveSourceIds.length}`}
                      </span>
                      <span className="rounded-full border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 font-semibold text-rose-200">
                        {locale === "ko" ? `비판 ${entry.criticalSourceIds.length}` : `Critical ${entry.criticalSourceIds.length}`}
                      </span>
                      {entry.keywords.slice(0, 3).map((keyword) => (
                        <span key={keyword} className="chip text-xs text-[var(--ink)]">
                          {keyword}
                        </span>
                      ))}
                    </div>

                    {entry.mainPassages.length ? (
                      <div className="mt-5">
                        <div className="text-sm font-semibold text-[var(--ink)]">{locale === "ko" ? "주요 본문" : "Primary passages"}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {entry.mainPassages.slice(0, 3).map((reference) => (
                            <PassagePanelLink
                              key={`${entry.slug}-${reference.code}-${reference.chapter}-${reference.startVerse}-${reference.endVerse}`}
                              href={buildBibleReferenceHref(reference, { locale, from: "hanja" })}
                              reference={reference}
                              locale={locale}
                              contextTitle={locale === "ko" ? `${summary.title}와 연결되는 이유` : `Why this passage connects to ${summary.title}`}
                              contextBody={[summary.thesis, summary.explanation].filter(Boolean).join(" ")}
                              contextMeta={entry.reading || entry.character}
                              className="rounded-full border border-[var(--hairline-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)]"
                            >
                              {formatReferenceLabel(reference)}
                            </PassagePanelLink>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-6 flex flex-wrap gap-3">
                      <Link
                        href={`/${locale}/hanja/${entry.slug}`}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[var(--gold)] px-5 py-3 text-sm font-semibold text-[var(--canvas)] transition hover:bg-[var(--gold-hover)]"
                      >
                        {locale === "ko" ? "항목 열기" : "Open entry"}
                      </Link>
                      {primaryReference ? (
                        <PassagePanelLink
                          href={buildBibleReferenceHref(primaryReference, { locale, from: "hanja" })}
                          reference={primaryReference}
                          locale={locale}
                          contextTitle={locale === "ko" ? `${summary.title}와 연결되는 이유` : `Why this passage connects to ${summary.title}`}
                          contextBody={[summary.thesis, summary.explanation].filter(Boolean).join(" ")}
                          contextMeta={entry.reading || entry.character}
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--hairline-strong)] px-5 py-3 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)]"
                        >
                          {locale === "ko" ? "본문 읽기" : "Read passage"}
                        </PassagePanelLink>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-8 rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)] p-6 text-base leading-relaxed text-[var(--muted)]">
              {locale === "ko" ? "한자 카탈로그에 아직 항목이 없습니다." : "The Hanja catalog does not contain any entries yet."}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
