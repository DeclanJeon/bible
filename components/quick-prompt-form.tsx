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
      <form action={`/${appLocale}/companion`} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-2 shadow-2xl shadow-black/15 sm:rounded-[28px]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[18px] px-3 py-3 sm:gap-3 sm:rounded-[22px] sm:px-4">
            <Search className="h-4 w-4 shrink-0 text-[var(--muted)] sm:h-5 sm:w-5" />
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
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[18px] bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 sm:rounded-[22px]"
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
