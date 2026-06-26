import type { Metadata, Viewport } from "next";

import { OG_IMAGE_URL, SITE_URL, siteDescription, siteImageAlt, siteKeywords, siteTitle } from "@/lib/page-metadata";
import "./globals.css";

const defaultLocale = "ko";
const defaultTitle = `성경 길찾기 | ${siteTitle(defaultLocale)}`;
const defaultDescription = siteDescription(defaultLocale);
const defaultImageAlt = siteImageAlt(defaultLocale);

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: defaultTitle,
    template: `%s | ${siteTitle(defaultLocale)}`,
  },
  applicationName: siteTitle(defaultLocale),
  description: defaultDescription,
  keywords: siteKeywords(defaultLocale),
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: `${SITE_URL}/ko`,
    languages: {
      ko: `${SITE_URL}/ko`,
      en: `${SITE_URL}/en`,
    },
  },
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    url: `${SITE_URL}/ko`,
    siteName: siteTitle(defaultLocale),
    type: "website",
    locale: "ko_KR",
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: defaultImageAlt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: [OG_IMAGE_URL],
  },
  creator: "Ponslink",
  publisher: "Ponslink",
  category: "Bible study",
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
        <meta name="theme-color" content="#12100d" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#fbfaf7" media="(prefers-color-scheme: light)" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = window.localStorage.getItem('bible-theme');
                  var theme = stored === 'dark' || stored === 'light'
                    ? stored
                    : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                  document.documentElement.dataset.theme = theme;
                  document.documentElement.classList.toggle('dark', theme === 'dark');
                  document.documentElement.style.colorScheme = theme;
                } catch (e) {
                  document.documentElement.dataset.theme = 'light';
                  document.documentElement.style.colorScheme = 'light';
                }
              })();
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var standalone =
                    window.matchMedia('(display-mode: standalone)').matches ||
                    window.matchMedia('(display-mode: fullscreen)').matches ||
                    window.navigator.standalone === true ||
                    document.referrer.indexOf('android-app://') === 0;
                  document.documentElement.dataset.pwaReady = standalone ? 'false' : 'true';
                  if (standalone) {
                    document.documentElement.dataset.pwaStandalone = 'true';
                  }
                    window.setTimeout(function() {
                      document.documentElement.dataset.pwaReady = 'true';
                    }, 1400);
                } catch (e) {
                  document.documentElement.dataset.pwaReady = 'true';
                }
              })();
            `,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: defaultTitle,
              alternateName: siteTitle(defaultLocale),
              url: SITE_URL,
              description: defaultDescription,
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
