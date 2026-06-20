import Link from "next/link";
import { BookOpen, BookOpenText, Compass, Home, Languages, Layers, MessageSquareText, Sparkles } from "lucide-react";
import { UI_COPY, resolveAppLocale } from "@/lib/content";
import { buildBibleHref, buildCompanionHref, buildGraphHref, buildLanesHref, buildReviewsHref, buildStudyHref } from "@/lib/navigation";
import { hasHanjaCatalogEntries } from "@/lib/hanja-catalog";


export async function SecondaryNav({
  locale,
  active,
  slug,
  title,
}: {
  locale?: string;
  active: "companion" | "study" | "graph" | "lanes" | "bible" | "reviews" | "hanja";
  slug?: string;
  title?: string;
}) {
  const appLocale = resolveAppLocale(locale);
  const sidebarCopy = UI_COPY[appLocale].sidebar;
  const hasHanjaEntries = await hasHanjaCatalogEntries();

  const items = [
    { key: "home", href: `/${appLocale}`, label: UI_COPY[appLocale].siteTitle, icon: Home },
    { key: "bible", href: buildBibleHref({ locale: appLocale }), label: sidebarCopy.navBible, icon: BookOpenText },
    ...(hasHanjaEntries
      ? [{ key: "hanja", href: `/${appLocale}/hanja`, label: appLocale === "ko" ? "한자" : "Hanja", icon: Languages }]
      : []),
    { key: "companion", href: buildCompanionHref({ locale: appLocale }), label: sidebarCopy.navNewReflection, icon: Sparkles },
    ...(slug
      ? [
          { key: "study", href: buildStudyHref(slug, appLocale), label: UI_COPY[appLocale].companion.openStudyDesk, icon: BookOpen, secondary: true },
          { key: "graph", href: buildGraphHref(slug, appLocale), label: sidebarCopy.navGraph, icon: Compass, secondary: true },
        ]
      : []),
    { key: "lanes", href: buildLanesHref({ locale: appLocale }), label: sidebarCopy.navLanes, icon: Layers, secondary: true },
    { key: "reviews", href: buildReviewsHref(appLocale), label: sidebarCopy.navReviews, icon: MessageSquareText, secondary: true },
  ];

  return (
    <header className="glass rounded-xl px-4 py-3 sm:rounded-2xl sm:px-5 sm:py-4 lg:px-6 lg:sticky lg:top-0 z-30 lg:backdrop-blur-xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link href={`/${appLocale}`} className="text-sm font-semibold tracking-tight text-[var(--ink)]">{UI_COPY[appLocale].siteTitle}</Link>
          <div className="mt-0.5 text-xs text-[var(--muted)] sm:text-sm">{title ?? UI_COPY[appLocale].siteSubtitle}</div>
        </div>
        <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin lg:flex-wrap lg:gap-2 lg:overflow-visible lg:pb-0">
          {items.map(({ key, href, label, icon: Icon, secondary }) => {
            const isActive = key === active;
            return (
              <Link
                key={key}
                href={href}
                className={`inline-flex shrink-0 min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
                  isActive
                    ? "bg-[var(--gold)] text-[var(--canvas)]"
                    : secondary
                      ? "border border-[var(--hairline)] bg-[var(--surface-2)] text-[var(--ink-subtle)] hover:border-[var(--gold)]/25 hover:text-[var(--ink)]"
                      : "border border-[var(--hairline)] bg-[var(--surface-2)] text-[var(--ink)] hover:border-[var(--gold)]/25 hover:text-[var(--gold)]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
