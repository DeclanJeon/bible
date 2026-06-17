import type { SourceLink } from "@/lib/app-data";
import { localizeSourceKind, localizeSourceLinks } from "@/lib/content";

type SourceKind = "local" | "repository" | "reference" | "external" | "source";

type Props = {
  sources: SourceLink[];
  compact?: boolean;
  locale?: string;
};

function describeSource(url: string): { kind: SourceKind; host: string } {
  if (url.startsWith("/")) {
    return { kind: "local", host: url.replace(/^\//, "") };
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const kind: SourceKind = host.includes("github.com")
      ? "repository"
      : host.includes("stepbible") || host.includes("openbible") || host.includes("crossreferences") || host.includes("sefaria")
        ? "reference"
        : "external";
    return { kind, host };
  } catch {
    return { kind: "source", host: url };
  }
}

export function SourceList({ sources, compact = false, locale }: Props) {
  const localizedSources = localizeSourceLinks(sources, locale);

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {localizedSources.map((source) => (
          <a
            key={`${source.label}-${source.url}`}
            href={source.url}
            target={source.url.startsWith("http") ? "_blank" : undefined}
            rel={source.url.startsWith("http") ? "noreferrer" : undefined}
            className="chip text-xs text-[var(--ink)] hover:border-[var(--gold)]/30 hover:text-[var(--gold)]"
          >
            {source.label}
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {localizedSources.map((source) => {
        const meta = describeSource(source.url);
        return (
          <a
            key={`${source.label}-${source.url}`}
            href={source.url}
            target={source.url.startsWith("http") ? "_blank" : undefined}
            rel={source.url.startsWith("http") ? "noreferrer" : undefined}
            className="block rounded-xl border border-[var(--hairline)] bg-black/15 p-4 transition hover:border-[var(--gold)]/25 hover:bg-black/20"
          >
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold text-[var(--ink)]">{source.label}</div>
              <span className="rounded-full border border-[var(--hairline)] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-[var(--gold)]">
                {localizeSourceKind(meta.kind, locale)}
              </span>
            </div>
            <div className="mt-2 text-sm text-[var(--muted)]">{meta.host}</div>
          </a>
        );
      })}
    </div>
  );
}
