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
      <form action={`/${appLocale}/companion`} className="rounded-card border border-[var(--input-border)] bg-[var(--input-bg)] p-1.5 sm:p-2">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
          <div className="flex flex-1 items-center gap-2.5 rounded-input px-3.5 py-3 sm:px-4">
            <Search className="h-4 w-4 shrink-0 text-ink-subtle sm:h-5 sm:w-5" />
            <input
              type="text"
              name="prompt"
              defaultValue={defaultValue}
              required
              minLength={2}
              className="w-full min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none placeholder:text-[var(--input-placeholder)]"
              placeholder={copy.placeholder}
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-input bg-gold px-5 py-2.5 text-sm font-semibold text-[var(--canvas)] transition hover:bg-gold-hover"
          >
            {copy.submit}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
      {suggestions?.length ? (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {suggestions.map((suggestion) => (
            <a
              key={suggestion.label}
              href={`/${appLocale}/companion?prompt=${encodeURIComponent(suggestion.prompt)}`}
              className="chip text-sm text-ink hover:border-[var(--hairline-hover)] hover:text-gold"
            >
              {suggestion.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
