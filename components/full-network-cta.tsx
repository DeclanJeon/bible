import Link from "next/link";
import { Network } from "lucide-react";
import type { BibleReference } from "@/lib/bible";


export function buildCrossReferenceNetworkHref(reference: BibleReference, locale?: string) {
  const appLocale = locale === "en" ? "en" : "ko";
  return `/${appLocale}/crossrefs/${reference.code}-${reference.chapter}-${reference.startVerse}-${reference.endVerse}`;
}

export function FullNetworkCta({
  reference,
  locale,
  totalEdges,
  className = "",
}: {
  reference: BibleReference;
  locale?: string;
  totalEdges?: number;
  className?: string;
}) {
  const appLocale = locale === "en" ? "en" : "ko";
  const label = appLocale === "ko" ? "전체 관련 성구 네트워크 보기" : "Open full Scripture network";
  const count = typeof totalEdges === "number"
    ? appLocale === "ko"
      ? `전체 직접 연결 ${totalEdges}개`
      : `${totalEdges} direct links available`
    : appLocale === "ko"
      ? "수집된 데이터셋 기준 전체 직접 연결"
      : "All direct links in the ingested datasets";

  return (
    <Link
      href={buildCrossReferenceNetworkHref(reference, appLocale)}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/[0.10] px-4 py-2.5 text-sm font-semibold text-[var(--gold)] transition hover:border-[var(--gold)]/50 hover:bg-[var(--gold)]/[0.16] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/50 ${className}`}
    >
      <Network className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
      <span className="sr-only">: {count}</span>
      <span aria-hidden="true" className="text-[var(--muted)]">→</span>
    </Link>
  );
}
