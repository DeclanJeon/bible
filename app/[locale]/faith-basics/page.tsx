import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenText, HeartHandshake, Landmark, Scale, Sparkles } from "lucide-react";

import { buildPageMetadata } from "@/lib/page-metadata";
import { resolveLocale } from "@/lib/server-locale";
import { buildBibleReferenceHref } from "@/lib/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

type AppLocale = "ko" | "en";

type Source = {
  label: string;
  href: string;
  note: Record<AppLocale, string>;
};

const SOURCES: Source[] = [
  {
    label: "BibleProject — Justice",
    href: "https://bibleproject.com/videos/justice/",
    note: {
      ko: "성경의 정의가 하나님의 형상, 약자 보호, 예수님의 이야기와 연결된다는 주제 자료입니다.",
      en: "A biblical-theme source connecting justice with the image of God, care for the vulnerable, and the story that leads to Jesus.",
    },
  },
  {
    label: "BibleProject — Holy Spirit",
    href: "https://bibleproject.com/videos/holy-spirit/",
    note: {
      ko: "성령을 하나님의 임재, 새 창조, 예수님을 통해 제자들에게 보내진 선물로 설명합니다.",
      en: "Explains the Spirit as God’s personal presence, revealed through Jesus and sent to his followers for new creation.",
    },
  },
  {
    label: "Oxford Learner’s Dictionaries — Trinity",
    href: "https://www.oxfordlearnersdictionaries.com/us/definition/english/trinity",
    note: {
      ko: "삼위일체를 ‘성부, 성자, 성령이 한 하나님으로 연합되어 있음’으로 정의합니다.",
      en: "Defines the Trinity as the union of Father, Son, and Holy Spirit as one God.",
    },
  },
  {
    label: "Stanford Encyclopedia of Philosophy — Trinity",
    href: "https://plato.stanford.edu/entries/trinity/",
    note: {
      ko: "삼위일체를 한 하나님과 세 위격의 문제로 정리하고, 공간·확장 비유 같은 철학적 설명이 가능하지만 한계가 있음을 다룹니다.",
      en: "Surveys the Trinity as one God and three persons, including philosophical spatial analogies and their limits.",
    },
  },
  {
    label: "Catholic Answers — Explaining the Trinity",
    href: "https://www.catholic.com/magazine/online-edition/explaining-the-trinity",
    note: {
      ko: "성부·성자·성령이 본질에서는 하나이고 관계에서는 구별된다는 설명과, 모든 비유에는 한계가 있다는 주의점을 제공합니다.",
      en: "Explains Father, Son, and Spirit as one in essence and distinct in relation, while warning that every analogy has limits.",
    },
  },
  {
    label: "BibleGateway — Genesis 1:26",
    href: "https://www.biblegateway.com/passage/?search=Genesis%201%3A26&version=ESV",
    note: {
      ko: "‘우리의 형상을 따라’라는 창조 본문으로, 인간의 존엄과 책임의 출발점입니다.",
      en: "The creation text, ‘Let us make man in our image,’ grounding human dignity and responsibility.",
    },
  },
  {
    label: "BibleGateway — John 14:16–17, 26",
    href: "https://www.biblegateway.com/passage/?search=John%2014%3A16-17%2C26&version=ESV",
    note: {
      ko: "예수님이 보혜사, 곧 진리의 영이 가르치고 생각나게 하신다고 말씀하신 본문입니다.",
      en: "Jesus promises the Helper, the Spirit of truth, who teaches and reminds his followers.",
    },
  },
  {
    label: "BibleGateway — Philippians 2:5–8",
    href: "https://www.biblegateway.com/passage/?search=Philippians%202%3A5-8&version=ESV",
    note: {
      ko: "그리스도께서 낮아지시고 십자가에 순종하신 자기희생의 핵심 본문입니다.",
      en: "A central passage on Christ’s humility, incarnation, obedience, and self-giving love.",
    },
  },
  {
    label: "BibleGateway — Micah 6:8; Amos 5:24",
    href: "https://www.biblegateway.com/passage/?search=Micah%206%3A8%3B%20Amos%205%3A24&version=ESV",
    note: {
      ko: "정의, 인애, 겸손, 공의가 강물처럼 흐르는 삶을 요구하는 예언서 본문입니다.",
      en: "Prophetic texts calling for justice, kindness, humility, and righteousness like an ever-flowing stream.",
    },
  },
  {
    label: "BibleGateway — Matthew 22:37–40; 1 Corinthians 13:13",
    href: "https://www.biblegateway.com/passage/?search=Matthew%2022%3A37-40%3B%201%20Corinthians%2013%3A13&version=ESV",
    note: {
      ko: "하나님 사랑과 이웃 사랑, 믿음·소망·사랑 중 사랑이 제일이라는 신앙의 중심 본문입니다.",
      en: "Core passages on love of God and neighbor, and love as the greatest of faith, hope, and love.",
    },
  },
];

const PASSAGES = [
  { label: "Genesis 1:26–27", reference: { code: "GEN", chapter: 1, startVerse: 26, endVerse: 27 } },
  { label: "Genesis 2:15–17", reference: { code: "GEN", chapter: 2, startVerse: 15, endVerse: 17 } },
  { label: "Micah 6:8", reference: { code: "MIC", chapter: 6, startVerse: 8, endVerse: 8 } },
  { label: "Amos 5:24", reference: { code: "AMO", chapter: 5, startVerse: 24, endVerse: 24 } },
  { label: "Psalm 89:14", reference: { code: "PSA", chapter: 89, startVerse: 14, endVerse: 14 } },
  { label: "Isaiah 1:17", reference: { code: "ISA", chapter: 1, startVerse: 17, endVerse: 17 } },
  { label: "Matthew 22:37–40", reference: { code: "MAT", chapter: 22, startVerse: 37, endVerse: 40 } },
  { label: "John 13:34–35", reference: { code: "JOH", chapter: 13, startVerse: 34, endVerse: 35 } },
  { label: "John 14:16–17", reference: { code: "JOH", chapter: 14, startVerse: 16, endVerse: 17 } },
  { label: "John 14:26", reference: { code: "JOH", chapter: 14, startVerse: 26, endVerse: 26 } },
  { label: "John 16:7–15", reference: { code: "JOH", chapter: 16, startVerse: 7, endVerse: 15 } },
  { label: "Romans 12:9", reference: { code: "ROM", chapter: 12, startVerse: 9, endVerse: 9 } },
  { label: "Galatians 5:22–23", reference: { code: "GAL", chapter: 5, startVerse: 22, endVerse: 23 } },
  { label: "Philippians 2:5–8", reference: { code: "PHI", chapter: 2, startVerse: 5, endVerse: 8 } },
  { label: "1 Corinthians 13:13", reference: { code: "1CO", chapter: 13, startVerse: 13, endVerse: 13 } },
] as const;

const SCRIPTURE_GROUPS = {
  justice: [
    { label: "Psalm 89:14", reference: { code: "PSA", chapter: 89, startVerse: 14, endVerse: 14 } },
    { label: "Micah 6:8", reference: { code: "MIC", chapter: 6, startVerse: 8, endVerse: 8 } },
    { label: "Amos 5:24", reference: { code: "AMO", chapter: 5, startVerse: 24, endVerse: 24 } },
    { label: "Isaiah 1:17", reference: { code: "ISA", chapter: 1, startVerse: 17, endVerse: 17 } },
  ],
  goodEvil: [
    { label: "Genesis 2:15–17", reference: { code: "GEN", chapter: 2, startVerse: 15, endVerse: 17 } },
    { label: "Isaiah 5:20", reference: { code: "ISA", chapter: 5, startVerse: 20, endVerse: 20 } },
    { label: "Romans 12:9", reference: { code: "ROM", chapter: 12, startVerse: 9, endVerse: 9 } },
    { label: "Hebrews 5:14", reference: { code: "HEB", chapter: 5, startVerse: 14, endVerse: 14 } },
  ],
  love: [
    { label: "John 13:34–35", reference: { code: "JOH", chapter: 13, startVerse: 34, endVerse: 35 } },
    { label: "Matthew 22:37–40", reference: { code: "MAT", chapter: 22, startVerse: 37, endVerse: 40 } },
    { label: "Romans 13:8–10", reference: { code: "ROM", chapter: 13, startVerse: 8, endVerse: 10 } },
    { label: "1 Corinthians 13:13", reference: { code: "1CO", chapter: 13, startVerse: 13, endVerse: 13 } },
    { label: "1 John 4:7–12", reference: { code: "1JO", chapter: 4, startVerse: 7, endVerse: 12 } },
  ],
  christ: [
    { label: "John 1:1–14", reference: { code: "JOH", chapter: 1, startVerse: 1, endVerse: 14 } },
    { label: "Philippians 2:5–8", reference: { code: "PHI", chapter: 2, startVerse: 5, endVerse: 8 } },
    { label: "Hebrews 4:14–16", reference: { code: "HEB", chapter: 4, startVerse: 14, endVerse: 16 } },
    { label: "1 Peter 2:21–24", reference: { code: "1PE", chapter: 2, startVerse: 21, endVerse: 24 } },
  ],
  spirit: [
    { label: "John 14:16–17", reference: { code: "JOH", chapter: 14, startVerse: 16, endVerse: 17 } },
    { label: "John 14:26", reference: { code: "JOH", chapter: 14, startVerse: 26, endVerse: 26 } },
    { label: "John 16:7–15", reference: { code: "JOH", chapter: 16, startVerse: 7, endVerse: 15 } },
    { label: "Galatians 5:22–23", reference: { code: "GAL", chapter: 5, startVerse: 22, endVerse: 23 } },
  ],
  trinity: [
    { label: "Genesis 1:26–27", reference: { code: "GEN", chapter: 1, startVerse: 26, endVerse: 27 } },
    { label: "Matthew 3:16–17", reference: { code: "MAT", chapter: 3, startVerse: 16, endVerse: 17 } },
    { label: "Matthew 28:19", reference: { code: "MAT", chapter: 28, startVerse: 19, endVerse: 19 } },
    { label: "John 10:30", reference: { code: "JOH", chapter: 10, startVerse: 30, endVerse: 30 } },
    { label: "2 Corinthians 13:14", reference: { code: "2CO", chapter: 13, startVerse: 14, endVerse: 14 } },
  ],
  freedom: [
    { label: "Galatians 5:13–14", reference: { code: "GAL", chapter: 5, startVerse: 13, endVerse: 14 } },
    { label: "1 Peter 2:16–17", reference: { code: "1PE", chapter: 2, startVerse: 16, endVerse: 17 } },
    { label: "Romans 14:17–19", reference: { code: "ROM", chapter: 14, startVerse: 17, endVerse: 19 } },
    { label: "James 1:27", reference: { code: "JAM", chapter: 1, startVerse: 27, endVerse: 27 } },
  ],
  practice: [
    { label: "2 Timothy 3:16–17", reference: { code: "2TI", chapter: 3, startVerse: 16, endVerse: 17 } },
    { label: "James 1:22–27", reference: { code: "JAM", chapter: 1, startVerse: 22, endVerse: 27 } },
    { label: "Matthew 7:24–27", reference: { code: "MAT", chapter: 7, startVerse: 24, endVerse: 27 } },
    { label: "Romans 12:1–2", reference: { code: "ROM", chapter: 12, startVerse: 1, endVerse: 2 } },
  ],
} as const;

function T({ locale, ko, en }: { locale: AppLocale; ko: string; en: string }) {
  return locale === "ko" ? ko : en;
}

function AnchorButton({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary" }) {
  const className =
    variant === "primary"
      ? "inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[var(--gold)] px-4 py-2.5 text-sm font-semibold text-[var(--canvas)] transition hover:bg-[var(--gold)]/90"
      : "inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[var(--hairline-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)]";

  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

function PrincipleCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-2)] p-5 sm:p-6">
      <div className="section-title">{eyebrow}</div>
      <h3 className="mt-3 text-xl font-semibold tracking-tight text-[var(--ink)]">{title}</h3>
      <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--muted)]">{children}</div>
    </article>
  );
}

function ScriptureLinks({
  locale,
  passages,
}: {
  locale: AppLocale;
  passages: readonly {
    label: string;
    reference: { code: string; chapter: number; startVerse: number; endVerse: number };
  }[];
}) {
  return (
    <div className="mt-4 rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--gold)]">
        <T locale={locale} ko="성경은 이렇게 말합니다" en="Scripture says" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {passages.map((passage) => (
          <Link
            key={passage.label}
            href={buildBibleReferenceHref(passage.reference, { locale, from: "faith-basics" })}
            className="rounded-full border border-[var(--hairline)] bg-[var(--surface-2)] px-3 py-2 text-xs font-medium text-[var(--ink-muted)] transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)]"
          >
            {passage.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  const title = locale === "ko" ? "신앙의 기본" : "Faith Basics";
  const description =
    locale === "ko"
      ? "정의와 공의, 선과 악, 사랑, 성령과 삼위일체를 성경 본문과 자료로 정리한 신앙 입문 페이지입니다."
      : "A faith-basics page on justice, righteousness, good and evil, love, the Spirit, and the Trinity with biblical sources.";

  return buildPageMetadata(locale, title, description, "/faith-basics");
}

export default async function FaithBasicsPage({ params }: Props) {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);

  return (
    <main className="page-shell page-enter">
      <section className="glass overflow-hidden rounded-2xl p-5 sm:p-8 lg:rounded-3xl lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-center">
          <div>
            <div className="section-title text-base">
              <T locale={locale} ko="기독교 신앙 입문" en="Christian faith primer" />
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-[var(--ink)] sm:text-5xl">
              <T locale={locale} ko="신앙의 기본" en="Faith Basics" />
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--muted)] sm:text-lg">
              <T
                locale={locale}
                ko="하나님의 정의와 공의는 선과 악을 분별하는 기준입니다. 그 기준을 마음에 받아 선을 행하고 사랑을 실천할 때, 우리는 예수님의 자기희생을 통해 드러난 하나님의 사랑을 조금씩 이해하게 됩니다."
                en="God’s justice and righteousness give the standard for discerning good and evil. When that standard becomes the will to do good and practice love, we begin to understand God’s self-giving love revealed in Jesus."
              />
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <AnchorButton href="#core">
                <T locale={locale} ko="핵심 정리" en="Core summary" />
              </AnchorButton>
              <AnchorButton href="#sources" variant="secondary">
                <T locale={locale} ko="근거 자료" en="Sources" />
              </AnchorButton>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--gold)]/20 bg-[var(--gold)]/[0.08] p-5 sm:p-6">
            <div className="section-title">
              <T locale={locale} ko="한 문장" en="In one sentence" />
            </div>
            <p className="mt-4 text-xl font-semibold leading-8 text-[var(--ink)]">
              <T
                locale={locale}
                ko="신앙은 하나님의 공의 안에서 자유를 배우고, 선을 선택하며, 사랑으로 책임을 실행하는 길입니다."
                en="Faith is the way of learning freedom within God’s righteousness, choosing good, and carrying responsibility through love."
              />
            </p>
          </div>
        </div>
      </section>

      <section id="core" className="mt-6 grid gap-6 lg:grid-cols-2">
        <PrincipleCard
          eyebrow={locale === "ko" ? "정의와 공의" : "Justice and righteousness"}
          title={locale === "ko" ? "정의는 법의 질서, 공의는 관계의 마땅함" : "Justice orders the community; righteousness fulfills relationship"}
        >
          <p>
            <T
              locale={locale}
              ko="정의는 공동체가 함께 살기 위해 세운 법과 원칙의 질서입니다. 불법과 폭력을 막고, 약자의 억울함을 드러내며, 모두에게 같은 기준을 요구합니다."
              en="Justice is the order of law and principle by which a community lives together. It restrains violence, exposes oppression, and requires a shared standard for all."
            />
          </p>
          <p>
            <T
              locale={locale}
              ko="공의는 관계 안에서 마땅히 해야 할 도리와 책임입니다. 법 조항만 보는 것이 아니라 하나님 앞에서 생명, 이웃, 약자, 자유, 사랑을 함께 보는 것입니다."
              en="Righteousness is the fitting duty and responsibility within relationship. It does not stop at a legal clause; before God it sees life, neighbor, the vulnerable, freedom, and love together."
            />
          </p>
          <ScriptureLinks locale={locale} passages={SCRIPTURE_GROUPS.justice} />
        </PrincipleCard>

        <PrincipleCard
          eyebrow={locale === "ko" ? "선과 악" : "Good and evil"}
          title={locale === "ko" ? "선은 하나님의 공의에 참여하는 선택" : "Good is participation in God’s righteous will"}
        >
          <p>
            <T
              locale={locale}
              ko="선은 하나님께서 보시는 생명과 관계의 방향으로 움직이는 것입니다. 악은 그 방향을 거슬러 자기 욕망, 지배, 무관심, 폭력으로 자유와 생명을 침탈하는 것입니다."
              en="Good moves in the direction God sees for life and relationship. Evil resists that direction through self-centered desire, domination, indifference, and violence against freedom and life."
            />
          </p>
          <p>
            <T
              locale={locale}
              ko="그러므로 선과 악은 단순한 감정이나 편의가 아니라 하나님의 정의와 공의를 기준으로 분별되어야 합니다. 빨간불에 건너는 사람을 손가락질할 것인지, 먼저 구할 것인지를 묻는 순간 공의의 무게가 드러납니다."
              en="Good and evil are not defined by mood or convenience but discerned by God’s justice and righteousness. The difference appears when we ask whether to condemn a person crossing wrongly or first rescue the person in danger."
            />
          </p>
          <ScriptureLinks locale={locale} passages={SCRIPTURE_GROUPS.goodEvil} />
        </PrincipleCard>
      </section>

      <section className="mt-6 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-5 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="hidden rounded-2xl bg-[var(--gold-soft)] p-3 text-[var(--gold)] sm:block">
            <HeartHandshake className="h-6 w-6" />
          </div>
          <div>
            <div className="section-title text-base">
              <T locale={locale} ko="사랑" en="Love" />
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">
              <T locale={locale} ko="사랑은 자유를 침탈하지 않는 자기희생" en="Love is self-giving that does not violate freedom" />
            </h2>
            <div className="mt-5 grid gap-5 text-base leading-8 text-[var(--muted)] lg:grid-cols-2">
              <p>
                <T
                  locale={locale}
                  ko="하나님께서는 만물의 근원이시므로 우리를 필요로 하셔서 창조하신 것이 아닙니다. 그러나 하나님은 관계를 원하셨고, 인간과 함께하시기 위해 에덴이라는 인간의 자리 안으로 들어오셨습니다. 창조는 하나님의 결핍이 아니라 사랑의 초대입니다."
                  en="God, the source of all things, did not create humanity out of need. Yet God desired relationship and entered the human place symbolized by Eden to be with humanity. Creation is not God’s deficiency; it is love’s invitation."
                />
              </p>
              <ScriptureLinks locale={locale} passages={SCRIPTURE_GROUPS.love} />
              <p>
                <T
                  locale={locale}
                  ko="예수님은 그 사랑을 가장 분명히 보여 주셨습니다. 하나님이 육신을 입고 낮은 자리로 오셔서 사람이 겪는 고통을 함께 겪으셨고, 십자가의 죽음과 부활로 사랑이 말이 아니라 자기희생임을 드러내셨습니다."
                  en="Jesus reveals that love most clearly. God came in flesh, took the lower place, shared human suffering, and through the cross and resurrection showed that love is not a slogan but self-giving."
                />
              </p>
              <ScriptureLinks locale={locale} passages={SCRIPTURE_GROUPS.christ} />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <article className="glass rounded-2xl p-5 sm:p-6 lg:p-8">
          <div className="flex items-center gap-3 text-[var(--gold)]">
            <Scale className="h-5 w-5" />
            <div className="section-title">
              <T locale={locale} ko="성령과 선택" en="Spirit and choice" />
            </div>
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-[var(--ink)]">
            <T locale={locale} ko="보혜사는 돕고 가르치시지만, 선택은 우리에게 맡겨진다" en="The Helper teaches and helps, but the choice remains ours" />
          </h2>
          <div className="mt-5 space-y-4 text-sm leading-7 text-[var(--muted)]">
            <p>
              <T
                locale={locale}
                ko="예수님은 성령을 보혜사, 곧 돕는 분으로 약속하셨습니다. 성령은 우리에게 예수님의 말씀을 생각나게 하시고, 죄와 의와 심판을 깨닫게 하시며, 선을 향한 분별을 돕습니다."
                en="Jesus promised the Holy Spirit as the Helper. The Spirit reminds us of Jesus’ words, convicts concerning sin, righteousness, and judgment, and helps us discern toward the good."
              />
            </p>
            <p>
              <T
                locale={locale}
                ko="그러나 성령은 우리를 강제로 끌고 가는 지배자가 아닙니다. 하나님은 하나님을 버릴 수 있는 자유까지 허락하실 만큼 인간의 자유를 존중하십니다. 내 안의 저울에 선과 악이 함께 있을 때 어느 쪽에 1그램을 더할지는 우리의 책임입니다."
                en="But the Spirit is not a coercive controller. God honors human freedom so deeply that even rejecting God is possible. When good and evil both pull within us, the responsibility for where to add the next gram remains ours."
              />
            </p>
            <ScriptureLinks locale={locale} passages={SCRIPTURE_GROUPS.spirit} />
          </div>
        </article>

        <article className="glass rounded-2xl p-5 sm:p-6 lg:p-8">
          <div className="flex items-center gap-3 text-[var(--gold)]">
            <Sparkles className="h-5 w-5" />
            <div className="section-title">
              <T locale={locale} ko="삼위일체" en="Trinity" />
            </div>
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-[var(--ink)]">
            <T locale={locale} ko="성부, 성자, 성령은 한 하나님" en="Father, Son, and Spirit are one God" />
          </h2>
          <div className="mt-5 space-y-4 text-sm leading-7 text-[var(--muted)]">
            <p>
              <T
                locale={locale}
                ko="삼위일체는 성부 하나님, 성자 하나님, 성령 하나님이 세 하나님이라는 뜻이 아니라, 성부·성자·성령이 한 하나님이시라는 기독교의 고백입니다. 창세기의 ‘우리’라는 표현은 성경 전체의 계시와 함께 읽을 때 이 고백을 묵상하게 합니다."
                en="The Trinity does not mean three gods. It is the Christian confession that Father, Son, and Holy Spirit are one God. Genesis’ plural ‘us’ is read with the whole biblical witness as a doorway into this confession."
              />
            </p>
            <p>
              <T
                locale={locale}
                ko="인간의 관점에서는 ‘셋이면서 하나’라는 말이 쉽게 이해되지 않습니다. 그래서 차원의 비유를 사용할 수 있습니다. 낮은 차원에서 보면 서로 다른 세 점이 하나의 점처럼 겹쳐 보일 수 있듯이, 우리의 제한된 시야에서는 성부·성자·성령의 구별과 하나 되심을 온전히 파악하기 어렵습니다."
                en="From a human point of view, ‘three and one’ is difficult to grasp. A dimensional analogy can help: just as three distinct points may appear as one point from a lower-dimensional perspective, our limited vision cannot fully grasp the distinction and unity of Father, Son, and Spirit."
              />
            </p>
            <p>
              <T
                locale={locale}
                ko="다만 이 비유는 삼위일체를 증명하거나 완전히 설명하는 공식이 아닙니다. 성부·성자·성령이 단지 다르게 보이는 모습이라는 뜻도 아니고, 하나님이 세 부분으로 쪼개진다는 뜻도 아닙니다. 비유의 목적은 하나님이 인간의 계산과 차원을 넘어서는 분이라는 겸손한 이해를 돕는 데 있습니다."
                en="But this analogy is not a proof or complete formula for the Trinity. It does not mean Father, Son, and Spirit are merely appearances, nor that God is divided into three parts. Its purpose is humbler: to remind us that God exceeds human categories of calculation and dimension."
              />
            </p>
            <p>
              <T
                locale={locale}
                ko="성부는 사랑의 근원이시고, 성자는 그 사랑을 육신과 십자가로 드러내시며, 성령은 그 사랑을 우리 안에서 깨닫고 실천하도록 돕습니다. 신앙은 이 하나님과 함께 살도록 초대받은 복입니다."
                en="The Father is the source of love, the Son reveals that love in flesh and on the cross, and the Spirit helps that love become discerned and practiced within us. Faith is the blessing of being invited to live with this God."
              />
            </p>
            <ScriptureLinks locale={locale} passages={SCRIPTURE_GROUPS.trinity} />
          </div>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-[var(--gold)]/20 bg-[var(--gold)]/[0.08] p-5 sm:p-8">
        <div className="flex items-center gap-3 text-[var(--gold)]">
          <Landmark className="h-5 w-5" />
          <div className="section-title">
            <T locale={locale} ko="교회와 자유" en="Church and freedom" />
          </div>
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-[var(--ink)]">
          <T locale={locale} ko="자유는 하나님의 공의 안에서 서로를 살리는 방식이어야 한다" en="Freedom must become a way of giving life within God’s righteousness" />
        </h2>
        <div className="mt-5 grid gap-5 text-base leading-8 text-[var(--muted)] lg:grid-cols-3">
          <p>
            <T
              locale={locale}
              ko="각 사람에게는 각자의 생각과 양심이 있습니다. 내 자유를 절대화하면 다른 사람의 자유가 침탈될 수 있습니다. 그래서 기독교의 자유는 자기 주장만이 아니라 이웃의 자유까지 함께 보는 사랑의 책임입니다."
              en="Each person has conscience and thought. If my freedom becomes absolute, another person’s freedom can be violated. Christian freedom is therefore not mere assertion but loving responsibility that also sees the neighbor’s freedom."
            />
          </p>
          <p>
            <T
              locale={locale}
              ko="교회가 세상의 모든 사안에 즉시 한쪽으로 서야 하는 것은 아닙니다. 교회는 하나님의 공의가 흐트러지지 않도록 신중해야 하며, 동시에 성도 각자가 말씀 안에서 분별하고 책임 있게 행동하도록 세워야 합니다."
              en="The church is not required to take an immediate public side on every social issue. It must be careful not to distort God’s righteousness while forming believers to discern and act responsibly within Scripture."
            />
          </p>
          <p>
            <T
              locale={locale}
              ko="공의를 위한 선은 낮은 곳으로 흐릅니다. 약자를 살리고, 억울함을 풀고, 자유를 존중하며, 사랑으로 책임을 감당하는 자리에서 하나님 나라의 맛을 보게 됩니다."
              en="Good done for righteousness flows toward the low place. We taste the kingdom of God where the vulnerable are protected, injustice is addressed, freedom is honored, and responsibility is carried in love."
            />
          </p>
          <ScriptureLinks locale={locale} passages={SCRIPTURE_GROUPS.freedom} />
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <article className="glass rounded-2xl p-5 sm:p-8">
          <div className="flex items-center gap-3 text-[var(--gold)]">
            <BookOpenText className="h-5 w-5" />
            <div className="section-title">
              <T locale={locale} ko="어떻게 신앙할 것인가" en="How to live faith" />
            </div>
          </div>
          <ol className="mt-5 space-y-4 text-sm leading-7 text-[var(--muted)]">
            <li>
              <T locale={locale} ko="성경을 공부하고 세상도 공부하십시오. 공의와 선과 사랑은 무지 위에 세워지지 않습니다." en="Study Scripture and also study the world. Righteousness, good, and love are not built on ignorance." />
            </li>
            <li>
              <T locale={locale} ko="법의 정의와 관계의 공의를 함께 보십시오. 하나님께서는 둘 다 보십니다." en="Hold together legal justice and relational righteousness. God sees both." />
            </li>
            <li>
              <T locale={locale} ko="예수님의 낮아지심을 기준으로 사랑을 배우십시오. 사랑은 감정 이전에 자발적 책임입니다." en="Learn love from Jesus’ humility. Love is voluntary responsibility before it is emotion." />
            </li>
            <li>
              <T locale={locale} ko="성령의 도움을 구하되 선택을 회피하지 마십시오. 행하는 것은 우리에게 맡겨진 믿음의 응답입니다." en="Seek the Spirit’s help without avoiding choice. Action is the faithful response entrusted to us." />
            </li>
          </ol>
          <ScriptureLinks locale={locale} passages={SCRIPTURE_GROUPS.practice} />
        </article>

        <aside className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-2)] p-5 sm:p-6">
          <div className="section-title">
            <T locale={locale} ko="함께 읽을 본문" en="Passages to read" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {PASSAGES.map((passage) => (
              <Link
                key={passage.label}
                href={buildBibleReferenceHref(passage.reference, { locale, from: "faith-basics" })}
                className="rounded-full border border-[var(--hairline)] bg-[var(--surface-1)] px-3 py-2 text-xs font-medium text-[var(--ink-muted)] transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)]"
              >
                {passage.label}
              </Link>
            ))}
          </div>
          <Link
            href={`/${locale}/bible`}
            className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[var(--hairline-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)]"
          >
            <T locale={locale} ko="성경 리더로 이동" en="Open Bible reader" />
          </Link>
        </aside>
      </section>

      <section id="sources" className="mt-6 glass rounded-2xl p-5 sm:p-8">
        <div className="section-title text-base">
          <T locale={locale} ko="웹 근거와 보완 자료" en="Web sources and supporting material" />
        </div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--ink)]">
          <T locale={locale} ko="이 페이지가 기대고 있는 자료" en="Sources behind this page" />
        </h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {SOURCES.map((source) => (
            <a
              key={source.href}
              href={source.href}
              className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-2)] p-5 transition hover:border-[var(--gold)]/30"
            >
              <div className="text-sm font-semibold text-[var(--ink)]">{source.label}</div>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{source.note[locale]}</p>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
