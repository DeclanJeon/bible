import Link from "next/link";
import { BookOpen, Compass, Home, Sparkles } from "lucide-react";
import { UI_COPY, resolveAppLocale } from "@/lib/content";
import { buildBibleHref, buildCompanionHref, buildGraphHref, buildLanesHref, buildStudyHref } from "@/lib/navigation";


export function SecondaryNav({
  locale,
  active,
  slug,
  title,
}: {
  locale?: string;
  active: "companion" | "study" | "graph" | "lanes" | "bible";
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
  ];

  return (
    <header className="glass rounded-[28px] px-5 py-4 lg:px-6 lg:sticky lg:top-0 z-30 lg:backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-white">{UI_COPY[appLocale].siteTitle}</div>
          <div className="mt-1 text-sm text-[var(--muted)]">{title ?? UI_COPY[appLocale].siteSubtitle}</div>
        </div>
        <nav className="flex flex-wrap gap-2">
          {items.map(({ key, href, label, icon: Icon }) => {
            const isActive = key === active;
            return (
              <Link
                key={key}
                href={href}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-[var(--accent)] text-slate-950"
                    : "border border-white/10 bg-white/[0.03] text-white hover:border-[var(--gold)]/25 hover:text-[var(--gold)]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
