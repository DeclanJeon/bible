import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPassage, parseBibleReferenceSlug } from "@/lib/bible";
import { buildBibleReferenceHref } from "@/lib/navigation";
import { buildPageMetadata } from "@/lib/page-metadata";
import { resolveLocale } from "@/lib/server-locale";

type Props = {
  params: Promise<{ locale: string; reference: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale, reference: referenceSlug } = await params;
  const locale = await resolveLocale(requestedLocale);

  return buildPageMetadata(locale, locale === "ko" ? "본문" : "Passage", "Bible passage", `/passage/${referenceSlug}`);
}

export default async function PassagePage({ params }: Props) {
  const { locale: requestedLocale, reference: referenceSlug } = await params;
  const locale = await resolveLocale(requestedLocale);
  const reference = parseBibleReferenceSlug(referenceSlug);

  if (!reference) {
    notFound();
  }
  const passage = await getPassage(reference, locale);
  const expectedVerseCount = reference.endVerse - reference.startVerse + 1;
  const exactCoverage =
    passage.verses.length === expectedVerseCount &&
    passage.verses[0]?.verse === reference.startVerse &&
    passage.verses.at(-1)?.verse === reference.endVerse;
  if (!exactCoverage) {
    notFound();
  }

  redirect(buildBibleReferenceHref(reference, { locale, from: "passage" }));
}
