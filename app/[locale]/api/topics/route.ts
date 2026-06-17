import { NextResponse } from "next/server";
import { getTopicStarts } from "@/lib/app-data";
import { localizeTopicLabel, resolveAppLocale } from "@/lib/content";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale: requestedLocale } = await params;
  const locale = resolveAppLocale(requestedLocale);
  return NextResponse.json({
    topics: getTopicStarts().map((topic) => ({
      ...topic,
      label: localizeTopicLabel(topic.label, locale),
    })),
  });
}
