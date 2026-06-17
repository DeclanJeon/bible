export default function BibleLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8 lg:px-8">
      <div className="glass rounded-[28px] px-5 py-4 animate-pulse">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="h-5 w-48 rounded bg-white/10" />
            <div className="mt-2 h-4 w-64 rounded bg-white/10" />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="h-9 w-20 rounded-full bg-white/10" />
            <div className="h-9 w-24 rounded-full bg-white/10" />
            <div className="h-9 w-28 rounded-full bg-white/10" />
          </div>
        </div>
      </div>

      <section className="mt-8 glass rounded-[36px] p-7 lg:p-10 animate-pulse">
        <div className="h-4 w-36 rounded bg-white/10" />
        <div className="mt-5 h-12 w-72 rounded bg-white/10" />
        <div className="mt-5 h-4 w-full max-w-3xl rounded bg-white/10" />
        <div className="mt-3 h-4 w-2/3 max-w-2xl rounded bg-white/10" />
      </section>

      <section className="mt-8 grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="glass rounded-[32px] p-5 animate-pulse">
          <div className="h-4 w-28 rounded bg-white/10" />
          <div className="mt-5 grid grid-cols-2 gap-2">
            {Array.from({ length: 18 }).map((_, index) => (
              <div key={index} className="h-14 rounded-2xl bg-white/[0.06]" />
            ))}
          </div>
        </aside>

        <div className="space-y-8">
          <div className="glass rounded-[32px] p-6 lg:p-8 animate-pulse">
            <div className="h-4 w-32 rounded bg-white/10" />
            <div className="mt-4 h-10 w-64 rounded bg-white/10" />
            <div className="mt-7 flex flex-wrap gap-2">
              {Array.from({ length: 16 }).map((_, index) => (
                <div key={index} className="h-9 w-11 rounded-full bg-white/10" />
              ))}
            </div>
          </div>

          <article className="rounded-[36px] border border-[var(--gold)]/20 bg-[var(--gold)]/[0.07] p-6 lg:p-10 animate-pulse">
            <div className="mx-auto max-w-3xl space-y-5">
              {Array.from({ length: 18 }).map((_, index) => (
                <div key={index} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
                  <div className="h-6 w-8 rounded bg-white/10" />
                  <div className="space-y-2">
                    <div className="h-4 w-full rounded bg-white/10" />
                    <div className="h-4 w-4/5 rounded bg-white/10" />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
