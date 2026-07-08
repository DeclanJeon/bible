import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Languages, Layers, Mail, Search, Shield, Sparkles, type LucideIcon } from "lucide-react";
import { UI_COPY, localizeStoryCluster, localizeTopicLabel } from "@/lib/content";
import { buildPageMetadata, siteDescription } from "@/lib/page-metadata";
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
            key: "letters",
            icon: Mail,
            title: "말씀편지",
            description: "성도 간 위로를 말씀 카드로 연결",
            body: "성도들이 이메일을 드러내지 않고 서로의 고민과 말씀의 위로를 이어 갑니다.",
            href: `/${locale}/letters`,
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
            key: "letters",
            icon: Mail,
            title: "Letters",
            description: "Connect believers through Scripture cards",
            body: "Believers can carry one another's concerns and Scripture-rooted comfort without exposing email addresses.",
            href: `/${locale}/letters`,
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
    <main className="page-shell-wide page-enter">
      <section className="relative overflow-hidden rounded-[1.6rem] border border-[var(--hairline)] bg-[var(--surface-1)] p-4 shadow-[var(--shadow-soft)] sm:rounded-[2.25rem] sm:p-8 lg:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[var(--gold-soft)] blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 rounded-full bg-[var(--sage-glow)] blur-3xl" />
        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)] lg:items-center">
          <div className="text-left">
            <p className="section-title mb-4 sm:mb-5">{locale === "ko" ? "본문과 마음을 잇는 길" : "Scripture pathfinder"}</p>
            <h1 className="hero-title gradient-text">
              {locale === "ko" ? "성경 길찾기" : copy.heroTitle}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-ink-muted sm:mt-6 sm:text-xl sm:leading-8">
              {locale === "ko"
                ? "마음을 한 문장으로 적으면, 본문과 연결과 맥락으로 바로 안내합니다."
                : copy.heroSubtitle}
            </p>

            <form action={`/${locale}/companion`} className="relative mt-6 w-full max-w-2xl sm:mt-8">
              <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
              <input
                name="prompt"
                type="search"
                required
                minLength={2}
                aria-label={UI_COPY[locale].prompt.placeholder}
                placeholder={locale === "ko" ? "지금 마음에 지고 있는 것을 적어 주세요." : UI_COPY[locale].prompt.placeholder}
                className="h-[3.25rem] w-full rounded-[1.15rem] border border-[var(--input-border)] bg-[var(--input-bg)] pl-14 pr-4 text-base font-medium text-ink shadow-[var(--shadow-soft)] outline-none transition placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-border)] sm:h-14 sm:rounded-2xl"
              />
            </form>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-thin sm:mt-5 sm:flex-wrap sm:overflow-visible sm:pb-0">
              {visibleTopics.map((topic) => (
                <Link
                  key={topic.slug}
                  href={`/${locale}/companion?prompt=${encodeURIComponent(topic.starterPrompt)}`}
                  className="shrink-0 rounded-full border border-[var(--hairline)] bg-surface-1 px-3.5 py-2 text-sm font-semibold text-ink-muted shadow-sm transition hover:border-[var(--gold-border)] hover:bg-[var(--gold-soft)] hover:text-gold sm:px-4"
                >
                  {topic.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="relative hidden md:block">
            <div className="rounded-[2rem] border border-[var(--gold-border)] bg-[var(--gold-soft)] p-4 shadow-[var(--shadow-lifted)] lg:-rotate-1">
              <div className="rounded-[1.5rem] bg-[var(--surface-1)] p-5">
                <div className="section-title">{locale === "ko" ? "오늘의 동선" : "Today's path"}</div>
                <div className="mt-5 space-y-3">
                  {featureCards.slice(0, 3).map((feature, index) => {
                    const Icon = feature.icon;
                    return (
                      <Link
                        key={feature.key}
                        href={feature.href}
                        className="group flex items-start gap-4 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-2)] p-4 transition hover:border-[var(--gold-border)] hover:bg-[var(--gold-soft)]"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-1)] text-gold shadow-sm">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold tabular-nums text-gold">0{index + 1}</span>
                            <h2 className="text-base font-bold tracking-tight text-ink">{feature.title}</h2>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-ink-muted">{feature.description}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:mt-8 sm:gap-4 md:grid-cols-2 xl:grid-cols-6">
        {featureCards.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <Link
              key={feature.key}
              href={feature.href}
              className={`group relative overflow-hidden rounded-[1.25rem] border border-[var(--hairline)] bg-surface-1 p-4 text-left shadow-sm transition hover:-translate-y-1 hover:border-[var(--gold-border)] hover:shadow-[var(--shadow-lifted)] sm:rounded-[1.5rem] sm:p-5 ${
                index === 0 ? "xl:col-span-2 xl:row-span-2 xl:p-7" : "xl:col-span-2"
              }`}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--gold)]/35 to-transparent opacity-0 transition group-hover:opacity-100" />
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--gold-soft)]">
                  <Icon className="h-5 w-5 text-gold" />
                </div>
                <ArrowRight className="mt-1 h-4 w-4 text-ink-subtle transition-transform group-hover:translate-x-1 group-hover:text-gold" />
              </div>
              <h2 className="mt-4 text-base font-bold tracking-tight text-ink sm:mt-5 sm:text-lg">{feature.title}</h2>
              <p className="mt-2 text-sm font-semibold text-ink-muted">{feature.description}</p>
              <p className="mt-3 text-sm leading-6 text-ink-muted sm:mt-5 sm:leading-7">{feature.body}</p>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
