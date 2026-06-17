import { ArrowRight, Search } from "lucide-react";
import { UI_COPY, resolveAppLocale } from "@/lib/content";

export function QuickPromptForm({
  defaultValue,
  locale,
  suggestions,
}: {
  defaultValue?: string;
  locale?: string;
  suggestions?: Array<{ label: string; prompt: string }>;
}) {
  const appLocale = resolveAppLocale(locale);
  const copy = UI_COPY[appLocale].prompt;

  return (
    <div>
      <form action={`/${appLocale}/companion`} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-2 shadow-2xl shadow-black/15">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-[22px] px-4 py-3">
            <Search className="h-5 w-5 shrink-0 text-[var(--muted)]" />
            <input
              type="text"
              name="prompt"
              defaultValue={defaultValue}
              className="min-w-0 flex-1 border-0 bg-transparent text-base text-white outline-none placeholder:text-[var(--muted)]"
              placeholder={copy.placeholder}
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-[22px] bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
          >
            {copy.submit}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
      {suggestions?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <a
              key={suggestion.label}
              href={`/${appLocale}/companion?prompt=${encodeURIComponent(suggestion.prompt)}`}
              className="chip text-sm text-white hover:border-[var(--gold)]/30 hover:text-[var(--gold)]"
            >
              {suggestion.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
