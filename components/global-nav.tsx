"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type NavLink = {
  key: string;
  href: string;
  label: string;
};

type AppLocale = "ko" | "en";

const LOCALE_COPY = {
  ko: {
    siteTitle: "성경 하이퍼링크 컴패니언",
    close: "메뉴 닫기",
    open: "메뉴 열기",
    localeLabel: "언어",
  },
  en: {
    siteTitle: "Bible Hyperlink Companion",
    close: "Close menu",
    open: "Open menu",
    localeLabel: "Language",
  },
} as const;

function isActive(href: string, pathname: string) {
  if (href === "/ko" || href === "/en") return pathname === href;
  return pathname.startsWith(href);
}

function MobileDrawer({
  open,
  onClose,
  links,
  locale,
  copy,
}: {
  open: boolean;
  onClose: () => void;
  links: NavLink[];
  locale: AppLocale;
  copy: (typeof LOCALE_COPY)[AppLocale];
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const pathname = typeof window !== "undefined" ? window.location.pathname : "";

  return (
    <div className="fixed inset-0 z-modal lg:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label={copy.close}
      />
      <nav className="absolute right-0 top-0 flex h-full w-72 flex-col bg-surface-0 border-l border-[var(--hairline)] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--hairline)]">
          <span className="text-sm font-semibold text-ink">{copy.siteTitle}</span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted hover:text-ink transition"
            aria-label={copy.close}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {links.map(({ key, href, label }) => {
            const active = isActive(href, pathname);
            return (
              <Link
                key={key}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition ${
                  active
                    ? "bg-[var(--gold-soft)] text-gold"
                    : "text-ink-muted hover:text-ink hover:bg-surface-1"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
        <div className="border-t border-[var(--hairline)] px-5 py-4 flex gap-2">
          <Link
            href="/ko"
            className={`flex-1 text-center rounded-lg py-2.5 text-xs font-semibold transition ${
              locale === "ko"
                ? "bg-gold text-[var(--canvas)]"
                : "border border-[var(--hairline)] text-ink-muted hover:text-ink"
            }`}
          >
            KO
          </Link>
          <Link
            href="/en"
            className={`flex-1 text-center rounded-lg py-2.5 text-xs font-semibold transition ${
              locale !== "ko"
                ? "bg-gold text-[var(--canvas)]"
                : "border border-[var(--hairline)] text-ink-muted hover:text-ink"
            }`}
          >
            EN
          </Link>
        </div>
      </nav>
    </div>
  );
}

export function GlobalNav({
  locale,
  links,
  activeKey,
}: {
  locale: AppLocale;
  links: NavLink[];
  activeKey?: string;
}) {
  const pathname = usePathname();
  const copy = LOCALE_COPY[locale];
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <>
      <header className="sticky top-0 z-nav bg-surface-1/80 backdrop-blur-xl border-b border-[var(--hairline)]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex h-nav max-w-content items-center justify-between px-gutter">
          <Link
            href={`/${locale}`}
            className="text-sm font-semibold tracking-tight text-ink shrink-0"
          >
            {copy.siteTitle}
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {links.map(({ key, href, label }) => {
              const active = activeKey ? key === activeKey : isActive(href, pathname);
              return (
                <Link
                  key={key}
                  href={href}
                  className={`relative px-3 py-2 text-xs font-medium transition ${
                    active
                      ? "text-gold"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {label}
                  {active ? (
                    <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-gold" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-1 rounded-lg border border-[var(--hairline)] p-0.5">
              <Link
                href="/ko"
                className={`px-2 py-1 text-[11px] font-semibold rounded-md transition ${
                  locale === "ko"
                    ? "bg-gold text-[var(--canvas)]"
                    : "text-ink-subtle hover:text-ink"
                }`}
              >
                KO
              </Link>
              <Link
                href="/en"
                className={`px-2 py-1 text-[11px] font-semibold rounded-md transition ${
                  locale !== "ko"
                    ? "bg-gold text-[var(--canvas)]"
                    : "text-ink-subtle hover:text-ink"
                }`}
              >
                EN
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted hover:text-ink transition"
              aria-label={copy.open}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <MobileDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        links={links}
        locale={locale}
        copy={copy}
      />
    </>
  );
}
