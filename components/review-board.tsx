"use client";

import { FormEvent, useState, useTransition } from "react";
import type { AnonymousReview } from "@/lib/reviews";
import type { AppLocale } from "@/lib/content";

type ReviewBoardCopy = {
  formLabel: string;
  placeholder: string;
  submit: string;
  posting: string;
  empty: string;
  anonymous: string;
  helper: string;
  success: string;
  invalid: string;
};

export function ReviewBoard({
  locale,
  initialReviews,
  copy,
}: {
  locale: AppLocale;
  initialReviews: AnonymousReview[];
  copy: ReviewBoardCopy;
}) {
  const [reviews, setReviews] = useState(initialReviews);
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const endpoint = `/${locale}/api/reviews`;

  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body, website }),
      });

      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const error = payload && typeof payload === "object" && "error" in payload ? String(payload.error) : copy.invalid;
        setMessage(error);
        return;
      }

      const payload: { review: AnonymousReview } = await response.json();
      setReviews((current) => [payload.review, ...current].slice(0, 50));
      setBody("");
      setWebsite("");
      setMessage(copy.success);
    });
  }

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_320px] lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-4">
        {reviews.length ? (
          reviews.map((review) => (
            <article key={review.id} className="glass rounded-2xl p-5 lg:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
                <span className="font-semibold text-[var(--gold)]">{copy.anonymous}</span>
                <time dateTime={review.createdAt}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(review.createdAt))}</time>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-[var(--text)]">{review.body}</p>
            </article>
          ))
        ) : (
          <div className="glass rounded-2xl p-6 text-base leading-8 text-[var(--muted)]">{copy.empty}</div>
        )}
      </section>

      <aside className="glass h-fit rounded-2xl p-6 lg:sticky lg:top-28">
        <form onSubmit={submitReview} className="space-y-4">
          <label htmlFor="review-body" className="block text-sm font-semibold tracking-tight text-[var(--ink)]">
            {copy.formLabel}
          </label>
          <textarea
            id="review-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={copy.placeholder}
            minLength={10}
            maxLength={1200}
            required
            rows={8}
            className="w-full resize-none rounded-xl border border-[var(--hairline-strong)] bg-[var(--surface-2)] px-4 py-3 text-base leading-7 text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--focus-ring)]"
          />
          <label className="sr-only" htmlFor="review-website">Website</label>
          <input
            id="review-website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            className="hidden"
            aria-hidden="true"
          />
          <p className="text-sm leading-6 text-[var(--muted)]">{copy.helper}</p>
          {message ? <p className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--muted)]">{message}</p> : null}
          <button
            type="submit"
            disabled={isPending}
            className="w-full min-h-[44px] rounded-xl bg-[var(--gold)] px-5 py-3.5 text-sm font-semibold text-[var(--canvas)] transition hover:bg-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? copy.posting : copy.submit}
          </button>
        </form>
      </aside>
    </div>
  );
}
