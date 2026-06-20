import type { Metadata, Viewport } from "next";

import { OG_IMAGE_URL, SITE_URL, siteDescription, siteTitle } from "@/lib/page-metadata";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: siteTitle("ko"),
  description: siteDescription("ko"),
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    title: siteTitle("ko"),
    description: siteDescription("ko"),
    url: `${SITE_URL}/ko`,
    siteName: siteTitle("ko"),
    type: "website",
    locale: "ko_KR",
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: siteTitle("ko"),
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle("ko"),
    description: siteDescription("ko"),
    images: [OG_IMAGE_URL],
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1020",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "성경 하이퍼링크 컴패니언",
              alternateName: "Bible Hyperlink Companion",
              url: SITE_URL,
              description:
                "삶의 고민을 성경 본문, 문맥, 교차참조, 시대와 장소의 층위로 연결해 주는 근거 중심 성경 공부 컴패니언입니다.",
              inLanguage: ["ko", "en"],
              potentialAction: {
                "@type": "SearchAction",
                target: `${SITE_URL}/ko/companion?prompt={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
