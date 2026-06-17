import type { Metadata } from "next";
import Link from "next/link";
import { UI_COPY, localizeStoryCluster, localizeTopicLabel } from "@/lib/content";
import { buildPageMetadata } from "@/lib/page-metadata";
import { QuickPromptForm } from "@/components/quick-prompt-form";
import { STORY_CLUSTERS, getTopicStarts } from "@/lib/app-data";

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

  return (
    <main className="flex min-h-dvh flex-col">
      {/* Language toggle — fixed top right */}
      <div className="fixed right-3 top-3 z-50 flex items-center gap-1.5 sm:right-4 sm:top-4">
        <Link
          href="/ko"
          className={`inline-flex min-h-[36px] items-center rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            locale === "ko"
              ? "bg-[var(--accent)] text-slate-950"
              : "border border-white/15 text-white/60 hover:border-[var(--gold)]/30 hover:text-white"
          }`}
        >
          KO
        </Link>
        <Link
          href="/en"
          className={`inline-flex min-h-[36px] items-center rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            locale !== "ko"
              ? "bg-[var(--accent)] text-slate-950"
              : "border border-white/15 text-white/60 hover:border-[var(--gold)]/30 hover:text-white"
          }`}
        >
          EN
        </Link>
      </div>

      {/* Google-style centered content */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-16 sm:px-8">
        <div className="w-full max-w-xl">
          {/* Title */}
          <h1 className="text-center text-4xl font-bold leading-tight sm:text-5xl">
            <span className="bg-gradient-to-r from-[var(--gold)] to-amber-400 bg-clip-text text-transparent">
              {copy.heroTitle}
            </span>
          </h1>
          <p className="mt-4 text-center text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            {copy.heroSubtitle}
          </p>

          {/* Input */}
          <div className="mt-8 sm:mt-10">
            <QuickPromptForm
              defaultValue=""
              locale={locale}
              suggestions={topicStarts.slice(0, 5).map((topic) => ({
                label: topic.label,
                prompt: topic.starterPrompt,
              }))}
            />
          </div>
        </div>
      </div>

      {/* Minimal footer */}
      <footer className="pb-5 text-center text-xs text-[var(--muted)]/60">
        <Link href={`/${locale}/bible`} className="transition hover:text-[var(--gold)]">
          {UI_COPY[locale].sidebar.navBible}
        </Link>
        <span className="mx-2 opacity-30">·</span>
        <Link href={`/${locale}/lanes`} className="transition hover:text-[var(--gold)]">
          {UI_COPY[locale].sidebar.navLanes}
        </Link>
        <span className="mx-2 opacity-30">·</span>
        <Link href={`/${locale}/reviews`} className="transition hover:text-[var(--gold)]">
          {UI_COPY[locale].reviews.title}
        </Link>
      </footer>
    </main>
  );
}
