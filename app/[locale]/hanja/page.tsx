import { HanjaCatalogSearch } from "@/components/hanja-catalog-search";

import type { Metadata } from "next";
import { getHanjaCatalogListEntries, getHanjaPublishedCharacterCount, type LocalizedHanjaText } from "@/lib/hanja-catalog";



import { buildPageMetadata } from "@/lib/page-metadata";
import { resolveLocale } from "@/lib/server-locale";

type Props = {
  params: Promise<{ locale: string }>;
};

function localizeText(text: LocalizedHanjaText, locale: "ko" | "en") {
  return text[locale] ?? text.ko ?? text.en ?? "";
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

  const searchableEntries = entries.map((entry) => ({
    slug: entry.slug,
    character: entry.character,
    reading: entry.reading,
    title: localizeText(entry.title, locale),
    thesis: localizeText(entry.thesis, locale),
    explanation: localizeText(entry.meaningSummary ?? {}, locale) || localizeText(entry.explanation, locale),
    mainPassages: entry.mainPassages,
    sourceCount: entry.sourceCount ?? entry.supportiveSourceIds.length + entry.criticalSourceIds.length,
  }));

  return (
    <main className="page-shell">
      <section className="mt-8 space-y-8">
        <section className="glass rounded-xl p-5 sm:rounded-2xl sm:p-6 lg:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="section-title text-base">{locale === "ko" ? "한자" : "Hanja"}</div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-4xl">
                {locale === "ko" ? "성경 본문과 함께 읽는 한자" : "Hanja read alongside Scripture"}
              </h1>
              <p className="mt-2 text-base leading-relaxed text-ink-muted">
                {locale === "ko"
                  ? `${entries.length}개 항목을 관련 성경 본문, 지지 자료, 비판 자료와 함께 탐색합니다.`
                  : `Browse ${entries.length} entries linked to Bible passages, supportive sources, and critical sources.`}
              </p>
            </div>
            <div className="flex gap-3">
              <div className="rounded-card border border-[var(--hairline)] bg-surface-2 px-4 py-2.5 text-center">
                <div className="text-lg font-bold text-ink">{entries.reduce((sum, e) => sum + e.mainPassages.length + e.relatedPassages.length, 0)}</div>
                <div className="text-[11px] text-ink-subtle">{locale === "ko" ? "연결 본문" : "Passages"}</div>
              </div>
              <div className="rounded-card border border-[var(--hairline)] bg-surface-2 px-4 py-2.5 text-center">
                <div className="text-lg font-bold text-ink">{generatedCount}</div>
                <div className="text-[11px] text-ink-subtle">{locale === "ko" ? "수확 문자" : "Characters"}</div>
              </div>
            </div>
          </div>
        </section>

        <HanjaCatalogSearch
          entries={searchableEntries}
          locale={locale}
          copy={{
            searchPlaceholder: locale === "ko" ? "한자, 음독, 뜻으로 검색…" : "Search by character, reading, or meaning…",
            all: locale === "ko" ? "전체" : "All",
            bySources: locale === "ko" ? "출처순" : "By sources",
            readInBible: locale === "ko" ? "성경에서 읽기" : "Read in Bible",
            noResults: locale === "ko" ? "일치하는 항목이 없습니다" : "No matching entries",
            showMore: locale === "ko" ? "더 보기" : "Show more",
            sources: locale === "ko" ? "출처" : "sources",
          }}
        />
      </section>
    </main>
  );
}