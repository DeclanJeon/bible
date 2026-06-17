import Link from "next/link";
import { BookOpen, Compass, Home, MessageSquareText, Sparkles } from "lucide-react";
import { UI_COPY, resolveAppLocale } from "@/lib/content";
import { buildBibleHref, buildCompanionHref, buildGraphHref, buildLanesHref, buildReviewsHref, buildStudyHref } from "@/lib/navigation";


export function SecondaryNav({
  locale,
  active,
  slug,
  title,
}: {
  locale?: string;
  active: "companion" | "study" | "graph" | "lanes" | "bible" | "reviews";
  slug?: string;
  title?: string;
}) {
  const appLocale = resolveAppLocale(locale);
  const sidebarCopy = UI_COPY[appLocale].sidebar;

  const items = [
    { key: "home", href: `/${appLocale}`, label: UI_COPY[appLocale].siteTitle, icon: Home },
    { key: "companion", href: buildCompanionHref({ locale: appLocale }), label: sidebarCopy.navNewReflection, icon: Sparkles },
    ...(slug
      ? [
          { key: "study", href: buildStudyHref(slug, appLocale), label: UI_COPY[appLocale].companion.openStudyDesk, icon: BookOpen },
          { key: "graph", href: buildGraphHref(slug, appLocale), label: sidebarCopy.navGraph, icon: Compass },
        ]
      : []),
    { key: "lanes", href: buildLanesHref({ locale: appLocale }), label: sidebarCopy.navLanes, icon: BookOpen },
    { key: "bible", href: buildBibleHref({ locale: appLocale }), label: sidebarCopy.navBible, icon: BookOpen },
    { key: "reviews", href: buildReviewsHref(appLocale), label: sidebarCopy.navReviews, icon: MessageSquareText },
  ];

  return (
    <header className="glass rounded-[20px] px-4 py-3 sm:rounded-[28px] sm:px-5 sm:py-4 lg:px-6 lg:sticky lg:top-0 z-30 lg:backdrop-blur-xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link href={`/${appLocale}`} className="text-sm font-semibold text-white">{UI_COPY[appLocale].siteTitle}</Link>
          <div className="mt-0.5 text-xs text-[var(--muted)] sm:text-sm">{title ?? UI_COPY[appLocale].siteSubtitle}</div>
        </div>
        <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin lg:flex-wrap lg:gap-2 lg:overflow-visible lg:pb-0">
          {items.map(({ key, href, label, icon: Icon }) => {
            const isActive = key === active;
            return (
              <Link
                key={key}
                href={href}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
                  isActive
                    ? "bg-[var(--accent)] text-slate-950"
                    : "border border-white/10 bg-white/[0.03] text-white hover:border-[var(--gold)]/25 hover:text-[var(--gold)]"
                }`}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
