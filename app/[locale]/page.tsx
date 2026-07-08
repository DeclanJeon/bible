import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { UI_COPY, localizeStoryCluster, localizeTopicLabel } from "@/lib/content";
import { buildPageMetadata, siteDescription } from "@/lib/page-metadata";
import { STORY_CLUSTERS, getTopicStarts } from "@/lib/app-data";

type Props = {
  params: Promise<{ locale: string }>;
};



export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = requestedLocale === "en" ? "en" : "ko";
  const copy = UI_COPY[locale].home;

  return buildPageMetadata(locale, copy.heroTitle, siteDescription(locale), "/");
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

  const referenceTopics =
    locale === "ko"
      ? ["토라", "역사서", "시가·지혜서", "대선지서", "소선지서", "복음서", "바울서신"]
      : ["Torah", "History", "Poetry and Wisdom", "Major Prophets", "Minor Prophets", "Gospels", "Pauline Letters"];
  const visibleTopics = referenceTopics
    .map((label) => topicStarts.find((topic) => topic.label === label))
    .filter((topic): topic is (typeof topicStarts)[number] => Boolean(topic));
  const promptTopics = visibleTopics.slice(0, 5);



  return (
    <main className="page-shell-wide page-enter">
      <section className="flex min-h-[calc(100dvh-11rem)] flex-col items-center justify-center px-2 py-10 text-center sm:min-h-[calc(100dvh-9rem)] sm:py-16">
        <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-[var(--gold-border)] bg-[var(--gold-soft)] shadow-[var(--shadow-soft)] sm:h-20 sm:w-20 sm:rounded-[1.75rem]">
          <span className="text-3xl font-[850] tracking-[-0.08em] text-gold sm:text-4xl">길</span>
        </div>

        <h1 className="text-[clamp(2.75rem,12vw,5.8rem)] font-[850] leading-none tracking-[-0.075em] text-[var(--ink)] text-balance">
          {locale === "ko" ? "성경 길찾기" : copy.heroTitle}
        </h1>
        <p className="mt-5 max-w-[36rem] text-base leading-7 text-ink-muted sm:text-lg sm:leading-8">
          {locale === "ko"
            ? "마음을 한 문장으로 적어 주세요. 가장 가까운 본문과 문맥으로 안내합니다."
            : "Write one honest sentence. We will route it to Scripture, context, and linked passages."}
        </p>

        <form action={`/${locale}/companion`} className="relative mt-8 w-full max-w-2xl">
          <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
          <input
            name="prompt"
            type="search"
            required
            minLength={2}
            aria-label={UI_COPY[locale].prompt.placeholder}
            placeholder={locale === "ko" ? "지금 마음에 지고 있는 것을 적어 주세요." : UI_COPY[locale].prompt.placeholder}
            className="h-14 w-full rounded-[1.35rem] border border-[var(--hairline)] bg-[var(--surface-1)] pl-14 pr-5 text-base font-medium text-ink shadow-[var(--shadow-lifted)] outline-none transition placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-border)] sm:h-16 sm:rounded-[1.6rem]"
          />
        </form>

        <div className="mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
          {promptTopics.map((topic) => (
            <Link
              key={topic.slug}
              href={`/${locale}/companion?prompt=${encodeURIComponent(topic.starterPrompt)}`}
              className="rounded-full px-3 py-2 text-sm font-semibold text-ink-muted transition hover:bg-[var(--gold-soft)] hover:text-gold"
            >
              {topic.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
