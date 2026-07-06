import Link from "next/link";
import Image from "next/image";
import { BookOpenText, Flag, ImageDown, Share2 } from "lucide-react";

import type { AppLocale } from "@/lib/content";
import type { LetterCard, PublicLetterBundle } from "@/lib/letters";

export function TrustNotice({ locale }: { locale: AppLocale }) {
  return (
    <div className="rounded-2xl border border-[var(--gold-border)] bg-[var(--gold-soft)] px-4 py-3 text-sm leading-6 text-[var(--ink)]">
      {locale === "ko"
        ? "이메일은 서로에게 보이지 않습니다. 모든 편지와 답장은 시스템을 통해서만 전달됩니다."
        : "Emails are never shown to each other. Letters and replies are relayed only through the system."}
    </div>
  );
}

export function LetterStatusBadge({ status, locale }: { status: string; locale: AppLocale }) {
  const labels: Record<string, string> = locale === "ko"
    ? { created: "작성됨", matched: "전달 준비", sent: "전달 완료", answered: "답변 도착", blocked: "안전 보류" }
    : { created: "Created", matched: "Queued", sent: "Delivered", answered: "Reply arrived", blocked: "Safety hold" };
  const tone = status === "answered" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : status === "blocked" ? "border-red-500/30 bg-red-500/10 text-red-700" : "border-[var(--gold-border)] bg-[var(--gold-soft)] text-[var(--gold)]";
  return <span className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold ${tone}`}>{labels[status] ?? status}</span>;
}

export function LetterCardVisual({ card, locale }: { card: LetterCard; locale: AppLocale }) {
  return (
    <article className="overflow-hidden rounded-[32px] border border-[var(--hairline)] bg-[var(--surface-1)] shadow-sm">
      {card.imageUrl ? (
        <Image src={card.imageUrl} alt={`${card.title} ${card.scripture.reference}`} width={1024} height={1024} unoptimized className="aspect-square w-full object-cover" />
      ) : (
        <div className="aspect-square bg-[radial-gradient(circle_at_25%_10%,rgba(221,157,74,0.20),transparent_32%),linear-gradient(145deg,#fffaf0,#efe3ce)] p-6 text-[var(--ink)] sm:p-8">
          <div className="flex h-full flex-col justify-between rounded-[24px] border border-[rgba(120,74,20,0.18)] bg-white/60 p-5 shadow-inner sm:p-7">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">Bible Hyperlink Companion</p>
              <h2 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">{card.title}</h2>
            </div>
            <blockquote className="my-6 text-xl font-semibold leading-9 sm:text-2xl sm:leading-10">
              “{card.scripture.text}”
            </blockquote>
            <div>
              <div className="h-px w-16 bg-[var(--gold)]/40" />
              <p className="mt-3 text-sm font-semibold text-[var(--gold-deep)]">{card.scripture.reference}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{card.visualTheme.coreMessage}</p>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-3 p-5">
        <p className="text-sm leading-6 text-[var(--ink-muted)]">{card.summary}</p>
        <p className="text-xs text-[var(--ink-subtle)]">
          {locale === "ko" ? "이미지 생성 상태" : "Image status"}: {card.generationStatus}
        </p>
      </div>
    </article>
  );
}

export function LetterActionPanel({ bundle, card, locale }: { bundle: PublicLetterBundle; card: LetterCard; locale: AppLocale }) {
  const href = card.shareUrl || `/${locale}/letters/card/${bundle.letter.id}`;
  return (
    <aside className="glass h-fit rounded-[28px] p-5 lg:sticky lg:top-24">
      <div className="flex flex-wrap items-center gap-2">
        <LetterStatusBadge status={bundle.letter.status} locale={locale} />
        <span className="rounded-full border border-[var(--hairline)] px-3 py-1 text-xs text-[var(--ink-muted)]">{card.visibility}</span>
      </div>
      <div className="mt-5 space-y-3">
        {card.scripture.href ? (
          <Link href={card.scripture.href} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--gold-hover)]">
            <BookOpenText className="h-4 w-4" />
            {locale === "ko" ? "말씀 전체 읽기" : "Read passage"}
          </Link>
        ) : null}
        {card.imageUrl ? (
          <a href={card.imageUrl} download className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--hairline)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--gold-border)]">
            <ImageDown className="h-4 w-4" />
            {locale === "ko" ? "이미지로 저장" : "Save image"}
          </a>
        ) : null}
        <Link href={href.replace(/^https?:\/\/[^/]+/, "")} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--hairline)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--gold-border)]">
          <Share2 className="h-4 w-4" />
          {locale === "ko" ? "공유 카드 열기" : "Open share card"}
        </Link>
        <form action={`/${locale}/api/letters/report`} method="post">
          <input type="hidden" name="targetType" value={card.kind === "answer" ? "answer" : "letter"} />
          <input type="hidden" name="targetId" value={card.kind === "answer" ? card.answerId ?? card.letterId : card.letterId} />
          <input type="hidden" name="reason" value="ui-report" />
          <button className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-500/10" type="submit">
            <Flag className="h-4 w-4" />
            {locale === "ko" ? "신고" : "Report"}
          </button>
        </form>
      </div>
    </aside>
  );
}
