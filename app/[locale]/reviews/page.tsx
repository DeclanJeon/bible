import type { Metadata } from "next";
import { MessageSquareText } from "lucide-react";
import { ReviewBoard } from "@/components/review-board";

import { UI_COPY } from "@/lib/content";
import { buildPageMetadata } from "@/lib/page-metadata";
import { listAnonymousReviews } from "@/lib/reviews";
import { resolveLocale } from "@/lib/server-locale";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  const copy = UI_COPY[locale].reviews;

  return buildPageMetadata(locale, copy.title, copy.body, "/reviews");
}

export default async function ReviewsPage({ params }: Props) {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  const copy = UI_COPY[locale].reviews;
  const reviews = await listAnonymousReviews(locale, 50);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-8 lg:px-8">

      <section className="mt-8 glass rounded-[36px] p-7 lg:p-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/[0.08] px-4 py-2 text-sm font-semibold text-[var(--gold)]">
          <MessageSquareText className="h-4 w-4" />
          {copy.title}
        </div>
        <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight text-white lg:text-6xl">{copy.heading}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--muted)]">{copy.body}</p>
      </section>

      <section className="mt-8">
        <ReviewBoard locale={locale} initialReviews={reviews} copy={copy} />
      </section>
    </main>
  );
}
