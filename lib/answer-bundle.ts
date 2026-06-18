import type { BibleReference } from "@/lib/bible";
import { formatReference, retrieveHybridPassageCandidates, type HybridPassageCandidate } from "@/lib/hybrid-retrieval";
import { rerankPassageCandidates } from "@/lib/passage-reranker";
import { understandQuestion, type QuestionUnderstanding } from "@/lib/question-understanding";
import type { TraditionKey } from "@/lib/question-understanding";


export type DoctrineDisplayMode = "shared_core_only" | "shared_core_plus_views" | "tradition_requested";

export type SharedCoreBlock = {
  summary: string;
  evidenceRefs: string[];
  confidence: "high" | "medium" | "low";
  limits?: string;
};

export type TraditionViewBlock = {
  tradition: TraditionKey;
  label: string;
  summary: string;
  emphasis: string;
  evidenceRefs: string[];
  doctrineSourceRefs: string[];
  confidence: "high" | "medium" | "low";
  limits?: string;
};

export type DoctrinePresentation = {
  topic: string;
  divergence: "low" | "medium" | "high";
  mode: DoctrineDisplayMode;
  sharedCore: SharedCoreBlock;
  views: TraditionViewBlock[];
  requestedTradition?: TraditionKey;
};

export type AnswerPolicy = QuestionUnderstanding["answerMode"];

export type AnswerBundle = {
  question: QuestionUnderstanding;
  primary: HybridPassageCandidate;
  supporting: HybridPassageCandidate[];
  confidence: "high" | "medium" | "low";
  answerPolicy: AnswerPolicy;
  relationMap: Array<{
    reference: string;
    answers: string;
    userConnection: string;
    limits?: string;
  }>;
  crossReferenceSupport: Array<{
    from: string;
    to: string;
    supportLabel: string;
  }>;
  doctrinePresentation?: DoctrinePresentation;
};

const BUNDLE_ELIGIBLE_MODES: Record<QuestionUnderstanding["answerMode"], true | undefined> = {
  direct_bible_answer: true,
  survey_bundle: true,
  wisdom_principle: true,
  pastoral_care: true,
  safety_first: true,
  clarify_with_starters: undefined,
  limited_answer: undefined,
};

function confidenceFor(question: QuestionUnderstanding, candidates: HybridPassageCandidate[]): AnswerBundle["confidence"] {
  const primary = candidates[0];
  if (!primary || question.confidence === "low") return "low";
  if (question.answerMode === "survey_bundle" && candidates.length >= 3 && primary.finalScore >= 42) return "high";
  if (question.answerMode === "wisdom_principle" && primary.finalScore >= 30) return "medium";
  if (primary.finalScore >= 62 || (primary.directness === "direct" && candidates.length >= 2)) return "high";
  if (primary.finalScore >= 28 || candidates.length >= 2) return "medium";
  return "low";
}

function relationAnswer(question: QuestionUnderstanding, candidate: HybridPassageCandidate) {
  if (candidate.unit.summary) return candidate.unit.summary;
  if (question.locale === "ko") return candidate.directness === "direct" ? "질문의 중심 주제를 직접 다룹니다." : "질문을 성경의 더 넓은 문맥 안에서 보조합니다.";
  return candidate.directness === "direct" ? "Directly addresses the question's central concern." : "Supports the question within a wider biblical context.";
}

function relationConnection(question: QuestionUnderstanding, candidate: HybridPassageCandidate) {
  if (candidate.matchedAxes.length) {
    return question.locale === "ko"
      ? `질문의 축(${candidate.matchedAxes.join(", ")})과 연결됩니다.`
      : `Connects to the question axes: ${candidate.matchedAxes.join(", ")}.`;
  }
  if (candidate.matchedQueries.length) {
    return question.locale === "ko"
      ? `검색 표현(${candidate.matchedQueries.slice(0, 4).join(", ")})과 본문 색인이 만났습니다.`
      : `Matches indexed terms: ${candidate.matchedQueries.slice(0, 4).join(", ")}.`;
  }
  return question.locale === "ko" ? "질문과 간접적으로 연결되는 배경 본문입니다." : "Provides background for the question.";
}

function relationLimit(question: QuestionUnderstanding, candidate: HybridPassageCandidate) {
  if (question.answerMode === "wisdom_principle") {
    return question.locale === "ko"
      ? "이 본문은 원칙을 주지만 회사·구매·메뉴 같은 구체적 선택을 대신 결정하지 않습니다."
      : "This passage gives a principle; it does not decide the concrete job, purchase, or menu choice for the user.";
  }
  if (candidate.directness === "background" || candidate.directness === "weak") {
    return question.locale === "ko" ? "중심 답변이 아니라 보조 배경으로만 사용해야 합니다." : "Use as supporting background, not as the central answer.";
  }
  return undefined;
}

function buildRelationMap(question: QuestionUnderstanding, candidates: HybridPassageCandidate[]): AnswerBundle["relationMap"] {
  return candidates.map((candidate) => ({
    reference: formatReference(candidate.unit.reference),
    answers: relationAnswer(question, candidate),
    userConnection: relationConnection(question, candidate),
    limits: relationLimit(question, candidate),
  }));
}

function buildCrossReferenceSupport(candidates: HybridPassageCandidate[]): AnswerBundle["crossReferenceSupport"] {
  const [primary, ...supporting] = candidates;
  if (!primary) return [];
  return supporting.slice(0, 4).map((candidate) => ({
    from: formatReference(primary.unit.reference),
    to: formatReference(candidate.unit.reference),
    supportLabel: candidate.matchedAxes.length ? candidate.matchedAxes.join(", ") : candidate.directness,
  }));
}

function buildTraditionViews(question: QuestionUnderstanding): TraditionViewBlock[] {
  void question; // will be used when doctrine-source-index is integrated
  return [];
}

function buildDoctrinePresentation(
  question: QuestionUnderstanding,
  candidates: HybridPassageCandidate[]
): DoctrinePresentation | undefined {
  if (question.intent !== "doctrine" || !question.doctrineDivergence) return undefined;

  const mode: DoctrineDisplayMode =
    question.doctrineDivergence === "tradition_requested"
      ? "tradition_requested"
      : question.doctrineDivergence === "divergent"
        ? "shared_core_plus_views"
        : "shared_core_only";

  const primary = candidates[0];
  if (!primary) return undefined;

  const divergence: DoctrinePresentation["divergence"] =
    mode === "shared_core_only" ? "low" : mode === "shared_core_plus_views" ? "medium" : "low";

  const sharedCore: SharedCoreBlock = {
    summary: question.locale === "ko"
      ? "이 주제에 대해 성경이 직접 말하는 핵심 내용입니다."
      : "This is the direct biblical core on this topic.",
    evidenceRefs: candidates.slice(0, 3).map((c) => formatReference(c.unit.reference)),
    confidence: "high",
    limits: question.locale === "ko"
      ? "이 내용은 성경 본문에 근거한 공통 핵심입니다. 교파별 해석 차이는 아래에서 확인하세요."
      : "This is common biblical ground. Tradition-specific differences are shown below.",
  };

  const views: TraditionViewBlock[] = mode !== "shared_core_only" ? buildTraditionViews(question) : [];

  return {
    topic: question.doctrineTopic ?? question.normalized,
    divergence,
    mode,
    sharedCore,
    views,
    requestedTradition: question.requestedTradition,
  };
}

export async function buildAnswerBundle(prompt: string, locale?: string): Promise<AnswerBundle | null> {
  const question = understandQuestion(prompt, locale);
  if (!BUNDLE_ELIGIBLE_MODES[question.answerMode]) return null;

  const rawCandidates = await retrieveHybridPassageCandidates(question).catch((error: unknown) => {
    if (error instanceof Error && /(passage-index|no such file|ENOENT|Invalid Bible passage index)/i.test(error.message)) return [];
    throw error;
  });
  const candidates = rerankPassageCandidates(question, rawCandidates, 8);
  const confidence = confidenceFor(question, candidates);
  const primary = candidates[0];
  if (!primary || confidence === "low") return null;

  const supportLimit = question.answerMode === "survey_bundle" ? 5 : 4;
  const supporting = candidates.slice(1, supportLimit + 1);
  const bundleCandidates = [primary, ...supporting];
  const doctrinePresentation = buildDoctrinePresentation(question, bundleCandidates);

  return {
    question,
    primary,
    supporting,
    confidence,
    answerPolicy: question.answerMode,
    relationMap: buildRelationMap(question, bundleCandidates),
    crossReferenceSupport: buildCrossReferenceSupport(bundleCandidates),
    doctrinePresentation,
  };
}

export function answerBundleReferences(bundle: AnswerBundle): BibleReference[] {
  return [bundle.primary, ...bundle.supporting].map((candidate) => candidate.unit.reference);
}
