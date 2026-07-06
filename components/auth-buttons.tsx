"use client";

import Image from "next/image";
import { signIn, signOut, useSession } from "next-auth/react";

import { Loader2, LogIn, LogOut } from "lucide-react";

import type { AppLocale } from "@/lib/content";

export function SignInButton({ locale, className }: { locale: AppLocale; className?: string }) {
  const { status } = useSession();

  if (status === "authenticated") {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl: `/${locale}/letters/write` })}
      disabled={status === "loading"}
      className={className ?? "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--gold)] px-8 py-3 text-sm font-bold text-white transition hover:bg-[var(--gold-hover)] disabled:cursor-not-allowed disabled:opacity-50"}
    >
      {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
      {locale === "ko" ? "시작하기" : "Start"}
    </button>
  );
}

export function SignOutButton({ locale, className }: { locale: AppLocale; className?: string }) {
  const { status } = useSession();

  if (status !== "authenticated") {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: `/${locale}/letters` })}
      className={className ?? "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--hairline)] px-4 py-2 text-sm font-bold text-[var(--ink)] transition hover:border-[var(--gold-border)]"}
    >
      <LogOut className="h-4 w-4" />
      {locale === "ko" ? "로그아웃" : "Sign out"}
    </button>
  );
}

export function AuthStatus({ locale }: { locale: AppLocale }) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--surface-2)]" />;
  }

  if (status !== "authenticated" || !session?.user) {
    return <SignInButton locale={locale} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--gold)] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-[var(--gold-hover)]" />;
  }

  return (
    <div className="flex items-center gap-2">
      {session.user.image ? (
        <Image src={session.user.image} alt="" width={28} height={28} className="h-7 w-7 rounded-full" />
      ) : (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--gold-soft)] text-xs font-bold text-[var(--gold)]">
          {(session.user.name ?? session.user.email ?? "?").charAt(0).toUpperCase()}
        </div>
      )}
      <span className="text-xs font-semibold text-[var(--ink)]">{session.user.name ?? session.user.email}</span>
    </div>
  );
}
