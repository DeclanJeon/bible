import Link from "next/link";
import type { BibleReference } from "@/lib/bible";

export function formatReference(reference: BibleReference, label?: string) {
  return `${label ?? reference.code} ${reference.chapter}:${reference.startVerse}-${reference.endVerse}`;
}

export function PassageCard({
  title,
  referenceLabel,
  excerpt,
  href,
  meta,
  actionLabel,
}: {
  title: string;
  referenceLabel: string;
  excerpt: string;
  href?: string;
  meta?: string;
  actionLabel?: string;
}) {
  const shouldShowTitle = !referenceLabel.toLocaleLowerCase().startsWith(title.toLocaleLowerCase());
  const content = (
    <div className="soft-glass rounded-2xl p-5 transition hover:border-[var(--gold)]/30 hover:bg-[var(--surface-2)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          {shouldShowTitle ? <div className="text-sm font-semibold tracking-tight text-[var(--ink)]">{title}</div> : null}
          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--gold)]">{referenceLabel}</div>
        </div>
        {meta ? <div className="text-right text-xs text-[var(--muted)]">{meta}</div> : null}
      </div>
      <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{excerpt}</p>
      {href ? (
        <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--gold)]">
          {actionLabel ?? "Read full passage"}
          <span aria-hidden="true">→</span>
        </div>
      ) : null}
    </div>
  );

  if (!href) {
    return content;
  }

  return <Link href={href}>{content}</Link>;
}
