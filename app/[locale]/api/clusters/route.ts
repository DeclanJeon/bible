import { NextResponse } from "next/server";
import { filterClusterCatalog } from "@/lib/app-data";
import { resolveAppLocale } from "@/lib/content";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const url = new URL(request.url);
  const topic = url.searchParams.get("topic") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;
  const { locale: requestedLocale } = await params;
  const locale = resolveAppLocale(requestedLocale);
  const { topicStarts, activeTopic, query, clusters, visibleClusters } = filterClusterCatalog({ topic, q, locale });

  return NextResponse.json({
    topicStarts,
    activeTopic,
    query,
    totalClusters: clusters.length,
    visibleCount: visibleClusters.length,
    clusters: visibleClusters,
  });
}
