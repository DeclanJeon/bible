import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRight, BookOpen, Compass, Search } from "lucide-react";
import { PassageCard } from "@/components/passage-card";
import { NoteCard } from "@/components/note-card";
import { SourceList } from "@/components/source-list";
import { CrossReferenceSection } from "@/components/crossref-section";
import { BookProfileCard } from "@/components/book-profile-card";
import { SafetyBanner } from "@/components/safety-banner";
import { TabSection } from "@/components/tab-section";
import { Collapsible } from "@/components/collapsible";
import { getPassage } from "@/lib/bible";
import { APP_SOURCES, getRelatedClusters } from "@/lib/app-data";
import { UI_COPY, localizeSourceLinks, localizeStoryCluster, resolveAppLocale } from "@/lib/content";
import { getBookMetadata } from "@/lib/book-metadata";
import { getPassageCrossReferences } from "@/lib/knowledge";
import { buildBibleHref, buildCompanionHref, buildGraphHref, buildPassageHref, buildStudyHref } from "@/lib/navigation";
import { buildReflectionResponse } from "@/lib/reflection";
import { retrieveClusterForPrompt } from "@/lib/retrieval";
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
  const retrieval = await retrieveClusterForPrompt(userPrompt, appLocale);
  const localizedCluster = localizeStoryCluster(retrieval.cluster, appLocale);
  const primary = await getPassage(localizedCluster.primary, appLocale);
  const graphSuggestions = await getPassageCrossReferences(localizedCluster.primary, 4, appLocale);
  const fallbackLinkedTexts = graphSuggestions.map((suggestion) => ({
    label: suggestion.displayReference,
    type: "theme" as const,
    summary: suggestion.supportLine || suggestion.excerpt,
    reference: suggestion.target,
  }));
  const supportingReferences = localizedCluster.supporting.length
    ? localizedCluster.supporting
    : graphSuggestions.map((suggestion) => suggestion.target);
  const cluster = {
    ...localizedCluster,
    supporting: supportingReferences,
    linkedTexts: localizedCluster.linkedTexts.length ? localizedCluster.linkedTexts : fallbackLinkedTexts,
  };
  const supporting = await Promise.all(cluster.supporting.map((reference) => getPassage(reference, appLocale)));
  const deterministic = await buildReflectionResponse(cluster, userPrompt, appLocale);
  const primaryBookMetadata = getBookMetadata(cluster.primary.code, appLocale);
  const relatedClusters = getRelatedClusters(cluster.slug, 3).map((related) => localizeStoryCluster(related, appLocale));
  const sources = localizeSourceLinks(APP_SOURCES, appLocale);

  const hydratedResponse = {
    ...deterministic,
    generationMode: "deterministic" as const,
    generationModel: deterministic.generationModel,
    generationNote: deterministic.generationNote,
  };

  const totalNotes = 4;
  const totalExplore = graphSuggestions.length + relatedClusters.length;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-8 lg:px-8">
      {/* Header */}
      <header className="glass rounded-[28px] px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Link href={`/${appLocale}`} className="text-base font-semibold text-white">{UI_COPY[appLocale].siteTitle}</Link>
          <form action={`/${appLocale}/companion`} className="flex flex-1 items-center gap-3 lg:max-w-xl">
            <div className="flex flex-1 items-center gap-3 rounded-full border border-white/15 bg-white/[0.06] px-5 py-3">
              <Search className="h-5 w-5 shrink-0 text-[var(--muted)]" />
              <input type="text" name="prompt" defaultValue={userPrompt} className="flex-1 min-w-0 border-0 bg-transparent text-base text-white outline-none placeholder:text-[var(--muted)]" />
            </div>
            <button type="submit" className="shrink-0 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--accent)]/90 transition">{UI_COPY[appLocale].prompt.submit}</button>
          </form>
          <div className="flex items-center gap-2">
            <Link href={buildBibleHref({ locale: appLocale })} className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)]">
              {UI_COPY[appLocale].sidebar.navBible}
            </Link>
            <Link href={buildCompanionHref({ prompt: userPrompt, locale: "ko" })} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${appLocale === "ko" ? "bg-[var(--accent)] text-white" : "border border-white/15 text-white hover:border-[var(--gold)]/30 hover:text-[var(--gold)]"}`}>KO</Link>
            <Link href={buildCompanionHref({ prompt: userPrompt, locale: "en" })} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${appLocale !== "ko" ? "bg-[var(--accent)] text-white" : "border border-white/15 text-white hover:border-[var(--gold)]/30 hover:text-[var(--gold)]"}`}>EN</Link>
          </div>
        </div>
      </header>

      {/* Hero Section — always visible */}
      <section className="mt-8 glass rounded-[32px] p-8 lg:p-10">
        <div className="rounded-[20px] border border-white/8 bg-white/[0.04] px-5 py-4 text-base text-[var(--muted)] italic leading-relaxed">&ldquo;{userPrompt}&rdquo;</div>
        <h1 className="mt-6 text-4xl font-bold text-white lg:text-5xl leading-tight">{cluster.title}</h1>
        <p className="mt-4 text-xl leading-relaxed text-[var(--muted)]">{hydratedResponse.concernSummary}</p>
        <div className="mt-5"><SafetyBanner safety={safety} /></div>

        {/* Primary Passage with Collapsible verses */}
        <div className="mt-8 rounded-[28px] border border-[var(--gold)]/25 bg-[var(--gold)]/[0.08] p-6 lg:p-8">
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
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={buildStudyHref(cluster.slug, appLocale)} className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--accent)]/90 transition">
              <BookOpen className="h-4 w-4" />{copy.openStudyDesk}
            </Link>
            <Link href={buildGraphHref(cluster.slug, appLocale)} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:border-[var(--gold)]/30 hover:text-[var(--gold)] transition">
              <Compass className="h-4 w-4" />{UI_COPY[appLocale].sidebar.navGraph}
            </Link>
            <Link href={buildPassageHref(cluster.primary, appLocale)} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:border-[var(--gold)]/30 hover:text-[var(--gold)] transition">
              {appLocale === "ko" ? "전체 본문 읽기" : "Read full passage"}
            </Link>
          </div>
        </div>
      </section>

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
                  <div className="grid gap-5 lg:grid-cols-2">
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
                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="soft-glass rounded-[24px] p-6">
                    <div className="section-title text-sm">{copy.whyThisStoryFirst}</div>
                    <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{hydratedResponse.whyTheseTexts}</p>
                  </div>
                  <div className="soft-glass rounded-[24px] p-6">
                    <div className="section-title text-sm">{copy.personalConnection}</div>
                    <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{hydratedResponse.personalConnection}</p>
                  </div>
                  <div className="soft-glass rounded-[24px] p-6">
                    <div className="section-title text-sm">{copy.datePlaceAudience}</div>
                    <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{hydratedResponse.datePlaceAudience}</p>
                  </div>
                  <div className="soft-glass rounded-[24px] p-6">
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
                  <div className="grid gap-5 lg:grid-cols-2">
                    <NoteCard note={cluster.context.author} eyebrow={copy.notes.author} locale={appLocale} />
                    <NoteCard note={cluster.context.date} eyebrow={copy.notes.date} locale={appLocale} />
                    <NoteCard note={cluster.context.place} eyebrow={copy.notes.place} locale={appLocale} />
                    <NoteCard note={cluster.jewishReception} eyebrow={copy.notes.reception} locale={appLocale} />
                  </div>
                  <div className="mt-6 grid gap-5 lg:grid-cols-2">
                    {primaryBookMetadata ? <BookProfileCard metadata={primaryBookMetadata} locale={appLocale} /> : null}
                    <div className="glass rounded-[24px] p-6">
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
                    <div key={question} className="soft-glass rounded-[24px] p-5 text-base leading-relaxed text-[var(--muted)]">{question}</div>
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
                  {relatedClusters.length ? (
                    <div>
                      <div className="section-title text-base">{copy.relatedLanes}</div>
                      <p className="mt-3 text-base text-[var(--muted)] leading-relaxed">{copy.relatedLanesBody}</p>
                      <div className="mt-6 space-y-4">
                        {relatedClusters.map((related) => (
                          <Link key={related.slug} href={buildCompanionHref({ prompt: related.starterPrompt, locale: appLocale })} className="block rounded-[24px] border border-white/10 bg-white/[0.04] p-5 transition hover:border-[var(--gold)]/25 hover:bg-white/[0.06]">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="text-base font-semibold text-white">{related.title}</div>
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
