import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpenText, Mail, Search, Sparkles } from "lucide-react";
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

  const primaryActions =
    locale === "ko"
      ? [
          { href: `/${locale}/bible`, label: "성경 읽기", note: "66권 전체 본문", icon: BookOpenText },
          { href: `/${locale}/letters`, label: "말씀편지", note: "위로를 전하기", icon: Mail },
          { href: `/${locale}/faith-questions`, label: "신앙 질문", note: "근거 찾기", icon: Sparkles },
        ]
      : [
          { href: `/${locale}/bible`, label: "Read Bible", note: "All 66 books", icon: BookOpenText },
          { href: `/${locale}/letters`, label: "Letters", note: "Send comfort", icon: Mail },
          { href: `/${locale}/faith-questions`, label: "Faith Q&A", note: "Find sources", icon: Sparkles },
        ];



  return (
    <main className="page-shell-wide page-enter">
      <section className="relative flex min-h-[calc(100dvh-11rem)] flex-col items-center justify-center overflow-hidden px-2 py-10 text-center sm:min-h-[calc(100dvh-9rem)] sm:py-16">
        <div className="pointer-events-none absolute left-1/2 top-10 h-80 w-80 -translate-x-1/2 rounded-full bg-[var(--gold-soft)] blur-3xl sm:h-[34rem] sm:w-[34rem]" />
        <div className="pointer-events-none absolute -left-20 bottom-12 hidden h-56 w-56 rounded-full bg-[var(--sage-glow)] blur-3xl sm:block" />
        <div className="pointer-events-none absolute -right-12 top-1/3 hidden h-64 w-64 rounded-full bg-[var(--amber-glow)] blur-3xl md:block" />

        <div className="relative w-full max-w-4xl">
          <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-[var(--gold-border)] bg-[linear-gradient(145deg,var(--gold-soft),var(--surface-1))] p-2 shadow-[var(--shadow-soft)] sm:h-20 sm:w-20 sm:rounded-[1.75rem] sm:p-2.5">
            <Image src="/logo.svg" alt={locale === "ko" ? "성경 길찾기 로고" : "Bible Companion logo"} width={64} height={64} priority className="h-full w-full rounded-[1rem] object-contain sm:rounded-[1.25rem]" />
          </div>

          <h1 className="mx-auto max-w-3xl text-[clamp(3rem,12vw,6.4rem)] font-[850] leading-[0.92] tracking-[-0.08em] text-[var(--ink)] text-balance">
            {locale === "ko" ? "성경 길찾기" : copy.heroTitle}
          </h1>
          <p className="mx-auto mt-5 max-w-[38rem] text-base leading-7 text-ink-muted sm:text-lg sm:leading-8">
            {locale === "ko"
              ? "마음을 한 문장으로 적어 주세요. 가장 가까운 본문과 문맥으로 안내합니다."
              : "Write one honest sentence. We will route it to Scripture, context, and linked passages."}
          </p>

          <form action={`/${locale}/companion`} className="relative mx-auto mt-8 w-full max-w-2xl">
            <div className="absolute -inset-1 rounded-[1.7rem] bg-[linear-gradient(135deg,var(--gold-border),transparent_38%,var(--sage-glow))] opacity-80 blur-sm" />
            <div className="relative rounded-[1.55rem] border border-[var(--hairline)] bg-[var(--surface-1)] shadow-[var(--shadow-lifted)]">
              <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
              <input
                name="prompt"
                type="search"
                required
                minLength={2}
                aria-label={UI_COPY[locale].prompt.placeholder}
                placeholder={locale === "ko" ? "지금 마음에 지고 있는 것을 적어 주세요." : UI_COPY[locale].prompt.placeholder}
                className="h-14 w-full rounded-[1.55rem] border-0 bg-transparent pl-14 pr-5 text-base font-medium text-ink outline-none transition placeholder:text-[var(--input-placeholder)] sm:h-16"
              />
            </div>
          </form>

          <div className="mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
            {promptTopics.map((topic) => (
              <Link
                key={topic.slug}
                href={`/${locale}/companion?prompt=${encodeURIComponent(topic.starterPrompt)}`}
                className="rounded-full border border-transparent px-3 py-2 text-sm font-semibold text-ink-muted transition hover:border-[var(--gold-border)] hover:bg-[var(--gold-soft)] hover:text-gold"
              >
                {topic.label}
              </Link>
            ))}
          </div>

          <div className="mx-auto mt-9 grid max-w-3xl gap-3 sm:grid-cols-3">
            {primaryActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex items-center justify-between gap-3 rounded-[1.25rem] border border-[var(--hairline)] bg-[color-mix(in_oklch,var(--surface-1)_88%,transparent)] px-4 py-3 text-left shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-[var(--gold-border)] hover:bg-[var(--surface-1)] hover:shadow-[var(--shadow-soft)]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--gold-soft)] text-gold">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-ink">{action.label}</span>
                      <span className="block truncate text-xs font-semibold text-ink-muted">{action.note}</span>
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-subtle transition group-hover:translate-x-0.5 group-hover:text-gold" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
