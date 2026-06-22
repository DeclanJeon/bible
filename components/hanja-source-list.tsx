"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";

type Source = {
  id: string;
  title: string;
  url: string;
  kind: string;
  language: string;
  publisher?: string | null;
  section: string;
  subsection?: string | null;
  notes?: string | null;
};

export function HanjaSourceList({
  title,
  body,
  sources,
  tone,
  locale,
  copy,
  initialCount = 6,
}: {
  title: string;
  body: string;
  sources: Source[];
  tone: "supportive" | "critical";
  locale: "ko" | "en";
  copy: { openOriginal: string };
  initialCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!sources.length) return null;

  const visible = expanded ? sources : sources.slice(0, initialCount);
  const hasMore = sources.length > initialCount;

  const toneStyles = tone === "supportive"
    ? { badge: "bg-emerald-500/10 text-emerald-300", border: "border-emerald-500/10" }
    : { badge: "bg-rose-500/10 text-rose-300", border: "border-rose-500/10" };

  return (
    <section>
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        <span className={`rounded-pill px-2.5 py-0.5 text-xs font-semibold ${toneStyles.badge}`}>{sources.length}</span>
      </div>
      <p className="mt-1.5 text-sm text-ink-muted">{body}</p>

      <div className="mt-5 space-y-2.5">
        {visible.map((source) => (
          <article
            key={source.id}
            className="group flex items-start gap-4 rounded-card border border-[var(--hairline)] bg-surface-1 px-5 py-4 transition hover:border-[var(--hairline-hover)]"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink">{source.title}</div>
              <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-ink-subtle">
                <span className="rounded-pill bg-surface-2 px-2 py-0.5">{source.kind}</span>
                <span className="rounded-pill bg-surface-2 px-2 py-0.5">{source.language}</span>
                {source.publisher ? <span className="rounded-pill bg-surface-2 px-2 py-0.5">{source.publisher}</span> : null}
              </div>
              {source.notes ? (
                <p className="mt-2 text-xs leading-relaxed text-ink-subtle">{source.notes}</p>
              ) : null}
            </div>
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-input border border-[var(--hairline)] px-3 py-2 text-xs font-semibold text-ink transition hover:border-[var(--hairline-hover)] hover:text-gold"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {copy.openOriginal}
            </a>
          </article>
        ))}
      </div>

      {hasMore && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-4 text-sm font-semibold text-gold transition hover:text-gold-hover"
        >
          {locale === "ko" ? `${sources.length - initialCount}개 더 보기` : `Show ${sources.length - initialCount} more`}
        </button>
      ) : null}
    </section>
  );
}
