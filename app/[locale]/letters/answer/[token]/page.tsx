import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { buildPageMetadata } from "@/lib/page-metadata";
import { getAnswerBundle, getLetterParticipantSession } from "@/lib/letters";
import { resolveLocale } from "@/lib/server-locale";
import { LetterActionPanel, LetterCardVisual, TrustNotice } from "@/components/letter-card-visual";
import { RelayParticipationCTA } from "@/components/letter-forms";

type Props = { params: Promise<{ locale: string; token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  return buildPageMetadata(locale, locale === "ko" ? "빛의 릴레이 — 답변 도착" : "Light Relay — Answer arrived", "", "/letters/answer");
}

export default async function LetterAnswerPage({ params }: Props) {
  const { locale: requestedLocale, token } = await params;
  const locale = await resolveLocale(requestedLocale);
  const bundle = await getAnswerBundle(token);
  if (!bundle?.answer || !bundle.answerCard) {
    notFound();
  }
  const session = await getLetterParticipantSession((await cookies()).get("letters_participant_session")?.value ?? null);
  const isAlreadyRelayRunner = session?.canReceiveLetters === true;

  return (
    <main className="page-shell pb-28">
      <Link href={`/${locale}/letters`} className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]">
        <ArrowLeft className="h-4 w-4" />
        {locale === "ko" ? "빛의 릴레이" : "Light Relay"}
      </Link>
      <section className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,560px)_minmax(300px,1fr)] lg:items-start">
        <div className="space-y-4">
          <LetterCardVisual card={bundle.answerCard} locale={locale} />
          <TrustNotice locale={locale} />
        </div>
        <div className="space-y-6">
          <LetterActionPanel bundle={bundle} card={bundle.answerCard} locale={locale} />
          {!isAlreadyRelayRunner ? <RelayParticipationCTA locale={locale} /> : null}
        </div>
      </section>
    </main>
  );
}
