import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Inbox, ShieldCheck, Users } from "lucide-react";

import { getAdminLetterModerationData } from "@/lib/letters";
import { resolveLocale } from "@/lib/server-locale";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-5">
      <div className="text-3xl font-bold text-[var(--ink)]">{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">{label}</div>
    </div>
  );
}

export default async function AdminLettersPage({ params, searchParams }: Props) {
  const [{ locale: requestedLocale }, { token }] = await Promise.all([params, searchParams]);
  const locale = await resolveLocale(requestedLocale);
  const expectedToken = process.env.ADMIN_DEBUG_TOKEN;
  if (!expectedToken || token !== expectedToken) {
    notFound();
  }
  const data = await getAdminLetterModerationData(80);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8 lg:px-8">
      <section className="glass rounded-2xl p-6 lg:p-8">
        <div className="section-title">Admin letters moderation</div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--ink)]">말씀편지 운영 대시보드</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          Hidden admin page for moderation triage. It shows letter content excerpts, report reasons, masked participants, and delivery state without raw email, raw token, token hash, or image generation internals.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Stat label="letters" value={data.totals.letters} />
          <Stat label="sent" value={data.totals.sent} />
          <Stat label="blocked" value={data.totals.blocked} />
          <Stat label="answers" value={data.totals.answers} />
          <Stat label="reports" value={data.totals.reports} />
          <Stat label="active pool" value={data.totals.activeParticipants} />
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 text-xl font-semibold tracking-tight text-[var(--ink)]"><Inbox className="h-5 w-5 text-[var(--gold)]" />Recent letters</div>
          <div className="mt-5 space-y-4">
            {data.letters.map((letter) => (
              <article key={letter.id} className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4">
                <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--gold)]">
                  <span>{letter.locale}</span><span>{letter.category}</span><span>{letter.status}</span><span>{letter.shareVisibility}</span><span>{letter.cardStatus ?? "no-card"}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--ink)]">{letter.body}</p>
                <div className="mt-3 text-sm font-semibold text-[var(--ink-muted)]">{letter.scriptureReference}</div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--ink-muted)]">
                  <span>{letter.id}</span>
                  <time dateTime={letter.createdAt}>{new Date(letter.createdAt).toLocaleString()}</time>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 text-xl font-semibold tracking-tight text-[var(--ink)]"><AlertTriangle className="h-5 w-5 text-[var(--gold)]" />Reports</div>
            {data.reports.length ? (
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--ink)]">
                {data.reports.map((report) => (
                  <li key={report.id} className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)] p-3">
                    <div className="font-semibold">{report.targetType} · {report.targetId}</div>
                    <p className="mt-1 text-[var(--ink-muted)]">{report.reason}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 text-sm text-[var(--ink-muted)]">No reports.</p>}
          </section>

          <section className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 text-xl font-semibold tracking-tight text-[var(--ink)]"><Users className="h-5 w-5 text-[var(--gold)]" />Participants</div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--ink)]">
              {data.participants.map((participant) => (
                <li key={participant.participantId} className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)] p-3">
                  <div className="font-semibold">{participant.maskedEmail}</div>
                  <div className="text-[var(--ink-muted)]">{participant.status} · receive {participant.canReceiveLetters ? "on" : "off"} · {participant.preferredLocale} · {participant.selectionWindowCount}/{participant.selectionLimitPerDay}</div>
                </li>
              ))}
            </ul>
          </section>

          <section className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 text-xl font-semibold tracking-tight text-[var(--ink)]"><ShieldCheck className="h-5 w-5 text-[var(--gold)]" />Deliveries</div>
            <ul className="mt-4 space-y-3 text-xs leading-5 text-[var(--ink)]">
              {data.deliveries.map((delivery) => (
                <li key={delivery.id} className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)] p-3">
                  <div className="font-semibold">{delivery.status} · {delivery.maskedRecipientEmail}</div>
                  <div className="text-[var(--ink-muted)]">{delivery.letterId}</div>
                </li>
              ))}
            </ul>
          </section>

          <Link href={`/${locale}/admin/retrieval-debug?token=${encodeURIComponent(expectedToken)}`} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--hairline)] px-4 py-2 text-sm font-bold text-[var(--ink)]">
            Retrieval debug
          </Link>
        </aside>
      </div>
    </main>
  );
}
