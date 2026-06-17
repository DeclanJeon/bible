import type { Metadata } from "next";
import Link from "next/link";

import { ArrowRight } from "lucide-react";
import { filterClusterCatalog, getClusterBySlug } from "@/lib/app-data";
import { UI_COPY, localizeStoryCluster, localizeTopicLabel } from "@/lib/content";
import { buildCompanionHref, buildGraphHref, buildLanesHref, buildStudyHref } from "@/lib/navigation";

import { buildPageMetadata } from "@/lib/page-metadata";
import { resolveLocale } from "@/lib/server-locale";
import { SecondaryNav } from "@/components/secondary-nav";
import { Collapsible } from "@/components/collapsible";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ topic?: string; q?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  const copy = UI_COPY[locale].lanes;

  return buildPageMetadata(locale, copy.heading, copy.body, "/lanes");
}

export default async function LanesPage({ params, searchParams }: Props) {
  const [{ locale: requestedLocale }, { topic, q }] = await Promise.all([params, searchParams]);
  const locale = await resolveLocale(requestedLocale);
  const copy = UI_COPY[locale].lanes;
  const { topicStarts, activeTopic, query, clusters, visibleClusters } = filterClusterCatalog({ topic, q, locale });
  const localizedTopicStarts = topicStarts.map((entry) => ({
    ...entry,
    displayLabel: localizeTopicLabel(entry.label, locale),
  }));
  const localizedClusters = visibleClusters.map((cluster) => {
    const fullCluster = getClusterBySlug(cluster.slug);
    const localized = fullCluster ? localizeStoryCluster(fullCluster, locale) : null;
    return {
      ...cluster,
      title: localized?.title ?? cluster.title,
      pastoralPrompt: localized?.pastoralPrompt ?? cluster.pastoralPrompt,
      starterPrompt: localized?.starterPrompt ?? cluster.starterPrompt,
      themes: localized?.themes ?? cluster.themes,
      topicLabel: cluster.topicLabel ? localizeTopicLabel(cluster.topicLabel, locale) : null,
    };
  });

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-8 lg:px-8">
      <SecondaryNav locale={locale} active="lanes" title={copy.heading} />

      <section className="mt-8 space-y-8">
        {/* Compact search panel */}
        <section className="glass rounded-[32px] p-6 lg:p-8">
          <form action={`/${locale}/lanes`} className="space-y-4">
            {activeTopic ? <input type="hidden" name="topic" value={activeTopic} /> : null}
            <div className="flex flex-col gap-3 lg:flex-row">
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder={copy.searchPlaceholder}
                className="min-w-0 flex-1 rounded-[24px] border border-white/15 bg-white/[0.06] px-5 py-3.5 text-base text-white outline-none placeholder:text-[var(--muted)] focus-within:border-[var(--focus-ring)] transition"
              />
              <button type="submit" className="rounded-[24px] bg-[var(--accent)] px-5 py-3.5 text-sm font-semibold text-white hover:bg-[var(--accent)]/90 transition">
                {copy.filter}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={buildLanesHref({ locale })}
                className={`chip text-sm ${activeTopic ? "text-white hover:border-[var(--gold)]/30 hover:text-[var(--gold)]" : "border-[var(--gold)]/30 text-[var(--gold)]"}`}
              >
                {copy.allTopics} · {clusters.length}
              </Link>
              {localizedTopicStarts.map((entry) => (
                <Link
                  key={entry.label}
                  href={buildLanesHref({ topic: entry.label, q: query ? q ?? "" : undefined, locale })}
                  className={`chip text-sm ${activeTopic === entry.label ? "border-[var(--gold)]/30 text-[var(--gold)]" : "text-white hover:border-[var(--gold)]/30 hover:text-[var(--gold)]"}`}
                >
                  {entry.displayLabel} · {entry.count}
                </Link>
              ))}
            </div>
          </form>

          {/* How-to-use collapsible */}
          <div className="mt-4">
            <Collapsible
              trigger={<span>{copy.howToUseLines?.length ? `How to use — ${copy.howToUseLines.length} tips` : "How to use"}</span>}
            >
              <div className="grid gap-4 lg:grid-cols-3">
                {copy.howToUseLines.map((line, index) => (
                  <div key={line} className="soft-glass rounded-[20px] p-4">
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold)]">0{index + 1}</div>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{line}</p>
                  </div>
                ))}
              </div>
            </Collapsible>
          </div>
        </section>

        {/* Results */}
        <section className="glass rounded-[32px] p-8 lg:p-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="section-title text-base">
                {activeTopic ? `${localizeTopicLabel(activeTopic, locale)} ${copy.title}` : copy.allLanes}
                <span className="ml-2 text-[var(--gold)]">{localizedClusters.length}</span>
              </div>
              <div className="mt-2 text-base text-[var(--muted)]">{localizedClusters.length} {copy.shown}</div>
            </div>
            {activeTopic || query ? (
              <div className="text-base text-[var(--muted)]">
                {copy.filters}: {activeTopic ? localizeTopicLabel(activeTopic, locale) : copy.allTopics}
                {query ? ` · "${q}"` : ""}
              </div>
            ) : null}
          </div>

          {localizedClusters.length ? (
            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              {localizedClusters.map((cluster) => (
                <div key={cluster.slug} className="soft-glass rounded-[24px] p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xl font-semibold text-white">{cluster.title}</div>
                      <div className="mt-2 text-sm text-[var(--gold)] font-medium">{cluster.topicLabel ?? copy.title}</div>
                    </div>
                    <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-[var(--gold)]" />
                  </div>
                  <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{cluster.pastoralPrompt}</p>
                  <div className="mt-5 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                    {cluster.themes.slice(0, 3).map((theme) => (
                      <span key={theme} className="chip text-xs text-white">
                        {theme}
                      </span>
                    ))}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link href={buildCompanionHref({ prompt: cluster.starterPrompt, locale })} className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--accent)]/90 transition">
                      {copy.startReflection}
                    </Link>
                    <Link href={buildStudyHref(cluster.slug, locale)} className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:border-[var(--gold)]/30 hover:text-[var(--gold)] transition">
                      {copy.openStudyDesk}
                    </Link>
                    <Link href={buildGraphHref(cluster.slug, locale)} className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:border-[var(--gold)]/30 hover:text-[var(--gold)] transition">
                      {copy.viewGraph}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
              <div className="text-xl font-semibold text-white">{copy.noMatch}</div>
              <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{copy.noMatchBody}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={buildLanesHref({ locale })} className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--accent)]/90 transition">
                  {copy.clearFilters}
                </Link>
                <Link href={buildCompanionHref({ locale })} className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:border-[var(--gold)]/30 hover:text-[var(--gold)] transition">
                  {copy.openCompanion}
                </Link>
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
