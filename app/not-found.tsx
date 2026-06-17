import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-8 lg:px-8">
      <div className="glass rounded-[32px] p-8 text-center lg:p-10 max-w-lg">
        <div className="text-6xl font-bold text-[var(--gold)]">404</div>
        <h1 className="mt-6 text-2xl font-bold text-white">Page not found</h1>
        <p className="mt-4 text-base leading-7 text-[var(--muted)]">
          The page you&apos;re looking for doesn&apos;t exist. Start a new reflection or browse study lanes.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/ko"
            className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-[var(--accent)]/90 transition"
          >
            Go home
          </Link>
          <Link
            href="/ko/lanes"
            className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-white hover:border-[var(--gold)]/30 hover:text-[var(--gold)] transition"
          >
            Browse lanes
          </Link>
        </div>
      </div>
    </main>
  );
}
