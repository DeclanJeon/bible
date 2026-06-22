"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-8 lg:px-8">
      <div className="glass rounded-[32px] p-8 text-center lg:p-10 max-w-lg">
        <AlertTriangle className="mx-auto h-12 w-12 text-[var(--gold)]" />
        <h1 className="mt-6 text-2xl font-bold text-[var(--ink)]">Something went wrong</h1>
        <p className="mt-4 text-base leading-7 text-[var(--ink-muted)]">
          An unexpected error occurred while loading this page. Please try again.
        </p>
        <button
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[var(--gold)] px-6 py-3 text-sm font-semibold text-[var(--canvas)] hover:bg-[var(--gold-hover)] transition"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
