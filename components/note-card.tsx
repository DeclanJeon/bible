import type { ContextNote } from "@/lib/app-data";
import { SourceList } from "@/components/source-list";
import { localizeConfidenceLabel } from "@/lib/content";

const CONFIDENCE_STYLES: Record<ContextNote["confidence"], string> = {
  high: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  medium: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  disputed: "border-rose-400/30 bg-rose-400/10 text-rose-100",
};

export function NoteCard({
  note,
  eyebrow,
  locale,
}: {
  note: ContextNote;
  eyebrow?: string;
  locale?: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/6 bg-white/[0.03] p-4">
      {eyebrow ? <div className="section-title">{eyebrow}</div> : null}
      <div className="mt-2 flex items-center justify-between gap-4">
        <div className="text-sm font-semibold text-white">{note.title}</div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${CONFIDENCE_STYLES[note.confidence]}`}>
          {localizeConfidenceLabel(note.confidence, locale)}
        </span>
      </div>
      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{note.body}</p>
      <div className="mt-4">
        <SourceList sources={note.sources} locale={locale} />
      </div>
    </div>
  );
}
