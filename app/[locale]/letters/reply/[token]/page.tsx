import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { buildPageMetadata } from "@/lib/page-metadata";
import { getReplyBundle } from "@/lib/letters";
import { resolveLocale } from "@/lib/server-locale";
import { LetterReplyForm } from "@/components/letter-forms";
import { LetterCardVisual, TrustNotice } from "@/components/letter-card-visual";

type Props = { params: Promise<{ locale: string; token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  return buildPageMetadata(locale, locale === "ko" ? "빛의 릴레이 — 답변 작성" : "Light Relay — Write a reply", "", "/letters/reply");
}

export default async function LetterReplyPage({ params }: Props) {
  const { locale: requestedLocale, token } = await params;
  const locale = await resolveLocale(requestedLocale);
  const bundle = await getReplyBundle(token);
  if (!bundle?.card || bundle.letter.status === "blocked") {
    notFound();
  }

  return (
    <main className="page-shell pb-28">
      <section className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-4">
          <LetterCardVisual card={bundle.card} locale={locale} />
          <TrustNotice locale={locale} />
        </div>
        <div className="glass rounded-[32px] p-6 sm:p-8 lg:p-10">
          <p className="section-title">{locale === "ko" ? "빛의 릴레이" : "Light Relay"}</p>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-[var(--ink)]">
            {locale === "ko" ? "이 고민에 성구를 골라 위로를 전해주세요." : "Choose a Scripture and send comfort for this concern."}
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--ink-muted)]">
            {locale === "ko" ? "아래 추천 성구 중 하나를 고르거나 직접 입력하세요. 답변은 시스템이 카드뉴스로 만들어 작성자에게 전달합니다. 당신의 이메일은 보이지 않습니다." : "Pick one of the recommended scriptures or enter your own. The system turns your answer into a card and delivers it. Your email is never shown."}
          </p>
          <div className="mt-7">
            <LetterReplyForm locale={locale} token={token} defaultScripture={bundle.letter.scripture.reference} />
          </div>
        </div>
      </section>
    </main>
  );
}
