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
      {/* Language toggle */}
      <div className="fixed right-3 top-3 z-50 flex items-center gap-1.5 sm:right-5 sm:top-5">
        <Link
          href="/ko"
          className={`inline-flex h-11 min-w-[44px] items-center justify-center rounded-md px-2.5 text-xs font-semibold transition ${
            locale === "ko"
              ? "bg-[var(--gold)] text-[var(--canvas)]"
              : "border border-[var(--hairline-strong)] text-[var(--ink-subtle)] hover:text-[var(--ink)]"
          }`}
        >
          KO
        </Link>
        <Link
          href="/en"
          className={`inline-flex h-11 min-w-[44px] items-center justify-center rounded-md px-2.5 text-xs font-semibold transition ${
            locale !== "ko"
              ? "bg-[var(--gold)] text-[var(--canvas)]"
              : "border border-[var(--hairline-strong)] text-[var(--ink-subtle)] hover:text-[var(--ink)]"
          }`}
        >
          EN
        </Link>
      </div>

      {/* Centered content */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-20 sm:px-8">
        <div className="w-full max-w-2xl">
          {/* Title */}
          <h1 className="text-center text-[2rem] font-bold leading-tight tracking-tight sm:text-5xl">
            <span className="gradient-text">{copy.heroTitle}</span>
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

      {/* Footer */}
      <footer className="pb-6 text-center text-xs text-[var(--ink-subtle)]">
        <div className="flex items-center justify-center gap-3">
          <Link href={`/${locale}/bible`} className="transition hover:text-[var(--gold)]">
            {UI_COPY[locale].sidebar.navBible}
          </Link>
          <span className="text-[var(--hairline)]">·</span>
          <Link href={`/${locale}/lanes`} className="transition hover:text-[var(--gold)]">
            {UI_COPY[locale].sidebar.navLanes}
          </Link>
          <span className="text-[var(--hairline)]">·</span>
          <Link href={`/${locale}/reviews`} className="transition hover:text-[var(--gold)]">
            {UI_COPY[locale].reviews.title}
          </Link>
        </div>
      </footer>
    </main>
  );
}
