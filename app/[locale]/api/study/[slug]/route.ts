import { NextResponse } from "next/server";
import { getChapterContext, getPassage } from "@/lib/bible";
import { getClusterBySlug, getRelatedClusters } from "@/lib/app-data";
import { localizeStoryCluster, resolveAppLocale } from "@/lib/content";
import { getBookMetadata } from "@/lib/book-metadata";
import { getPassageCrossReferences } from "@/lib/knowledge";
import { buildReflectionResponse } from "@/lib/reflection";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; slug: string }> },
) {
  const { locale: requestedLocale, slug } = await params;
  const locale = resolveAppLocale(requestedLocale);
  const baseCluster = getClusterBySlug(slug);

  if (!baseCluster) {
    return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
  }

  const cluster = localizeStoryCluster(baseCluster, locale);

  const primary = await getPassage(cluster.primary, locale);
  const chapterContext = await getChapterContext(cluster.primary, 2, locale);
  const graphSuggestions = await getPassageCrossReferences(cluster.primary, 6, locale);
  const fallbackLinkedTexts = graphSuggestions.map((suggestion) => ({
    label: suggestion.displayReference,
    type: "theme" as const,
    summary: suggestion.supportLine || suggestion.excerpt,
    reference: suggestion.target,
  }));
  const effectiveCluster = {
    ...cluster,
    linkedTexts: cluster.linkedTexts.length ? cluster.linkedTexts : fallbackLinkedTexts,
    supporting: cluster.supporting.length
      ? cluster.supporting
      : graphSuggestions.slice(0, 3).map((suggestion) => suggestion.target),
  };
  const linked = await Promise.all(effectiveCluster.linkedTexts.map((item) => getPassage(item.reference, locale)));
  const response = await buildReflectionResponse(effectiveCluster, effectiveCluster.pastoralPrompt, locale);
  const primaryBookMetadata = getBookMetadata(cluster.primary.code, locale);
  const relatedClusters = getRelatedClusters(cluster.slug, 3).map((related) => {
    const localized = localizeStoryCluster(related, locale);
    return {
      slug: localized.slug,
      title: localized.title,
      pastoralPrompt: localized.pastoralPrompt,
      starterPrompt: localized.starterPrompt,
      themes: localized.themes,
    };
  });

  return NextResponse.json({
    cluster: effectiveCluster,
    primary,
    primaryBookMetadata,
    chapterContext,
    linked,
    graphSuggestions,
    relatedClusters,
    response,
  });
}
