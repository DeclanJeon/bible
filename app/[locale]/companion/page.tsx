import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRight, BookOpen, Compass, Search } from "lucide-react";
import { PassageCard } from "@/components/passage-card";
import { NoteCard } from "@/components/note-card";
import { SourceList } from "@/components/source-list";
import { CrossReferenceSection } from "@/components/crossref-section";
import { buildCrossReferenceNetworkHref, FullNetworkCta } from "@/components/full-network-cta";
import { BookProfileCard } from "@/components/book-profile-card";
import { SafetyBanner } from "@/components/safety-banner";
import { TabSection } from "@/components/tab-section";
import { Collapsible } from "@/components/collapsible";
import { getPassage } from "@/lib/bible";
import { APP_SOURCES, getRelatedClustersFromReferences } from "@/lib/app-data";
import { UI_COPY, localizeSourceLinks, localizeStoryCluster, resolveAppLocale } from "@/lib/content";
import { getBookMetadata } from "@/lib/book-metadata";
import { getPassageCrossReferences } from "@/lib/knowledge";
import { buildBibleHref, buildCompanionHref, buildGraphHref, buildPassageHref, buildStudyHref } from "@/lib/navigation";
import { buildReflectionResponse } from "@/lib/reflection";
import { generateReflectionWithHermes } from "@/lib/hermes";
import { buildRagQueryPlan } from "@/lib/rag-query";
import { isRetrievalReliable, retrieveClusterForPrompt } from "@/lib/retrieval";
import { assessPromptSafety } from "@/lib/safety";
import { buildPageMetadata } from "@/lib/page-metadata";
import { resolveLocale } from "@/lib/server-locale";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ prompt?: string }>;
};

function preview(text: string) {
  return text.length > 220 ? `${text.slice(0, 220)}…` : text;
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
  const headerList = await headers();
  const appLocale = resolveAppLocale(requestedLocale);
  const defaultPrompt =
    appLocale === "ko"
      ? "성경 본문을 문맥과 연결 본문으로 공부하고 싶어요."
      : "Help me study a Bible passage with context and linked passages.";
  const userPrompt = prompt?.trim() || defaultPrompt;
  const safety = assessPromptSafety(userPrompt, {
    requestedLocale: appLocale,
    acceptLanguage: headerList.get("accept-language") ?? undefined,
    countryCode: headerList.get("x-vercel-ip-country") ?? headerList.get("cf-ipcountry") ?? undefined,
  });
  const copy = UI_COPY[appLocale].companion;
  const ragQuery = await buildRagQueryPlan(userPrompt, appLocale);
  const retrieval = await retrieveClusterForPrompt(userPrompt, appLocale, {
    queryPlan: ragQuery,
  });
  const answerBundle = retrieval.answerBundle ?? null;
  const questionUnderstanding = retrieval.question ?? answerBundle?.question ?? null;
  const hasReliablePrimary = isRetrievalReliable(retrieval);
  const localizedCluster = localizeStoryCluster(retrieval.cluster, appLocale);
  const primaryReference = retrieval.primaryReference;
  const primary = await getPassage(primaryReference, appLocale);
  const graphSuggestions = hasReliablePrimary ? await getPassageCrossReferences(primaryReference, 4, appLocale) : [];
  const fallbackLinkedTexts = graphSuggestions.map((suggestion) => ({
    label: suggestion.displayReference,
    type: "theme" as const,
    summary: suggestion.supportLine || suggestion.excerpt,
    reference: suggestion.target,
  }));
  const supportingReferences = hasReliablePrimary
    ? retrieval.supportingReferences.length
      ? retrieval.supportingReferences
      : localizedCluster.supporting.length
        ? localizedCluster.supporting
        : graphSuggestions.map((suggestion) => suggestion.target)
    : [];
  const cluster = {
    ...localizedCluster,
    primary: primaryReference,
    supporting: supportingReferences,
    linkedTexts: hasReliablePrimary && localizedCluster.linkedTexts.length ? localizedCluster.linkedTexts : fallbackLinkedTexts,
  };
  const supporting = await Promise.all(cluster.supporting.map((reference) => getPassage(reference, appLocale)));
  const deterministic = await buildReflectionResponse(cluster, userPrompt, appLocale, {
    retrieval,
    graphSuggestions,
    primaryReference,
    supportingReferences,
  });
  const primaryBookMetadata = getBookMetadata(primaryReference.code, appLocale);
  const relatedCodes = [
    primaryReference.code,
    ...supportingReferences.map((reference) => reference.code),
    ...graphSuggestions.map((suggestion) => suggestion.target.code),
  ];
  const relatedClusters = hasReliablePrimary
    ? getRelatedClustersFromReferences(cluster.slug, relatedCodes, 3).map((related) => localizeStoryCluster(related, appLocale))
    : [];
  const sources = localizeSourceLinks(APP_SOURCES, appLocale);
  const crossReferenceNetworkUrl = hasReliablePrimary ? buildCrossReferenceNetworkHref(primaryReference, appLocale) : null;
  const allowedEvidenceIds = ["primary", ...supportingReferences.map((_, index) => `supporting-${index}`)];

  const generation = await generateReflectionWithHermes(
    {
      prompt: userPrompt,
      safety,
      retrieval,
      cluster: {
        slug: cluster.slug,
        title: cluster.title,
        themes: cluster.themes,
        emotions: cluster.emotions,
        pastoralPrompt: cluster.pastoralPrompt,
        reflectionQuestions: cluster.reflectionQuestions,
      },
      primaryBookMetadata,
      linkedTexts: cluster.linkedTexts,
      context: cluster.context,
      jesusLayer: cluster.jesusLayer,
      paulLayer: cluster.paulLayer,
      jewishReception: cluster.jewishReception,
      graphSuggestions,
      crossReferenceSummary: null,
      crossReferenceHighlights: [],
      crossReferenceNetworkUrl,
      allowedEvidenceIds,
      deterministicReflection: deterministic,
    },
    deterministic,
  );
  const structuredReflection = {
    passageExplanations: deterministic.passageExplanations,
    passageBackground: deterministic.passageBackground,
    passageClaim: deterministic.passageClaim,
    userConnection: deterministic.userConnection,
    applicationBoundary: deterministic.applicationBoundary,
  };
  const hydratedResponse = {
    ...generation.response,
    ...structuredReflection,
    generationMode: generation.provider,
    generationModel: generation.model,
    generationNote: generation.note,
    answerPolicy: questionUnderstanding?.answerMode,
    questionUnderstanding,
  };

  const totalNotes = 4;
  const totalExplore = graphSuggestions.length + relatedClusters.length;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Header */}
      <header className="glass rounded-2xl px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center justify-between gap-3">
          <Link href={`/${appLocale}`} className="shrink-0 text-sm font-semibold text-[var(--ink)] sm:text-base">{UI_COPY[appLocale].siteTitle}</Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link href={buildBibleHref({ locale: appLocale })} className="rounded-lg border border-[var(--hairline-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)] min-h-[36px] flex items-center">
              {UI_COPY[appLocale].sidebar.navBible}
            </Link>
            <Link href={buildCompanionHref({ prompt: userPrompt, locale: "ko" })} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition min-h-[44px] min-w-[44px] items-center justify-center flex ${appLocale === "ko" ? "bg-[var(--gold)] text-[var(--canvas)]" : "border border-[var(--hairline-strong)] text-[var(--ink-muted)] hover:border-[var(--gold)]/30 hover:text-[var(--ink)]"}`}>KO</Link>
            <Link href={buildCompanionHref({ prompt: userPrompt, locale: "en" })} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition min-h-[44px] min-w-[44px] items-center justify-center flex ${appLocale !== "ko" ? "bg-[var(--gold)] text-[var(--canvas)]" : "border border-[var(--hairline-strong)] text-[var(--ink-muted)] hover:border-[var(--gold)]/30 hover:text-[var(--ink)]"}`}>EN</Link>
          </div>
        </div>
        <form action={`/${appLocale}/companion`} className="mt-3 flex items-center gap-2 sm:mt-4 sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--hairline-strong)] bg-[var(--surface-2)] px-3 py-2.5 sm:px-5 sm:py-3">
            <Search className="h-4 w-4 shrink-0 text-[var(--muted)] sm:h-5 sm:w-5" />
            <input type="text" name="prompt" defaultValue={userPrompt} required minLength={2} className="w-full min-w-0 flex-1 border-0 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] sm:text-base" />
          </div>
          <button type="submit" className="shrink-0 rounded-lg bg-[var(--gold)] px-4 py-2.5 text-xs font-semibold text-[var(--canvas)] transition hover:bg-[var(--gold)]/90 min-h-[44px] sm:px-5 sm:py-3 sm:text-sm">{UI_COPY[appLocale].prompt.submit}</button>
        </form>
      </header>

      {/* Hero Section — always visible */}
      <section className="mt-6 glass rounded-2xl p-5 sm:p-6 lg:rounded-3xl lg:mt-8 lg:p-8">
        <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--muted)] italic leading-relaxed sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base">&ldquo;{userPrompt}&rdquo;</div>
        <h1 className="mt-3 text-xl font-bold text-[var(--ink)] tracking-tight leading-tight sm:mt-5 sm:text-3xl lg:text-5xl">
          {hasReliablePrimary ? (answerBundle ? (appLocale === "ko" ? "성경 본문 묶음으로 답합니다" : "Answering with a Bible evidence bundle") : cluster.title) : appLocale === "ko" ? "더 구체적인 연결이 필요합니다" : "A more specific connection is needed"}
        </h1>
        <p className="mt-2 text-sm font-medium text-[var(--gold)]">
          {hasReliablePrimary ? primary.reference : appLocale === "ko" ? "낮은 신뢰도 검색" : "Low-confidence retrieval"}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] sm:text-lg lg:text-xl">{hydratedResponse.concernSummary}</p>
        <p className="mt-3 rounded-lg border border-[var(--gold-border)] bg-[var(--gold-soft)] px-4 py-3 text-sm leading-relaxed text-[var(--ink)]">{hydratedResponse.relevanceSummary}</p>
        {questionUnderstanding ? (
          <div className="mt-3 rounded-lg border border-[var(--hairline)] bg-[var(--surface-2)] px-4 py-3 text-sm leading-relaxed text-[var(--muted)]">
            <span className="font-semibold text-[var(--ink)]">{appLocale === "ko" ? "질문 이해" : "Question understood"}:</span>{" "}
            {questionUnderstanding.normalized} · {questionUnderstanding.answerMode}
          </div>
        ) : null}
        <div className="mt-3 sm:mt-5"><SafetyBanner safety={safety} /></div>

        {hasReliablePrimary ? (
          <div className="mt-8 rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold)]/[0.08] p-6 lg:p-8">
            <div className="text-base font-semibold text-[var(--gold)]">{primary.reference}</div>
            <div className="mt-4 space-y-4 text-lg leading-relaxed text-[var(--text)]">
              {primary.verses.slice(0, 3).map((verse) => (
                <p key={`${verse.code}-${verse.chapter}-${verse.verse}`}><span className="mr-3 text-[var(--gold)] font-medium">{verse.verse}</span>{verse.text}</p>
              ))}
            </div>
            {primary.verses.length > 3 && (
              <Collapsible trigger={<span>Show {primary.verses.length - 3} more verses</span>} className="mt-4">
                <div className="space-y-4 text-lg leading-relaxed text-[var(--text)]">
                  {primary.verses.slice(3).map((verse) => (
                    <p key={`${verse.code}-${verse.chapter}-${verse.verse}`}><span className="mr-3 text-[var(--gold)] font-medium">{verse.verse}</span>{verse.text}</p>
                  ))}
                </div>
              </Collapsible>
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href={buildStudyHref(cluster.slug, appLocale)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--gold)] px-5 py-3 text-sm font-semibold text-[var(--canvas)] hover:bg-[var(--gold)]/90 transition min-h-[44px]">
                <BookOpen className="h-4 w-4" />{copy.openStudyDesk}
              </Link>
              <Link href={buildGraphHref(cluster.slug, appLocale)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--hairline-strong)] px-5 py-3 text-sm font-semibold text-[var(--ink)] hover:border-[var(--gold)]/30 hover:text-[var(--gold)] transition min-h-[44px]">
                <Compass className="h-4 w-4" />{UI_COPY[appLocale].sidebar.navGraph}
              </Link>
              <Link href={buildPassageHref(primaryReference, appLocale)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--hairline-strong)] px-5 py-3 text-sm font-semibold text-[var(--ink)] hover:border-[var(--gold)]/30 hover:text-[var(--gold)] transition min-h-[44px]">
                {appLocale === "ko" ? "전체 본문 읽기" : "Read full passage"}
              </Link>
              <FullNetworkCta reference={primaryReference} locale={appLocale} />
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-[var(--hairline-strong)] bg-[var(--surface-2)] p-6 lg:p-8">
            <div className="text-base font-semibold text-[var(--gold)]">
              {appLocale === "ko" ? "본문 추천 보류" : "Passage recommendation paused"}
            </div>
            <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{hydratedResponse.whyTheseTexts}</p>
          </div>
        )}
      </section>

      {/* Doctrine Presentation Section */}
      {answerBundle?.doctrinePresentation ? (
        <section className="mt-6 glass rounded-2xl p-5 sm:p-6 lg:rounded-3xl lg:mt-8 lg:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/[0.08] px-4 py-2 text-sm font-semibold text-[var(--gold)]">
            {appLocale === "ko" ? "교리적 배경" : "Doctrinal Context"}
          </div>
          <div className="mt-4 rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] px-4 py-3 sm:px-5 sm:py-4">
            <div className="text-sm font-semibold text-[var(--ink)]">
              {appLocale === "ko" ? "공통 핵심" : "Shared Core"}
            </div>
            <p className="mt-2 text-base leading-relaxed text-[var(--muted)]">
              {answerBundle.doctrinePresentation.sharedCore.summary}
            </p>
            {answerBundle.doctrinePresentation.sharedCore.limits ? (
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] italic">
                {answerBundle.doctrinePresentation.sharedCore.limits}
              </p>
            ) : null}
          </div>
          {answerBundle.doctrinePresentation.mode !== "shared_core_only" ? (
            <div className="mt-4 rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] px-4 py-3 sm:px-5 sm:py-4">
              <div className="text-sm font-semibold text-[var(--ink)]">
                {appLocale === "ko" ? "전통별 해석 차이" : "Tradition Differences"}
              </div>
              <p className="mt-2 text-base leading-relaxed text-[var(--muted)]">
                {appLocale === "ko"
                  ? "이 주제는 기독교 전통마다 해석이 다를 수 있습니다. 아래에서 전통별 관점을 확인하세요."
                  : "This topic may be interpreted differently across Christian traditions. Check tradition-specific views below."}
              </p>
              {answerBundle.doctrinePresentation.views.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {answerBundle.doctrinePresentation.views.map((view) => (
                    <div key={view.tradition} className="rounded-lg border border-[var(--hairline)] bg-[var(--surface-1)] px-4 py-3">
                      <div className="text-sm font-semibold text-[var(--gold)]">{view.label}</div>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{view.summary}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] italic">
                  {appLocale === "ko"
                    ? "전통별 상세 데이터는 아직 준비 중입니다."
                    : "Tradition-specific detail data is not yet available."}
                </p>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Tabbed content */}
      <div className="mt-8">
        <TabSection
          defaultKey="passages"
          tabs={[
            {
              key: "passages",
              label: copy.primaryAndLinked,
              count: supporting.length,
              content: (
                <div>
                  <p className="text-base text-[var(--muted)] leading-relaxed mb-6">{copy.primaryAndLinkedBody}</p>
                  <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                    {supporting.map((passage, index) => (
                      <PassageCard
                        key={passage.reference}
                        title={passage.book?.name ?? cluster.supporting[index].code}
                        referenceLabel={passage.reference}
                        excerpt={preview(passage.verses.map((verse) => `${verse.verse}. ${verse.text}`).join(" "))}
                        href={buildPassageHref(cluster.supporting[index], appLocale)}
                        meta={`${copy.linkedText} ${index + 1}`}
                        actionLabel={appLocale === "ko" ? "전체 본문 보기" : "Read full passage"}
                      />
                    ))}
                  </div>
                </div>
              ),
            },
            {
              key: "explanation",
              label: copy.groundedResponse,
              content: (
                <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                  <div className="soft-glass rounded-2xl p-6">
                    <div className="section-title text-sm">{copy.whyThisStoryFirst}</div>
                    <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{hydratedResponse.whyTheseTexts}</p>
                  </div>
                  <div className="soft-glass rounded-2xl p-6">
                    <div className="section-title text-sm">{copy.personalConnection}</div>
                    <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{hydratedResponse.personalConnection}</p>
                  </div>
                  <div className="soft-glass rounded-2xl p-6">
                    <div className="section-title text-sm">{copy.datePlaceAudience}</div>
                    <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{hydratedResponse.datePlaceAudience}</p>
                  </div>
                  <div className="soft-glass rounded-2xl p-6">
                    <div className="section-title text-sm">{copy.jesusPaul}</div>
                    <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{hydratedResponse.jesusAndPaul}</p>
                  </div>
                </div>
              ),
            },
            {
              key: "notes",
              label: copy.sourcedNotes,
              count: totalNotes,
              content: (
                <div>
                  <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                    <NoteCard note={cluster.context.author} eyebrow={copy.notes.author} locale={appLocale} />
                    <NoteCard note={cluster.context.date} eyebrow={copy.notes.date} locale={appLocale} />
                    <NoteCard note={cluster.context.place} eyebrow={copy.notes.place} locale={appLocale} />
                    <NoteCard note={cluster.jewishReception} eyebrow={copy.notes.reception} locale={appLocale} />
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-5">
                    {primaryBookMetadata ? <BookProfileCard metadata={primaryBookMetadata} locale={appLocale} /> : null}
                    <div className="glass rounded-2xl p-6">
                      <div className="section-title text-sm">{copy.sourceInventory}</div>
                      <div className="mt-4"><SourceList sources={sources} compact locale={appLocale} /></div>
                    </div>
                  </div>
                </div>
              ),
            },
            {
              key: "reflection",
              label: copy.reflectionQuestions,
              count: hydratedResponse.reflectionQuestions.length,
              content: (
                <div className="space-y-4">
                  {hydratedResponse.reflectionQuestions.map((question) => (
                    <div key={question} className="soft-glass rounded-2xl p-5 text-base leading-relaxed text-[var(--muted)]">{question}</div>
                  ))}
                </div>
              ),
            },
            {
              key: "explore",
              label: copy.relatedLanes ?? "Explore",
              count: totalExplore,
              content: (
                <div className="space-y-8">
                  <CrossReferenceSection suggestions={graphSuggestions} locale={appLocale} />
                  {hasReliablePrimary ? <FullNetworkCta reference={primaryReference} locale={appLocale} /> : null}
                  {relatedClusters.length ? (
                    <div>
                      <div className="section-title text-base">{copy.relatedLanes}</div>
                      <p className="mt-3 text-base text-[var(--muted)] leading-relaxed">{copy.relatedLanesBody}</p>
                      <div className="mt-6 space-y-4">
                        {relatedClusters.map((related) => (
                          <Link key={related.slug} href={buildCompanionHref({ prompt: related.starterPrompt, locale: appLocale })} className="block rounded-2xl border border-[var(--hairline)] bg-[var(--surface-2)] p-5 transition hover:border-[var(--gold)]/25 hover:bg-[var(--surface-3)]">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="text-base font-semibold text-[var(--ink)]">{related.title}</div>
                                <p className="mt-2 text-base leading-relaxed text-[var(--muted)]">{related.pastoralPrompt}</p>
                              </div>
                              <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-[var(--gold)]" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      </div>
    </main>
  );
}
