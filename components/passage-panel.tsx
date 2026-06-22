"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, Network, X } from "lucide-react";
import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PropsWithChildren,
} from "react";
import { buildPassageApiHref } from "@/lib/navigation";

type AppLocale = "ko" | "en";

type BibleReferenceLike = {
  code: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
};

type PassagePanelData = {
  reference: BibleReferenceLike & {
    slug: string;
    label: string;
    displayReference: string;
  };
  book: {
    code: string;
    name: string;
    testament?: string;
  } | null;
  verses: Array<{
    verse: number;
    text: string;
  }>;
  background: {
    bookName: string;
    author?: string;
    date?: string;
    place?: string;
    audience?: string;
    storyContext: string;
    canonicalContext?: string;
  };
  fullReaderHref: string;
  crossrefsHref: string;
};


type PassagePanelContextNote = {
  title?: string;
  body: string;
  meta?: string;
};

type PassagePanelRequest = {
  locale: AppLocale;
  reference: BibleReferenceLike;
  href: string;
  context: PassagePanelContextNote | null;
};

type PassagePanelContextValue = {
  openPanel: (request: PassagePanelRequest) => void;
  closePanel: () => void;
};

const PassagePanelContext = createContext<PassagePanelContextValue | null>(null);
const panelCache = new Map<string, PassagePanelData>();

const COPY = {
  ko: {
    title: "연결 본문",
    body: "현재 화면을 벗어나지 않고 우측 패널에서 관련 성구를 바로 확인합니다.",
    loading: "본문을 불러오는 중입니다…",
    failed: "본문을 불러오지 못했습니다.",
    retry: "다시 시도",
    openReader: "성경 리더에서 열기",
    openCrossrefs: "연관 성구 보기",
    relationTitle: "왜 지금 이 본문을 보나",
    backgroundTitle: "배경과 역사",
    storyContextLabel: "본문 문맥",
    canonicalContextLabel: "정경과 적용",
    authorLabel: "저자",
    dateLabel: "시기",
    placeLabel: "장소",
    audienceLabel: "청중",
    close: "닫기",
  },
  en: {
    title: "Linked passage",
    body: "Read the related passage in a side panel without leaving the current surface.",
    loading: "Loading passage…",
    failed: "Could not load this passage.",
    retry: "Retry",
    openReader: "Open in Bible reader",
    openCrossrefs: "View cross references",
    relationTitle: "Why this passage matters here",
    backgroundTitle: "Background and history",
    storyContextLabel: "Story context",
    canonicalContextLabel: "Canonical reading",
    authorLabel: "Author",
    dateLabel: "Date",
    placeLabel: "Place",
    audienceLabel: "Audience",
    close: "Close",
  },
} as const;


function normalizeLocale(locale?: string): AppLocale {
  return locale === "en" ? "en" : "ko";
}

function backgroundFacts(data: PassagePanelData, copy: (typeof COPY)[AppLocale]): Array<{ label: string; value: string }> {
  return [
    { label: copy.authorLabel, value: data.background.author },
    { label: copy.dateLabel, value: data.background.date },
    { label: copy.placeLabel, value: data.background.place },
    { label: copy.audienceLabel, value: data.background.audience },
  ].flatMap((item) => (item.value?.trim() ? [{ label: item.label, value: item.value.trim() }] : []));
}


function cacheKey(locale: AppLocale, reference: BibleReferenceLike) {
  return `${locale}:${reference.code}-${reference.chapter}-${reference.startVerse}-${reference.endVerse}`;
}

function shouldOpenInPanel(event: MouseEvent<HTMLAnchorElement>) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }

  if (typeof window === "undefined" || !window.matchMedia("(min-width: 1024px)").matches) {
    return false;
  }

  const target = event.currentTarget.target;
  return !target || target === "_self";
}

function usePassagePanel() {
  const value = useContext(PassagePanelContext);
  if (!value) {
    throw new Error("PassagePanelLink must be used inside PassagePanelProvider.");
  }
  return value;
}

function PassagePanelNavigationSync({ closePanel }: { closePanel: () => void }) {
  const pathname = usePathname();

  useEffect(() => {
    closePanel();
  }, [pathname, closePanel]);

  return null;
}

export function PassagePanelProvider({ locale, children }: PropsWithChildren<{ locale: string }>) {
  const appLocale = normalizeLocale(locale);
  const copy = COPY[appLocale];
  const [request, setRequest] = useState<PassagePanelRequest | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [data, setData] = useState<PassagePanelData | null>(null);
  const latestRequestKey = useRef<string | null>(null);

  const closePanel = useCallback(() => {
    setRequest(null);
    setStatus("idle");
    setData(null);
    latestRequestKey.current = null;
  }, []);

  const openPanel = useCallback((next: PassagePanelRequest) => {
    setRequest(next);
    latestRequestKey.current = cacheKey(next.locale, next.reference);
  }, []);


  useEffect(() => {
    if (!request) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
      }
    };

    window.addEventListener("keydown", handleEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [request, closePanel]);

  const loadPanelData = useCallback(async () => {
    if (!request) {
      return;
    }

    const key = cacheKey(request.locale, request.reference);
    const cached = panelCache.get(key);
    if (latestRequestKey.current !== key) {
      return;
    }
    if (cached) {
      setData(cached);
      setStatus("ready");
      return;
    }

    setStatus("loading");
    setData(null);

    const response = await fetch(buildPassageApiHref(request.reference, request.locale), {
      credentials: "same-origin",
      cache: "force-cache",
    });
    if (!response.ok) {
      throw new Error(`Passage panel fetch failed: ${response.status}`);
    }

    const next = (await response.json()) as PassagePanelData;
    if (latestRequestKey.current !== key) {
      return;
    }
    panelCache.set(key, next);
    setData(next);
    setStatus("ready");
  }, [request]);

  useEffect(() => {
    if (!request) {
      return;
    }

    let cancelled = false;
    loadPanelData()
      .then(() => {
        if (cancelled) {
          return;
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [request, loadPanelData]);

  const value = useMemo<PassagePanelContextValue>(
    () => ({
      openPanel,
      closePanel,
    }),
    [openPanel, closePanel],
  );

  return (
    <PassagePanelContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        <PassagePanelNavigationSync closePanel={closePanel} />
      </Suspense>
      {request ? (
        <div className="fixed inset-0 z-50 hidden lg:block" aria-live="polite">
          <button
            type="button"
            aria-label={copy.close}
            onClick={closePanel}
            className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-[var(--hairline)] bg-[var(--canvas)] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--hairline)] px-6 py-5">
              <div>
                <div className="section-title text-sm">{copy.title}</div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{copy.body}</p>
              </div>
              <button
                type="button"
                onClick={closePanel}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--hairline)] text-[var(--ink)] transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)]"
                aria-label={copy.close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {status === "loading" ? (
                <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-2)] p-5 text-sm text-[var(--muted)]">
                  {copy.loading}
                </div>
              ) : null}

              {status === "error" ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-100">
                  <p>{copy.failed}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        void loadPanelData().catch(() => setStatus("error"));
                      }}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-rose-400/30 px-4 py-2 font-semibold text-rose-50 transition hover:bg-rose-400/10"
                    >
                      {copy.retry}
                    </button>
                    <Link
                      href={request.href}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-rose-400/30 px-4 py-2 font-semibold text-rose-50 transition hover:bg-rose-400/10"
                    >
                      {copy.openReader}
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              ) : null}

              {status === "ready" && data ? (
                <div className="space-y-6">
                  <section className="glass rounded-2xl p-5 sm:p-6">
                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
                      {data.reference.displayReference}
                    </div>
                    <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--ink)]">
                      {data.book?.name ?? data.reference.label}
                    </h2>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href={data.fullReaderHref}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[var(--gold)] px-5 py-3 text-sm font-semibold text-[var(--canvas)] transition hover:bg-[var(--gold-hover)]"
                      >
                        {copy.openReader}
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      <Link
                        href={data.crossrefsHref}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--hairline-strong)] px-5 py-3 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--gold)]/30 hover:text-[var(--gold)]"
                      >
                        {copy.openCrossrefs}
                        <Network className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </section>

                  {request.context?.body ? (
                    <section className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-2)] p-5 sm:p-6">
                      <div className="text-sm font-semibold text-[var(--ink)]">
                        {request.context.title?.trim() || copy.relationTitle}
                      </div>
                      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{request.context.body}</p>
                      {request.context.meta?.trim() ? (
                        <div className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--gold)]">{request.context.meta}</div>
                      ) : null}
                    </section>
                  ) : null}
                  <section className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-2)] p-5 sm:p-6">
                    <div className="text-sm font-semibold text-[var(--ink)]">{copy.backgroundTitle}</div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {backgroundFacts(data, copy).map((fact) => (
                        <div
                          key={`${data.reference.slug}-${fact.label}`}
                          className="rounded-full border border-[var(--hairline)] bg-[var(--canvas)] px-3 py-1.5 text-xs text-[var(--muted)]"
                        >
                          <span className="font-semibold text-[var(--ink)]">{fact.label}:</span>
                          <span className="ml-2">{fact.value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 space-y-5 text-sm leading-7 text-[var(--muted)]">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)]">
                          {copy.storyContextLabel}
                        </div>
                        <p className="mt-2">{data.background.storyContext}</p>
                      </div>
                      {data.background.canonicalContext?.trim() ? (
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)]">
                            {copy.canonicalContextLabel}
                          </div>
                          <p className="mt-2">{data.background.canonicalContext}</p>
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-[var(--gold)]/20 bg-[var(--gold)]/[0.07] p-5 sm:p-6">
                    <div className="verse-container space-y-4 text-[var(--text)]">
                      {data.verses.map((verse) => (
                        <p key={`${data.reference.slug}-${verse.verse}`} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
                          <span className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-lg bg-[var(--gold)]/[0.12] text-base font-bold text-[var(--gold)]">
                            {verse.verse}
                          </span>
                          <span className="pt-2 text-base leading-8 text-[var(--ink)]">{verse.text}</span>
                        </p>
                      ))}
                    </div>
                  </section>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </PassagePanelContext.Provider>
  );
}

export function PassagePanelLink({
  href,
  reference,
  locale,
  contextTitle,
  contextBody,
  contextMeta,
  onClick,
  children,
  className,
  ariaLabel,
  title,
}: PropsWithChildren<{
  href: string;
  reference: BibleReferenceLike;
  locale: string;
  contextTitle?: string;
  contextBody?: string;
  contextMeta?: string;
  className?: string;
  ariaLabel?: string;
  title?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}>) {
  const { openPanel } = usePassagePanel();
  const appLocale = normalizeLocale(locale);

  return (
    <Link
      href={href}
      className={className}
      aria-label={ariaLabel}
      title={title}
      onClick={(event) => {
        onClick?.(event);
        if (!shouldOpenInPanel(event)) {
          return;
        }

        event.preventDefault();
        openPanel({
          href,
          reference,
          locale: appLocale,
          context: contextBody?.trim()
            ? {
                title: contextTitle?.trim() || undefined,
                body: contextBody.trim(),
                meta: contextMeta?.trim() || undefined,
              }
            : null,
        });
      }}
    >
      {children}
    </Link>
  );
}
