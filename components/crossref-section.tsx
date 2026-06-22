"use client";
import Link from "next/link";
import type { CrossReferenceSuggestion } from "@/lib/knowledge";
import { PassageCard } from "@/components/passage-card";
import { Collapsible } from "@/components/collapsible";
import { UI_COPY, localizeCrossReferenceSupportSummary, resolveAppLocale } from "@/lib/content";
import { buildBibleReferenceHref } from "@/lib/navigation";
import { memo } from "react";

export const CrossReferenceSection = memo(function CrossReferenceSection({
  suggestions,
  locale,
}: {
  suggestions: CrossReferenceSuggestion[];
  locale?: string;
}) {
  if (!suggestions.length) {
    return null;
  }

  const appLocale = resolveAppLocale(locale);
  const copy = UI_COPY[appLocale].crossrefs;
  const labelKeys: Array<keyof typeof copy.labels> = ["consensus-link", "vote-supported", "phrase-anchor"];

  return (
    <div className="glass rounded-2xl p-6 lg:p-8">
      <div className="section-title">{copy.title}</div>
      <div className="mt-2 text-sm text-[var(--muted)]">{copy.body}</div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {suggestions.map((suggestion) => (
          <PassageCard
            key={`${suggestion.targetLabel}-${suggestion.supportLine}`}
            title={suggestion.title}
            referenceLabel={suggestion.displayReference}
            excerpt={suggestion.excerpt}
            href={buildBibleReferenceHref(suggestion.target, { locale: appLocale, from: "crossref" })}
            reference={suggestion.target}
            locale={appLocale}
            meta={`${suggestion.supportLabel} · ${suggestion.supportLine}`}
            actionLabel={appLocale === "ko" ? "전체 본문 보기" : "Read full passage"}
          />
        ))}
      </div>
      <Collapsible trigger={<span className="text-sm font-semibold">{copy.howLabelsWork}</span>} className="mt-4">
        <div className="rounded-xl border border-[var(--hairline)] bg-black/15 p-4 text-sm text-[var(--muted)]">
          <div className="space-y-2">
            {labelKeys.map((key) => (
              <p key={key}>
                <span className="text-[var(--ink)]">{copy.labels[key]}</span>: {localizeCrossReferenceSupportSummary(key, appLocale)}
              </p>
            ))}
          </div>
        </div>
      </Collapsible>
      <div className="mt-4 text-sm text-[var(--muted)]">
        {copy.sources}: {" "}
        <Link href="https://www.openbible.info/labs/cross-references/" className="source-link">
          OpenBible Cross References
        </Link>
        {" · "}
        <Link href="https://github.com/CrossReferences-org/bible-cross-references" className="source-link">
          Bible Cross References KJV
        </Link>
      </div>
    </div>
  );
});
