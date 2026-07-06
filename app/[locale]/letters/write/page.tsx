import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, UserPlus } from "lucide-react";

import { buildPageMetadata } from "@/lib/page-metadata";
import { resolveLocale } from "@/lib/server-locale";
import { getLetterParticipantSession } from "@/lib/letters";
import { LetterWriteForm } from "@/components/letter-forms";
import { TrustNotice } from "@/components/letter-card-visual";


const SESSION_COOKIE = "letters_participant_session";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  return buildPageMetadata(locale, locale === "ko" ? "익명 말씀편지 쓰기" : "Write a Scripture letter", "", "/letters/write");
}

export default async function LetterWritePage({ params }: Props) {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  const participant = await getLetterParticipantSession((await cookies()).get(SESSION_COOKIE)?.value ?? null);

  return (
    <main className="page-shell pb-28">
      <Link href={`/${locale}/letters`} className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]">
        <ArrowLeft className="h-4 w-4" />
        {locale === "ko" ? "빛의 릴레이" : "Light Relay"}
      </Link>
      <section className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="glass rounded-[32px] p-6 sm:p-8 lg:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--gold-border)] bg-[var(--gold-soft)] px-4 py-2 text-sm font-semibold text-[var(--gold)]">
            <ShieldCheck className="h-4 w-4" />
            {locale === "ko" ? "익명 고민 보내기" : "Send anonymously"}
          </div>
          <h1 className="mt-5 text-3xl font-bold leading-tight text-[var(--ink)] sm:text-4xl">
            {locale === "ko" ? "고민을 적으면, 빛 전달자가 성구와 함께 답변을 보냅니다." : "Write your concern. A light bearer will send comfort with Scripture."}
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--ink-muted)]">
            {participant
              ? (locale === "ko" ? `${participant.maskedEmail} 인증 상태로 작성합니다. 고민은 익명으로 전달되고, 빛 전달자가 성구를 골라 답변하면 카드뉴스로 전달됩니다.` : `You are writing as ${participant.maskedEmail}. Your concern is sent anonymously. A light bearer picks Scripture and sends an answer. You will receive a card with the answer.`)
              : (locale === "ko" ? "고민을 익명으로 작성하세요. 빛 전달자가 성구를 골라 답변을 보냅니다. 이메일은 상대에게 공개되지 않습니다. 릴레이에 참여하려면 이메일 인증이 필요합니다." : "Write your concern anonymously. A light bearer picks Scripture and sends an answer. Your email is never shown. Email verification is required to join the relay.")}
          </p>
          <div className="mt-7">
            <LetterWriteForm locale={locale} participant={participant} />
          </div>
          <Link href={`/${locale}/letters/join`} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--hairline)] px-4 py-2 text-sm font-bold text-[var(--ink)] transition hover:border-[var(--gold-border)]">
            <UserPlus className="h-4 w-4" />
            {locale === "ko" ? "빛의 릴레이에 참여하기" : "Join the Light Relay"}
          </Link>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <TrustNotice locale={locale} />
          <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-5 text-sm leading-7 text-[var(--ink-muted)]">
            {locale === "ko" ? "자해·학대·즉각적 위험 표현은 랜덤 발송하지 않고 도움 안내를 먼저 보여줍니다. 이메일 인증 없이도 작성은 가능하지만, 수신 참여자로 배정되려면 참여 페이지에서 OTP 인증이 필요합니다." : "Self-harm, abuse, or immediate-danger content is not randomly dispatched and receives safety guidance first. You can write without verification, but joining the receiving pool requires OTP verification on the join page."}
          </div>
        </aside>
      </section>
    </main>
  );
}
