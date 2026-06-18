import Image from "next/image";

type BrandedLoadingPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  steps: readonly string[];
};

export function BrandedLoadingPage({ eyebrow, title, description, steps }: BrandedLoadingPageProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-12 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(212,168,83,0.16),transparent_34%),radial-gradient(circle_at_20%_80%,rgba(138,180,232,0.08),transparent_28%)]" />
      <section
        role="status"
        aria-live="polite"
        className="glass relative w-full max-w-xl rounded-[32px] p-7 text-center shadow-2xl shadow-black/30 sm:rounded-[40px] sm:p-10"
      >
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] border border-[var(--gold-border)] bg-[var(--gold-soft)] shadow-[0_0_56px_rgba(212,168,83,0.22)] sm:h-28 sm:w-28">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-[22px] bg-[var(--canvas)] ring-1 ring-white/10 sm:h-20 sm:w-20">
            <span className="absolute inset-0 rounded-[22px] border border-[var(--gold)]/35 motion-safe:animate-ping motion-reduce:animate-none" />
            <Image src="/favicon.svg" alt="" width={56} height={56} priority className="relative h-12 w-12 sm:h-14 sm:w-14" />
          </div>
        </div>

        <div className="mt-7 section-title text-sm">{eyebrow}</div>
        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-[var(--ink)] sm:text-4xl">{title}</h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-7 text-[var(--muted)] sm:text-lg">{description}</p>

        <div className="mx-auto mt-8 h-1.5 max-w-xs overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 rounded-full bg-[linear-gradient(90deg,transparent,var(--gold),transparent)] motion-safe:animate-[pulse_1.35s_ease-in-out_infinite] motion-reduce:animate-none" />
        </div>

        <ol className="mt-8 grid gap-3 text-left sm:grid-cols-3">
          {steps.map((step) => (
            <li key={step} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="mb-2 h-1.5 w-10 rounded-full bg-[var(--gold)]/70" />
              <span className="text-sm font-semibold leading-5 text-[var(--ink)]">{step}</span>
            </li>
          ))}
        </ol>
        <span className="sr-only">Loading</span>
      </section>
    </main>
  );
}
