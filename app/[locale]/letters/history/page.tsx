import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowLeft, Inbox, PenLine, ShieldCheck } from "lucide-react";

import { buildPageMetadata } from "@/lib/page-metadata";
import { resolveLocale } from "@/lib/server-locale";
import { getLetterParticipantHistory, type PublicLetterBundle } from "@/lib/letters";
import { TrustNotice } from "@/components/letter-card-visual";

const SESSION_COOKIE = "letters_participant_session";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  return buildPageMetadata(locale, locale === "ko" ? "내 말씀편지" : "My Scripture letters", "", "/letters/history");
}

function HistoryList({ title, empty, items }: { title: string; empty: string; items: PublicLetterBundle[] }) {
  return (
    <section className="rounded-[28px] border border-[var(--hairline)] bg-[var(--surface-1)] p-6">
      <h2 className="text-xl font-bold text-[var(--ink)]">{title}</h2>
      {items.length ? (
        <div className="mt-5 space-y-4">
          {items.map((item) => (
            <article key={item.letter.id} className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-2)] p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
                <span>{item.letter.category}</span>
                <span>·</span>
                <span>{item.letter.status}</span>
                <span>·</span>
                <time dateTime={item.letter.createdAt}>{new Date(item.letter.createdAt).toLocaleDateString()}</time>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--ink)]">{item.letter.body}</p>
              <p className="mt-3 text-sm font-semibold text-[var(--ink)]">{item.letter.scripture.reference}</p>
              {item.answer ? (
                <div className="mt-4 rounded-xl border border-[var(--gold-border)] bg-[var(--gold-soft)] p-4 text-sm leading-6 text-[var(--ink)]">
                  <div className="font-bold">Reply</div>
                  <p className="mt-2">{item.answer.body}</p>
                  <p className="mt-2 font-semibold">{item.answer.scripture.reference}</p>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">{empty}</p>
      )}
    </section>
  );
}

export default async function LetterHistoryPage({ params }: Props) {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  const history = await getLetterParticipantHistory((await cookies()).get(SESSION_COOKIE)?.value ?? null);

  return (
    <main className="page-shell pb-28">
      <Link href={`/${locale}/letters`} className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]">
        <ArrowLeft className="h-4 w-4" />
        {locale === "ko" ? "위로의 말씀편지" : "Letters"}
      </Link>
      <section className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="glass rounded-[32px] p-6 sm:p-8 lg:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--gold-border)] bg-[var(--gold-soft)] px-4 py-2 text-sm font-semibold text-[var(--gold)]">
            <Inbox className="h-4 w-4" />
            {locale === "ko" ? "내 편지함" : "My letters"}
          </div>
          <h1 className="mt-5 text-3xl font-bold leading-tight text-[var(--ink)] sm:text-4xl">
            {locale === "ko" ? "내가 보낸 편지와 받은 말씀편지를 확인합니다." : "Review letters you wrote and letters you received."}
          </h1>
          {!history ? (
            <div className="mt-7 rounded-[28px] border border-[var(--hairline)] bg-[var(--surface-1)] p-6">
              <h2 className="text-2xl font-bold text-[var(--ink)]">{locale === "ko" ? "인증된 참여자가 아닙니다" : "No verified participant session"}</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{locale === "ko" ? "내 편지함은 이메일 OTP 인증 후 사용할 수 있습니다." : "Verify by email OTP to open your letter history."}</p>
              <Link href={`/${locale}/letters/join`} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--gold)] px-5 py-3 text-sm font-bold text-white">
                {locale === "ko" ? "이메일 인증하기" : "Verify email"}
              </Link>
            </div>
          ) : (
            <div className="mt-7 space-y-6">
              <div className="rounded-[28px] border border-[var(--hairline)] bg-[var(--surface-1)] p-6">
                <p className="text-sm font-semibold text-[var(--gold)]">{history.participant.maskedEmail}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                  {locale === "ko" ? `오늘 수신 ${history.participant.selectionWindowCount}/${history.participant.selectionLimitPerDay}회 · 선호 언어 ${history.participant.preferredLocale.toUpperCase()}` : `Received today ${history.participant.selectionWindowCount}/${history.participant.selectionLimitPerDay} · preferred ${history.participant.preferredLocale.toUpperCase()}`}
                </p>
              </div>
              <HistoryList title={locale === "ko" ? "내가 쓴 편지" : "Letters I wrote"} empty={locale === "ko" ? "아직 작성한 편지가 없습니다." : "No letters written yet."} items={history.authored} />
              <HistoryList title={locale === "ko" ? "내가 받은 편지" : "Letters I received"} empty={locale === "ko" ? "아직 받은 편지가 없습니다." : "No received letters yet."} items={history.received} />
            </div>
          )}
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <TrustNotice locale={locale} />
          <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-5 text-sm leading-7 text-[var(--ink-muted)]">
            <div className="flex items-center gap-2 font-bold text-[var(--ink)]"><ShieldCheck className="h-4 w-4 text-[var(--gold)]" />{locale === "ko" ? "이메일은 숨겨집니다" : "Emails stay hidden"}</div>
            <p className="mt-2">{locale === "ko" ? "편지함은 인증된 세션으로만 열리며 공개 카드에는 이메일과 토큰이 포함되지 않습니다." : "History opens only through the verified session, and public cards never include emails or tokens."}</p>
          </div>
          <Link href={`/${locale}/letters/write`} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-5 py-3 text-sm font-bold text-white">
            <PenLine className="h-4 w-4" />
            {locale === "ko" ? "새 편지 쓰기" : "Write a letter"}
          </Link>
        </aside>
      </section>
    </main>
  );
}
