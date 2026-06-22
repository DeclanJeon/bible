"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

type Book = {
  code: string;
  name: string;
  testament: string;
};

function buildBibleHref(code: string, locale: string) {
  return `/${locale}/bible?book=${code}&chapter=1`;
}

export function BibleBookSearch({
  books,
  selectedCode,
  locale,
  copy,
}: {
  books: Book[];
  selectedCode: string;
  locale: "ko" | "en";
  copy: {
    old: string;
    new: string;
    searchPlaceholder: string;
    books: string;
  };
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return books;
    const q = query.trim().toLowerCase();
    return books.filter(
      (book) =>
        book.name.toLowerCase().includes(q) ||
        book.code.toLowerCase().includes(q),
    );
  }, [books, query]);

  const grouped = useMemo(() => {
    const groups: Record<"old" | "new", Book[]> = { old: [], new: [] };
    for (const book of filtered) {
      const key = locale === "ko"
        ? book.testament.includes("신약") ? "new" : "old"
        : book.testament.toLowerCase().includes("new") ? "new" : "old";
      groups[key].push(book);
    }
    return groups;
  }, [filtered, locale]);

  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.searchPlaceholder}
          className="w-full rounded-input border border-[var(--input-border)] bg-[var(--input-bg)] py-2.5 pl-9 pr-3 text-sm text-ink outline-none transition focus:border-[var(--input-focus-border)] placeholder:text-[var(--input-placeholder)]"
        />
      </div>
      <div className="space-y-5">
        {(["old", "new"] as const).map((group) => {
          if (!grouped[group].length) return null;
          return (
            <div key={group}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-gold">{copy[group]}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {grouped[group].map((book) => {
                  const selected = book.code === selectedCode;
                  return (
                    <Link
                      key={book.code}
                      href={buildBibleHref(book.code, locale)}
                      className={`min-h-[44px] rounded-input px-3 py-2 text-sm font-medium transition ${
                        selected
                          ? "bg-gold text-[var(--canvas)]"
                          : "border border-[var(--hairline)] bg-surface-2 text-ink hover:border-[var(--hairline-hover)] hover:text-gold"
                      }`}
                    >
                      <span className="block truncate text-xs">{book.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-xs text-ink-subtle">
            {locale === "ko" ? "일치하는 책이 없습니다" : "No matching books"}
          </p>
        ) : null}
      </div>
    </div>
  );
}
