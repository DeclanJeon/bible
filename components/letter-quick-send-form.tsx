"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { signIn, useSession } from "next-auth/react";
import { Loader2, Send } from "lucide-react";

import type { AppLocale } from "@/lib/content";

const MIN_CONCERN_LENGTH = 20;
const MAX_CONCERN_LENGTH = 1200;
const PENDING_CONCERN_TTL_MS = 1000 * 60 * 30;

type PendingConcern = {
  body: string;
  createdAt: number;
};

function pendingConcernKey(locale: AppLocale) {
  return `letters.pendingConcern.${locale}`;
}

function readPendingConcern(locale: AppLocale) {
  try {
    const raw = window.sessionStorage.getItem(pendingConcernKey(locale));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingConcern>;
    if (typeof parsed.body !== "string" || typeof parsed.createdAt !== "number") {
      window.sessionStorage.removeItem(pendingConcernKey(locale));
      return null;
    }
    if (Date.now() - parsed.createdAt > PENDING_CONCERN_TTL_MS) {
      window.sessionStorage.removeItem(pendingConcernKey(locale));
      return null;
    }
    return { body: parsed.body, createdAt: parsed.createdAt } satisfies PendingConcern;
  } catch {
    window.sessionStorage.removeItem(pendingConcernKey(locale));
    return null;
  }
}

function writePendingConcern(locale: AppLocale, body: string) {
  window.sessionStorage.setItem(pendingConcernKey(locale), JSON.stringify({ body, createdAt: Date.now() } satisfies PendingConcern));
}

function clearPendingConcern(locale: AppLocale) {
  window.sessionStorage.removeItem(pendingConcernKey(locale));
}

function quickSendErrorMessage(error: string | undefined, locale: AppLocale) {
  const ko: Record<string, string> = {
    "missing-email": "로그인 이메일을 확인할 수 없습니다. 다시 로그인해주세요.",
    "invalid-body": "고민은 20자 이상 1200자 이하로 적어주세요.",
    "contact-info-not-allowed": "이메일, 전화번호, 연락처 유도 문구는 넣을 수 없습니다.",
    "request-failed": "고민을 보내지 못했습니다. 잠시 후 다시 시도해주세요.",
  };
  const en: Record<string, string> = {
    "missing-email": "We could not read your signed-in email. Please sign in again.",
    "invalid-body": "Write between 20 and 1200 characters.",
    "contact-info-not-allowed": "Contact details are not allowed.",
    "request-failed": "We could not send your concern. Please try again shortly.",
  };
  return (locale === "ko" ? ko : en)[error ?? "request-failed"] ?? (error ?? "request-failed");
}

export function LetterQuickSendForm({ locale }: { locale: AppLocale }) {
  const { data: session, status } = useSession();
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const autoSubmitStarted = useRef(false);
  const normalizedBody = body.replace(/\s+/g, " ").trim();
  const canSubmit = useMemo(
    () => normalizedBody.length >= MIN_CONCERN_LENGTH && normalizedBody.length <= MAX_CONCERN_LENGTH && !isPending && status !== "loading",
    [isPending, normalizedBody.length, status],
  );

  const sendConcern = useCallback(async (concernBody: string) => {
    const authorEmail = session?.user?.email;
    if (!authorEmail) {
      setMessage(quickSendErrorMessage("missing-email", locale));
      return;
    }
    const response = await fetch(`/${locale}/api/letters`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: concernBody, authorEmail, category: "concern", shareVisibility: "unlisted" }),
    });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok || result.error) {
      setMessage(quickSendErrorMessage(result.error ?? "request-failed", locale));
      return;
    }
    clearPendingConcern(locale);
    window.location.href = `/${locale}/letters/sent`;
  }, [locale, session?.user?.email]);

  useEffect(() => {
    if (status !== "authenticated" || autoSubmitStarted.current) {
      return;
    }
    const pendingConcern = readPendingConcern(locale);
    if (!pendingConcern) {
      return;
    }
    autoSubmitStarted.current = true;
    setBody(pendingConcern.body);
    setMessage(locale === "ko" ? "로그인되었습니다. 고민을 바로 보내는 중입니다." : "Signed in. Sending your concern now.");
    startTransition(async () => {
      await sendConcern(pendingConcern.body);
      autoSubmitStarted.current = false;
    });
  }, [locale, sendConcern, status]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (normalizedBody.length < MIN_CONCERN_LENGTH || normalizedBody.length > MAX_CONCERN_LENGTH) {
      setMessage(quickSendErrorMessage("invalid-body", locale));
      return;
    }
    if (status !== "authenticated") {
      writePendingConcern(locale, normalizedBody);
      void signIn("google", { callbackUrl: `/${locale}/letters` });
      return;
    }
    startTransition(async () => {
      await sendConcern(normalizedBody);
    });
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-3xl">
      <div className="rounded-[32px] border border-[var(--hairline)] bg-[var(--surface-1)] p-3 shadow-sm transition focus-within:border-[var(--gold-border)] focus-within:shadow-md sm:p-4">
        <label className="sr-only" htmlFor="letter-quick-concern">
          {locale === "ko" ? "고민 작성" : "Write your concern"}
        </label>
        <textarea
          id="letter-quick-concern"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          minLength={MIN_CONCERN_LENGTH}
          maxLength={MAX_CONCERN_LENGTH}
          placeholder={locale === "ko" ? "지금 마음에 있는 사연을 들려주세요." : "Write what is weighing on your heart."}
          className="max-h-64 min-h-28 w-full resize-y rounded-[24px] border-0 bg-transparent px-4 py-3 text-base leading-7 text-[var(--ink)] outline-none placeholder:text-[var(--ink-subtle)] sm:text-lg"
        />
        <div className="mt-2 flex flex-col gap-3 border-t border-[var(--hairline)] px-2 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--ink-muted)]">
            {body.length}/{MAX_CONCERN_LENGTH} · {locale === "ko" ? "로그인 후에도 작성한 내용은 유지됩니다." : "Your draft stays saved after sign-in."}
          </p>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--gold)] px-6 py-3 text-sm font-bold text-white transition hover:bg-[var(--gold-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending || status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {locale === "ko" ? "보내기" : "Send"}
          </button>
        </div>
      </div>
      {message ? <p className="mt-3 text-sm font-semibold text-red-700" role="alert">{message}</p> : null}
    </form>
  );
}
