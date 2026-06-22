import type { Metadata } from "next";

import Link from "next/link";
import { ArrowRight, BookOpenText, Search } from "lucide-react";
import { PassageCard } from "@/components/passage-card";
import { SafetyBanner } from "@/components/safety-banner";
import { Collapsible } from "@/components/collapsible";

import { UI_COPY, resolveAppLocale } from "@/lib/content";
import { buildBibleHref } from "@/lib/navigation";
import { buildPageMetadata } from "@/lib/page-metadata";
import { buildPassageRecommendation } from "@/lib/passage-response";
import { getBookMetadata } from "@/lib/book-metadata";
import { resolveLocale } from "@/lib/server-locale";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ prompt?: string }>;
};

function preview(text: string, max = 220) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function compactLines(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function formatDuration(seconds: number | undefined) {
  if (!seconds || seconds < 1) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function youtubeMatchLabel(locale: string, matchType: "exact" | "book" | "keyword") {
  if (locale === "ko") {
    switch (matchType) {
      case "exact":
        return "본문 직접 일치";
      case "book":
        return "같은 책 기준";
      default:
        return "주제어 기준";
    }
  }

  switch (matchType) {
    case "exact":
      return "Exact passage match";
    case "book":
      return "Same book match";
    default:
      return "Keyword match";
  }
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  const copy = UI_COPY[locale].companion;
  const title = locale === "ko" ? "컴패니언" : "Companion";

  return buildPageMetadata(locale, title, copy.primaryAndLinkedBody, "/companion");
}

export default async function CompanionPage({ params, searchParams }: Props) {
  const [{ locale: requestedLocale }, { prompt }] = await Promise.all([params, searchParams]);
  const appLocale = resolveAppLocale(requestedLocale);
  const defaultPrompt =
    appLocale === "ko"
      ? "성경 본문을 문맥과 연결 본문으로 공부하고 싶어요."
      : "Help me study a Bible passage with context and linked passages.";
  const userPrompt = prompt?.trim() || defaultPrompt;
  const build = await buildPassageRecommendation(userPrompt, {
    locale: appLocale,
  });

  const { recommendation, safety, questionUnderstanding, ragQuery, primaryPassage, relatedPassageDetails } = build;
  const youtubeResources = recommendation.externalResources?.youtube ?? recommendation.background?.youtubeResources ?? [];
  const primaryBookCode = recommendation.primary?.reference.code;
  const primaryBookMetadata = primaryBookCode ? getBookMetadata(primaryBookCode, appLocale) : undefined;
  const referenceSources = primaryBookMetadata?.notes.authorship.sources.filter(
    (s) => s.label === "Wikipedia" || s.label === "한국어 위키피디아" || s.label === "나무위키"
  ) ?? [];

  return (
    <main className="page-shell">

      <section className="mt-6 glass rounded-2xl p-5 sm:p-6 lg:rounded-3xl lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="section-title text-base">{appLocale === "ko" ? "사용자 입력" : "Prompt"}</div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl lg:text-5xl">
              {appLocale === "ko" ? "가장 연결되는 본문부터 읽습니다" : "Start with the most connected passage"}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--muted)] sm:text-lg">
              {appLocale === "ko"
                ? "질문을 성경의 언어로 다시 읽고, 중심 본문과 연결 본문을 먼저 제시한 뒤 배경과 문맥을 붙입니다."
                : "The companion rewrites the question in biblical language, then starts with a primary passage, related passages, and compact background context."}
            </p>
          </div>
          <Link
            href={buildBibleHref({ locale: appLocale })}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--hairline-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)]"
          >
            <BookOpenText className="h-4 w-4" />
            {UI_COPY[appLocale].sidebar.navBible}
          </Link>
        </div>
        <form action={`/${appLocale}/companion`} className="mt-5 flex items-center gap-2 sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--hairline-strong)] bg-[var(--surface-2)] px-3 py-2.5 sm:px-5 sm:py-3">
            <Search className="h-4 w-4 shrink-0 text-[var(--muted)] sm:h-5 sm:w-5" />
            <input
              type="text"
              name="prompt"
              defaultValue={recommendation.prompt}
              required
              minLength={2}
              className="w-full min-w-0 flex-1 border-0 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] sm:text-base"
            />
          </div>
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-[var(--gold)] px-4 py-2.5 text-xs font-semibold text-[var(--canvas)] transition hover:bg-[var(--gold)]/90 min-h-[44px] sm:px-5 sm:py-3 sm:text-sm"
          >
            {UI_COPY[appLocale].prompt.submit}
          </button>
        </form>
        <Collapsible
          trigger={
            <span className="text-sm font-semibold text-[var(--ink-muted)]">
              {appLocale === "ko" ? "검색 메모 보기" : "View search notes"}
            </span>
          }
          className="mt-4"
        >
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] px-4 py-3 text-sm leading-relaxed text-[var(--ink-muted)]">
              &ldquo;{recommendation.prompt}&rdquo;
            </div>
            <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] px-4 py-3 text-sm leading-relaxed text-[var(--ink-muted)]">
              <span className="font-semibold text-[var(--ink)]">{appLocale === "ko" ? "질문 이해" : "Question understood"}:</span>{" "}
              {recommendation.normalizedQuestion}
              <span className="mx-2 text-[var(--hairline)]">·</span>
              {questionUnderstanding.answerMode}
              <span className="mx-2 text-[var(--hairline)]">·</span>
              {recommendation.state}
            </div>
          </div>
        </Collapsible>
        <div className="mt-4">
          <SafetyBanner safety={safety} />
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)] lg:items-start">
        <div className="space-y-6">
          <article className="rounded-2xl border border-[var(--gold)]/20 bg-[var(--gold)]/[0.08] p-5 sm:p-6 lg:p-8">
            <div className="section-title text-base">{appLocale === "ko" ? "메인 성구" : "Primary passage"}</div>
            {recommendation.primary && primaryPassage && (recommendation.state === "direct" || recommendation.state === "safety_first") ? (
              <>
                <div className="mt-3 text-lg font-semibold text-[var(--gold)]">{primaryPassage.reference}</div>
                <div className="mt-5 space-y-4 text-lg leading-relaxed text-[var(--ink)]">
                  {primaryPassage.verses.map((verse) => (
                    <p key={`${verse.code}-${verse.chapter}-${verse.verse}`}>
                      <span className="mr-3 text-[var(--gold)] font-medium">{verse.verse}</span>
                      {verse.text}
                    </p>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  {recommendation.readerHref ? (
                    <Link
                      href={recommendation.readerHref}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[var(--gold)] px-4 py-2.5 text-sm font-semibold text-[var(--canvas)] transition hover:bg-[var(--gold)]/90"
                    >
                      {appLocale === "ko" ? "이 본문을 성경 전체 문맥에서 읽기" : "Read in the Bible reader"}
                    </Link>
                  ) : null}
                  <Link
                    href={buildBibleHref({ book: recommendation.primary.reference.code, chapter: recommendation.primary.reference.chapter, locale: appLocale })}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--hairline-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)]"
                  >
                    {appLocale === "ko" ? "이 장 전체 보기" : "Read the whole chapter"}
                  </Link>
                </div>
              </>
            ) : recommendation.primary && primaryPassage ? (
              <>
                <div className="mt-3 text-lg font-semibold text-[var(--gold)]">
                  {appLocale === "ko" ? "잠정 후보 본문" : "Tentative candidate passage"}
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{primaryPassage.reference}</p>
                <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{recommendation.clarifyPrompt}</p>
                <div className="mt-4 rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] px-4 py-3 text-sm leading-7 text-[var(--muted)]">
                  {preview(primaryPassage.verses.map((verse) => `${verse.verse}. ${verse.text}`).join(" "), 260)}
                </div>
                {recommendation.readerHref ? (
                  <div className="mt-5">
                    <Link
                      href={recommendation.readerHref}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--hairline-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)]"
                    >
                      {appLocale === "ko" ? "후보 본문을 직접 확인하기" : "Inspect the candidate passage"}
                    </Link>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className="mt-3 text-lg font-semibold text-[var(--gold)]">
                  {recommendation.state === "unsupported"
                    ? appLocale === "ko"
                      ? "본문 추천 보류"
                      : "No direct passage yet"
                    : appLocale === "ko"
                      ? "잠정 후보"
                      : "Tentative candidate"}
                </div>
                <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
                  {recommendation.clarifyPrompt ??
                    (appLocale === "ko"
                      ? "질문을 조금 더 구체적으로 적으면 더 직접 연결되는 성구를 찾을 수 있습니다."
                      : "A more specific prompt will help the companion find a more directly connected passage.")}
                </p>
              </>
            )}
          </article>

          <section className="glass rounded-2xl p-5 sm:p-6 lg:p-8">
            <div className="section-title text-base">{appLocale === "ko" ? "왜 이 성구인가" : "Why this passage fits"}</div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-2)] p-5">
                <div className="text-sm font-semibold text-[var(--ink)]">{appLocale === "ko" ? "질문 요약" : "Concern summary"}</div>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  {recommendation.explanation?.userConcernSummary ?? recommendation.clarifyPrompt}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-2)] p-5">
                <div className="text-sm font-semibold text-[var(--ink)]">{appLocale === "ko" ? "직접 연결 근거" : "Direct connection"}</div>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  {recommendation.explanation?.connectionToUser ?? compactLines(recommendation.clarifyPrompt)}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-2)] p-5">
                <div className="text-sm font-semibold text-[var(--ink)]">{appLocale === "ko" ? "본문 선택 이유" : "Why this text"}</div>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  {recommendation.explanation?.whyThisPassage ?? compactLines(recommendation.clarifyPrompt)}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-2)] p-5">
                <div className="text-sm font-semibold text-[var(--ink)]">{appLocale === "ko" ? "경계와 한계" : "Limits"}</div>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  {recommendation.explanation?.limits ??
                    (recommendation.state === "unsupported"
                      ? appLocale === "ko"
                        ? "본문을 억지로 끼워 맞추지 않고, 더 분명한 질문을 기다립니다."
                        : "The companion waits for a clearer question rather than forcing a weak passage."
                      : compactLines(recommendation.clarifyPrompt))}
                </p>
              </div>
            </div>
          </section>

          <section className="glass rounded-2xl p-5 sm:p-6 lg:p-8">
            <div className="section-title text-base">{appLocale === "ko" ? "관련 성구" : "Related passages"}</div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {appLocale === "ko"
                ? "메인 성구를 넓히거나 교차 검증하는 본문들입니다. 넓은 화면에서는 우측 패널에서 바로 읽고, 필요하면 성경 리더 전체 화면으로 이어서 볼 수 있습니다."
                : "These passages widen or cross-check the main passage. On wider screens they open in a side panel first, with a full Bible reader fallback when you want more context."}
            </p>
            {relatedPassageDetails.length ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {relatedPassageDetails.map((card) => (
                  <PassageCard
                    key={`${card.reference.code}-${card.reference.chapter}-${card.reference.startVerse}-${card.reference.endVerse}`}
                    title={card.title}
                    referenceLabel={card.referenceLabel}
                    excerpt={preview(card.excerpt)}
                    href={card.href}
                    reference={card.reference}
                    locale={appLocale}
                    meta={card.reason}
                    panelContextTitle={appLocale === "ko" ? "이 본문이 지금 질문과 연결되는 이유" : "How this passage connects to your question"}
                    panelContextBody={card.reason}
                    panelContextMeta={card.referenceLabel}
                    actionLabel={appLocale === "ko" ? "성경 리더에서 읽기" : "Read in reader"}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm leading-6 text-[var(--muted)]">
                {appLocale === "ko"
                  ? "현재는 확장할 만큼 직접 연결된 관련 성구가 충분하지 않습니다."
                  : "There are not enough directly connected passages to expand confidently yet."}
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-[calc(var(--nav-height)+1.5rem)]">
          {recommendation.background ? (
            <section className="glass rounded-2xl p-5 sm:p-6">
              <div className="section-title text-base">{appLocale === "ko" ? "배경과 역사" : "Background and history"}</div>
              <div className="mt-4 space-y-4 text-sm leading-7 text-ink-muted">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">{appLocale === "ko" ? "책과 이야기" : "Book and story"}</div>
                  <p className="mt-1.5">{recommendation.background.storyContext}</p>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">{appLocale === "ko" ? "정경적 문맥" : "Canonical context"}</div>
                  <p className="mt-1.5">{recommendation.background.canonicalContext}</p>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">{appLocale === "ko" ? "시대·장소·청중" : "Date / place / audience"}</div>
                  <p className="mt-1.5">
                    {compactLines(recommendation.background.date)} {compactLines(recommendation.background.place)} {compactLines(recommendation.background.audience)}
                  </p>
                </div>
                {recommendation.background.author ? (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">{appLocale === "ko" ? "저자" : "Author"}</div>
                    <p className="mt-1.5">{recommendation.background.author}</p>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {referenceSources.length ? (
            <section className="glass rounded-2xl p-5 sm:p-6">
              <div className="section-title text-base">{appLocale === "ko" ? "참고 링크" : "Reference links"}</div>
              <div className="mt-4 space-y-2">
                {referenceSources.map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="source-link flex items-center gap-2 text-sm"
                  >
                    {source.label}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {youtubeResources.length ? (
            <section className="glass rounded-2xl p-5 sm:p-6">
              <div className="section-title text-base">{appLocale === "ko" ? "관련 영상" : "Related videos"}</div>
              <div className="mt-4 space-y-3">
                {youtubeResources.slice(0, 3).map((resource) => (
                  <a
                    key={resource.videoId}
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-[var(--hairline)] bg-surface-2 p-3.5 transition hover:border-[var(--hairline-hover)]"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">
                      {youtubeMatchLabel(appLocale, resource.matchType)}
                      {resource.durationSeconds ? ` · ${formatDuration(resource.durationSeconds)}` : ""}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-ink leading-snug">{resource.title}</div>
                    <p className="mt-1 text-xs text-ink-subtle">{resource.channelTitle}</p>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          <section className="glass rounded-2xl p-5 sm:p-6">
            <div className="section-title text-base">{appLocale === "ko" ? "계속 읽기" : "Continue reading"}</div>
            <div className="mt-4 space-y-2.5">
              <Link
                href={buildBibleHref({ locale: appLocale })}
                className="flex items-center justify-between rounded-xl border border-[var(--hairline)] bg-surface-2 px-4 py-3 text-sm font-semibold text-ink transition hover:border-[var(--hairline-hover)] hover:text-gold"
              >
                <span>{UI_COPY[appLocale].sidebar.navBible}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              {recommendation.primary ? (
                <Link
                  href={buildBibleHref({ book: recommendation.primary.reference.code, chapter: recommendation.primary.reference.chapter, locale: appLocale })}
                  className="flex items-center justify-between rounded-xl border border-[var(--hairline)] bg-surface-2 px-4 py-3 text-sm font-semibold text-ink transition hover:border-[var(--hairline-hover)] hover:text-gold"
                >
                  <span>{appLocale === "ko" ? "이 책과 장 계속 읽기" : "Keep reading this chapter"}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </section>

          <section className="glass rounded-2xl p-5 sm:p-6">
            <div className="section-title text-base">{appLocale === "ko" ? "검색 메모" : "Search notes"}</div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-ink-muted">
              <p>
                <span className="font-semibold text-ink">{appLocale === "ko" ? "응답 모드" : "Answer mode"}:</span>{" "}
                {questionUnderstanding.answerMode}
              </p>
              <p>
                <span className="font-semibold text-ink">{appLocale === "ko" ? "검색 확장" : "Query expansion"}:</span>{" "}
                {ragQuery.expansionProvider}
              </p>
              <p>
                <span className="font-semibold text-ink">{appLocale === "ko" ? "신뢰도" : "Confidence"}:</span>{" "}
                {recommendation.confidence}
              </p>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
