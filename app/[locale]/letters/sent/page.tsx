import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { auth } from "@/auth";
import { getRelayAvailability } from "@/lib/letters";
import { resolveLocale } from "@/lib/server-locale";

type Props = { params: Promise<{ locale: string }> };

export default async function LetterSentPage({ params }: Props) {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  const session = await auth();
  const relayAvailability = await getRelayAvailability(session?.user?.email ?? null);

  return (
    <main className="page-shell flex min-h-[70vh] items-center justify-center pb-28">
      <section className="glass max-w-xl rounded-[32px] p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h1 className="mt-5 text-3xl font-bold text-[var(--ink)]">{locale === "ko" ? "당신의 고민이 빛 전달자에게 전달되었습니다" : "Your concern was sent to a light bearer"}</h1>
        <p className="mt-4 text-base leading-7 text-[var(--ink-muted)]">{locale === "ko" ? "빛 전달자가 성구를 골라 답변을 보낼 예정입니다. 카드뉴스가 완성되면 이메일로 알림을 받습니다." : "A light bearer will pick Scripture and send a reply. You will receive an email when the card is ready."}</p>
        {!relayAvailability.hasEligibleHumanRelay ? (
          <div className="mt-5 rounded-2xl border border-[var(--gold-border)] bg-[var(--gold-soft)] p-5 text-left text-sm leading-6 text-[var(--ink)]">
            <p className="font-bold">{locale === "ko" ? "따뜻한 세상의 빛이 되어 주세요." : "Become a warm light for someone."}</p>
            <p className="mt-1 text-[var(--ink-muted)]">
              {locale === "ko"
                ? "시스템은 작성자 본인에게 답변을 맡기지 않습니다. 지금은 테스트용 마스터 계정이 받을 수 있지만, 진짜 릴레이가 이어지려면 한 사람이 더 필요해요."
                : "The system never asks the author to answer their own concern. A test master account can receive this for now, but the real relay needs one more person."}
            </p>
            <Link href={`/${locale}/letters/join`} className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--gold)] px-4 py-2 text-xs font-bold text-white">
              {locale === "ko" ? "릴레이로 참여하기" : "Join the relay"}
            </Link>
          </div>
        ) : null}
        <Link href={`/${locale}/letters`} className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--gold)] px-5 py-3 text-sm font-bold text-white">
          {locale === "ko" ? "빛의 릴레이로 돌아가기" : "Back to Light Relay"}
        </Link>
      </section>
    </main>
  );
}
