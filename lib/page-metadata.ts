import type { Metadata } from "next";
import { UI_COPY, type AppLocale } from "@/lib/content";

export const SITE_URL = "https://bible.ponslink.com";

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

type PageMetadataOptions = {
  imagePath?: string;
};
export function siteImageAlt(locale: AppLocale) {
  return locale === "ko"
    ? "성경 길찾기 - 고민 한 문장을 본문, 맥락, 교차참조로 연결하는 성경 공부 앱"
    : "Bible Guidance - a Bible study app that connects one concern to passages, context, and cross references";
}

export function siteKeywords(locale: AppLocale) {
  return locale === "ko"
    ? [
        "성경 공부",
        "성경 묵상",
        "성경 교차참조",
        "성경 본문",
        "신앙 질문",
        "성경 길찾기",
        "성경 하이퍼링크 컴패니언",
      ]
    : [
        "Bible study",
        "Bible reflection",
        "Bible cross references",
        "Scripture context",
        "faith questions",
        "Bible guidance",
        "Bible Hyperlink Companion",
      ];
}


function pageOgImageUrl(locale: AppLocale, title: string, description: string, path?: string) {
  const params = new URLSearchParams({
    locale,
    title,
    description: description || siteDescription(locale),
    path: localizedPath(normalizePath(path), locale),
  });
  return absoluteUrl(`/api/og?${params.toString()}`);
}

export function buildPageMetadata(locale: AppLocale, title: string, description: string, path?: string, options: PageMetadataOptions = {}): Metadata {
  const siteName = UI_COPY[locale].siteTitle;
  const fullTitle = `${title} | ${siteName}`;
  const pathname = normalizePath(path);
  const canonicalPath = localizedPath(pathname, locale);
  const url = absoluteUrl(canonicalPath);
  const imageUrl = options.imagePath ? absoluteUrl(options.imagePath) : pageOgImageUrl(locale, title, description, pathname);

  return {
    title,
    description,
    keywords: siteKeywords(locale),
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
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: siteImageAlt(locale),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [imageUrl],
    },
  };
}

export function siteDescription(locale: AppLocale) {
  return locale === "ko"
    ? "고민 한 문장을 입력하면 성경 본문, 문맥, 교차참조, 시대·장소·저자 정보를 따라 공부 경로를 제안하는 한국어 성경 공부 앱입니다."
    : "Enter one concern and follow a grounded Bible study path through passages, context, cross references, date, place, and authorship.";
}

export function siteTitle(locale: AppLocale) {
  return UI_COPY[locale].siteTitle;
}
