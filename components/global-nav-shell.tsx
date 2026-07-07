import { hasHanjaCatalogEntries } from "@/lib/hanja-catalog";
import { GlobalNav } from "@/components/global-nav";

type AppLocale = "ko" | "en";

export async function GlobalNavShell({ locale }: { locale: AppLocale }) {
  const hasHanja = await hasHanjaCatalogEntries();

  const links = [
    { key: "home", href: `/${locale}`, label: locale === "ko" ? "홈" : "Home" },
    { key: "bible", href: `/${locale}/bible`, label: locale === "ko" ? "성경 읽기" : "Bible" },
    { key: "letters", href: `/${locale}/letters`, label: locale === "ko" ? "말씀편지" : "Letters" },
    { key: "faith-questions", href: `/${locale}/faith-questions`, label: locale === "ko" ? "신앙 질문" : "Faith Questions" },
    { key: "faith-basics", href: `/${locale}/faith-basics`, label: locale === "ko" ? "신앙의 기본" : "Faith Basics" },
    ...(hasHanja ? [{ key: "hanja", href: `/${locale}/hanja`, label: locale === "ko" ? "한자" : "Hanja" }] : []),
    { key: "lanes", href: `/${locale}/lanes`, label: locale === "ko" ? "공부 레인" : "Lanes", secondary: true },
    { key: "spirit-soul-body", href: `/${locale}/spirit-soul-body`, label: locale === "ko" ? "영혼육" : "Spirit/Soul/Body", secondary: true },
    { key: "reviews", href: `/${locale}/reviews`, label: locale === "ko" ? "리뷰" : "Reviews", secondary: true },
  ];

  return <GlobalNav locale={locale} links={links} />;
}
