import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { buildPageMetadata } from "@/lib/page-metadata";
import { getCardBundle } from "@/lib/letters";
import { resolveLocale } from "@/lib/server-locale";
import { LetterActionPanel, LetterCardVisual, TrustNotice } from "@/components/letter-card-visual";

type Props = { params: Promise<{ locale: string; cardId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale, cardId } = await params;
  const locale = await resolveLocale(requestedLocale);
  const bundle = await getCardBundle(cardId);
  const card = bundle?.requestedCard ?? bundle?.card;
  return buildPageMetadata(locale, card?.title ?? (locale === "ko" ? "말씀편지 카드" : "Scripture letter card"), card?.summary ?? "", `/letters/card/${cardId}`);
}

export default async function LetterCardPage({ params }: Props) {
  const { locale: requestedLocale, cardId } = await params;
  const locale = await resolveLocale(requestedLocale);
  const bundle = await getCardBundle(cardId);
  const card = bundle?.requestedCard ?? bundle?.card;
  if (!bundle || !card) {
    notFound();
  }

  return (
    <main className="page-shell pb-28">
      <Link href={`/${locale}/letters`} className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]">
        <ArrowLeft className="h-4 w-4" />
        {locale === "ko" ? "위로의 말씀편지" : "Letters"}
      </Link>
      <section className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,560px)_minmax(300px,1fr)] lg:items-start">
        <div className="space-y-4">
          <LetterCardVisual card={card} locale={locale} />
          <TrustNotice locale={locale} />
        </div>
        <LetterActionPanel bundle={bundle} card={card} locale={locale} />
      </section>
    </main>
  );
}
