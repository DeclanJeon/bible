import { getBookMetadata } from "@/lib/book-metadata";
import type { BibleReference } from "@/lib/bible";
import { routeFaithQuestion, type FaithQuestionAnswer as RoutedFaithQuestionAnswer } from "@/lib/faith-question-router";
import {
  FAITH_RESOURCES,
  type AppLocale,
  type FaithPassage,
  type FaithQuestionNode,
  type FaithResource,
} from "@/lib/faith-resources";
import { generateFaithQuestionWithHermes, type FaithQuestionEvidence, type FaithQuestionGeneration } from "@/lib/faith-question-hermes";
import { buildPassageRecommendation, type PassageRecommendationBuild } from "@/lib/passage-response";
import { searchGotQuestionsRag, type GotQuestionsRagCoverage } from "@/lib/gotquestions-rag";
import { parseBibleReferences } from "@/lib/bible-reference-parser";

export type FaithQuestionAnswerMeta = {
  mode: "ai-grounded-rag" | "rag-deterministic" | "deterministic-link-router" | "unsupported";
  aiUsed: boolean;
  bibleRagUsed: boolean;
  evidenceLocked: boolean;
  externalBodyFetched: false;
  externalBodyStored: false;
  matchedCount: number;
  retrievalConfidence?: string;
  retrievalMode?: string;
  generationProvider?: string;
  generationModel?: string;
  generationNote?: string;
  gotQuestionsRag: {
    used: boolean;
    indexVersion: string | null;
    matchedCount: number;
    coverage: GotQuestionsRagCoverage;
    bodyFetched: false;
    bodyStored: false;
    articles: Array<{
      id: string;
      titleKo: string;
      url: string;
      categoryIds: string[];
      references: Array<{ key: string; label: string }>;
    }>;
  };
};

export type GroundedFaithQuestionAnswer = RoutedFaithQuestionAnswer & {
  biblicalDirection?: string;
  passageReasons?: Array<{ passageKey: string; reason: string }>;
  resourceReasons?: Array<{ resourceId: string; reason: string }>;
  meta: FaithQuestionAnswerMeta;
};

type BuildFaithQuestionAnswerInput = {
  query: string;
  locale?: string | null;
  acceptLanguage?: string | null;
  countryCode?: string | null;
};

type ScoredResource = {
  resource: FaithResource;
  score: number;
};

const MAX_RESOURCE_RESULTS = 6;
const MAX_PASSAGE_RESULTS = 10;

function normalizeLocale(locale: string | null | undefined): AppLocale {
  return locale === "en" ? "en" : "ko";
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
}

function queryTerms(query: string) {
  return [...new Set(normalizeText(query).split(" ").filter((term) => term.length >= 2))];
}

function referenceKey(reference: BibleReference) {
  return `${reference.code}-${reference.chapter}-${reference.startVerse}-${reference.endVerse}`;
}

function formatReferenceLabel(reference: BibleReference, locale: AppLocale) {
  const bookTitle = getBookMetadata(reference.code, locale)?.title ?? reference.code;
  const verses = reference.startVerse === reference.endVerse ? `${reference.startVerse}` : `${reference.startVerse}-${reference.endVerse}`;
  return `${bookTitle} ${reference.chapter}:${verses}`;
}

function passageFromReference(reference: BibleReference, locale: AppLocale, note: string): FaithPassage {
  return {
    label: formatReferenceLabel(reference, locale),
    reference,
    note: { ko: note, en: note },
  };
}

function uniquePassages(passages: FaithPassage[]) {
  const seen = new Set<string>();
  const result: FaithPassage[] = [];
  for (const passage of passages) {
    const key = referenceKey(passage.reference);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(passage);
  }
  return result.slice(0, MAX_PASSAGE_RESULTS);
}

function uniqueResourcesById(resources: FaithResource[]) {
  const seen = new Set<string>();
  const result: FaithResource[] = [];
  for (const resource of resources) {
    if (seen.has(resource.id)) continue;
    seen.add(resource.id);
    result.push(resource);
  }
  return result.slice(0, MAX_RESOURCE_RESULTS);
}

function resourceSearchText(resource: FaithResource, locale: AppLocale) {
  return normalizeText([
    resource.title,
    resource.source,
    resource.kind,
    resource.level,
    resource.topics.join(" "),
    resource.questions[locale].join(" "),
    resource.questions[locale === "ko" ? "en" : "ko"].join(" "),
    resource.summary[locale],
    resource.summary[locale === "ko" ? "en" : "ko"],
  ].join(" "));
}

function scoreResource(resource: FaithResource, locale: AppLocale, terms: string[], routedIds: Set<string>) {
  let score = routedIds.has(resource.id) ? 8 : 0;
  const title = normalizeText(resource.title);
  const localizedQuestions = normalizeText(resource.questions[locale].join(" "));
  const topics = normalizeText(resource.topics.join(" "));
  const summary = normalizeText(resource.summary[locale]);
  const searchText = resourceSearchText(resource, locale);

  for (const term of terms) {
    if (title.includes(term)) score += 4;
    if (localizedQuestions.includes(term)) score += 4;
    if (topics.includes(term)) score += 3;
    if (summary.includes(term)) score += 2;
    if (searchText.includes(term)) score += 1;
  }
  if (resource.language === locale) score += 1;
  return score;
}

export function searchFaithResources(query: string, locale: AppLocale, routedResources: FaithResource[]) {
  const terms = queryTerms(query);
  const routedIds = new Set(routedResources.map((resource) => resource.id));
  const scored: ScoredResource[] = FAITH_RESOURCES.map((resource) => ({
    resource,
    score: scoreResource(resource, locale, terms, routedIds),
  }));
  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.resource.id.localeCompare(b.resource.id))
    .map((item) => item.resource)
    .slice(0, MAX_RESOURCE_RESULTS);
}

function buildBiblePassages(locale: AppLocale, bible: PassageRecommendationBuild) {
  const passages: FaithPassage[] = [];
  if (bible.recommendation.primary) {
    passages.push(passageFromReference(bible.recommendation.primary.reference, locale, bible.recommendation.primary.reason));
  }
  for (const related of bible.recommendation.relatedPassages) {
    passages.push(passageFromReference(related.reference, locale, related.reason));
  }
  return passages;
}

function buildEvidencePassages(locale: AppLocale, bible: PassageRecommendationBuild): FaithQuestionEvidence["bible"]["passages"] {
  const passages: FaithQuestionEvidence["bible"]["passages"] = [];
  if (bible.recommendation.primary) {
    passages.push({
      key: referenceKey(bible.recommendation.primary.reference),
      label: formatReferenceLabel(bible.recommendation.primary.reference, locale),
      reference: bible.recommendation.primary.reference,
      text: bible.recommendation.primary.text,
      reason: bible.recommendation.primary.reason,
    });
  }
  for (const detail of bible.relatedPassageDetails) {
    passages.push({
      key: referenceKey(detail.reference),
      label: detail.referenceLabel || formatReferenceLabel(detail.reference, locale),
      reference: detail.reference,
      text: detail.excerpt,
      reason: detail.reason,
    });
  }
  const seen = new Set<string>();
  return passages.filter((passage) => {
    if (seen.has(passage.key)) return false;
    seen.add(passage.key);
    return true;
  }).slice(0, MAX_PASSAGE_RESULTS);
}

function buildIntentSummary(locale: AppLocale, routed: RoutedFaithQuestionAnswer, bible: PassageRecommendationBuild) {
  const topic = routed.matches[0]?.question.title[locale];
  const normalized = bible.questionUnderstanding.normalized;
  if (topic) {
    return locale === "ko" ? `질문은 “${topic}” 주제와 ${normalized} 흐름에 가깝습니다.` : `The question is closest to “${topic}” and the ${normalized} thread.`;
  }
  return normalized;
}

function buildEvidence(
  query: string,
  locale: AppLocale,
  routed: RoutedFaithQuestionAnswer,
  bible: PassageRecommendationBuild,
  resources: FaithResource[],
): FaithQuestionEvidence {
  return {
    locale,
    query,
    intentSummary: buildIntentSummary(locale, routed, bible),
    bible: {
      state: bible.recommendation.state,
      confidence: bible.recommendation.confidence,
      retrievalMode: bible.retrieval.retrievalMode,
      passages: buildEvidencePassages(locale, bible),
      explanation: bible.recommendation.explanation,
    },
    resources,
    matches: routed.matches.map((match) => ({
      title: match.question.title[locale],
      shortAnswer: match.question.shortAnswer[locale],
      matchedTerms: match.matchedTerms,
    })),
    policy: {
      externalBodyFetched: false,
      externalBodyStored: false,
      citeOnlyProvidedEvidence: true,
      doNotInventBibleReferences: true,
      doNotSummarizeUnprovidedExternalBodies: true,
    },
  };
}

function deterministicSummary(locale: AppLocale, routed: RoutedFaithQuestionAnswer, bible: PassageRecommendationBuild) {
  const bibleDirection = bible.recommendation.explanation?.whyThisPassage;
  if (bible.recommendation.state === "direct" && bibleDirection) {
    return locale === "ko" ? `${routed.summary} 성경 RAG는 ${bibleDirection}` : `${routed.summary} The Bible RAG adds: ${bibleDirection}`;
  }
  return routed.summary;
}

function deterministicCaveat(locale: AppLocale, bible: PassageRecommendationBuild) {
  const base = locale === "ko"
    ? "이 답변은 성경 본문과 선별된 링크로 이동하기 위한 안내입니다. AI가 독립 권위로 답하지 않으며, 외부 글 전문을 저장하거나 대신 재배포하지 않습니다."
    : "This answer guides you toward Scripture and curated source links. AI is not used as an independent authority, and external article bodies are neither stored nor republished.";
  if (bible.recommendation.clarifyPrompt) return `${base} ${bible.recommendation.clarifyPrompt}`;
  return base;
}

function applyGeneration(
  locale: AppLocale,
  routed: RoutedFaithQuestionAnswer,
  generation: FaithQuestionGeneration | null,
  bible: PassageRecommendationBuild,
) {
  if (!generation) {
    return {
      summary: deterministicSummary(locale, routed, bible),
      caveat: deterministicCaveat(locale, bible),
      biblicalDirection: bible.recommendation.explanation?.whyThisPassage,
      passageReasons: undefined,
      resourceReasons: undefined,
      nextQuestions: routed.nextQuestions,
    };
  }
  return {
    summary: generation.summary,
    caveat: generation.caveat,
    biblicalDirection: generation.biblicalDirection,
    passageReasons: generation.passageReasons,
    resourceReasons: generation.resourceReasons,
    nextQuestions: generation.nextQuestions.length ? generation.nextQuestions : routed.nextQuestions,
  };
}

function isUnsupported(bible: PassageRecommendationBuild) {
  return bible.recommendation.state === "unsupported" && !bible.recommendation.primary;
}

function uniqueReferences(references: BibleReference[]) {
  const seen = new Set<string>();
  const result: BibleReference[] = [];
  for (const reference of references) {
    const key = referenceKey(reference);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(reference);
  }
  return result;
}

export async function buildFaithQuestionAnswer(input: BuildFaithQuestionAnswerInput): Promise<GroundedFaithQuestionAnswer> {
  const locale = normalizeLocale(input.locale);
  const query = input.query.trim();
  const routed = routeFaithQuestion({ query, locale });
  const bible = await buildPassageRecommendation(query, {
    locale,
    acceptLanguage: input.acceptLanguage ?? undefined,
    countryCode: input.countryCode ?? undefined,
    includeRelatedPassageDetails: true,
    includeExternalResources: false,
  });
  const gotQuestionsReferences = uniqueReferences([
    ...parseBibleReferences(query),
    ...(bible.recommendation.primary ? [bible.recommendation.primary.reference] : []),
    ...bible.recommendation.relatedPassages.map((passage) => passage.reference),
  ]);
  const gotQuestions = searchGotQuestionsRag(query, locale, gotQuestionsReferences);
  const resources = searchFaithResources(query, locale, routed.resources);
  const mergedResources = uniqueResourcesById([...gotQuestions.resources.slice(0, 3), ...(resources.length ? resources : routed.resources), ...gotQuestions.resources.slice(3)]);
  const evidence = buildEvidence(query, locale, routed, bible, mergedResources);
  const generation = isUnsupported(bible) ? null : await generateFaithQuestionWithHermes(evidence);
  const generated = generation?.generated ?? null;
  const answerText = applyGeneration(locale, routed, generated, bible);
  const passages = uniquePassages([...gotQuestions.passages, ...routed.passages, ...buildBiblePassages(locale, bible)]);
  const mode: FaithQuestionAnswerMeta["mode"] = generated
    ? "ai-grounded-rag"
    : bible.answerBundle || bible.recommendation.primary
      ? "rag-deterministic"
      : isUnsupported(bible)
        ? "unsupported"
        : "deterministic-link-router";

  return {
    ...routed,
    summary: answerText.summary,
    caveat: answerText.caveat,
    passages,
    resources: mergedResources,
    nextQuestions: answerText.nextQuestions,
    biblicalDirection: answerText.biblicalDirection,
    passageReasons: answerText.passageReasons,
    resourceReasons: answerText.resourceReasons,
    meta: {
      mode,
      aiUsed: Boolean(generated),
      bibleRagUsed: Boolean(bible.answerBundle || bible.recommendation.primary),
      evidenceLocked: true,
      externalBodyFetched: false,
      externalBodyStored: false,
      matchedCount: routed.matches.length,
      retrievalConfidence: bible.retrieval.confidence,
      retrievalMode: bible.retrieval.retrievalMode,
      generationProvider: generation?.provider,
      generationModel: generation?.model,
      generationNote: generation?.note,
      gotQuestionsRag: {
        used: gotQuestions.used,
        indexVersion: gotQuestions.indexVersion,
        matchedCount: gotQuestions.matchedCount,
        coverage: gotQuestions.coverage,
        bodyFetched: false,
        bodyStored: false,
        articles: gotQuestions.hits.map((hit) => ({
          id: hit.article.id,
          titleKo: hit.article.titleKo,
          url: hit.article.url,
          categoryIds: hit.article.categoryIds,
          references: hit.article.references.slice(0, 4).map((reference) => ({
            key: referenceKey(reference),
            label: formatReferenceLabel(reference, locale),
          })),
        })),
      },
    },
  };
}

export type { FaithQuestionNode };
