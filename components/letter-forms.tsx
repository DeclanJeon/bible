"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Loader2, Mail, Send, ShieldCheck } from "lucide-react";

import type { AppLocale } from "@/lib/content";
import type { ScriptureSuggestion } from "@/lib/letters";

type ReplyScriptureMode = "suggested" | "custom";

const MAX_REPLY_SCRIPTURE_SUGGESTIONS = 10;

const CATEGORY_OPTIONS = {
  ko: [
    ["concern", "고민"],
    ["reflection", "고찰"],
    ["question", "질문"],
    ["prayer", "기도제목"],
  ],
  en: [
    ["concern", "Concern"],
    ["reflection", "Reflection"],
    ["question", "Question"],
    ["prayer", "Prayer"],
  ],
} as const;

function errorMessage(error: string | null, locale: AppLocale) {
  if (!error) return null;
  const ko: Record<string, string> = {
    "invalid-body": "본문은 20~1200자로 적어주세요.",
    "invalid-email": "답변 받을 이메일을 확인해주세요.",
    "contact-info-not-allowed": "이메일, 전화번호, 연락처 유도 문구는 넣을 수 없습니다.",
    "email-failed": "답장 알림 이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.",
    "already-answered": "이미 답변한 편지입니다.",
    "expired-token": "답변 링크가 만료되었습니다.",
  };
  const en: Record<string, string> = {
    "invalid-body": "Please write within the required length.",
    "invalid-email": "Check the reply email address.",
    "contact-info-not-allowed": "Contact details are not allowed.",
    "invalid-token": "This reply link is not valid.",
    "email-failed": "The reply notification email could not be sent. Please try again shortly.",
    "expired-token": "This reply link has expired.",
  };
  return (locale === "ko" ? ko : en)[error] ?? error;
}

function normalizeReplyScriptureSuggestions(suggestions: ScriptureSuggestion[], fallbackReference: string) {
  const seen = new Set<string>();
  const normalized: ScriptureSuggestion[] = [];
  for (const suggestion of suggestions) {
    const reference = suggestion.reference.replace(/\s+/g, " ").trim();
    if (!reference || seen.has(reference)) {
      continue;
    }
    seen.add(reference);
    normalized.push({ ...suggestion, reference });
    if (normalized.length >= MAX_REPLY_SCRIPTURE_SUGGESTIONS) {
      break;
    }
  }
  if (normalized.length === 0 && fallbackReference.trim()) {
    normalized.push({
      reference: fallbackReference.trim(),
      text: "",
      reason: "",
      href: null,
      confidence: "low",
    });
  }
  return normalized;
}

type ParticipantSummary = {
  participantId?: string;
  status?: string;
  canReceiveLetters?: boolean;
  nickname?: string;
  maskedEmail?: string;
  verifiedAt?: string;
  pausedUntil?: string | null;
  preferredLocale?: AppLocale;
  maxLettersPerDay?: number;
  selectionWindowCount?: number;
  selectionLimitPerDay?: number;
  nextEligibleAt?: string;
};

function participantErrorMessage(error: string | null, locale: AppLocale) {
  if (!error) return null;
  const ko: Record<string, string> = {
    "invalid-email": "이메일 주소를 확인해주세요.",
    "invalid-otp": "인증번호가 맞지 않습니다.",
    "expired-otp": "인증번호가 만료되었습니다. 다시 요청해주세요.",
    "otp-expired": "인증번호가 만료되었습니다. 다시 요청해주세요.",
    "too-many-requests": "요청이 많습니다. 잠시 후 다시 시도해주세요.",
    "rate-limited": "요청이 많습니다. 잠시 후 다시 시도해주세요.",
    "invalid-nickname": "닉네임은 32자 이내로 적어주세요.",
  };
  const en: Record<string, string> = {
    "invalid-email": "Check the email address.",
    "invalid-otp": "The verification code does not match.",
    "expired-otp": "The verification code expired. Request a new one.",
    "otp-expired": "The verification code expired. Request a new one.",
    "too-many-requests": "Too many requests. Please try again shortly.",
    "rate-limited": "Too many requests. Please try again shortly.",
    "invalid-nickname": "Keep the nickname within 32 characters.",
  };
  return (locale === "ko" ? ko : en)[error] ?? error;
}

export function LetterJoinForm({ locale }: { locale: AppLocale }) {
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [canReceiveLetters, setCanReceiveLetters] = useState(true);
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"request" | "verify" | "joined">("request");
  const [participant, setParticipant] = useState<ParticipantSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canRequest = email.includes("@") && nickname.length <= 32;
  const canVerify = otp.trim().length >= 4 && email.includes("@");

  function requestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/${locale}/api/letters/participants/request-otp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, nickname, canReceiveLetters }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; participant?: ParticipantSummary };
      if (!response.ok || result.error) {
        setMessage(participantErrorMessage(result.error ?? "unknown", locale));
        return;
      }
      setParticipant(result.participant ?? null);
      setStep("verify");
      setMessage(locale === "ko" ? "인증번호를 보냈습니다. 이메일에서 6자리 코드를 확인해주세요." : "We sent a verification code. Check your email for the 6-digit code.");
    });
  }

  function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/${locale}/api/letters/participants/verify-otp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; participant?: ParticipantSummary };
      if (!response.ok || result.error) {
        setMessage(participantErrorMessage(result.error ?? "unknown", locale));
        return;
      }
      setParticipant(result.participant ?? null);
      setStep("joined");
      setMessage(null);
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [Mail, locale === "ko" ? "이메일 인증" : "Verify email", locale === "ko" ? "인증번호로 본인 소유 이메일만 등록합니다." : "Use a one-time code to register an email you control."],
          [Send, locale === "ko" ? "고민 보내기" : "Send your concern", locale === "ko" ? "익명으로 고민을 작성하고 빛 전달자에게 전달합니다." : "Write your concern anonymously and pass it to a light bearer."],
          [ShieldCheck, locale === "ko" ? "빛의 릴레이" : "Light Relay", locale === "ko" ? "답변을 받고, 다음 사람에게 빛을 이어갈 수 있습니다." : "Receive a reply and pass the light to the next person."],
        ].map(([Icon, title, body]) => {
          const TypedIcon = Icon as typeof Mail;
          return (
            <div key={String(title)} className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4">
              <TypedIcon className="h-5 w-5 text-[var(--gold)]" />
              <h2 className="mt-3 text-sm font-bold text-[var(--ink)]">{title as string}</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{body as string}</p>
            </div>
          );
        })}
      </div>

      {step === "joined" ? (
        <div className="rounded-[28px] border border-emerald-500/30 bg-emerald-500/10 p-6 text-[var(--ink)]">
          <CheckCircle2 className="h-8 w-8 text-emerald-700" />
          <h2 className="mt-4 text-2xl font-bold">{locale === "ko" ? "빛의 릴레이 참여가 완료되었습니다" : "You have joined the Light Relay"}</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
            {locale === "ko"
              ? `${participant?.maskedEmail ?? "인증한 이메일"}로 말씀편지 알림을 받습니다. 다른 참여자의 고민이 오면 성구를 골라 답변을 보낼 수 있습니다.`
              : `You will receive Scripture-letter notifications at ${participant?.maskedEmail ?? "your verified email"}. When another participant shares a concern, you can choose a Bible verse and send a reply.`}
          </p>
          <div className="mt-4 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4 text-sm font-semibold text-[var(--ink)]">
            {participant?.canReceiveLetters
              ? (locale === "ko" ? "수신 허용: 다른 사람의 말씀편지를 받을 수 있습니다." : "Receiving enabled: you can receive another person's Scripture letter.")
              : (locale === "ko" ? "수신 꺼짐: 직접 쓴 편지와 알림만 이용합니다." : "Receiving off: you can still write letters and receive your own notifications.")}
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <a href={`/${locale}/letters/write`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--gold)] px-4 py-2 text-sm font-bold text-white">
              {locale === "ko" ? "익명 말씀편지 쓰기" : "Write a letter"}
            </a>
            <a href={`/${locale}/letters/settings`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--hairline)] px-4 py-2 text-sm font-bold text-[var(--ink)]">
              {locale === "ko" ? "수신 설정 관리" : "Manage settings"}
            </a>
          </div>
        </div>
      ) : step === "verify" ? (
        <form onSubmit={verifyOtp} className="space-y-5">
          <div className="rounded-2xl border border-[var(--gold-border)] bg-[var(--gold-soft)] p-4 text-sm leading-6 text-[var(--ink)]">
            {locale === "ko"
              ? `${participant?.maskedEmail ?? "입력한 이메일"}로 보낸 인증번호를 입력하세요. 인증 전에는 수신 참여자로 배정되지 않습니다.`
              : `Enter the code sent to ${participant?.maskedEmail ?? "your email"}. You are not added to the receiving pool until verification succeeds.`}
          </div>
          <label className="block space-y-2 text-sm font-semibold text-[var(--ink)]">
            {locale === "ko" ? "이메일 인증번호" : "Email verification code"}
            <input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))} required inputMode="numeric" autoComplete="one-time-code" className="h-12 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 tracking-[0.35em] outline-none focus:border-[var(--input-focus-border)]" />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={() => { setStep("request"); setMessage(null); }} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--hairline)] px-5 py-3 text-sm font-bold text-[var(--ink)] transition hover:border-[var(--gold-border)]">
              {locale === "ko" ? "이메일 다시 입력" : "Change email"}
            </button>
            {message ? <p className="text-sm font-semibold text-[var(--ink-muted)]" role="status">{message}</p> : null}
            <button type="submit" disabled={!canVerify || isPending} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--gold-hover)] disabled:cursor-not-allowed disabled:opacity-50">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {locale === "ko" ? "인증하고 참여하기" : "Verify and join"}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={requestOtp} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-[var(--ink)]">
              {locale === "ko" ? "이메일" : "Email"}
              <input value={email} onChange={(event) => setEmail(event.target.value)} required type="email" autoComplete="email" className="h-12 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 outline-none focus:border-[var(--input-focus-border)]" />
            </label>
            <label className="space-y-2 text-sm font-semibold text-[var(--ink)]">
              {locale === "ko" ? "닉네임 (선택)" : "Nickname (optional)"}
              <input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={32} autoComplete="nickname" className="h-12 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 outline-none focus:border-[var(--input-focus-border)]" />
            </label>
          </div>
          <label className="flex gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4 text-sm leading-6 text-[var(--ink)]">
            <input checked={canReceiveLetters} onChange={(event) => setCanReceiveLetters(event.target.checked)} type="checkbox" className="mt-1 h-4 w-4 accent-[var(--gold)]" />
            <span>
              <span className="block font-bold">{locale === "ko" ? "빛의 릴레이에 참여하기" : "Join the Light Relay"}</span>
              <span className="mt-1 block text-[var(--ink-muted)]">
                {locale === "ko"
                  ? "당신이 받은 위로를 다음 고민자에게 전달합니다."
                  : "Pass the comfort you receive to the next person in need."}
              </span>
            </span>
          </label>
          <p className="rounded-2xl border border-[var(--gold-border)] bg-[var(--gold-soft)] p-4 text-sm leading-6 text-[var(--ink)]">
            {locale === "ko"
              ? "참여자는 고민을 보낼 수도 있고, 빛 전달자가 되어 다른 사람의 고민에 답변할 수도 있습니다. 인증번호 원문은 저장되지 않습니다."
              : "Participants can send their own concerns or become light bearers to answer others' concerns. Raw verification codes are not stored."}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {message ? <p className="text-sm font-semibold text-red-700" role="alert">{message}</p> : <span />}
            <button type="submit" disabled={!canRequest || isPending} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--gold-hover)] disabled:cursor-not-allowed disabled:opacity-50">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {locale === "ko" ? "인증번호 받기" : "Send verification code"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function LetterSettingsForm({ locale, participant }: { locale: AppLocale; participant: ParticipantSummary | null }) {
  const [current, setCurrent] = useState(participant);
  const [nickname, setNickname] = useState(participant?.nickname ?? "");
  const [canReceiveLetters, setCanReceiveLetters] = useState(participant?.canReceiveLetters === true);
  const [pauseDays, setPauseDays] = useState("0");
  const [preferredLocale, setPreferredLocale] = useState<AppLocale>(participant?.preferredLocale ?? locale);
  const [maxLettersPerDay, setMaxLettersPerDay] = useState(String(participant?.maxLettersPerDay ?? 3));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/${locale}/api/letters/participants/settings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname, canReceiveLetters, pauseDays: Number(pauseDays), preferredLocale, maxLettersPerDay: Number(maxLettersPerDay) }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; participant?: ParticipantSummary };
      if (!response.ok || result.error || !result.participant) {
        setMessage(participantErrorMessage(result.error ?? "unknown", locale));
        return;
      }
      setCurrent(result.participant);
      setCanReceiveLetters(result.participant.canReceiveLetters === true);
      setNickname(result.participant.nickname ?? "");
      setPreferredLocale(result.participant.preferredLocale ?? locale);
      setMaxLettersPerDay(String(result.participant.maxLettersPerDay ?? 3));
      setPauseDays("0");
      setMessage(locale === "ko" ? "수신 설정을 저장했습니다." : "Settings saved.");
    });
  }

  function unsubscribe() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/${locale}/api/letters/participants/unsubscribe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; participant?: ParticipantSummary };
      if (!response.ok || result.error) {
        setMessage(participantErrorMessage(result.error ?? "unknown", locale));
        return;
      }
      setCurrent(result.participant ?? null);
      setMessage(locale === "ko" ? "수신을 중단했습니다. 다시 참여하려면 이메일 인증을 다시 진행하세요." : "Receiving stopped. Verify by email again to rejoin.");
    });
  }

  if (!current) {
    return (
      <div className="rounded-[28px] border border-[var(--hairline)] bg-[var(--surface-1)] p-6">
        <h2 className="text-2xl font-bold text-[var(--ink)]">{locale === "ko" ? "인증된 참여자가 아닙니다" : "No verified participant session"}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{locale === "ko" ? "수신 설정을 관리하려면 이메일 OTP 인증을 먼저 완료하세요." : "Verify by email OTP before managing receiving settings."}</p>
        <a href={`/${locale}/letters/join`} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--gold)] px-5 py-3 text-sm font-bold text-white">
          {locale === "ko" ? "이메일 인증하기" : "Verify email"}
        </a>
      </div>
    );
  }

  const paused = current.status === "paused" && current.pausedUntil;
  const unsubscribed = current.status === "unsubscribed";

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-[var(--hairline)] bg-[var(--surface-1)] p-6">
        <p className="text-sm font-semibold text-[var(--gold)]">{current.maskedEmail}</p>
        <h2 className="mt-2 text-2xl font-bold text-[var(--ink)]">{locale === "ko" ? "빛의 릴레이 설정" : "Light Relay settings"}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
          {locale === "ko"
            ? `오늘 수신 ${current.selectionWindowCount ?? 0}/${current.selectionLimitPerDay ?? current.maxLettersPerDay ?? 3}회 · 선호 언어 ${(current.preferredLocale ?? locale).toUpperCase()}`
            : `Received today ${current.selectionWindowCount ?? 0}/${current.selectionLimitPerDay ?? current.maxLettersPerDay ?? 3} · preferred ${(current.preferredLocale ?? locale).toUpperCase()}`}
        </p>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
          {paused
            ? (locale === "ko" ? `${new Date(current.pausedUntil ?? "").toLocaleDateString("ko-KR")}까지 릴레이를 쉬고 있습니다.` : `Relay is paused until ${new Date(current.pausedUntil ?? "").toLocaleDateString("en-US")}.`)
            : current.canReceiveLetters
              ? (locale === "ko" ? "현재 릴레이에 참여 중입니다. 다른 사람의 고민을 받고 답변할 수 있습니다." : "You are in the relay. You can receive concerns and send answers.")
              : (locale === "ko" ? "현재 릴레이에 참여하지 않았습니다. 직접 작성과 알림만 사용합니다." : "You are not in the relay. You can only write and receive your own notifications.")}
        </p>
      </div>

      <form onSubmit={saveSettings} className="space-y-5">
        <label className="block space-y-2 text-sm font-semibold text-[var(--ink)]">
          {locale === "ko" ? "닉네임 (선택)" : "Nickname (optional)"}
          <input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={32} disabled={unsubscribed} className="h-12 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 outline-none focus:border-[var(--input-focus-border)] disabled:opacity-60" />
        </label>
        <label className="flex gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4 text-sm leading-6 text-[var(--ink)]">
          <input checked={canReceiveLetters} onChange={(event) => setCanReceiveLetters(event.target.checked)} disabled={unsubscribed} type="checkbox" className="mt-1 h-4 w-4 accent-[var(--gold)] disabled:opacity-60" />
          <span>
            <span className="block font-bold">{locale === "ko" ? "빛의 릴레이 참여" : "Light Relay participation"}</span>
            <span className="mt-1 block text-[var(--ink-muted)]">{locale === "ko" ? "다른 사람의 고민을 받고 성구를 골라 위로의 답변을 보냅니다." : "Receive another person's concern, pick a Scripture, and send comfort."}</span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm font-semibold text-[var(--ink)]">
            {locale === "ko" ? "선호 언어" : "Preferred language"}
            <select value={preferredLocale} onChange={(event) => setPreferredLocale(event.target.value as AppLocale)} disabled={unsubscribed} className="h-12 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 outline-none focus:border-[var(--input-focus-border)] disabled:opacity-60">
              <option value="ko">한국어</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="block space-y-2 text-sm font-semibold text-[var(--ink)]">
            {locale === "ko" ? "하루 최대 수신" : "Daily receiving cap"}
            <select value={maxLettersPerDay} onChange={(event) => setMaxLettersPerDay(event.target.value)} disabled={unsubscribed} className="h-12 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 outline-none focus:border-[var(--input-focus-border)] disabled:opacity-60">
              <option value="1">{locale === "ko" ? "하루 1통" : "1 per day"}</option>
              <option value="2">{locale === "ko" ? "하루 2통" : "2 per day"}</option>
              <option value="3">{locale === "ko" ? "하루 3통" : "3 per day"}</option>
            </select>
          </label>
        </div>
        <label className="block space-y-2 text-sm font-semibold text-[var(--ink)]">
          {locale === "ko" ? "잠시 쉬기" : "Pause receiving"}
          <select value={pauseDays} onChange={(event) => setPauseDays(event.target.value)} disabled={unsubscribed} className="h-12 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 outline-none focus:border-[var(--input-focus-border)] disabled:opacity-60">
            <option value="0">{locale === "ko" ? "수신 활성화 / 쉬기 해제" : "Active / resume receiving"}</option>
            <option value="7">{locale === "ko" ? "7일 쉬기" : "Pause for 7 days"}</option>
            <option value="30">{locale === "ko" ? "30일 쉬기" : "Pause for 30 days"}</option>
          </select>
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {message ? <p className="text-sm font-semibold text-[var(--ink-muted)]" role="status">{message}</p> : <span />}
          <button type="submit" disabled={isPending || unsubscribed} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--gold-hover)] disabled:cursor-not-allowed disabled:opacity-50">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {locale === "ko" ? "설정 저장" : "Save settings"}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
        <h3 className="text-sm font-bold text-red-800">{locale === "ko" ? "빛의 릴레이 탈퇴" : "Leave the Light Relay"}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{locale === "ko" ? "릴레이를 탈퇴하면 참여 세션이 사라집니다. 다시 참여하려면 이메일 인증을 다시 진행하면 됩니다." : "Leaving the relay clears your session. Verify by email again if you want to rejoin."}</p>
        <button type="button" onClick={unsubscribe} disabled={isPending || unsubscribed} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-red-500/40 px-4 py-2 text-sm font-bold text-red-800 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50">
          {locale === "ko" ? "릴레이 탈퇴" : "Leave relay"}
        </button>
      </div>
    </div>
  );
}

export function LetterUnsubscribeForm({ locale, token }: { locale: AppLocale; token: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/${locale}/api/letters/participants/unsubscribe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok || result.error) {
        setMessage(participantErrorMessage(result.error ?? "unknown", locale));
        return;
      }
      setMessage(locale === "ko" ? "말씀편지 수신을 중단했습니다." : "You have stopped receiving Scripture letters.");
    });
  }

  return (
    <div className="rounded-[28px] border border-[var(--hairline)] bg-[var(--surface-1)] p-6">
      <h2 className="text-2xl font-bold text-[var(--ink)]">{locale === "ko" ? "수신을 중단할까요?" : "Stop receiving letters?"}</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{locale === "ko" ? "중단 후에도 다시 이메일 인증을 하면 언제든 참여할 수 있습니다." : "You can rejoin later by verifying your email again."}</p>
      {message ? <p className="mt-4 text-sm font-semibold text-[var(--ink)]" role="status">{message}</p> : null}
      <button type="button" onClick={submit} disabled={isPending || Boolean(message)} className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--gold)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--gold-hover)] disabled:cursor-not-allowed disabled:opacity-50">
        {isPending ? (locale === "ko" ? "처리 중..." : "Working...") : (locale === "ko" ? "수신 중단하기" : "Stop receiving")}
      </button>
    </div>
  );
}

export function LetterWriteForm({ locale, authorEmail }: { locale: AppLocale; authorEmail: string }) {
  const [body, setBody] = useState("");
  const [nickname, setNickname] = useState("");
  const [category, setCategory] = useState("concern");
  const visibility = "unlisted";
  const [message, setMessage] = useState<string | null>(null);
  const canSubmit = body.trim().length >= 20 && body.length <= 1200;
  const countClass = body.length > 1200 ? "text-red-700" : "text-[var(--ink-muted)]";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const payload = JSON.stringify({ body, authorEmail, authorNickname: nickname, category, shareVisibility: visibility });
    void fetch(`/${locale}/api/letters`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch((error) => {
      console.error("Letter quick submit failed", error);
    });
    window.location.href = `/${locale}/letters/sent`;
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block space-y-2 text-sm font-semibold text-[var(--ink)]">
        {locale === "ko" ? "닉네임 (선택)" : "Nickname (optional)"}
        <input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={32} className="h-12 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 outline-none focus:border-[var(--input-focus-border)]" />
      </label>
      <input type="hidden" name="shareVisibility" value={visibility} />
      <label className="block space-y-2 text-sm font-semibold text-[var(--ink)]">
        {locale === "ko" ? "분류" : "Category"}
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-12 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 outline-none focus:border-[var(--input-focus-border)]">
          {CATEGORY_OPTIONS[locale].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <p className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4 text-sm leading-6 text-[var(--ink-muted)]">
        {locale === "ko" ? "고민은 익명으로 전달됩니다. 빛 전달자가 성구를 골라 답변합니다. 카드뉴스가 도착하면 알림을 받습니다." : "Your concern is sent anonymously. A light bearer picks Scripture and answers. You will be notified when the card arrives."}
      </p>
      <label className="block space-y-2 text-sm font-semibold text-[var(--ink)]">
        {locale === "ko" ? "고민·고찰·질문" : "Concern, reflection, or question"}
        <textarea value={body} onChange={(event) => setBody(event.target.value)} required minLength={20} maxLength={1200} rows={9} placeholder={locale === "ko" ? "지금 마음에 있는 고민이나 생각을 적어주세요." : "Write what is weighing on your heart."} className="w-full resize-y rounded-2xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 leading-7 outline-none focus:border-[var(--input-focus-border)]" />
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className={`text-sm ${countClass}`}>{body.length}/1200</p>
        {message ? <p className="text-sm font-semibold text-red-700" role="alert">{message}</p> : null}
        <button type="submit" disabled={!canSubmit} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--gold-hover)] disabled:cursor-not-allowed disabled:opacity-50">
          <Send className="h-4 w-4" />
          {locale === "ko" ? "고민 보내기" : "Send concern"}
        </button>
      </div>
    </form>
  );
}

export function LetterReplyForm({
  locale,
  token,
  defaultScripture,
  scriptureSuggestions = [],
}: {
  locale: AppLocale;
  token: string;
  defaultScripture: string;
  scriptureSuggestions?: ScriptureSuggestion[];
}) {
  const suggestions = useMemo(
    () => normalizeReplyScriptureSuggestions(scriptureSuggestions, defaultScripture),
    [defaultScripture, scriptureSuggestions],
  );
  const [body, setBody] = useState("");
  const [nickname, setNickname] = useState("");
  const [scriptureRef, setScriptureRef] = useState(suggestions[0]?.reference ?? defaultScripture);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scriptureMode, setScriptureMode] = useState<ReplyScriptureMode>(suggestions.length > 0 ? "suggested" : "custom");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canSubmit = useMemo(() => body.trim().length >= 8 && body.length <= 1400 && scriptureRef.trim().length > 0, [body, scriptureRef]);
  const selectedSuggestion = suggestions[selectedIndex] ?? suggestions[0] ?? null;

  function chooseSuggestion(index: number) {
    const suggestion = suggestions[index];
    if (!suggestion) {
      return;
    }
    setSelectedIndex(index);
    setScriptureMode("suggested");
    setScriptureRef(suggestion.reference);
  }

  function moveSuggestion(delta: number) {
    if (suggestions.length === 0) {
      return;
    }
    const nextIndex = (selectedIndex + delta + suggestions.length) % suggestions.length;
    chooseSuggestion(nextIndex);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/${locale}/api/letters/reply/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body, responderNickname: nickname, scriptureRef }),
      });
      const result = await response.json() as { error?: string; readToken?: string };
      if (!response.ok || result.error || !result.readToken) {
        setMessage(errorMessage(result.error ?? "unknown", locale));
        return;
      }
      window.location.href = `/${locale}/letters/answer/${result.readToken}`;
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block space-y-2 text-sm font-semibold text-[var(--ink)]">
        {locale === "ko" ? "답변자 닉네임 (선택)" : "Responder nickname (optional)"}
        <input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={32} className="h-12 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 outline-none focus:border-[var(--input-focus-border)]" />
      </label>

      <section className="space-y-3 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[var(--ink)]">{locale === "ko" ? "함께 보낼 성구" : "Scripture to send"}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
              {locale === "ko"
                ? `시스템 추천 성구 ${suggestions.length}개 중 고르거나 직접 입력할 수 있습니다.`
                : `Choose from ${suggestions.length} system suggestions or enter your own reference.`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--input-bg)] p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setScriptureMode("suggested");
                if (selectedSuggestion) setScriptureRef(selectedSuggestion.reference);
              }}
              disabled={suggestions.length === 0}
              className={`min-h-10 rounded-lg px-3 transition disabled:cursor-not-allowed disabled:opacity-40 ${scriptureMode === "suggested" ? "bg-[var(--gold)] text-white" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
            >
              {locale === "ko" ? "추천 중 선택" : "Suggestions"}
            </button>
            <button
              type="button"
              onClick={() => setScriptureMode("custom")}
              className={`min-h-10 rounded-lg px-3 transition ${scriptureMode === "custom" ? "bg-[var(--gold)] text-white" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
            >
              {locale === "ko" ? "직접 입력" : "Custom"}
            </button>
          </div>
        </div>

        {scriptureMode === "suggested" && selectedSuggestion ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-[var(--gold-border)] bg-[var(--gold-soft)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold)]">
                    {locale === "ko" ? "추천 성구" : "Suggested Scripture"} {selectedIndex + 1}/{suggestions.length}
                  </p>
                  <h3 className="mt-2 text-xl font-bold text-[var(--ink)]">{selectedSuggestion.reference}</h3>
                </div>
                <span className="rounded-full border border-[var(--gold-border)] px-2 py-1 text-[11px] font-bold text-[var(--gold)]">
                  {selectedSuggestion.confidence}
                </span>
              </div>
              {selectedSuggestion.text ? <p className="mt-3 text-sm leading-6 text-[var(--ink)]">{selectedSuggestion.text}</p> : null}
              {selectedSuggestion.reason ? <p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">{selectedSuggestion.reason}</p> : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <button type="button" onClick={() => moveSuggestion(-1)} className="min-h-11 rounded-xl border border-[var(--hairline)] px-4 text-sm font-bold text-[var(--ink)] transition hover:border-[var(--gold-border)]">
                  {locale === "ko" ? "이전" : "Previous"}
                </button>
                <button type="button" onClick={() => moveSuggestion(1)} className="min-h-11 rounded-xl border border-[var(--hairline)] px-4 text-sm font-bold text-[var(--ink)] transition hover:border-[var(--gold-border)]">
                  {locale === "ko" ? "다음" : "Next"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.reference}
                    type="button"
                    onClick={() => chooseSuggestion(index)}
                    aria-label={locale === "ko" ? `${index + 1}번째 추천 성구 선택` : `Choose suggestion ${index + 1}`}
                    className={`h-2.5 w-7 rounded-full transition ${index === selectedIndex ? "bg-[var(--gold)]" : "bg-[var(--hairline)] hover:bg-[var(--gold-border)]"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <label className="block space-y-2 text-sm font-semibold text-[var(--ink)]">
            {locale === "ko" ? "직접 고른 성구" : "Custom Scripture"}
            <input
              value={scriptureRef}
              onChange={(event) => {
                setScriptureMode("custom");
                setScriptureRef(event.target.value);
              }}
              placeholder={locale === "ko" ? "예: 요한복음 3:16" : "Example: John 3:16"}
              className="h-12 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 outline-none focus:border-[var(--input-focus-border)]"
            />
          </label>
        )}
      </section>

      <label className="block space-y-2 text-sm font-semibold text-[var(--ink)]">
        {locale === "ko" ? "답변" : "Reply"}
        <textarea value={body} onChange={(event) => setBody(event.target.value)} required minLength={8} maxLength={1400} rows={9} placeholder={locale === "ko" ? "정답을 말하기보다, 읽고 마음에 남은 위로를 적어주세요." : "You do not need a perfect answer. Share the comfort that stayed with you."} className="w-full resize-y rounded-2xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 leading-7 outline-none focus:border-[var(--input-focus-border)]" />
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--ink-muted)]">{body.length}/1400</p>
        {message ? <p className="text-sm font-semibold text-red-700" role="alert">{message}</p> : null}
        <button type="submit" disabled={!canSubmit || isPending} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--gold-hover)] disabled:cursor-not-allowed disabled:opacity-50">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {locale === "ko" ? "답변 카드 보내기" : "Send reply card"}
        </button>
      </div>
    </form>
  );
}

export function RelayParticipationCTA({ locale }: { locale: AppLocale }) {
  const [status, setStatus] = useState<"idle" | "accepted" | "declined">("idle");
  const [isPending, startTransition] = useTransition();

  function accept() {
    startTransition(async () => {
      const response = await fetch(`/${locale}/api/letters/participants/relay-accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok || result.error) {
        return;
      }
      setStatus("accepted");
    });
  }

  if (status === "accepted") {
    return (
      <div className="rounded-[28px] border border-emerald-500/30 bg-emerald-500/10 p-6 text-[var(--ink)]">
        <CheckCircle2 className="h-8 w-8 text-emerald-700" />
        <h2 className="mt-4 text-2xl font-bold">{locale === "ko" ? "빛의 릴레이에 참여합니다" : "You joined the Light Relay"}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
          {locale === "ko" ? "다른 참여자의 고민이 오면 성구를 골라 답변을 보낼 수 있습니다. 언제든 설정에서 변경할 수 있습니다." : "When another participant's concern arrives, you can pick a Scripture and send comfort. You can change this anytime in settings."}
        </p>
        <a href={`/${locale}/letters/settings`} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--hairline)] px-4 py-2 text-sm font-bold text-[var(--ink)]">
          {locale === "ko" ? "설정 관리" : "Manage settings"}
        </a>
      </div>
    );
  }

  if (status === "declined") {
    return null;
  }

  return (
    <div className="rounded-[28px] border border-[var(--gold-border)] bg-[var(--gold-soft)] p-6">
      <h2 className="text-2xl font-bold text-[var(--ink)]">{locale === "ko" ? "당신이 받은 이 빛을 다음 사람에게 이어가시겠습니까?" : "Will you carry this light to the next person?"}</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
        {locale === "ko"
          ? "릴레이에 참여하면, 다른 사람의 익명 고민을 받게 되고, 성구를 고르고 위로의 답변을 보낼 수 있습니다. 이메일은 상대에게 공개되지 않습니다."
          : "When you join the relay, you will receive another person's anonymous concern. You can pick a Scripture and send comfort. Your email is never shown."}
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={accept} disabled={isPending} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--gold-hover)] disabled:cursor-not-allowed disabled:opacity-50">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {locale === "ko" ? "빛의 릴레이에 참여하기" : "Join the Light Relay"}
        </button>
        <button type="button" onClick={() => setStatus("declined")} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--hairline)] px-5 py-3 text-sm font-bold text-[var(--ink)] transition hover:border-[var(--gold-border)]">
          {locale === "ko" ? "지금은 괜찮습니다" : "Not right now"}
        </button>
      </div>
      <p className="mt-3 text-xs text-[var(--ink-muted)]">{locale === "ko" ? "언제든 설정에서 변경할 수 있습니다." : "You can change this anytime in settings."}</p>
    </div>
  );
}

export function LetterRelayJoinForm({ locale, participant, userEmail }: { locale: AppLocale; participant: ParticipantSummary | null; userEmail: string }) {
  const [canReceive, setCanReceive] = useState(participant?.canReceiveLetters === true);
  const [nickname, setNickname] = useState(participant?.nickname ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function joinRelay() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/${locale}/api/letters/participants/relay-accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const result = await response.json().catch(() => ({})) as { error?: string; participant?: ParticipantSummary };
      if (!response.ok || result.error) {
        setMessage(participantErrorMessage(result.error ?? "unknown", locale));
        return;
      }
      setMessage(locale === "ko" ? "빛의 릴레이에 참여합니다!" : "You joined the Light Relay!");
    });
  }

  function saveSettings() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/${locale}/api/letters/participants/settings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname, canReceiveLetters: canReceive }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; participant?: ParticipantSummary };
      if (!response.ok || result.error) {
        setMessage(participantErrorMessage(result.error ?? "unknown", locale));
        return;
      }
      setMessage(locale === "ko" ? "설정을 저장했습니다." : "Settings saved.");
    });
  }

  if (!participant) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-[var(--ink-muted)]">
          {locale === "ko" ? "아직 릴레이 참여자가 아닙니다. 아래 버튼으로 참여하세요." : "You are not yet a relay participant. Join below."}
        </p>
        <button type="button" onClick={joinRelay} disabled={isPending} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--gold)] px-8 py-3 text-sm font-bold text-white transition hover:bg-[var(--gold-hover)] disabled:cursor-not-allowed disabled:opacity-50">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {locale === "ko" ? "빛의 릴레이에 참여하기" : "Join the Light Relay"}
        </button>
        {message ? <p className="text-sm font-semibold text-[var(--ink)]" role="status">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-[var(--hairline)] bg-[var(--surface-1)] p-6">
        <p className="text-sm font-semibold text-[var(--gold)]">{userEmail}</p>
        <h2 className="mt-2 text-xl font-bold text-[var(--ink)]">{locale === "ko" ? "릴레이 설정" : "Relay settings"}</h2>
      </div>
      <label className="block space-y-2 text-sm font-semibold text-[var(--ink)]">
        {locale === "ko" ? "닉네임 (선택)" : "Nickname (optional)"}
        <input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={32} className="h-12 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 outline-none focus:border-[var(--input-focus-border)]" />
      </label>
      <label className="flex gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4 text-sm leading-6 text-[var(--ink)]">
        <input checked={canReceive} onChange={(event) => setCanReceive(event.target.checked)} type="checkbox" className="mt-1 h-4 w-4 accent-[var(--gold)]" />
        <span>
          <span className="block font-bold">{locale === "ko" ? "빛의 릴레이 참여" : "Light Relay participation"}</span>
          <span className="mt-1 block text-[var(--ink-muted)]">{locale === "ko" ? "다른 사람의 고민을 받고 성구를 골라 위로의 답변을 보냅니다." : "Receive another person's concern, pick a Scripture, and send comfort."}</span>
        </span>
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {message ? <p className="text-sm font-semibold text-[var(--ink)]" role="status">{message}</p> : <span />}
        <button type="button" onClick={saveSettings} disabled={isPending} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--gold-hover)] disabled:cursor-not-allowed disabled:opacity-50">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {locale === "ko" ? "설정 저장" : "Save settings"}
        </button>
      </div>
      <Link href={`/${locale}/letters/write`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--gold-hover)]">
        {locale === "ko" ? "고민 보내기" : "Send a concern"}
      </Link>
    </div>
  );
}
