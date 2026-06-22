"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

type Entry = {
  slug: string;
  character: string;
  reading: string;
  title: string;
  thesis: string;
  explanation: string;
  mainPassages: Array<{ code: string; chapter: number; startVerse: number; endVerse: number }>;
  sourceCount: number;
};

export function HanjaCatalogSearch({
  entries,
  buildHref,
  copy,
  initialCount = 48,
}: {
  entries: Entry[];
  buildHref: (slug: string) => string;
  copy: {
    searchPlaceholder: string;
    all: string;
    bySources: string;
    readInBible: string;
    noResults: string;
    showMore: string;
    sources: string;
  };
  initialCount?: number;
}) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"default" | "sources">("default");
  const [visibleCount, setVisibleCount] = useState(initialCount);

  const filtered = useMemo(() => {
    let result = entries;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = entries.filter(
        (entry) =>
          entry.character.includes(q) ||
          entry.reading.toLowerCase().includes(q) ||
          entry.title.toLowerCase().includes(q) ||
          entry.thesis.toLowerCase().includes(q) ||
          entry.explanation.toLowerCase().includes(q),
      );
    }
    if (sortBy === "sources") {
      result = [...result].sort((a, b) => b.sourceCount - a.sourceCount);
    }
    return result;
  }, [entries, query, sortBy]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setVisibleCount(initialCount); }}
            placeholder={copy.searchPlaceholder}
            className="w-full rounded-input border border-[var(--input-border)] bg-[var(--input-bg)] py-2.5 pl-9 pr-3 text-sm text-ink outline-none transition focus:border-[var(--input-focus-border)] placeholder:text-[var(--input-placeholder)]"
          />
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setSortBy("default")}
            className={`rounded-pill px-3.5 py-2 text-xs font-semibold transition ${
              sortBy === "default" ? "bg-gold text-[var(--canvas)]" : "border border-[var(--hairline)] bg-surface-2 text-ink-muted hover:text-ink"
            }`}
          >
            {copy.all}
          </button>
          <button
            type="button"
            onClick={() => setSortBy("sources")}
            className={`rounded-pill px-3.5 py-2 text-xs font-semibold transition ${
              sortBy === "sources" ? "bg-gold text-[var(--canvas)]" : "border border-[var(--hairline)] bg-surface-2 text-ink-muted hover:text-ink"
            }`}
          >
            {copy.bySources}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((entry) => (
          <Link
            key={entry.slug}
            href={buildHref(entry.slug)}
            className="group rounded-card border border-[var(--hairline)] bg-surface-1 p-4 transition hover:border-[var(--hairline-hover)]"
          >
            <div className="flex items-start justify-between">
              <div className="text-2xl font-bold text-ink">{entry.character}</div>
              <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-subtle">
                {entry.sourceCount} {copy.sources}
              </span>
            </div>
            <div className="mt-1.5 text-xs text-ink-subtle">{entry.reading}</div>
            <div className="mt-2.5 text-sm font-semibold leading-snug text-ink">{entry.title}</div>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-muted line-clamp-2">{entry.thesis || entry.explanation}</p>
            {entry.mainPassages.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {entry.mainPassages.slice(0, 2).map((ref) => (
                  <span
                    key={`${ref.code}-${ref.chapter}-${ref.startVerse}`}
                    className="rounded-pill bg-gold-soft px-2 py-0.5 text-[11px] font-medium text-gold"
                  >
                    {ref.code} {ref.chapter}:{ref.startVerse}
                  </span>
                ))}
              </div>
            ) : null}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-10 text-center text-sm text-ink-subtle">{copy.noResults}</p>
      ) : null}

      {hasMore ? (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + initialCount)}
            className="rounded-input border border-[var(--hairline)] bg-surface-2 px-6 py-2.5 text-sm font-semibold text-ink transition hover:border-[var(--hairline-hover)] hover:text-gold"
          >
            {copy.showMore} ({filtered.length - visibleCount})
          </button>
        </div>
      ) : null}
    </div>
  );
}
