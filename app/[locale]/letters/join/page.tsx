import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Sparkles } from "lucide-react";

import { buildPageMetadata } from "@/lib/page-metadata";
import { resolveLocale } from "@/lib/server-locale";
import { auth } from "@/auth";
import { getLetterParticipantSession } from "@/lib/letters";
import { GoogleSignInButton, SignOutButton } from "@/components/auth-buttons";
import { LetterRelayJoinForm } from "@/components/letter-forms";
import { TrustNotice } from "@/components/letter-card-visual";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  return buildPageMetadata(
    locale,
    locale === "ko" ? "빛의 릴레이 참여" : "Join the Light Relay",
    locale === "ko" ? "Google 로그인으로 빛의 릴레이에 참여합니다." : "Join the Light Relay with Google sign-in.",
    "/letters/join",
  );
}

export default async function LetterJoinPage({ params }: Props) {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  const session = await auth();
  const participant = await getLetterParticipantSession((await cookies()).get("letters_participant_session")?.value ?? null);

  return (
    <main className="page-shell pb-28">
      <Link href={`/${locale}/letters`} className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]">
        <ArrowLeft className="h-4 w-4" />
        {locale === "ko" ? "빛의 릴레이" : "Light Relay"}
      </Link>
      <section className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="glass rounded-[32px] p-6 sm:p-8 lg:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--gold-border)] bg-[var(--gold-soft)] px-4 py-2 text-sm font-semibold text-[var(--gold)]">
            <ShieldCheck className="h-4 w-4" />
            {locale === "ko" ? "빛의 릴레이 참여" : "Join the Light Relay"}
          </div>
          <h1 className="mt-5 text-3xl font-bold leading-tight text-[var(--ink)] sm:text-4xl">
            {session?.user
              ? (locale === "ko" ? `${session.user.name ?? session.user.email}님, 환영합니다.` : `Welcome, ${session.user.name ?? session.user.email}.`)
              : (locale === "ko" ? "Google로 시작하고 빛의 릴레이에 참여하세요." : "Start with Google and join the Light Relay.")}
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--ink-muted)]">
            {locale === "ko"
              ? "Google 계정으로 로그인하면 익명 고민을 보내고, 빛 전달자가 되어 다른 사람의 고민에 답변할 수 있습니다. 이메일은 상대에게 공개되지 않습니다."
              : "Sign in with Google to send anonymous concerns and become a light bearer who answers others' concerns. Emails are never shown to other participants."}
          </p>
          <div className="mt-7">
            {session?.user ? (
              <LetterRelayJoinForm locale={locale} participant={participant} userEmail={session.user.email ?? ""} />
            ) : (
              <div className="space-y-5">
                <GoogleSignInButton locale={locale} />
                <p className="text-xs text-[var(--ink-muted)]">
                  {locale === "ko"
                    ? "로그인하면 자동으로 빛의 릴레이 참여자로 등록됩니다. 수신 여부는 설정에서 변경할 수 있습니다."
                    : "Signing in automatically registers you as a Light Relay participant. You can change receiving settings later."}
                </p>
              </div>
            )}
          </div>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <TrustNotice locale={locale} />
          <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-5 text-sm leading-7 text-[var(--ink-muted)]">
            <div className="flex items-center gap-2 font-bold text-[var(--ink)]">
              <Sparkles className="h-4 w-4 text-[var(--gold)]" />
              {locale === "ko" ? "참여 방식" : "How it works"}
            </div>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>{locale === "ko" ? "Google 계정으로 로그인합니다." : "Sign in with your Google account."}</li>
              <li>{locale === "ko" ? "익명으로 고민을 작성하고 보냅니다." : "Write and send a concern anonymously."}</li>
              <li>{locale === "ko" ? "빛 전달자가 성구를 골라 답변합니다." : "A light bearer picks Scripture and answers."}</li>
              <li>{locale === "ko" ? "(선택) 다음 빛 전달자가 됩니다." : "(Optional) Become the next light bearer."}</li>
            </ol>
          </div>
          {session?.user ? (
            <div className="flex flex-col gap-3">
              <Link href={`/${locale}/letters/write`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--gold-hover)]">
                {locale === "ko" ? "고민 보내기" : "Send a concern"}
              </Link>
              <SignOutButton locale={locale} />
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
