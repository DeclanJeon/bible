import type { Metadata } from "next";
import { UI_COPY, type AppLocale } from "@/lib/content";

export const SITE_URL = "https://bible-guide.kr";

function normalizePath(path?: string) {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function localizedPath(path: string, locale: AppLocale) {
  const pathname = normalizePath(path);
  return pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;
}

function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString();
}

export const OG_IMAGE_URL = absoluteUrl("/og-image.png");

export function buildPageMetadata(locale: AppLocale, title: string, description: string, path?: string): Metadata {
  const siteName = UI_COPY[locale].siteTitle;
  const fullTitle = `${title} | ${siteName}`;
  const pathname = normalizePath(path);
  const canonicalPath = localizedPath(pathname, locale);
  const url = absoluteUrl(canonicalPath);

  return {
    title: fullTitle,
    description,
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: url,
      languages: {
        ko: absoluteUrl(localizedPath(pathname, "ko")),
        en: absoluteUrl(localizedPath(pathname, "en")),
      },
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName,
      type: "website",
      locale: locale === "ko" ? "ko_KR" : "en_US",
      images: [
        {
          url: OG_IMAGE_URL,
          width: 1200,
          height: 630,
          alt: siteName,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [OG_IMAGE_URL],
    },
  };
}

export function siteDescription(locale: AppLocale) {
  return locale === "ko"
    ? "삶의 고민을 성경 본문, 문맥, 교차참조, 시대와 장소의 층위로 연결해 주는 근거 중심 성경 공부 컴패니언입니다."
    : "A grounded Bible study companion that connects lived concerns to scripture, context, and cross references.";
}

export function siteTitle(locale: AppLocale) {
  return UI_COPY[locale].siteTitle;
}
