import { getPassage, type BibleReference } from "@/lib/bible";
import { getBookMetadata } from "@/lib/book-metadata";
import type { AnswerBundle, PassageExplanation } from "@/lib/answer-bundle";
import { resolveAppLocale, type AppLocale } from "@/lib/content";
import { getPassageCrossReferences, type CrossReferenceSuggestion } from "@/lib/knowledge";
import { buildBibleReferenceHref } from "@/lib/navigation";
import {
  buildLocalPassageBackground,
  summarizeBackgroundPack,
  type PassageBackgroundSummary,
  type PassageYoutubeResource,
  withCachedYoutubeResources,
} from "@/lib/passage-background";
import { buildRagQueryPlan, type RetrievalQueryPlan } from "@/lib/rag-query";
import { isRetrievalReliable, retrieveClusterForPrompt, type RetrievalResult } from "@/lib/retrieval";
import { type QuestionUnderstanding, understandQuestion } from "@/lib/question-understanding";
import { assessPromptSafety, type SafetyAssessment } from "@/lib/safety";

export type RecommendationState = "direct" | "tentative" | "unsupported" | "safety_first";

export type RelatedPassageRecommendation = {
  reference: BibleReference;
  reason: string;
  relation: "crossref" | "theme" | "echo" | "support";
  href: string;
};

export type PassageExternalResources = {
  youtube: PassageYoutubeResource[];
};

export type PassageRecommendationResponse = {
  state: RecommendationState;
  prompt: string;
  normalizedQuestion: string;
  confidence: "high" | "medium" | "low";
  primary: {
    reference: BibleReference;
    text: string;
    reason: string;
    score: number;
  } | null;
  explanation: {
    userConcernSummary: string;
    connectionToUser: string;
    whyThisPassage: string;
    limits?: string;
  } | null;
  background: PassageBackgroundSummary | null;
  relatedPassages: RelatedPassageRecommendation[];
  readerHref: string | null;
  externalResources?: PassageExternalResources;
  clarifyPrompt?: string | null;
};

export type PassageRecommendationBuild = {
  recommendation: PassageRecommendationResponse;
  safety: SafetyAssessment;
  questionUnderstanding: QuestionUnderstanding;
  ragQuery: RetrievalQueryPlan;
  retrieval: RetrievalResult;
  answerBundle: AnswerBundle | null;
  primaryPassage: Awaited<ReturnType<typeof getPassage>> | null;
  relatedPassageDetails: Array<RelatedPassageRecommendation & { title: string; referenceLabel: string; excerpt: string }>;
};

function referenceKey(reference: BibleReference) {
  return `${reference.code}-${reference.chapter}-${reference.startVerse}-${reference.endVerse}`;
}

function formatReferenceLabel(reference: BibleReference, locale: AppLocale) {
  const bookTitle = getBookMetadata(reference.code, locale)?.title ?? reference.code;
  const verseLabel = reference.startVerse === reference.endVerse
    ? `${reference.chapter}:${reference.startVerse}`
    : `${reference.chapter}:${reference.startVerse}-${reference.endVerse}`;
  return `${bookTitle} ${verseLabel}`;
}

function responseConfidence(answerBundle: AnswerBundle | null, retrieval: RetrievalResult): PassageRecommendationResponse["confidence"] {
  return answerBundle?.confidence ?? retrieval.confidence;
}

function safetyFirst(question: QuestionUnderstanding, safety: SafetyAssessment) {
  return question.answerMode === "safety_first" || safety.level === "crisis";
}

function unsupportedQuestion(question: QuestionUnderstanding) {
  return (
    question.intent === "external_fact" ||
    question.intent === "empty_or_nonsense" ||
    question.answerMode === "limited_answer" ||
    question.answerMode === "clarify_with_starters"
  );
}

function relationType(explanation: PassageExplanation["role"]): RelatedPassageRecommendation["relation"] {
  switch (explanation) {
    case "supporting":
      return "support";
    case "background":
      return "echo";
    default:
      return "theme";
  }
}

function clarifyPrompt(locale: AppLocale, question: QuestionUnderstanding) {
  if (question.answerMode === "limited_answer" || question.intent === "external_fact") {
    return locale === "ko"
      ? "이 요청은 성경 본문으로 직접 답할 수 있는 범위를 벗어나 있으므로, 낮은 신뢰도 상태로 중심 본문을 확정하지 않고 추천을 보류합니다. 사실 정보나 실시간 정보는 다른 도구로 확인해야 합니다."
      : "This request is outside what the companion can answer directly from scripture, so it stays low-confidence, withholds any primary passage, and pauses recommendation. Factual or real-time information should be checked with another tool.";
  }

  if (question.answerMode === "clarify_with_starters" || question.intent === "empty_or_nonsense") {
    return locale === "ko"
      ? "지금 입력만으로는 낮은 신뢰도 상태라 중심 본문을 확정하지 않고 추천을 보류합니다. 감정, 상황, 혹은 묻고 싶은 핵심 문장을 한 문장으로 더 구체적으로 적어 주세요."
      : "With the current input the companion stays low-confidence, withholds any primary passage, and pauses recommendation. Narrow the prompt to one sentence that names the feeling, situation, or core question more concretely.";
  }

  return locale === "ko"
    ? "질문을 조금 더 구체적으로 적으면 더 직접 연결되는 성구를 찾을 수 있습니다."
    : "A slightly more specific prompt will help the companion find a more directly connected passage.";
}

function normalizeForRepeat(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function joinLines(...values: Array<string | undefined>) {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const normalized = normalizeForRepeat(trimmed);
    if (normalized && seen.has(normalized)) continue;
    seen.add(normalized);
    parts.push(trimmed);
  }

  return parts.join(" ");
}
function questionContextSummary(locale: AppLocale, question: QuestionUnderstanding) {
  const axes = [...question.concernAxes, ...question.theologicalAxes].filter(Boolean).join(", ");
  return joinLines(
    question.original,
    axes ? (locale === "ko" ? `질문 축: ${axes}` : `Question axes: ${axes}`) : undefined,
  );
}

async function buildRelatedDetails(
  locale: AppLocale,
  supportingReferences: BibleReference[],
  graphSuggestions: CrossReferenceSuggestion[],
  answerBundle: AnswerBundle | null,
  includePassageDetails: boolean,
) {
  const related: RelatedPassageRecommendation[] = [];
  const seen = new Set<string>();
  const relationByKey = new Map(
    (answerBundle?.relationMap ?? []).map((relation) => [referenceKey(relation.explanation.reference), relation] as const),
  );

  for (const reference of supportingReferences) {
    const key = referenceKey(reference);
    if (seen.has(key)) continue;
    seen.add(key);
    const relation = relationByKey.get(key);
    const reason = relation
      ? joinLines(relation.answers, relation.userConnection, relation.limits)
      : locale === "ko"
        ? "메인 성구를 보강하는 보조 본문입니다."
        : "Supporting passage that strengthens the main text.";
    const explanationRole = relation?.explanation.role ?? "supporting";
    related.push({
      reference,
      reason,
      relation: relationType(explanationRole),
      href: buildBibleReferenceHref(reference, { locale, from: "companion" }),
    });
  }

  for (const suggestion of graphSuggestions) {
    const key = referenceKey(suggestion.target);
    if (seen.has(key)) continue;
    seen.add(key);
    related.push({
      reference: suggestion.target,
      reason: joinLines(suggestion.supportLabel, suggestion.supportLine) || suggestion.excerpt,
      relation: suggestion.supportType === "phrase-anchor" ? "echo" : "crossref",
      href: buildBibleReferenceHref(suggestion.target, { locale, from: "crossref" }),
    });
  }

  return Promise.all(
    related.slice(0, 6).map(async (item) => {
      const relation = relationByKey.get(referenceKey(item.reference));
      if (relation) {
        return {
          ...item,
          title: getBookMetadata(item.reference.code, locale)?.title ?? item.reference.code,
          referenceLabel: relation.explanation.displayReference,
          excerpt: relation.explanation.passageClaim.keyLines.join(" ") || relation.answers,
        };
      }
      if (!includePassageDetails) {
        return {
          ...item,
          title: getBookMetadata(item.reference.code, locale)?.title ?? item.reference.code,
          referenceLabel: formatReferenceLabel(item.reference, locale),
          excerpt: "",
        };
      }
      const passage = await getPassage(item.reference, locale);
      return {
        ...item,
        title: passage.book?.name ?? item.reference.code,
        referenceLabel: passage.reference,
        excerpt: passage.verses.map((verse) => `${verse.verse}. ${verse.text}`).join(" "),
      };
    }),
  );
}

function primaryExplanation(bundle: AnswerBundle | null) {
  return bundle?.passageExplanations[0] ?? null;
}

function buildBundleExplanation(
  locale: AppLocale,
  question: QuestionUnderstanding,
  explanation: PassageExplanation,
): PassageRecommendationResponse["explanation"] {
  return {
    userConcernSummary: questionContextSummary(locale, question),
    connectionToUser: joinLines(explanation.userConnection.promptFragment, explanation.userConnection.connectionReason),
    whyThisPassage: joinLines(explanation.passageClaim.summary, locale === "ko" ? `질문 핵심: ${question.normalized}` : `Question focus: ${question.normalized}`),
    limits: joinLines(explanation.applicationBoundary.caution, ...explanation.applicationBoundary.doesNotSettle),
  };
}

function buildFallbackExplanation(
  locale: AppLocale,
  question: QuestionUnderstanding,
  retrieval: RetrievalResult,
  reliable: boolean,
): PassageRecommendationResponse["explanation"] {
  const matchedTerms = retrieval.reasons.passageKeywords.join(", ");
  const semanticTerms = retrieval.reasons.semanticTerms.join(", ");
  return {
    userConcernSummary: questionContextSummary(locale, question),
    connectionToUser: retrieval.rationale,
    whyThisPassage:
      matchedTerms || semanticTerms
        ? joinLines(
            matchedTerms ? (locale === "ko" ? `본문 자체의 직접 단서: ${matchedTerms}` : `Text-level cues: ${matchedTerms}`) : undefined,
            semanticTerms ? (locale === "ko" ? `질문 핵심어와 이어지는 주제: ${semanticTerms}` : `Query concepts connected to the text: ${semanticTerms}`) : undefined,
          )
        : retrieval.rationale,
    limits: reliable
      ? undefined
      : locale === "ko"
        ? "아직 약한 매칭이므로, 질문을 더 구체적으로 적어 본문 연결을 다시 확인하는 편이 좋습니다."
        : "This match is still tentative, so narrowing the prompt would make the passage connection safer.",
  };
}

async function buildBackgroundWithResources(
  locale: AppLocale,
  prompt: string,
  primaryRef: BibleReference,
  background: PassageBackgroundSummary,
) {
  return withCachedYoutubeResources(background, primaryRef, { locale, prompt });
}

export async function buildPassageRecommendation(
  prompt: string,
  options: {
    locale?: string;
    acceptLanguage?: string;
    countryCode?: string;
    includeRelatedPassageDetails?: boolean;
    includeExternalResources?: boolean;
  } = {},
): Promise<PassageRecommendationBuild> {
  const locale = resolveAppLocale(options.locale);
  const normalizedPrompt = prompt.trim() || (locale === "ko" ? "성경 본문을 찾고 싶어요." : "Help me find a Bible passage.");
  const safety = assessPromptSafety(normalizedPrompt, {
    requestedLocale: locale,
    acceptLanguage: options.acceptLanguage,
    countryCode: options.countryCode,
  });
  const ragQuery = await buildRagQueryPlan(normalizedPrompt, locale);
  const retrieval = await retrieveClusterForPrompt(normalizedPrompt, locale, { queryPlan: ragQuery });
  const answerBundle = retrieval.answerBundle ?? null;
  const questionUnderstanding = retrieval.question ?? answerBundle?.question ?? understandQuestion(normalizedPrompt, locale);
  const reliable = isRetrievalReliable(retrieval);
  const primaryRef = retrieval.primaryReference;
  const bundleExplanation = primaryExplanation(answerBundle);

  let state: RecommendationState;
  if (safetyFirst(questionUnderstanding, safety)) {
    state = "safety_first";
  } else if (unsupportedQuestion(questionUnderstanding) && !reliable) {
    state = "unsupported";
  } else if (answerBundle || reliable) {
    state = "direct";
  } else if (primaryRef) {
    state = "tentative";
  } else {
    state = "unsupported";
  }
  const suppressTentativePrimary = state === "tentative" && questionUnderstanding.intent === "everyday_wisdom";

  const primaryPassage = state === "unsupported" || suppressTentativePrimary ? null : await getPassage(primaryRef, locale);
  const supportingReferences =
    state === "direct" || state === "safety_first"
      ? retrieval.supportingReferences
      : [];
  const includeRelatedPassageDetails = options.includeRelatedPassageDetails !== false;
  const graphSuggestionLimit = Math.max(0, 4 - supportingReferences.length);
  const graphSuggestions =
    primaryRef && (state === "direct" || state === "safety_first") && graphSuggestionLimit > 0
      ? await getPassageCrossReferences(primaryRef, graphSuggestionLimit, locale)
      : [];
  const relatedPassageDetails = await buildRelatedDetails(locale, supportingReferences, graphSuggestions, answerBundle, includeRelatedPassageDetails);
  const backgroundBase =
    state === "unsupported" || suppressTentativePrimary || !primaryPassage
      ? null
      : bundleExplanation
        ? summarizeBackgroundPack(bundleExplanation.background, locale)
        : await buildLocalPassageBackground(primaryRef, locale);
  const background =
    backgroundBase && options.includeExternalResources !== false
      ? await buildBackgroundWithResources(locale, normalizedPrompt, primaryRef, backgroundBase)
      : backgroundBase;
  const primary =
    state === "unsupported" || suppressTentativePrimary || !primaryPassage
      ? null
      : {
          reference: primaryRef,
          text: primaryPassage.verses.map((verse) => `${verse.verse}. ${verse.text}`).join(" "),
          reason: answerBundle?.primary.reason ?? retrieval.rationale,
          score: answerBundle?.primary.finalScore ?? retrieval.score,
        };
  const explanation =
    state === "unsupported"
      ? null
      : bundleExplanation
        ? buildBundleExplanation(locale, questionUnderstanding, bundleExplanation)
        : buildFallbackExplanation(locale, questionUnderstanding, retrieval, reliable);
  const relatedPassages = relatedPassageDetails.map(({ reference, reason, relation, href }) => ({
    reference,
    reason,
    relation,
    href,
  }));
  const externalResources: PassageExternalResources = {
    youtube: background?.youtubeResources ?? [],
  };
  const readerHref =
    primary && !suppressTentativePrimary && (state === "direct" || state === "tentative" || state === "safety_first")
      ? buildBibleReferenceHref(primary.reference, { locale, from: "companion" })
      : null;

  return {
    recommendation: {
      state,
      prompt: normalizedPrompt,
      normalizedQuestion: questionUnderstanding.normalized,
      confidence: responseConfidence(answerBundle, retrieval),
      primary,
      explanation,
      background,
      relatedPassages,
      readerHref,
      clarifyPrompt: state === "direct" ? null : clarifyPrompt(locale, questionUnderstanding),
      externalResources,
    },
    safety,
    questionUnderstanding,
    ragQuery,
    retrieval,
    answerBundle,
    primaryPassage,
    relatedPassageDetails,
  };
}
