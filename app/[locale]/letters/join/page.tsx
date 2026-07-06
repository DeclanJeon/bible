import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MailCheck, ShieldCheck, Sparkles } from "lucide-react";

import { buildPageMetadata } from "@/lib/page-metadata";
import { resolveLocale } from "@/lib/server-locale";
import { LetterJoinForm } from "@/components/letter-forms";
import { TrustNotice } from "@/components/letter-card-visual";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  return buildPageMetadata(
    locale,
    locale === "ko" ? "말씀편지 참여하기" : "Join Scripture letters",
    locale === "ko" ? "이메일 OTP 인증으로 익명 말씀편지에 참여하고 수신 여부를 선택합니다." : "Verify by email OTP to join anonymous Scripture letters and choose whether to receive them.",
    "/letters/join",
  );
}

export default async function LetterJoinPage({ params }: Props) {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);

  return (
    <main className="page-shell pb-28">
      <Link href={`/${locale}/letters`} className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]">
        <ArrowLeft className="h-4 w-4" />
        {locale === "ko" ? "위로의 말씀편지" : "Letters"}
      </Link>
      <section className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="glass rounded-[32px] p-6 sm:p-8 lg:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--gold-border)] bg-[var(--gold-soft)] px-4 py-2 text-sm font-semibold text-[var(--gold)]">
            <MailCheck className="h-4 w-4" />
            {locale === "ko" ? "이메일 OTP 참여" : "Email OTP join"}
          </div>
          <h1 className="mt-5 text-3xl font-bold leading-tight text-[var(--ink)] sm:text-4xl">
            {locale === "ko" ? "인증 후 말씀편지 참여자가 됩니다." : "Verify your email to become a participant."}
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--ink-muted)]">
            {locale === "ko"
              ? "참여자는 직접 익명 고민을 나눌 수 있고, 수신을 허용하면 다른 사람의 말씀편지를 받아 답장할 수 있습니다. 이메일은 상대에게 공개되지 않습니다."
              : "Participants can share anonymous concerns and, if receiving is enabled, receive someone else's Scripture letter and reply. Emails are never shown to other participants."}
          </p>
          <div className="mt-7">
            <LetterJoinForm locale={locale} />
          </div>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <TrustNotice locale={locale} />
          <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-5 text-sm leading-7 text-[var(--ink-muted)]">
            <div className="flex items-center gap-2 font-bold text-[var(--ink)]">
              <Sparkles className="h-4 w-4 text-[var(--gold)]" />
              {locale === "ko" ? "참여 방식" : "How participation works"}
            </div>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>{locale === "ko" ? "이메일과 선택 닉네임을 입력합니다." : "Enter your email and optional nickname."}</li>
              <li>{locale === "ko" ? "이메일로 받은 인증번호를 입력합니다." : "Enter the verification code sent by email."}</li>
              <li>{locale === "ko" ? "수신을 켜면 다른 참여자의 편지를 받아 시스템 안에서 답장합니다." : "Turn on receiving to get another participant's letter and reply inside the system."}</li>
            </ol>
          </div>
          <div className="rounded-2xl border border-[var(--gold-border)] bg-[var(--gold-soft)] p-5 text-sm leading-7 text-[var(--ink)]">
            <div className="flex items-center gap-2 font-bold">
              <ShieldCheck className="h-4 w-4 text-[var(--gold)]" />
              {locale === "ko" ? "인증 전에는 수신 배정 없음" : "No receiving match before verification"}
            </div>
            <p className="mt-2 text-[var(--ink-muted)]">
              {locale === "ko"
                ? "인증이 끝나기 전까지는 편지를 받는 참여자 목록에 들어가지 않습니다. 수신을 끄더라도 익명 편지 작성은 계속 사용할 수 있습니다."
                : "You are not added to the receiving pool until verification succeeds. Even with receiving off, you can still write anonymous letters."}
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
