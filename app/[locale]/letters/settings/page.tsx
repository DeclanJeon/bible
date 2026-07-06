import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowLeft, Settings, ShieldCheck } from "lucide-react";

import { buildPageMetadata } from "@/lib/page-metadata";
import { resolveLocale } from "@/lib/server-locale";
import { getLetterParticipantSession } from "@/lib/letters";
import { LetterSettingsForm } from "@/components/letter-forms";
import { TrustNotice } from "@/components/letter-card-visual";

const SESSION_COOKIE = "letters_participant_session";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  return buildPageMetadata(locale, locale === "ko" ? "빛의 릴레이 설정" : "Light Relay settings", "", "/letters/settings");
}

export default async function LetterSettingsPage({ params }: Props) {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  const participant = await getLetterParticipantSession((await cookies()).get(SESSION_COOKIE)?.value ?? null);

  return (
    <main className="page-shell pb-28">
      <Link href={`/${locale}/letters`} className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]">
        <ArrowLeft className="h-4 w-4" />
        {locale === "ko" ? "빛의 릴레이" : "Light Relay"}
      </Link>
      <section className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="glass rounded-[32px] p-6 sm:p-8 lg:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--gold-border)] bg-[var(--gold-soft)] px-4 py-2 text-sm font-semibold text-[var(--gold)]">
            <Settings className="h-4 w-4" />
            {locale === "ko" ? "빛의 릴레이 설정" : "Light Relay settings"}
          </div>
          <h1 className="mt-5 text-3xl font-bold leading-tight text-[var(--ink)] sm:text-4xl">
            {locale === "ko" ? "릴레이 참여 여부와 수신 설정을 관리합니다." : "Manage relay participation and receiving settings."}
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--ink-muted)]">
            {locale === "ko" ? "인증한 이메일 기준으로 릴레이 참여와 닉네임을 관리합니다. 설정은 상대에게 공개되지 않습니다." : "Manage relay participation and nickname for your verified email. These settings are never shown to other participants."}
          </p>
          <div className="mt-7">
            <LetterSettingsForm locale={locale} participant={participant} />
          </div>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <TrustNotice locale={locale} />
          <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-5 text-sm leading-7 text-[var(--ink-muted)]">
            <div className="flex items-center gap-2 font-bold text-[var(--ink)]">
              <ShieldCheck className="h-4 w-4 text-[var(--gold)]" />
              {locale === "ko" ? "언제든 다시 릴레이 참여 가능" : "You can rejoin the relay anytime"}
            </div>
            <p className="mt-2">
              {locale === "ko" ? "릴레이를 완전히 탈퇴해도 이메일 OTP 인증을 다시 하면 릴레이 참여자로 돌아올 수 있습니다." : "Even after leaving completely, verifying by email OTP lets you rejoin the relay."}
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
