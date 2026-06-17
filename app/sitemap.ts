import type { MetadataRoute } from "next";
import { STORY_CLUSTERS } from "@/lib/app-data";
import { serializeBibleReference, type BibleReference } from "@/lib/bible";

const SITE_URL = "https://bible-guide.kr";

function passageKey(reference: BibleReference) {
  return serializeBibleReference(reference);
}

function localizedUrl(locale: "en" | "ko", path = "") {
  return `${SITE_URL}/${locale}${path}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  const staticPages: MetadataRoute.Sitemap = [
    { url: localizedUrl("ko"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: localizedUrl("en"), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: localizedUrl("ko", "/lanes"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: localizedUrl("en", "/lanes"), lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: localizedUrl("ko", "/bible"), lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: localizedUrl("en", "/bible"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: localizedUrl("ko", "/companion"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: localizedUrl("en", "/companion"), lastModified: now, changeFrequency: "weekly", priority: 0.75 },
    { url: localizedUrl("ko", "/reviews"), lastModified: now, changeFrequency: "weekly", priority: 0.55 },
    { url: localizedUrl("en", "/reviews"), lastModified: now, changeFrequency: "weekly", priority: 0.5 },
  ];

  const clusterPages: MetadataRoute.Sitemap = STORY_CLUSTERS.flatMap((cluster) => {
    const studyBase = { lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 };
    return [
      { url: localizedUrl("ko", `/study/${cluster.slug}`), ...studyBase },
      { url: localizedUrl("en", `/study/${cluster.slug}`), ...studyBase },
      { url: localizedUrl("ko", `/graph/${cluster.slug}`), ...studyBase, priority: 0.6 },
      { url: localizedUrl("en", `/graph/${cluster.slug}`), ...studyBase, priority: 0.5 },
    ];
  });

  const passageSlugs = [
    ...new Set(
      STORY_CLUSTERS.flatMap((cluster) => [
        cluster.primary,
        ...cluster.supporting,
        ...cluster.linkedTexts.map((item) => item.reference),
      ]).map(passageKey),
    ),
  ];

  const passagePages: MetadataRoute.Sitemap = passageSlugs.flatMap((slug) => [
    { url: localizedUrl("ko", `/passage/${slug}`), lastModified: now, changeFrequency: "monthly", priority: 0.55 },
    { url: localizedUrl("en", `/passage/${slug}`), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ]);

  return [...staticPages, ...clusterPages, ...passagePages];
}
