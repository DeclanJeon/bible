import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { LetterQuickSendForm } from "@/components/letter-quick-send-form";
import { buildPageMetadata } from "@/lib/page-metadata";
import { resolveLocale } from "@/lib/server-locale";

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

  return (
    <main className="page-shell pb-28">
      <section className="mx-auto flex min-h-[72vh] max-w-4xl flex-col items-center justify-center py-16 text-center sm:py-24">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">
          {locale === "ko" ? "빛의 릴레이" : "Light Relay"}
        </p>
        <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-[var(--ink)] sm:text-5xl lg:text-6xl">
          {locale === "ko" ? "지금 마음에 있는 고민을 적어주세요." : "Write what is weighing on your heart."}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--ink-muted)]">
          {locale === "ko"
            ? "보내기를 누르면 로그인 상태를 확인합니다. 로그인이 필요하면 Google 로그인 후 같은 고민을 바로 전송합니다."
            : "Press send. If sign-in is needed, Google sign-in runs first and then sends the same concern automatically."}
        </p>
        <div className="mt-10 w-full">
          <LetterQuickSendForm locale={locale} />
        </div>
        <div className="mt-6 flex items-center justify-center gap-2 text-sm leading-6 text-[var(--ink-muted)]">
          <ShieldCheck className="h-4 w-4 text-[var(--gold)]" />
          <span>
            {locale === "ko"
              ? "이메일은 서로에게 보이지 않고, 모든 편지와 답장은 시스템을 통해서만 전달됩니다."
              : "Emails stay hidden; every letter and reply is relayed only through the system."}
          </span>
        </div>
      </section>

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
