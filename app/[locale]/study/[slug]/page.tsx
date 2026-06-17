import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Compass, Sparkles } from "lucide-react";
import { PassageCard } from "@/components/passage-card";
import { NoteCard } from "@/components/note-card";
import { SourceList } from "@/components/source-list";
import { CrossReferenceSection } from "@/components/crossref-section";
import { BookProfileCard } from "@/components/book-profile-card";
import { SecondaryNav } from "@/components/secondary-nav";
import { TabSection } from "@/components/tab-section";
import { AccordionGroup } from "@/components/accordion-group";
import { Collapsible } from "@/components/collapsible";
import { getChapterContext, getPassage } from "@/lib/bible";
import { APP_SOURCES, getClusterBySlug, getRelatedClusters } from "@/lib/app-data";
import { UI_COPY, localizeRelationTypeLabel, localizeSourceLinks, localizeStoryCluster } from "@/lib/content";
import { getBookMetadata } from "@/lib/book-metadata";
import { getPassageCrossReferences } from "@/lib/knowledge";
import { buildCompanionHref, buildGraphHref, buildPassageHref } from "@/lib/navigation";
import { buildReflectionResponse } from "@/lib/reflection";
import { buildPageMetadata } from "@/lib/page-metadata";
import { resolveLocale } from "@/lib/server-locale";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale, slug } = await params;
  const locale = await resolveLocale(requestedLocale);
  const copy = UI_COPY[locale].study;
  const baseCluster = getClusterBySlug(slug);
  const cluster = baseCluster ? localizeStoryCluster(baseCluster, locale) : null;
  const title = cluster ? `${cluster.title} · ${copy.title}` : copy.title;
  const description = cluster?.pastoralPrompt ?? copy.howToReadBody;

  return buildPageMetadata(locale, title, description, `/study/${slug}`);
}

export default async function StudyPage({ params }: Props) {
  const { locale: requestedLocale, slug } = await params;
  const locale = await resolveLocale(requestedLocale);
  const copy = UI_COPY[locale].study;
  const baseCluster = getClusterBySlug(slug);
  if (!baseCluster) notFound();
  const localizedCluster = localizeStoryCluster(baseCluster, locale);

  const primary = await getPassage(localizedCluster.primary, locale);
  const context = await getChapterContext(localizedCluster.primary, 2, locale);
  const graphSuggestions = await getPassageCrossReferences(localizedCluster.primary, 6, locale);
  const fallbackLinkedTexts = graphSuggestions.map((suggestion) => ({
    label: suggestion.displayReference,
    type: "theme" as const,
    summary: suggestion.supportLine || suggestion.excerpt,
    reference: suggestion.target,
  }));
  const cluster = {
    ...localizedCluster,
    linkedTexts: localizedCluster.linkedTexts.length ? localizedCluster.linkedTexts : fallbackLinkedTexts,
    supporting: localizedCluster.supporting.length
      ? localizedCluster.supporting
      : graphSuggestions.slice(0, 3).map((suggestion) => suggestion.target),
  };
  const linked = await Promise.all(cluster.linkedTexts.map((item) => getPassage(item.reference, locale)));
  const response = await buildReflectionResponse(cluster, cluster.pastoralPrompt, locale);
  const primaryBookMetadata = getBookMetadata(cluster.primary.code, locale);
  const relatedClusters = getRelatedClusters(cluster.slug, 3).map((related) => localizeStoryCluster(related, locale));
  const sources = localizeSourceLinks(APP_SOURCES, locale);

  const noteItems = [
    { key: "author", header: <span className="text-sm font-semibold tracking-tight text-[var(--ink)]">{cluster.context.author.title}</span>, body: <NoteCard note={cluster.context.author} locale={locale} />, defaultOpen: true },
    { key: "place", header: <span className="text-sm font-semibold tracking-tight text-[var(--ink)]">{cluster.context.place.title}</span>, body: <NoteCard note={cluster.context.place} locale={locale} /> },
    { key: "audience", header: <span className="text-sm font-semibold tracking-tight text-[var(--ink)]">{cluster.context.audience.title}</span>, body: <NoteCard note={cluster.context.audience} locale={locale} /> },
    { key: "jesus", header: <span className="text-sm font-semibold tracking-tight text-[var(--ink)]">{cluster.jesusLayer.title}</span>, body: <NoteCard note={cluster.jesusLayer} locale={locale} /> },
    { key: "paul", header: <span className="text-sm font-semibold tracking-tight text-[var(--ink)]">{cluster.paulLayer.title}</span>, body: <NoteCard note={cluster.paulLayer} locale={locale} /> },
    { key: "reception", header: <span className="text-sm font-semibold tracking-tight text-[var(--ink)]">{cluster.jewishReception.title}</span>, body: <NoteCard note={cluster.jewishReception} locale={locale} /> },
  ];

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <SecondaryNav locale={locale} active="study" slug={cluster.slug} title={cluster.title} />

      <section className="mt-8 space-y-8">
        {/* Hero */}
        <div className="glass rounded-xl sm:rounded-2xl p-5 sm:p-6 lg:p-8">
          <div className="section-title text-base">{copy.title}</div>
          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-4xl lg:text-5xl leading-tight">{cluster.title}</h1>
              <p className="mt-3 text-base leading-relaxed text-[var(--muted)] sm:mt-4 sm:text-xl">{cluster.pastoralPrompt}</p>
              <p className="mt-4 text-xl leading-relaxed text-[var(--muted)]">{cluster.pastoralPrompt}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={buildCompanionHref({ prompt: cluster.starterPrompt, locale })} className="inline-flex items-center gap-2 rounded-lg min-h-[44px] bg-[var(--gold)] px-5 py-3 text-sm font-semibold text-[var(--canvas)] hover:bg-[var(--gold-hover)] transition">
                <Sparkles className="h-4 w-4" />
                {UI_COPY[locale].sidebar.navNewReflection}
              </Link>
              <Link href={buildGraphHref(cluster.slug, locale)} className="inline-flex items-center gap-2 rounded-lg min-h-[44px] border border-[var(--hairline-strong)] px-5 py-3 text-sm font-semibold text-[var(--ink)] hover:border-[var(--gold)]/30 hover:text-[var(--gold)] transition">
                <Compass className="h-4 w-4" />
                {UI_COPY[locale].sidebar.navGraph}
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] md:items-start">
          {/* Main content — tabbed */}
          <TabSection
            defaultKey="context"
            tabs={[
              {
                key: "context",
                label: copy.primaryInContext,
                content: (
                  <div className="space-y-8">
                    <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] p-5 sm:p-6 lg:p-8">
                      <div className="text-xl font-semibold tracking-tight text-[var(--ink)]">{primary.reference}</div>
                      <div className="mt-5 space-y-4 text-lg leading-relaxed text-[var(--text)]">
                        {context.verses.map((verse) => (
                          <p key={`${verse.code}-${verse.chapter}-${verse.verse}`}>
                            <span className="mr-3 text-[var(--gold)] font-medium">{verse.verse}</span>
                            {verse.text}
                          </p>
                        ))}
                      </div>
                      <Link href={buildPassageHref(cluster.primary, locale)} className="mt-6 inline-flex items-center gap-2 rounded-lg min-h-[44px] border border-[var(--hairline-strong)] px-5 py-3 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)]">
                        {locale === "ko" ? "전체 본문 읽기" : "Read full passage"}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                    <div>
                      <div className="section-title text-base mb-4">{copy.whatPassageDoing}</div>
                      <div className="grid gap-5 lg:grid-cols-2">
                        <div className="soft-glass rounded-xl p-5 sm:p-6">
                          <div className="section-title text-sm">{copy.meaningInsideCanon}</div>
                          <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{response.primaryStory}</p>
                        </div>
                        <div className="soft-glass rounded-xl p-5 sm:p-6">
                          <div className="section-title text-sm">{copy.originalAudience}</div>
                          <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{response.originalAudience}</p>
                        </div>
                        <div className="soft-glass rounded-xl p-5 sm:p-6">
                          <div className="section-title text-sm">{copy.dateLayer}</div>
                          <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{cluster.context.date.body}</p>
                        </div>
                        <div className="soft-glass rounded-xl p-5 sm:p-6">
                          <div className="section-title text-sm">{copy.howToRead}</div>
                          <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{copy.howToReadBody}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                key: "network",
                label: copy.connectedNetwork,
                count: linked.length + graphSuggestions.length,
                content: (
                  <div className="space-y-8">
                    <div className="grid gap-5 lg:grid-cols-3">
                      {linked.map((passage, index) => (
                        <PassageCard
                          key={passage.reference}
                          title={cluster.linkedTexts[index].label}
                          referenceLabel={passage.reference}
                          excerpt={cluster.linkedTexts[index].summary}
                          href={buildPassageHref(cluster.linkedTexts[index].reference, locale)}
                          meta={localizeRelationTypeLabel(cluster.linkedTexts[index].type, locale)}
                          actionLabel={locale === "ko" ? "전체 본문 보기" : "Read full passage"}
                        />
                      ))}
                    </div>
                    <CrossReferenceSection suggestions={graphSuggestions} locale={locale} />
                  </div>
                ),
              },
              {
                key: "reflection",
                label: copy.reflectionQuestions,
                count: cluster.reflectionQuestions.length + relatedClusters.length,
                content: (
                  <div className="space-y-8">
                    <div className="space-y-4">
                      {cluster.reflectionQuestions.map((question) => (
                        <div key={question} className="soft-glass rounded-xl p-5 text-base leading-relaxed text-[var(--muted)]">
                          {question}
                        </div>
                      ))}
                    </div>
                    {relatedClusters.length ? (
                      <div>
                        <div className="section-title text-base">{copy.relatedLanes}</div>
                        <p className="mt-3 text-base leading-relaxed text-[var(--muted)]">{copy.relatedLanesBody}</p>
                        <div className="mt-6 grid gap-5 lg:grid-cols-3">
                          {relatedClusters.map((related) => (
                            <Link
                              key={related.slug}
                              href={buildCompanionHref({ prompt: related.starterPrompt, locale })}
                              className="soft-glass rounded-xl p-5 sm:p-6 transition hover:border-[var(--gold)]/25"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <div className="text-base font-semibold tracking-tight text-[var(--ink)]">{related.title}</div>
                                  <p className="mt-3 text-base leading-relaxed text-[var(--muted)]">{related.pastoralPrompt}</p>
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

          {/* Sidebar */}
          <div className="space-y-8">
            {primaryBookMetadata ? <BookProfileCard metadata={primaryBookMetadata} locale={locale} /> : null}

            {/* Teaching Notes — accordion */}
            <div className="glass rounded-2xl p-5 sm:p-6 lg:p-8">
              <div className="section-title text-base mb-2">{copy.teachingNotes}</div>
              <AccordionGroup items={noteItems} />
            </div>

            {/* Source Inventory — collapsible */}
            <div className="glass rounded-2xl p-5 sm:p-6 lg:p-8">
              <Collapsible trigger={<span className="text-base font-semibold">{copy.sourceInventory} ({sources.length})</span>}>
                <SourceList sources={sources} compact locale={locale} />
              </Collapsible>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
