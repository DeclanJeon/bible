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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "성경 컴패니언",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#08080d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
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
        <link
          rel="preconnect"
          href="https://cdn.jsdelivr.net"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#08080d" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#08080d" media="(prefers-color-scheme: light)" />
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(reg) { console.log('SW registered:', reg.scope); },
                    function(err) { console.log('SW registration failed:', err); }
                  );
                });
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
