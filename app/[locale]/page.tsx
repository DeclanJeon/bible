import type { Metadata } from "next";
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
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 sm:px-8">
      <div className="w-full max-w-narrow">
        <h1 className="text-center text-[2rem] font-bold leading-tight tracking-tight sm:text-5xl">
          <span className="gradient-text">{copy.heroTitle}</span>
        </h1>
        <p className="mt-4 text-center text-base leading-relaxed text-ink-muted sm:text-lg">
          {copy.heroSubtitle}
        </p>

        <div className="mt-10 sm:mt-12">
          <QuickPromptForm
            defaultValue=""
            locale={locale}
            suggestions={topicStarts.slice(0, 4).map((topic) => ({
              label: topic.label,
              prompt: topic.starterPrompt,
            }))}
          />
        </div>
      </div>
    </main>
  );
}
