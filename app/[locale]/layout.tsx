import Image from "next/image";
import { GlobalNavShell } from "@/components/global-nav-shell";
import { PassagePanelProvider } from "@/components/passage-panel";
import { PwaExperience } from "@/components/pwa-experience";
import { notFound } from "next/navigation";

function PwaBootSplash({ locale }: { locale: "ko" | "en" }) {
  const copy =
    locale === "ko"
      ? {
          eyebrow: "성경 컴패니언",
          title: "본문을 준비하고 있습니다",
          description: "홈 화면 앱 모드로 성경, 문맥, 연결 본문을 불러오는 중입니다.",
        }
      : {
          eyebrow: "Bible Companion",
          title: "Preparing Scripture",
          description: "Opening Bible passages, context, and cross-references in app mode.",
        };

  return (
    <div className="pwa-boot-splash fixed inset-0 z-[80] items-center justify-center overflow-hidden bg-[var(--canvas)] px-6 py-10" role="status" aria-live="polite">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(212,168,83,0.20),transparent_34%),radial-gradient(circle_at_20%_80%,rgba(138,180,232,0.10),transparent_30%)]" />
      <section className="glass relative w-full max-w-sm rounded-[32px] p-7 text-center shadow-2xl shadow-black/30">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] border border-[var(--gold-border)] bg-[var(--gold-soft)] shadow-[0_0_56px_rgba(212,168,83,0.24)]">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-[22px] bg-[var(--canvas)] ring-1 ring-white/10">
            <span className="absolute inset-0 rounded-[22px] border border-[var(--gold)]/35 motion-safe:animate-ping motion-reduce:animate-none" />
            <Image src="/favicon.svg" alt="" width={52} height={52} priority className="relative h-12 w-12" />
          </div>
        </div>
        <div className="mt-7 section-title text-sm">{copy.eyebrow}</div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--ink)]">{copy.title}</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{copy.description}</p>
        <div className="mx-auto mt-7 h-1.5 max-w-[220px] overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 rounded-full bg-[linear-gradient(90deg,transparent,var(--gold),transparent)] motion-safe:animate-[pulse_1.25s_ease-in-out_infinite] motion-reduce:animate-none" />
        </div>
        <span className="sr-only">Loading</span>
      </section>
    </div>
  );
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (locale !== "ko" && locale !== "en") {
    notFound();
  }

  return (
    <PassagePanelProvider locale={locale}>
      <GlobalNavShell locale={locale} />
      <PwaBootSplash locale={locale} />
      <PwaExperience locale={locale} />
      {children}
    </PassagePanelProvider>
  );
}
