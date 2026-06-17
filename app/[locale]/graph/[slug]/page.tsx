import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { CrossReferenceSection } from "@/components/crossref-section";
import { SecondaryNav } from "@/components/secondary-nav";
import { TabSection } from "@/components/tab-section";
import { Collapsible } from "@/components/collapsible";
import { getClusterBySlug, getRelatedClusters } from "@/lib/app-data";
import { UI_COPY, localizeRelationTypeLabel, localizeStoryCluster } from "@/lib/content";
import { getPassageCrossReferences } from "@/lib/knowledge";
import { buildCompanionHref, buildPassageHref, buildStudyHref } from "@/lib/navigation";
import { buildPageMetadata } from "@/lib/page-metadata";
import { resolveLocale } from "@/lib/server-locale";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale, slug } = await params;
  const locale = await resolveLocale(requestedLocale);
  const copy = UI_COPY[locale].graph;
  const baseCluster = getClusterBySlug(slug);
  const cluster = baseCluster ? localizeStoryCluster(baseCluster, locale) : null;
  const title = cluster ? `${cluster.title} · ${copy.title}` : copy.title;
  const description = cluster?.pastoralPrompt ?? copy.body;

  return buildPageMetadata(locale, title, description, `/graph/${slug}`);
}

export default async function GraphPage({ params }: Props) {
  const { locale: requestedLocale, slug } = await params;
  const locale = await resolveLocale(requestedLocale);
  const copy = UI_COPY[locale].graph;
  const baseCluster = getClusterBySlug(slug);
  if (!baseCluster) notFound();
  const cluster = localizeStoryCluster(baseCluster, locale);
  const relatedClusters = getRelatedClusters(cluster.slug, 3).map((related) => localizeStoryCluster(related, locale));
  const graphSuggestions = await getPassageCrossReferences(cluster.primary, 8, locale);
  const graphLinks = cluster.linkedTexts.length
    ? cluster.linkedTexts
    : graphSuggestions.slice(0, 6).map((suggestion) => ({
        label: suggestion.displayReference,
        type: "theme" as const,
        summary: suggestion.supportLine || suggestion.excerpt,
        reference: suggestion.target,
      }));

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-8 lg:px-8">
      <SecondaryNav locale={locale} active="graph" slug={cluster.slug} title={cluster.title} />

      <section className="mt-8 space-y-8">
        {/* Hero */}
        <div className="glass rounded-2xl p-5 sm:p-6 lg:p-8">
          <div className="section-title text-base">{copy.title}</div>
          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight sm:text-4xl lg:text-5xl leading-tight">{cluster.title}</h1>
              <p className="mt-3 text-base leading-relaxed text-[var(--muted)] sm:mt-4 sm:text-xl">{copy.body}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={buildCompanionHref({ prompt: cluster.starterPrompt, locale })} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--hairline-strong)] px-5 py-3 text-sm font-semibold text-[var(--ink)] hover:border-[var(--gold)]/30 hover:text-[var(--gold)] transition">
                <Sparkles className="h-4 w-4" />
                {UI_COPY[locale].sidebar.navNewReflection}
              </Link>
              <Link href={buildStudyHref(cluster.slug, locale)} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[var(--gold)] px-5 py-3 text-sm font-semibold text-[var(--canvas)] hover:bg-[var(--gold-hover)] transition">
                <BookOpen className="h-4 w-4" />
                {copy.openStudyDesk}
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-start">
          {/* Main content — tabbed */}
          <TabSection
            defaultKey="graph"
            tabs={[
              {
                key: "graph",
                label: copy.primaryNode,
                count: graphLinks.length,
                content: (
                  <div className="space-y-6">
                    <div className="rounded-[28px] border border-[var(--gold)]/25 bg-[var(--gold)]/[0.08] p-6">
                      <div className="text-xl font-semibold text-white">{cluster.title}</div>
                      <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{cluster.context.meaning.body}</p>
                    </div>
                    <div className="grid gap-5 lg:grid-cols-3">
                      {graphLinks.map((item) => (
                        <Link key={`${item.label}-${item.reference.code}-${item.reference.chapter}-${item.reference.startVerse}`} href={buildPassageHref(item.reference, locale)} className="block soft-glass rounded-[24px] p-6 transition hover:border-[var(--gold)]/25 hover:bg-white/[0.05]">
                          <div className="text-xs uppercase tracking-[0.18em] text-[var(--gold)] font-semibold">{localizeRelationTypeLabel(item.type, locale)}</div>
                          <div className="mt-3 text-base font-semibold text-white">{item.label}</div>
                          <p className="mt-3 text-base leading-relaxed text-[var(--muted)]">{item.summary}</p>
                          <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--gold)]">
                            {locale === "ko" ? "전체 본문 보기" : "Read full passage"} <ArrowRight className="h-4 w-4" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ),
              },
              {
                key: "crossrefs",
                label: "Cross References",
                count: graphSuggestions.length,
                content: (
                  <CrossReferenceSection suggestions={graphSuggestions} locale={locale} />
                ),
              },
              {
                key: "related",
                label: copy.relatedLanes,
                count: relatedClusters.length,
                content: (
                  <div className="space-y-4">
                    {relatedClusters.map((related) => (
                      <Link
                        key={related.slug}
                        href={buildCompanionHref({ prompt: related.starterPrompt, locale })}
                        className="block soft-glass rounded-[24px] p-6 transition hover:border-[var(--gold)]/25"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-base font-semibold text-white">{related.title}</div>
                            <p className="mt-3 text-base leading-relaxed text-[var(--muted)]">{related.pastoralPrompt}</p>
                          </div>
                          <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-[var(--gold)]" />
                        </div>
                      </Link>
                    ))}
                  </div>
                ),
              },
            ]}
          />

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Travel Path — connector lines */}
            <div className="glass rounded-[32px] p-6 lg:p-8">
              <div className="section-title text-base">{copy.travelPath}</div>
              <ol className="mt-6 border-l-2 border-[var(--connector)] pl-6 space-y-4 text-base leading-relaxed text-[var(--muted)]">
                {copy.travelSteps.map((step, index) => (
                  <li key={step} className="relative">
                    <span className="absolute -left-[1.65rem] top-1.5 h-3 w-3 rounded-full bg-[var(--gold)]" />
                    <span className="font-medium text-white">{index + 1}.</span> {step}
                  </li>
                ))}
              </ol>
            </div>

            {/* Next Move + Boundaries — merged */}
            <div className="glass rounded-[32px] p-6 lg:p-8">
              <div className="section-title text-base">{copy.nextMove}</div>
              <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{copy.nextMoveBody}</p>
              <Link href={buildStudyHref(cluster.slug, locale)} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--accent)]/90 transition">
                <BookOpen className="h-4 w-4" />
                {copy.openStudyDesk}
              </Link>

              <div className="mt-6 border-t border-[var(--line)] pt-6">
                <Collapsible trigger={<span className="text-base font-semibold text-white">{copy.boundaries}</span>}>
                  <div className="mt-4 space-y-3 text-base leading-relaxed text-[var(--muted)]">
                    {copy.boundaryLines.map((line) => (
                      <div key={line} className="soft-glass rounded-[20px] px-4 py-3">
                        {line}
                      </div>
                    ))}
                  </div>
                </Collapsible>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
