import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { resolveLocale } from "@/lib/server-locale";

type Props = { params: Promise<{ locale: string }> };

export default async function LetterSentPage({ params }: Props) {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);

  return (
    <main className="page-shell flex min-h-[70vh] items-center justify-center pb-28">
      <section className="glass max-w-xl rounded-[32px] p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h1 className="mt-5 text-3xl font-bold text-[var(--ink)]">{locale === "ko" ? "당신의 고민이 빛 전달자에게 전달되었습니다" : "Your concern was sent to a light bearer"}</h1>
        <p className="mt-4 text-base leading-7 text-[var(--ink-muted)]">{locale === "ko" ? "빛 전달자가 성구를 골라 답변을 보낼 예정입니다. 카드뉴스가 완성되면 이메일로 알림을 받습니다." : "A light bearer will pick Scripture and send a reply. You will receive an email when the card is ready."}</p>
        <Link href={`/${locale}/letters`} className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--gold)] px-5 py-3 text-sm font-bold text-white">
          {locale === "ko" ? "빛의 릴레이로 돌아가기" : "Back to Light Relay"}
        </Link>
      </section>
    </main>
  );
}
