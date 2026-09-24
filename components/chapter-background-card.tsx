import Link from "next/link";
import type { ChapterBackground } from "@/lib/chapter-background";
import { SourceList } from "@/components/source-list";
import { buildBibleReferenceHref } from "@/lib/navigation";

type Props = {
  background: ChapterBackground;
  locale?: string;
};

function parseRef(ref: string): { code: string; chapter: number; verse: number } | null {
  const m = /^([0-9A-Z]{3})\s+(\d+):(\d+)/.exec(ref.trim());
  if (!m) return null;
  return { code: m[1], chapter: Number(m[2]), verse: Number(m[3]) };
}

export function ChapterBackgroundCard({ background, locale }: Props) {
  const isKo = locale === "ko";
  return (
    <section className="glass rounded-2xl p-5 lg:p-6">
      <div className="section-title">{isKo ? "이 장의 배경" : "Chapter background"}</div>
      <div className="mt-3 rounded-xl border border-[var(--gold-border)] bg-[var(--gold-soft)] p-4">
        <div className="text-sm font-semibold text-[var(--ink)]">{isKo ? "장 개요" : "Overview"}</div>
        <p className="mt-2 text-sm leading-7 text-[var(--ink-muted)]">{background.overview}</p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="soft-glass rounded-xl p-4">
          <div className="text-sm font-semibold text-[var(--ink)]">{isKo ? "역사적 배경" : "Historical context"}</div>
          <p className="mt-2 text-sm leading-7 text-[var(--ink-muted)]">{background.historical}</p>
        </div>
        <div className="soft-glass rounded-xl p-4">
          <div className="text-sm font-semibold text-[var(--ink)]">{isKo ? "신학적 주제" : "Theological theme"}</div>
          <p className="mt-2 text-sm leading-7 text-[var(--ink-muted)]">{background.theological}</p>
        </div>
      </div>

      <div className="mt-4 soft-glass rounded-xl p-4">
        <div className="text-sm font-semibold text-[var(--ink)]">{isKo ? "문학적 읽기" : "Literary note"}</div>
        <p className="mt-2 text-sm leading-7 text-[var(--ink-muted)]">{background.literary}</p>
      </div>

      {background.keyVerses.length ? (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-subtle)]">{isKo ? "핵심 구절" : "Key verses"}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {background.keyVerses.map((kv) => {
              const parsed = parseRef(kv.reference);
              const href = parsed ? buildBibleReferenceHref({ code: parsed.code, chapter: parsed.chapter, startVerse: parsed.verse, endVerse: parsed.verse }, { locale }) : undefined;
              const label = kv.reference;
              return href ? (
                <Link key={label} href={href} className="chip text-xs hover:border-[var(--gold)]/30 hover:text-[var(--gold)]">
                  <span className="font-semibold text-[var(--gold)]">{label}</span>
                  <span className="text-[var(--ink-muted)]">{kv.why}</span>
                </Link>
              ) : (
                <span key={label} className="chip text-xs">
                  <span className="font-semibold text-[var(--gold)]">{label}</span>
                  <span className="text-[var(--ink-muted)]">{kv.why}</span>
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      {background.cautions.length ? (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-subtle)]">{isKo ? "주의해서 읽을 점" : "Reading cautions"}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {background.cautions.map((c) => (
              <span key={c} className="chip text-xs">{c}</span>
            ))}
          </div>
        </div>
      ) : null}

      {background.sources.length ? (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-subtle)]">{isKo ? "출처" : "Sources"}</div>
          <div className="mt-2">
            <SourceList sources={background.sources.map((s) => ({ label: s.title, url: s.url ?? `local://${s.id}` }))} compact locale={locale} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
