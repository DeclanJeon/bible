import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowRight, BookOpenText, Heart, Mail, ShieldCheck } from "lucide-react";

import { buildPageMetadata } from "@/lib/page-metadata";
import { resolveLocale } from "@/lib/server-locale";
import { getLetterParticipantSession } from "@/lib/letters";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  return buildPageMetadata(
    locale,
    locale === "ko" ? "빛의 릴레이" : "Light Relay",
    locale === "ko" ? "고민을 보내면, 예수님의 사랑이 먼저 당신에게 전달됩니다." : "Send your concern, and the love of Jesus reaches you first.",
    "/letters",
  );
}

export default async function LettersLandingPage({ params }: Props) {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  const session = await getLetterParticipantSession((await cookies()).get("letters_participant_session")?.value ?? null);
  const ctaHref = session ? `/${locale}/letters/write` : `/${locale}/letters/join`;
  const ctaLabel = session
    ? (locale === "ko" ? "고민 보내기" : "Send a concern")
    : (locale === "ko" ? "참여하기" : "Join");

  return (
    <main className="page-shell pb-28">
      {/* Hero */}
      <section className="mx-auto max-w-2xl py-20 text-center sm:py-28">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">
          {locale === "ko" ? "빛의 릴레이" : "Light Relay"}
        </p>
        <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-[var(--ink)] sm:text-5xl lg:text-6xl">
          {locale === "ko"
            ? "고민을 보내면,\n예수님의 사랑이\n먼저 전달됩니다."
            : "Send your concern,\nand the love of Jesus\nreaches you first."}
        </h1>
        <div className="mt-10">
          <Link
            href={ctaHref}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--gold)] px-8 py-3 text-sm font-bold text-white transition hover:bg-[var(--gold-hover)]"
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Divider */}
      <div className="mx-auto h-px w-16 bg-[var(--gold)]/30" />

      {/* Flow */}
      <section className="mx-auto max-w-xl py-16 sm:py-20">
        <h2 className="text-center text-sm font-bold uppercase tracking-[0.22em] text-[var(--gold)]">
          {locale === "ko" ? "어떻게 작동하나요" : "How it works"}
        </h2>
        <ol className="mt-10 space-y-8">
          {(
            locale === "ko"
              ? [
                  { icon: Mail, title: "고민을 익명으로 보냅니다", desc: "이메일은 상대에게 공개되지 않습니다." },
                  { icon: Heart, title: "빛 전달자가 성구를 골라 답변합니다", desc: "위로의 답변을 카드뉴스로 준비합니다." },
                  { icon: BookOpenText, title: "카드뉴스로 답변을 받습니다", desc: "완성되면 이메일로 알림을 받습니다." },
                ]
              : [
                  { icon: Mail, title: "Send a concern anonymously", desc: "Your email is never shown to the other person." },
                  { icon: Heart, title: "A light bearer picks Scripture and answers", desc: "They prepare comfort as a card." },
                  { icon: BookOpenText, title: "Receive the reply as a card", desc: "You get an email when it is ready." },
                ]
          ).map(({ icon: Icon, title, desc }, i) => (
            <li key={i} className="flex items-start gap-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--gold-soft)] text-[var(--gold)]">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-base font-bold text-[var(--ink)]">{title}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Divider */}
      <div className="mx-auto h-px w-16 bg-[var(--gold)]/30" />

      {/* Philosophy */}
      <section className="mx-auto max-w-lg py-16 text-center sm:py-20">
        <blockquote className="text-xl font-semibold leading-8 text-[var(--ink)] sm:text-2xl">
          {locale === "ko"
            ? "\u201C빛은 먼저 비추는 사람에게서 시작됩니다.\u201D"
            : "\u201CLight begins with the one who shines first.\u201D"}
        </blockquote>
        <p className="mt-4 text-sm text-[var(--ink-muted)]">
          {locale === "ko"
            ? "예수님의 사랑을 먼저 실천하는 빛의 릴레이"
            : "Light Relay \u2014 living the love of Jesus first"}
        </p>
      </section>

      {/* Divider */}
      <div className="mx-auto h-px w-16 bg-[var(--gold)]/30" />

      {/* Trust */}
      <section className="mx-auto max-w-lg py-16 text-center sm:py-20">
        <ShieldCheck className="mx-auto h-8 w-8 text-[var(--gold)]" />
        <p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">
          {locale === "ko"
            ? "이메일은 서로에게 보이지 않습니다. 모든 편지와 답장은 시스템을 통해서만 전달됩니다."
            : "Emails are never shown to each other. All letters and replies are relayed through the system."}
        </p>
      </section>

      {/* Secondary links */}
      <section className="mx-auto flex max-w-lg justify-center gap-6 text-sm">
        <Link href={`/${locale}/letters/settings`} className="text-[var(--ink-muted)] underline decoration-[var(--hairline)] underline-offset-4 transition hover:text-[var(--gold)]">
          {locale === "ko" ? "설정" : "Settings"}
        </Link>
        <Link href={`/${locale}/letters/history`} className="text-[var(--ink-muted)] underline decoration-[var(--hairline)] underline-offset-4 transition hover:text-[var(--gold)]">
          {locale === "ko" ? "내 편지함" : "My letters"}
        </Link>
      </section>
    </main>
  );
}
