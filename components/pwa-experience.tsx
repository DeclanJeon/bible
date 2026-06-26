"use client";

import { ArrowLeft, Download, PlusSquare, Share, Smartphone, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type AppLocale = "ko" | "en";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallMode = "android" | "ios" | "generic";

const DISMISS_KEY = "bible-companion:pwa-install-dismissed-at";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

const COPY = {
  ko: {
    installTitle: "성경 컴패니언을 홈 화면에 설치하세요",
    androidBody: "앱처럼 빠르게 열고, 더 안정적으로 다시 접속할 수 있습니다.",
    iosBody: "Safari 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택하세요.",
    genericBody: "브라우저 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요.",
    install: "설치하기",
    later: "나중에",
    close: "설치 안내 닫기",
    stepShare: "공유",
    stepAdd: "홈 화면에 추가",
    stepOpen: "아이콘으로 실행",
  },
  en: {
    installTitle: "Install Bible Companion on your home screen",
    androidBody: "Open it like an app and return more reliably on mobile or tablet.",
    iosBody: "Tap Safari’s Share button, then choose Add to Home Screen.",
    genericBody: "Use your browser menu and choose Install app or Add to Home Screen.",
    install: "Install",
    later: "Later",
    close: "Close install guide",
    stepShare: "Share",
    stepAdd: "Add to Home Screen",
    stepOpen: "Open from icon",
  },
} as const;

const BACK_FALLBACK_BY_SOURCE: Record<string, (locale: AppLocale) => string> = {
  "faith-basics": (locale) => `/${locale}/faith-basics`,
  hanja: (locale) => `/${locale}/hanja`,
  panel: (locale) => `/${locale}/companion`,
  passage: (locale) => `/${locale}`,
  crossref: (locale) => `/${locale}/lanes`,
};

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.startsWith("android-app://")
  );
}

function isTouchDevice() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: none), (pointer: coarse), (max-width: 1024px)").matches;
}

function detectIosSafari() {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigatorWithStandalone.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  const isWebKit = /WebKit/.test(ua);
  const isExcludedBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIos && isWebKit && !isExcludedBrowser;
}

function recentlyDismissed() {
  try {
    const value = window.localStorage.getItem(DISMISS_KEY);
    if (!value) return false;
    return Date.now() - Number(value) < DISMISS_MS;
  } catch {
    return false;
  }
}

function dismissForNow() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Ignore storage failures; dismissal is a convenience only.
  }
}

function PwaBootController() {
  useEffect(() => {
    const root = document.documentElement;

    if (!isStandaloneDisplay()) {
      root.dataset.pwaReady = "true";
      root.removeAttribute("data-pwa-standalone");
      return;
    }

    root.dataset.pwaStandalone = "true";
    const timer = window.setTimeout(() => {
      root.dataset.pwaReady = "true";
    }, 1250);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}

function PwaBackButton({ locale }: { locale: AppLocale }) {
  const router = useRouter();
  const pathname = usePathname();
  const [fallbackHref, setFallbackHref] = useState(`/${locale}`);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get("from");
    const sourceFallback = source ? BACK_FALLBACK_BY_SOURCE[source]?.(locale) : undefined;
    setFallbackHref(sourceFallback ?? `/${locale}`);
    setVisible(isStandaloneDisplay());
  }, [locale, pathname]);

  const goBack = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }, [fallbackHref, router]);

  if (!visible || pathname === `/${locale}`) return null;

  return (
    <button
      type="button"
      onClick={goBack}
      className="fixed left-3 top-[calc(var(--nav-height)+env(safe-area-inset-top)+0.75rem)] z-[65] inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--surface-1)]/95 px-4 py-2 text-sm font-semibold text-[var(--ink)] shadow-xl shadow-black/30 backdrop-blur-xl transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)] sm:left-5"
      aria-label={locale === "ko" ? "이전 화면으로 돌아가기" : "Go back"}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {locale === "ko" ? "이전으로" : "Back"}
    </button>
  );
}

function PwaInstallPrompt({ locale }: { locale: AppLocale }) {
  const copy = COPY[locale];
  const pathname = usePathname();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<InstallMode | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => {
      if (pathname === `/${locale}` || isStandaloneDisplay() || !isTouchDevice() || recentlyDismissed()) {
        setVisible(false);
        setMode(null);
        return;
      }

      if (installEvent) {
        setMode("android");
        setVisible(true);
        return;
      }

      if (detectIosSafari()) {
        setMode("ios");
        setVisible(true);
        return;
      }

      setMode("generic");
      setVisible(true);
    };

    updateVisibility();
    const timer = window.setTimeout(updateVisibility, 900);
    return () => window.clearTimeout(timer);
  }, [installEvent, locale, pathname]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setVisible(false);
      setMode(null);
      setInstallEvent(null);
      try {
        window.localStorage.removeItem(DISMISS_KEY);
      } catch {
        // Ignore storage failures.
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const body = useMemo(() => {
    if (mode === "android") return copy.androidBody;
    if (mode === "ios") return copy.iosBody;
    return copy.genericBody;
  }, [copy.androidBody, copy.genericBody, copy.iosBody, mode]);

  const dismiss = useCallback(() => {
    dismissForNow();
    setVisible(false);
  }, []);

  const install = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice.outcome === "dismissed") {
      dismissForNow();
    }
    setVisible(false);
  }, [installEvent]);

  if (!visible || !mode) return null;

  return (
    <aside className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-md rounded-3xl border border-[var(--gold-border)] bg-[var(--surface-1)]/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl sm:bottom-5 sm:right-5 sm:left-auto" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--gold-soft)] text-[var(--gold)]">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="pr-8 text-sm font-bold leading-5 text-[var(--ink)]">{copy.installTitle}</div>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{body}</p>

          {mode === "ios" ? (
            <ol className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-[var(--ink-muted)]">
              <li className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] px-2 py-2">
                <Share className="mx-auto mb-1 h-4 w-4 text-[var(--gold)]" />
                {copy.stepShare}
              </li>
              <li className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] px-2 py-2">
                <PlusSquare className="mx-auto mb-1 h-4 w-4 text-[var(--gold)]" />
                {copy.stepAdd}
              </li>
              <li className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] px-2 py-2">
                <Smartphone className="mx-auto mb-1 h-4 w-4 text-[var(--gold)]" />
                {copy.stepOpen}
              </li>
            </ol>
          ) : null}

          <div className="mt-3 flex gap-2">
            {mode === "android" && installEvent ? (
              <button type="button" onClick={install} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-3 py-2 text-sm font-bold text-[var(--canvas)] transition hover:bg-[var(--gold-hover)]">
                <Download className="h-4 w-4" />
                {copy.install}
              </button>
            ) : null}
            <button type="button" onClick={dismiss} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[var(--hairline-strong)] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)]">
              {copy.later}
            </button>
          </div>
        </div>
        <button type="button" onClick={dismiss} aria-label={copy.close} className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--ink-muted)] transition hover:bg-white/5 hover:text-[var(--ink)]">
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}

export function PwaExperience({ locale }: { locale: AppLocale }) {
  return (
    <>
      <PwaBootController />
      <PwaBackButton locale={locale} />
      <PwaInstallPrompt locale={locale} />
    </>
  );
}
