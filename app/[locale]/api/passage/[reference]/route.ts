import { NextResponse } from "next/server";
import { getPassage, parseBibleReferenceSlug } from "@/lib/bible";
import { resolveAppLocale } from "@/lib/content";
import { buildBibleReferenceHref, serializeBibleReferenceSlug } from "@/lib/navigation";

function formatReferenceLabel(reference: { code: string; chapter: number; startVerse: number; endVerse: number }) {
  return `${reference.code} ${reference.chapter}:${reference.startVerse}${reference.endVerse > reference.startVerse ? `-${reference.endVerse}` : ""}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; reference: string }> },
) {
  const { locale: requestedLocale, reference: referenceSlug } = await params;
  const reference = parseBibleReferenceSlug(referenceSlug);
  if (!reference) {
    return NextResponse.json({ error: "invalid-reference" }, { status: 404 });
  }

  const locale = resolveAppLocale(requestedLocale);
  const passage = await getPassage(reference, locale);
  const expectedVerseCount = reference.endVerse - reference.startVerse + 1;
  const exactCoverage =
    passage.verses.length === expectedVerseCount &&
    passage.verses[0]?.verse === reference.startVerse &&
    passage.verses.at(-1)?.verse === reference.endVerse;

  if (!exactCoverage) {
    return NextResponse.json({ error: "invalid-reference" }, { status: 404 });
  }

  const slug = serializeBibleReferenceSlug(reference);
  return NextResponse.json({
    reference: {
      ...reference,
      slug,
      label: passage.reference,
      displayReference: formatReferenceLabel(reference),
    },
    book: passage.book ? { code: passage.book.code, name: passage.book.name, testament: passage.book.testament } : null,
    verses: passage.verses.map((verse) => ({ verse: verse.verse, text: verse.text })),
    fullReaderHref: buildBibleReferenceHref(reference, { locale, from: "panel" }),
    crossrefsHref: `/${locale}/crossrefs/${slug}`,
  });
}
