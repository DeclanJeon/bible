import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { buildPageMetadata } from "@/lib/page-metadata";
import { resolveLocale } from "@/lib/server-locale";
import { LetterUnsubscribeForm } from "@/components/letter-forms";
import { TrustNotice } from "@/components/letter-card-visual";

type Props = { params: Promise<{ locale: string; token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  return buildPageMetadata(locale, locale === "ko" ? "말씀편지 수신 중단" : "Stop Scripture letters", "", "/letters/unsubscribe");
}

export default async function LetterUnsubscribePage({ params }: Props) {
  const { locale: requestedLocale, token } = await params;
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
            <ShieldCheck className="h-4 w-4" />
            {locale === "ko" ? "수신 중단" : "Unsubscribe"}
          </div>
          <h1 className="mt-5 text-3xl font-bold leading-tight text-[var(--ink)] sm:text-4xl">
            {locale === "ko" ? "말씀편지 수신을 멈출 수 있습니다." : "You can stop receiving Scripture letters."}
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--ink-muted)]">
            {locale === "ko" ? "이 링크는 이메일 수신 중단에만 사용됩니다. 작성했던 편지나 답장 카드는 삭제하지 않습니다." : "This link only stops future receiving. It does not delete letters or reply cards you already created."}
          </p>
          <div className="mt-7">
            <LetterUnsubscribeForm locale={locale} token={token} />
          </div>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <TrustNotice locale={locale} />
        </aside>
      </section>
    </main>
  );
}
