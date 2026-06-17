export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="glass w-full max-w-2xl rounded-[36px] p-8 text-center lg:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] border border-[var(--gold)]/35 bg-[var(--gold)]/[0.08]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--gold)] border-t-transparent" />
        </div>
        <div className="mt-7 section-title text-base">성경 본문을 불러오는 중</div>
        <h1 className="mt-4 text-3xl font-bold text-white lg:text-4xl">잠시만 기다려 주세요</h1>
        <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-[var(--muted)]">
          본문, 문맥, 상호참조 데이터를 정리해 읽기 좋은 화면으로 준비하고 있습니다.
        </p>
        <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
          {["본문", "문맥", "연결 본문"].map((label) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-[var(--gold)]" />
              </div>
              <div className="mt-3 text-sm font-semibold text-white">{label}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
