import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Globe, ExternalLink, MessageSquareText } from "lucide-react";
import { STORY_CLUSTERS, getTopicStarts } from "@/lib/app-data";
import { UI_COPY, localizeStoryCluster, localizeTopicLabel } from "@/lib/content";
import { buildPageMetadata } from "@/lib/page-metadata";
import { buildBibleHref, buildLanesHref, buildReviewsHref } from "@/lib/navigation";
import { QuickPromptForm } from "@/components/quick-prompt-form";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = requestedLocale === "en" ? "en" : "ko";
  const copy = UI_COPY[locale].home;

  return buildPageMetadata(locale, copy.heroTitle, copy.heroSubtitle, "/");
}

export default async function HomePage({ params }: Props) {
  const { locale: requestedLocale } = await params;
  const locale = requestedLocale === "en" ? "en" : "ko";
  const copy = UI_COPY[locale].home;
  const topicStarts = getTopicStarts().map((topic) => {
    const cluster = STORY_CLUSTERS.find((entry) => entry.slug === topic.slug);
    const localized = cluster ? localizeStoryCluster(cluster, locale) : null;
    return {
      ...topic,
      label: localizeTopicLabel(topic.label, locale),
      starterPrompt: localized?.starterPrompt ?? topic.starterPrompt,
    };
  });
  const defaultPrompt = "";

  return (
    <main className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 lg:px-10 border-b border-[var(--line)]">
        <div className="text-base font-semibold text-white">{UI_COPY[locale].siteTitle}</div>
        <div className="flex items-center gap-2">
          <Link
            href="/ko"
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              locale === "ko"
                ? "bg-[var(--accent)] text-white"
                : "border border-white/15 text-white hover:border-[var(--gold)]/30 hover:text-[var(--gold)]"
            }`}
          >
            KO
          </Link>
          <Link
            href="/en"
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              locale !== "ko"
                ? "bg-[var(--accent)] text-white"
                : "border border-white/15 text-white hover:border-[var(--gold)]/30 hover:text-[var(--gold)]"
            }`}
          >
            EN
          </Link>
        </div>
      </header>

      {/* Hero — 2-column on lg: */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 lg:py-20">
        <div className="w-full max-w-6xl grid gap-10 lg:grid-cols-[1fr_340px] lg:items-center">
          {/* Left: Form */}
          <div>
            <div className="section-title text-base">{UI_COPY[locale].siteSubtitle}</div>
            <h1 className="mt-6 bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] bg-clip-text text-5xl font-bold text-transparent lg:text-7xl leading-tight">
              {copy.heroTitle}
            </h1>
            <p className="mt-7 max-w-2xl text-xl leading-relaxed text-[var(--muted)]">{copy.heroSubtitle}</p>
            <div className="mt-10 max-w-2xl">
              <QuickPromptForm
                defaultValue={defaultPrompt}
                locale={locale}
                suggestions={topicStarts.map((topic) => ({
                  label: `${topic.label} · ${topic.count}`,
                  prompt: topic.starterPrompt,
                }))}
              />
            </div>
            <p className="mt-5 text-sm text-[var(--muted)]">{copy.heroHint}</p>
          </div>

          {/* Right: How it works */}
          <div className="glass rounded-[32px] p-6">
            <div className="section-title text-sm mb-4">{copy.howItWorks[0]?.title ? "How it works" : ""}</div>
            <div className="space-y-4">
              {copy.howItWorks.map((item, index) => (
                <div key={item.title} className="soft-glass rounded-[20px] p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold)]">0{index + 1}</div>
                  <div className="mt-2 text-base font-semibold text-white">{item.title}</div>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Browse CTAs */}
      <section className="mx-auto grid w-full max-w-6xl gap-4 px-6 pb-12 lg:grid-cols-3">
        <Link
          href={buildLanesHref({ locale })}
          className="glass rounded-[24px] p-6 flex items-center justify-between group hover:border-[var(--gold)]/30 transition"
        >
          <div className="flex items-center gap-4">
            <BookOpen className="h-6 w-6 text-[var(--gold)]" />
            <div>
              <div className="text-lg font-semibold text-white">{UI_COPY[locale].lanes?.heading ?? "Browse study lanes"}</div>
              <p className="text-sm text-[var(--muted)] mt-1">{UI_COPY[locale].lanes?.body ?? "Explore guided study paths through scripture"}</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-[var(--gold)] group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link
          href={buildBibleHref({ locale })}
          className="glass rounded-[24px] p-6 flex items-center justify-between group hover:border-[var(--gold)]/30 transition"
        >
          <div className="flex items-center gap-4">
            <BookOpen className="h-6 w-6 text-[var(--gold)]" />
            <div>
              <div className="text-lg font-semibold text-white">{locale === "ko" ? "성경 전체 읽기" : "Read the full Bible"}</div>
              <p className="text-sm text-[var(--muted)] mt-1">
                {locale === "ko" ? "66권 전체 본문을 책과 장별로 끊김 없이 읽습니다." : "Browse all 66 books by book and chapter."}
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-[var(--gold)] group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link
          href={buildReviewsHref(locale)}
          className="glass rounded-[24px] p-6 flex items-center justify-between group hover:border-[var(--gold)]/30 transition"
        >
          <div className="flex items-center gap-4">
            <MessageSquareText className="h-6 w-6 text-[var(--gold)]" />
            <div>
              <div className="text-lg font-semibold text-white">{UI_COPY[locale].reviews.title}</div>
              <p className="text-sm text-[var(--muted)] mt-1">{UI_COPY[locale].reviews.body}</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-[var(--gold)] group-hover:translate-x-1 transition-transform" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--line)] px-6 py-6 lg:px-10">
        <div className="mx-auto max-w-6xl flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm text-[var(--muted)]">{UI_COPY[locale].siteTitle}</div>
          <div className="flex flex-wrap gap-4 text-sm text-[var(--muted)]">
            <a href="https://worldenglish.bible" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white transition">
              <Globe className="h-3.5 w-3.5" /> WEB
            </a>
            <a href="https://www.openbible.info/labs/cross-references/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white transition">
              <ExternalLink className="h-3.5 w-3.5" /> OpenBible
            </a>
            <a href="https://crossreferences.org/project/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white transition">
              <ExternalLink className="h-3.5 w-3.5" /> CrossReferences
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
