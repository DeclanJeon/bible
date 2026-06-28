"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpenText, ExternalLink, Loader2, Search } from "lucide-react";

import { buildBibleReferenceHref } from "@/lib/navigation";
import type { AppLocale, FaithBibleReference } from "@/lib/faith-resources";

type ApiPassage = {
  label: string;
  reference: FaithBibleReference;
  note: Record<AppLocale, string>;
};

type ApiResource = {
  id: string;
  title: string;
  href: string;
  source: string;
  kind: string;
  level: string;
  summary: Record<AppLocale, string>;
};

type ApiMatch = {
  question: {
    id: string;
    title: Record<AppLocale, string>;
  };
  score: number;
  matchedTerms: string[];
};
type ApiReason = {
  passageKey?: string;
  resourceId?: string;
  reason: string;
};


type FaithQuestionResponse = {
  summary: string;
  caveat: string;
  matches: ApiMatch[];
  passages: ApiPassage[];
  resources: ApiResource[];
  nextQuestions: string[];
  biblicalDirection?: string;
  passageReasons?: ApiReason[];
  resourceReasons?: ApiReason[];
  meta: {
    mode: string;
    aiUsed: boolean;
    bibleRagUsed: boolean;
    evidenceLocked: boolean;
    externalBodyFetched: boolean;
    externalBodyStored: boolean;
    matchedCount: number;
    retrievalConfidence?: string;
    retrievalMode?: string;
    gotQuestionsRag?: {
      used: boolean;
      indexVersion: string | null;
      matchedCount: number;
      coverage: string;
      bodyFetched: boolean;
      bodyStored: boolean;
      articles?: Array<{
        id: string;
        titleKo: string;
        url: string;
        categoryIds: string[];
        references: Array<{ key: string; label: string }>;
      }>;
    };
  };
};

const EXAMPLES: Record<AppLocale, string[]> = {
  ko: ["천국은 죽어서 가는 곳인가요?", "성경은 신화인가요?", "신앙 없이도 살 수 있지 않나요?"],
  en: ["Is heaven simply where we go after death?", "Is the Bible just mythology?", "Can people live without faith?"],
};

function localizedHref(href: string, locale: AppLocale) {
  return href.startsWith("/") ? `/${locale}${href}` : href;
}

function isInternalHref(href: string) {
  return href.startsWith("/");
}
function reasonForResource(answer: FaithQuestionResponse, resourceId: string) {
  return answer.resourceReasons?.find((item) => item.resourceId === resourceId)?.reason;
}


function gotQuestionsResources(answer: FaithQuestionResponse) {
  const articleIds = new Set(answer.meta.gotQuestionsRag?.articles?.map((article) => article.id) ?? []);
  return answer.resources.filter((resource) => articleIds.has(resource.id) || resource.source === "GotQuestions");
}

function nonGotQuestionsResources(answer: FaithQuestionResponse) {
  const gotQuestionsIds = new Set(gotQuestionsResources(answer).map((resource) => resource.id));
  return answer.resources.filter((resource) => !gotQuestionsIds.has(resource.id));
}
export function FaithQuestionForm({ locale }: { locale: AppLocale }) {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<FaithQuestionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const examples = useMemo(() => EXAMPLES[locale], [locale]);

  async function submitQuestion(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      setError(locale === "ko" ? "질문을 입력해 주세요." : "Please enter a question.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/faith-questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: trimmed, locale }),
      });
      const data = (await response.json()) as FaithQuestionResponse | { error?: string };

      if (!response.ok) {
        setAnswer(null);
        setError("error" in data && data.error ? data.error : locale === "ko" ? "질문을 처리하지 못했습니다." : "Could not process the question.");
        return;
      }

      setAnswer(data as FaithQuestionResponse);
    } catch {
      setAnswer(null);
      setError(locale === "ko" ? "네트워크 오류가 발생했습니다." : "A network error occurred.");
    } finally {
      setIsLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitQuestion(query);
  }

  return (
    <section id="ask" className="mt-8 rounded-3xl border border-[var(--gold)]/20 bg-[var(--surface-2)] p-5 sm:p-7">
      <div className="section-title">{locale === "ko" ? "질문 도우미" : "Question helper"}</div>
      <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(320px,1.08fr)]">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
            {locale === "ko" ? "질문하면 성경 본문과 자료 링크로 연결합니다" : "Ask and get routed to Scripture and source links"}
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)] sm:text-base">
            {locale === "ko"
              ? "이 기능은 외부 글 전문을 가져오거나 저장하지 않습니다. 질문을 주제에 맞춰 분류하고, 짧은 방향·성경 본문·원문 링크를 보여줍니다."
              : "This feature does not fetch or store external article bodies. It classifies the question and returns a short direction, Bible passages, and source links."}
          </p>
          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <label htmlFor="faith-question-input" className="sr-only">
              {locale === "ko" ? "신앙 질문" : "Faith question"}
            </label>
            <textarea
              id="faith-question-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              rows={4}
              maxLength={1000}
              placeholder={locale === "ko" ? "예: 천국은 죽어서 가는 곳인가요?" : "Example: Is heaven simply where we go after death?"}
              className="w-full rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] px-4 py-3 text-sm leading-6 text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-muted)] focus:border-[var(--gold)]/50"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-4 py-2.5 text-sm font-semibold text-[var(--canvas)] transition hover:bg-[var(--gold-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
                {locale === "ko" ? "질문하기" : "Ask"}
              </button>
              <span className="text-xs text-[var(--ink-muted)]">{query.length}/1000</span>
            </div>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setQuery(example);
                  void submitQuestion(example);
                }}
                className="rounded-full border border-[var(--hairline)] bg-[var(--surface-1)] px-3 py-2 text-xs font-medium text-[var(--ink-muted)] transition hover:border-[var(--gold)]/40 hover:text-[var(--ink)]"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-5" aria-live="polite">
          {error ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
          {!answer && !error ? (
            <div className="text-sm leading-7 text-[var(--muted)]">
              {locale === "ko" ? "질문 결과가 여기에 표시됩니다." : "Question results will appear here."}
            </div>
          ) : null}
          {answer ? (
            <div className="space-y-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--gold)]">{locale === "ko" ? "짧은 답" : "Short answer"}</div>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{answer.summary}</p>
                <p className="mt-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] p-3 text-xs leading-5 text-[var(--ink-muted)]">{answer.caveat}</p>
                {answer.biblicalDirection ? (
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{answer.biblicalDirection}</p>
                ) : null}
                <p className="mt-3 text-[11px] leading-5 text-[var(--ink-muted)]">
                  {locale === "ko"
                    ? `${answer.meta.aiUsed ? "AI 근거 안내" : "근거 기반 라우팅"} · 성경 RAG ${answer.meta.bibleRagUsed ? "사용" : "보류"} · 외부 전문 저장 없음`
                    : `${answer.meta.aiUsed ? "AI evidence guide" : "Grounded routing"} · Bible RAG ${answer.meta.bibleRagUsed ? "used" : "paused"} · no external body storage`}
                </p>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--gold)]">{locale === "ko" ? "성경으로 확인하기" : "Check in Scripture"}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {answer.passages.map((passage) => (
                    <Link
                      key={`${passage.label}-${passage.reference.code}`}
                      href={buildBibleReferenceHref(passage.reference, { locale, from: "faith-questions" })}
                      title={passage.note[locale]}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface-2)] px-3 py-2 text-xs font-medium text-[var(--ink-muted)] transition hover:border-[var(--gold)]/40 hover:text-[var(--gold)]"
                    >
                      <BookOpenText className="h-3.5 w-3.5" aria-hidden="true" />
                      {passage.label}
                    </Link>
                  ))}
                </div>
                {answer.passageReasons?.length ? (
                  <ul className="mt-3 space-y-2 text-xs leading-5 text-[var(--ink-muted)]">
                    {answer.passageReasons.map((item) => (
                      <li key={`${item.passageKey}-${item.reason}`}>• {item.reason}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {answer.meta.gotQuestionsRag?.used ? (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--gold)]">
                    {locale === "ko" ? "GotQuestions Korean 관련 문답" : "Related GotQuestions Korean Q&A"}
                  </div>
                  <div className="mt-3 grid gap-2">
                    {(answer.meta.gotQuestionsRag.articles ?? []).slice(0, 3).map((article) => (
                      <a
                        key={article.id}
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--ink-muted)] transition hover:border-[var(--gold)]/40 hover:text-[var(--ink)]"
                      >
                        <span className="flex items-center justify-between gap-3 font-medium">
                          <span>{article.titleKo}</span>
                          <ExternalLink className="h-3.5 w-3.5 flex-none text-[var(--gold)]" aria-hidden="true" />
                        </span>
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          {article.categoryIds.slice(0, 3).map((categoryId) => (
                            <span key={categoryId} className="rounded-full border border-[var(--hairline)] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-[var(--ink-muted)]">
                              {categoryId}
                            </span>
                          ))}
                          {article.references.slice(0, 4).map((reference) => (
                            <span key={reference.key} className="rounded-full border border-[var(--gold)]/25 px-2 py-1 text-[10px] text-[var(--gold)]">
                              {reference.label}
                            </span>
                          ))}
                        </span>
                      </a>
                    ))}
                    {(answer.meta.gotQuestionsRag.articles?.length ?? 0) > 3 ? (
                      <details>
                        <summary className="cursor-pointer rounded-xl border border-[var(--hairline)] px-3 py-2 text-xs font-semibold text-[var(--gold)]">
                          {locale === "ko" ? `GotQuestions 문답 ${(answer.meta.gotQuestionsRag.articles?.length ?? 0) - 3}개 더 보기` : `Show ${(answer.meta.gotQuestionsRag.articles?.length ?? 0) - 3} more GotQuestions articles`}
                        </summary>
                        <div className="mt-2 grid gap-2">
                          {(answer.meta.gotQuestionsRag.articles ?? []).slice(3).map((article) => (
                            <a key={article.id} href={article.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] px-3 py-2.5 text-sm font-medium text-[var(--ink-muted)] transition hover:border-[var(--gold)]/40 hover:text-[var(--ink)]">
                              {article.titleKo}
                              <ExternalLink className="h-3.5 w-3.5 flex-none text-[var(--gold)]" aria-hidden="true" />
                            </a>
                          ))}
                        </div>
                      </details>
                    ) : null}
                    <p className="text-xs leading-5 text-[var(--ink-muted)]">
                      {locale === "ko"
                        ? "GotQuestions Ministries 원문 전문은 외부 링크에서 확인하세요. 이 앱은 제목, 링크, 분류, 성구 연결만 보관합니다."
                        : "Read the full GotQuestions Ministries source through the external link. This app stores only title, link, category, and Scripture-link metadata."}
                    </p>
                  </div>
                </div>
              ) : null}

              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--gold)]">{locale === "ko" ? "더 깊게 보기" : "Go deeper"}</div>
                <div className="mt-3 grid gap-2">
                  {nonGotQuestionsResources(answer).slice(0, 3).map((resource) => {
                    const href = localizedHref(resource.href, locale);
                    const reason = reasonForResource(answer, resource.id);
                    const content = (
                      <>
                        <span>
                          {resource.title}
                          {reason ? <span className="mt-1 block text-xs font-normal leading-5 text-[var(--ink-muted)]">{reason}</span> : null}
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 flex-none text-[var(--gold)]" aria-hidden="true" />
                      </>
                    );
                    const className = "flex items-center justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] px-3 py-2.5 text-sm font-medium text-[var(--ink-muted)] transition hover:border-[var(--gold)]/40 hover:text-[var(--ink)]";

                    return isInternalHref(resource.href) ? (
                      <Link key={resource.id} href={href} className={className}>
                        {content}
                      </Link>
                    ) : (
                      <a key={resource.id} href={href} target="_blank" rel="noopener noreferrer" className={className}>
                        {content}
                      </a>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--gold)]">{locale === "ko" ? "다음 질문" : "Next questions"}</div>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted)]">
                  {answer.nextQuestions.map((nextQuestion) => (
                    <li key={nextQuestion}>• {nextQuestion}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
