"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Heart,
  HelpCircle,
  Home,
  Languages,
  Layers,
  Menu,
  MoreHorizontal,
  MessageSquare,
  Moon,
  Shield,
  Sparkles,
  Sun,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type NavLink = {
  key: string;
  href: string;
  label: string;
};

type AppLocale = "ko" | "en";
type Theme = "light" | "dark";

const LOCALE_COPY = {
  ko: {
    siteTitle: "성경 컴패니언",
    close: "메뉴 닫기",
    open: "메뉴 열기",
    theme: "테마 전환",
    navigation: "모바일 내비게이션",
  },
  en: {
    siteTitle: "Bible Companion",
    close: "Close menu",
    open: "Open menu",
    theme: "Toggle theme",
    navigation: "Mobile navigation",
  },
} as const;

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  bible: BookOpen,
  hanja: Languages,
  companion: Sparkles,
  "faith-basics": Shield,
  "faith-questions": HelpCircle,
  "spirit-soul-body": Heart,
  lanes: Layers,
  reviews: MessageSquare,
};

function isActive(href: string, pathname: string) {
  if (href === "/ko" || href === "/en") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

function ThemeToggle({ label }: { label: string }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    const initial: Theme =
      current === "dark" || current === "light"
        ? current
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next);
      window.localStorage.setItem("bible-theme", next);
      return next;
    });
  }, []);

  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
      aria-label={label}
      aria-pressed={theme === "dark"}
      title={label}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function MobileDrawer({
  open,
  onClose,
  links,
  copy,
  drawerId,
}: {
  open: boolean;
  onClose: () => void;
  links: NavLink[];
  copy: (typeof LOCALE_COPY)[AppLocale];
  drawerId: string;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
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
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled") && element.tabIndex !== -1);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const pathname = typeof window !== "undefined" ? window.location.pathname : "";

  return (
    <div
      id={drawerId}
      className="fixed inset-0 z-modal lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={copy.navigation}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
        aria-label={copy.close}
      />
      <nav ref={panelRef} className="absolute right-0 top-0 flex h-full w-72 flex-col border-l border-[var(--hairline)] bg-surface-1 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-4">
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Image src="/logo.svg" alt="" width={20} height={20} className="h-5 w-5 rounded" priority />
            {copy.siteTitle}
          </span>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted transition hover:text-ink"
            aria-label={copy.close}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
          {links.map(({ key, href, label }) => {
            const Icon = ICONS[key] ?? Sparkles;
            const active = isActive(href, pathname);
            return (
              <Link
                key={key}
                href={href}
                onClick={onClose}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-[var(--gold-soft)] text-gold"
                    : "text-ink-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
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
  const drawerId = "global-mobile-navigation";
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const openDrawer = useCallback((trigger: HTMLElement) => {
    returnFocusRef.current = trigger;
    setDrawerOpen(true);
  }, []);
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    window.requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, []);
  const bottomLinks = [
    links.find((link) => link.key === "home"),
    links.find((link) => link.key === "bible"),
    links.find((link) => link.key === "companion"),
    links.find((link) => link.key === "lanes"),
  ].filter((link): link is NavLink => Boolean(link));
  const bottomLabels =
    locale === "ko"
      ? { bible: "성경", companion: "컴패니언", lanes: "레인", more: "더보기" }
      : { bible: "Bible", companion: "Companion", lanes: "Lanes", more: "More" };


  return (
    <>
      <header className="sticky top-0 z-nav w-full border-b border-[var(--hairline)] bg-[var(--nav-bg)] backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 lg:px-6">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink transition-opacity hover:opacity-80"
          >
            <Image src="/logo.svg" alt="" width={20} height={20} className="h-5 w-5 rounded" priority />
            {copy.siteTitle}
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {links.map(({ key, href, label }) => {
              const Icon = ICONS[key] ?? Sparkles;
              const active = activeKey ? key === activeKey : isActive(href, pathname);
              return (
                <Link
                  key={key}
                  href={href}
                  className={`relative flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active ? "text-gold" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                  {active ? (
                    <span className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-gold" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1">
            <ThemeToggle label={copy.theme} />
            <button
              type="button"
              onClick={(event) => openDrawer(event.currentTarget)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface-2 hover:text-ink lg:hidden"
              aria-label={copy.open}
              aria-expanded={drawerOpen}
              aria-controls={drawerId}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <MobileDrawer open={drawerOpen} onClose={closeDrawer} links={links} copy={copy} drawerId={drawerId} />

      <nav className="fixed inset-x-0 bottom-0 z-nav border-t border-[var(--hairline)] bg-[var(--nav-bg)] backdrop-blur-lg lg:hidden">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2 pb-[env(safe-area-inset-bottom,0px)]">
          {bottomLinks.map(({ key, href, label }) => {
            const Icon = ICONS[key] ?? Sparkles;
            const active = activeKey ? key === activeKey : isActive(href, pathname);
            const shortLabel = key === "home" ? label : bottomLabels[key as keyof typeof bottomLabels] ?? label;
            return (
              <Link
                key={key}
                href={href}
                className={`relative flex min-w-12 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                  active ? "text-gold" : "text-ink-muted hover:text-ink"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{shortLabel}</span>
                {active ? <span className="absolute bottom-1 h-0.5 w-1 rounded-full bg-gold" /> : null}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={(event) => openDrawer(event.currentTarget)}
            className="flex min-w-12 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-ink-muted transition-colors hover:text-ink"
            aria-expanded={drawerOpen}
            aria-controls={drawerId}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>{bottomLabels.more}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
