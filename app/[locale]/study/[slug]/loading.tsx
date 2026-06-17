export default function StudyLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-8 lg:px-8">
      <div className="glass rounded-[28px] px-5 py-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-5 w-40 rounded bg-white/10" />
          <div className="h-8 w-20 rounded-full bg-white/10" />
          <div className="h-8 w-24 rounded-full bg-white/10" />
          <div className="h-8 w-16 rounded-full bg-white/10" />
        </div>
      </div>
      <div className="mt-8 glass rounded-[32px] p-8 lg:p-10 animate-pulse">
        <div className="h-4 w-24 rounded bg-white/10" />
        <div className="mt-4 h-10 w-2/3 rounded bg-white/10" />
        <div className="mt-4 h-4 w-full rounded bg-white/10" />
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="space-y-6">
          <div className="glass rounded-[32px] p-8 animate-pulse">
            <div className="h-4 w-32 rounded bg-white/10" />
            <div className="mt-6 h-64 rounded-[28px] bg-white/[0.03]" />
          </div>
          <div className="glass rounded-[32px] p-8 animate-pulse">
            <div className="h-4 w-40 rounded bg-white/10" />
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <div className="h-32 rounded-[24px] bg-white/[0.03]" />
              <div className="h-32 rounded-[24px] bg-white/[0.03]" />
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="glass rounded-[32px] p-8 animate-pulse">
            <div className="h-4 w-28 rounded bg-white/10" />
            <div className="mt-4 h-8 w-48 rounded bg-white/10" />
            <div className="mt-3 h-4 w-32 rounded bg-white/10" />
          </div>
          <div className="glass rounded-[32px] p-8 animate-pulse">
            <div className="h-4 w-28 rounded bg-white/10" />
            <div className="mt-4 space-y-4">
              <div className="h-20 rounded-[20px] bg-white/[0.03]" />
              <div className="h-20 rounded-[20px] bg-white/[0.03]" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
