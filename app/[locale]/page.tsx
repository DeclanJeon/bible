import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Languages, Layers, Search, Shield, Sparkles, type LucideIcon } from "lucide-react";
import { UI_COPY, localizeStoryCluster, localizeTopicLabel } from "@/lib/content";
import { buildPageMetadata } from "@/lib/page-metadata";
import { STORY_CLUSTERS, getTopicStarts } from "@/lib/app-data";

type Props = {
  params: Promise<{ locale: string }>;
};

type FeatureCard = {
  key: string;
  icon: LucideIcon;
  title: string;
  description: string;
  body: string;
  href: string;
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

  const referenceTopics =
    locale === "ko"
      ? ["토라", "역사서", "시가·지혜서", "대선지서", "소선지서", "복음서", "바울서신"]
      : ["Torah", "History", "Poetry and Wisdom", "Major Prophets", "Minor Prophets", "Gospels", "Pauline Letters"];
  const visibleTopics = referenceTopics
    .map((label) => topicStarts.find((topic) => topic.label === label))
    .filter((topic): topic is (typeof topicStarts)[number] => Boolean(topic));


  const featureCards: FeatureCard[] =
    locale === "ko"
      ? [
          {
            key: "companion",
            icon: Sparkles,
            title: "컴패니언",
            description: "마음의 질문을 성경 본문과 연결",
            body: "어떤 질문이든 성경 본문과 자연스럽게 연결해 드립니다.",
            href: `/${locale}/companion`,
          },
          {
            key: "lanes",
            icon: Layers,
            title: "공부 레인",
            description: "66권 책별 가이드드 패턴",
            body: "각 성경 책의 핵심 주제와 공부 경로를 제안합니다.",
            href: `/${locale}/lanes`,
          },
          {
            key: "faith-basics",
            icon: Shield,
            title: "신앙의 기본",
            description: "정의, 사랑, 성령을 본문으로",
            body: "기독교 신앙의 핵심 개념을 본문 중심으로 정리합니다.",
            href: `/${locale}/faith-basics`,
          },
          {
            key: "hanja",
            icon: Languages,
            title: "한자 탐색",
            description: "한자와 성경 본문의 연결",
            body: "한자의 의미를 성경 구절과 연결하여 이해합니다.",
            href: `/${locale}/hanja`,
          },
        ]
      : [
          {
            key: "companion",
            icon: Sparkles,
            title: "Companion",
            description: "Connect a lived question to Scripture",
            body: "Route any concern into primary passages, linked texts, and context.",
            href: `/${locale}/companion`,
          },
          {
            key: "lanes",
            icon: Layers,
            title: "Study lanes",
            description: "Guided patterns across the 66 books",
            body: "Follow book-level themes and study paths generated from the local corpus.",
            href: `/${locale}/lanes`,
          },
          {
            key: "faith-basics",
            icon: Shield,
            title: "Faith basics",
            description: "Justice, love, and Spirit from the text",
            body: "Study core Christian concepts through primary passages first.",
            href: `/${locale}/faith-basics`,
          },
          {
            key: "hanja",
            icon: Languages,
            title: "Hanja search",
            description: "Connect Hanja meaning with Bible passages",
            body: "Understand characters by tracing them beside Scripture references.",
            href: `/${locale}/hanja`,
          },
        ];

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-28 pt-12 lg:pb-10 lg:pt-20">
      <section className="flex flex-col items-center text-center">
        <h1 className="gradient-text mb-4 text-4xl font-[800] leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          {locale === "ko" ? "성경 길찾기" : copy.heroTitle}
        </h1>
        <p className="mb-8 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
          {locale === "ko"
            ? "마음을 한 문장으로 적으면, 본문과 연결과 맥락으로 바로 안내합니다."
            : copy.heroSubtitle}
        </p>

        <form action={`/${locale}/companion`} className="relative mb-6 w-full max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
          <input
            name="prompt"
            type="search"
            required
            minLength={2}
            aria-label={UI_COPY[locale].prompt.placeholder}
            placeholder={locale === "ko" ? "지금 마음에 지고 있는 것을 적어 주세요." : UI_COPY[locale].prompt.placeholder}
            className="h-12 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] pl-12 pr-4 text-base text-ink shadow-sm outline-none transition focus:border-[var(--input-focus-border)] focus:shadow-md placeholder:text-[var(--input-placeholder)]"
          />
        </form>

        <div className="flex flex-wrap justify-center gap-2">
          {visibleTopics.map((topic) => (
            <Link
              key={topic.slug}
              href={`/${locale}/companion?prompt=${encodeURIComponent(topic.starterPrompt)}`}
              className="rounded-full border border-[var(--hairline)] bg-surface-1 px-4 py-1.5 text-sm font-medium text-ink shadow-sm transition-colors hover:border-[var(--gold-border)] hover:bg-[var(--gold-soft)] hover:text-gold"
            >
              {topic.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:mt-20">
        {featureCards.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <Link
              key={feature.key}
              href={feature.href}
              className="group relative overflow-hidden rounded-card border border-[var(--hairline)] bg-surface-1 p-6 text-left shadow-sm transition hover:shadow-md"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--gold-soft)]">
                  <Icon className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-ink">{feature.title}</h2>
                  <p className="text-sm text-ink-muted">{feature.description}</p>
                </div>
              </div>
              <p className="mt-6 text-sm leading-relaxed text-ink-muted">{feature.body}</p>
              <div className="mt-6 flex items-center justify-end gap-1 text-sm font-medium text-gold">
                {locale === "ko" ? "바로가기" : "Open"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
