export default function CompanionLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-8 lg:px-8">
      <div className="glass rounded-[28px] px-6 py-5 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-5 w-56 rounded bg-white/10" />
          <div className="h-10 w-80 rounded-full bg-white/10" />
          <div className="flex gap-2">
            <div className="h-8 w-12 rounded-full bg-white/10" />
            <div className="h-8 w-12 rounded-full bg-white/10" />
          </div>
        </div>
      </div>
      <div className="mt-8 glass rounded-[32px] p-8 lg:p-10 animate-pulse">
        <div className="rounded-[20px] border border-white/5 bg-white/[0.02] px-5 py-4">
          <div className="h-4 w-64 rounded bg-white/10" />
        </div>
        <div className="mt-6 h-10 w-3/4 rounded bg-white/10" />
        <div className="mt-4 h-4 w-full rounded bg-white/10" />
        <div className="mt-2 h-4 w-5/6 rounded bg-white/10" />
        <div className="mt-8 rounded-[28px] border border-[var(--gold)]/10 bg-[var(--gold)]/[0.03] p-6 lg:p-8">
          <div className="h-5 w-40 rounded bg-white/10" />
          <div className="mt-4 space-y-3">
            <div className="h-4 w-full rounded bg-white/10" />
            <div className="h-4 w-full rounded bg-white/10" />
            <div className="h-4 w-4/5 rounded bg-white/10" />
          </div>
        </div>
      </div>
      <div className="mt-8 glass rounded-[32px] p-6 animate-pulse">
        <div className="flex gap-2">
          <div className="h-10 w-28 rounded-full bg-white/10" />
          <div className="h-10 w-32 rounded-full bg-white/10" />
          <div className="h-10 w-24 rounded-full bg-white/10" />
          <div className="h-10 w-28 rounded-full bg-white/10" />
          <div className="h-10 w-24 rounded-full bg-white/10" />
        </div>
        <div className="mt-6 h-48 rounded-[24px] bg-white/[0.03]" />
      </div>
    </main>
  );
}
