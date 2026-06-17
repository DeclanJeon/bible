import type { BookMetadata } from "@/lib/book-metadata";
import { SourceList } from "@/components/source-list";
import { UI_COPY, localizeConfidenceLabel, resolveAppLocale } from "@/lib/content";

const CONFIDENCE_STYLES: Record<BookMetadata["notes"]["authorship"]["confidence"], string> = {
  high: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  medium: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  disputed: "border-rose-400/30 bg-rose-400/10 text-rose-100",
};

export function BookProfileCard({ metadata, locale }: { metadata: BookMetadata; locale?: string }) {
  const appLocale = resolveAppLocale(locale);

  return (
    <div className="glass rounded-2xl p-6 lg:p-8">
      <div className="section-title">{UI_COPY[appLocale].bookProfile.title}</div>
      <div className="mt-2 text-xl font-semibold tracking-tight text-[var(--ink)]">{metadata.title}</div>
      <div className="mt-1 text-sm text-[var(--gold)]">{metadata.genre}</div>
      <div className="mt-5 space-y-4">
        {Object.values(metadata.notes).map((note) => (
          <div key={note.title} className="soft-glass rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold tracking-tight text-[var(--ink)]">{note.title}</div>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${CONFIDENCE_STYLES[note.confidence]}`}>
                {localizeConfidenceLabel(note.confidence, appLocale)}
              </span>
            </div>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{note.body}</p>
            <div className="mt-3">
              <SourceList sources={note.sources} compact locale={appLocale} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
