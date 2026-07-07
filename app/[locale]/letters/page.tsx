import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { LetterQuickSendForm } from "@/components/letter-quick-send-form";
import { auth } from "@/auth";
import { buildPageMetadata } from "@/lib/page-metadata";
import { resolveLocale } from "@/lib/server-locale";
import { getRelayAvailability } from "@/lib/letters";

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
  const session = await auth();
  const relayAvailability = await getRelayAvailability(session?.user?.email ?? null);

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
            ? "고민을 보내면, 예수님의 사랑이 먼저 당신에게 전달됩니다."
            : "Send your concern, and the love of Jesus reaches you first."}
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
        {!relayAvailability.hasEligibleHumanRelay ? (
          <div className="mt-6 max-w-2xl rounded-2xl border border-[var(--gold-border)] bg-[var(--gold-soft)] p-5 text-left text-sm leading-6 text-[var(--ink)]">
            <p className="font-bold">
              {locale === "ko" ? "따뜻한 세상의 빛이 되어 주세요." : "Become a warm light for someone."}
            </p>
            <p className="mt-1 text-[var(--ink-muted)]">
              {locale === "ko"
                ? "지금은 당신의 고민을 당신에게 다시 배정하지 않도록, 기다리는 빛 전달자가 더 필요합니다. 테스트용 마스터 계정이 안전하게 받지만, 실제 릴레이를 위해 참여해 주세요."
                : "We never assign your own concern back to you. A test master account can receive it safely for now, but the real relay needs more light bearers."}
            </p>
            <Link href={`/${locale}/letters/join`} className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--gold)] px-4 py-2 text-xs font-bold text-white">
              {locale === "ko" ? "릴레이로 참여하기" : "Join the relay"}
            </Link>
          </div>
        ) : null}
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
