import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { buildPageMetadata } from "@/lib/page-metadata";
import { resolveLocale } from "@/lib/server-locale";
import { auth } from "@/auth";
import { LetterWriteForm } from "@/components/letter-forms";
import { TrustNotice } from "@/components/letter-card-visual";
import { SignInButton } from "@/components/auth-buttons";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  return buildPageMetadata(locale, locale === "ko" ? "고민 보내기" : "Send a concern", "", "/letters/write");
}

export default async function LetterWritePage({ params }: Props) {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="page-shell flex min-h-[70vh] items-center justify-center pb-28">
        <section className="glass max-w-lg rounded-[32px] p-8 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-[var(--gold)]" />
          <h1 className="mt-5 text-3xl font-bold text-[var(--ink)]">{locale === "ko" ? "로그인이 필요합니다" : "Sign in required"}</h1>
          <p className="mt-4 text-base leading-7 text-[var(--ink-muted)]">
            {locale === "ko" ? "고민을 보내려면 로그인하세요. 이메일은 상대에게 공개되지 않습니다." : "Sign in to send a concern. Your email is never shown to others."}
          </p>
          <div className="mt-7">
            <SignInButton locale={locale} />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell pb-28">
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
            {locale === "ko"
              ? `${session.user.email}로 로그인 상태입니다. 고민은 익명으로 전달되고, 빛 전달자가 성구를 골라 답변하면 카드뉴스로 전달됩니다.`
              : `Signed in as ${session.user.email}. Your concern is sent anonymously. A light bearer picks Scripture and sends an answer as a card.`}
          </p>
          <div className="mt-7">
            <LetterWriteForm locale={locale} authorEmail={session.user.email ?? ""} />
          </div>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <TrustNotice locale={locale} />
          <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-5 text-sm leading-7 text-[var(--ink-muted)]">
            {locale === "ko" ? "자해·학대·즉각적 위험 표현은 발송하지 않고 도움 안내를 먼저 보여줍니다." : "Self-harm, abuse, or immediate-danger content is not dispatched and receives safety guidance first."}
          </div>
        </aside>
      </section>
    </main>
  );
}
