import type { BibleReference } from "@/lib/bible";
import { buildPassageBackgroundPack, type PassageBackgroundPack } from "@/lib/background-pack";
import { formatReference, retrieveHybridPassageCandidates, type HybridPassageCandidate } from "@/lib/hybrid-retrieval";
import { rerankPassageCandidates } from "@/lib/passage-reranker";
import { understandQuestion, type QuestionUnderstanding, type TraditionKey } from "@/lib/question-understanding";
import type { RetrievalQueryPlan } from "@/lib/rag-query";

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

export type AnswerBundleOptions = {
  queryPlan?: RetrievalQueryPlan;
  expansionTerms?: string[];
  expansionSummary?: string;
  expansionProvider?: string;
};

export type PassageExplanation = {
  reference: BibleReference;
  displayReference: string;
  role: "primary" | "supporting" | "background";
  directness: "direct" | "supporting" | "background" | "weak";
  background: PassageBackgroundPack;
  passageClaim: {
    summary: string;
    keyLines: string[];
    answers: string;
  };
  userConnection: {
    promptFragment: string;
    matchedTerms: string[];
    matchedAxes: string[];
    connectionReason: string;
  };
  applicationBoundary: {
    helpsWith: string[];
    doesNotSettle: string[];
    caution?: string;
  };
};

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
    explanation: PassageExplanation;
  }>;
  passageExplanations: PassageExplanation[];
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
  if (!primary) return "low";

  const supportingCount = candidates
    .slice(1)
    .filter((candidate) => candidate.directness !== "weak" && candidate.finalScore >= Math.max(18, primary.finalScore * 0.38))
    .length;
  const evidenceCount = primary.matchedQueries.length + primary.matchedAxes.length;

  if (question.confidence === "low") {
    if (question.answerMode === "survey_bundle" && primary.finalScore >= 52 && supportingCount >= 2 && evidenceCount >= 2) return "medium";
    if (primary.finalScore >= 64 && primary.directness === "direct" && supportingCount >= 1 && evidenceCount >= 2) return "medium";
    return "low";
  }

  if (question.answerMode === "survey_bundle" && supportingCount >= 3 && primary.finalScore >= 40) return "high";
  if (question.answerMode === "wisdom_principle" && primary.finalScore >= 30 && evidenceCount >= 1) return "medium";
  if (primary.finalScore >= 60 || (primary.directness === "direct" && supportingCount >= 1 && evidenceCount >= 1)) return "high";
  if (primary.finalScore >= 32 || (supportingCount >= 2 && evidenceCount >= 1)) return "medium";
  return "low";
}

function relationAnswer(question: QuestionUnderstanding, candidate: HybridPassageCandidate) {
  if (candidate.unit.summary) return candidate.unit.summary;
  if (question.locale === "ko") return candidate.directness === "direct" ? "질문의 중심 주제를 직접 다룹니다." : "질문을 성경의 더 넓은 문맥 안에서 보조합니다.";
  return candidate.directness === "direct" ? "Directly addresses the question's central concern." : "Supports the question within a wider biblical context.";
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

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function promptFragment(question: QuestionUnderstanding, candidate: HybridPassageCandidate) {
  const matched = candidate.matchedQueries[0] ?? candidate.matchedAxes[0];
  if (matched) return matched;
  return question.normalized || question.searchQueries[0] || (question.locale === "ko" ? "사용자 질문의 중심 고민" : "the user's central concern");
}

function passageKeyLines(candidate: HybridPassageCandidate) {
  const text = (candidate.unit.text ?? candidate.unit.excerpt ?? "").replace(/\s+/g, " ").trim();
  if (!text) return [];
  const firstSentence = text.split(/(?<=[.!?。！？])\s+/u)[0] ?? text;
  return [firstSentence.slice(0, 220)];
}

function passageAnswers(question: QuestionUnderstanding, candidate: HybridPassageCandidate) {
  if (candidate.unit.questionsAnswered?.length) return candidate.unit.questionsAnswered.slice(0, 2).join("; ");
  if (candidate.directness === "direct") return relationAnswer(question, candidate);
  return question.locale === "ko"
    ? "질문에 직접 결론을 주기보다 중심 본문을 보강하거나 배경을 제공합니다."
    : "It supports or backgrounds the primary answer rather than settling the question by itself.";
}

function connectionReason(question: QuestionUnderstanding, candidate: HybridPassageCandidate) {
  const terms = candidate.matchedQueries.slice(0, 4);
  const axes = candidate.matchedAxes.slice(0, 4);
  if (question.locale === "ko") {
    if (terms.length && axes.length) return `사용자의 표현(${terms.join(", ")})과 본문 주제축(${axes.join(", ")})이 함께 맞물립니다.`;
    if (terms.length) return `사용자의 표현(${terms.join(", ")})이 본문 색인의 언어와 직접 만납니다.`;
    if (axes.length) return `질문의 개념축(${axes.join(", ")})이 본문의 신학/삶의 축과 만납니다.`;
    return "직접 단어 겹침은 약하지만, 보조 배경 본문으로 질문을 더 넓은 성경 문맥에 둡니다.";
  }
  if (terms.length && axes.length) return `The user's wording (${terms.join(", ")}) and the passage axes (${axes.join(", ")}) meet together.`;
  if (terms.length) return `The user's wording (${terms.join(", ")}) directly matches indexed passage language.`;
  if (axes.length) return `The question axes (${axes.join(", ")}) meet the passage's theological or human-concern axes.`;
  return "Direct wording overlap is weak, so this passage should be treated as background context.";
}

function applicationBoundary(question: QuestionUnderstanding, candidate: HybridPassageCandidate): PassageExplanation["applicationBoundary"] {
  const helpsWith = unique([
    ...candidate.matchedAxes,
    ...question.concernAxes,
    question.locale === "ko" ? "성경적 관점 형성" : "forming a biblical perspective",
  ]).slice(0, 5);
  const doesNotSettle = question.answerMode === "wisdom_principle"
    ? [question.locale === "ko" ? "구체적 선택을 대신 결정하지 않습니다." : "It does not decide the concrete choice for the user."]
    : candidate.directness === "background" || candidate.directness === "weak"
      ? [question.locale === "ko" ? "중심 결론을 단독으로 세우기에는 보조 본문에 가깝습니다." : "It does not establish the central conclusion by itself."]
      : [question.locale === "ko" ? "모든 개인 상황의 세부 결론을 자동으로 대신 내려 주지는 않습니다." : "It does not automatically decide every detail of the user's situation."];

  return {
    helpsWith,
    doesNotSettle,
    caution: relationLimit(question, candidate),
  };
}

function buildPassageExplanation(question: QuestionUnderstanding, candidate: HybridPassageCandidate, role: PassageExplanation["role"]): PassageExplanation {
  return {
    reference: candidate.unit.reference,
    displayReference: formatReference(candidate.unit.reference),
    role,
    directness: candidate.directness,
    background: buildPassageBackgroundPack(candidate, question.locale),
    passageClaim: {
      summary: relationAnswer(question, candidate),
      keyLines: passageKeyLines(candidate),
      answers: passageAnswers(question, candidate),
    },
    userConnection: {
      promptFragment: promptFragment(question, candidate),
      matchedTerms: candidate.matchedQueries.slice(0, 8),
      matchedAxes: candidate.matchedAxes.slice(0, 8),
      connectionReason: connectionReason(question, candidate),
    },
    applicationBoundary: applicationBoundary(question, candidate),
  };
}

function buildRelationMap(question: QuestionUnderstanding, candidates: HybridPassageCandidate[]): AnswerBundle["relationMap"] {
  return candidates.map((candidate, index) => {
    const explanation = buildPassageExplanation(question, candidate, index === 0 ? "primary" : candidate.directness === "background" || candidate.directness === "weak" ? "background" : "supporting");
    return {
      reference: explanation.displayReference,
      answers: explanation.passageClaim.answers,
      userConnection: explanation.userConnection.connectionReason,
      limits: explanation.applicationBoundary.caution,
      explanation,
    };
  });
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
  void question;
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

function enrichQuestionWithExpansion(
  question: QuestionUnderstanding,
  options: AnswerBundleOptions,
): QuestionUnderstanding {
  if (options.queryPlan) return options.queryPlan.question;

  const expansionTerms = unique(options.expansionTerms ?? []);
  const expansionSummary = options.expansionSummary?.trim();
  if (!expansionTerms.length && !expansionSummary) return question;

  const searchQueries = unique([
    ...question.searchQueries,
    ...(expansionSummary ? [expansionSummary] : []),
    ...expansionTerms,
  ]);
  const hasGenericFallbackAxes =
    question.intent === "biblical_context" &&
    question.theologicalAxes.length === 2 &&
    question.theologicalAxes.includes("Bible") &&
    question.theologicalAxes.includes("discernment");
  const confidence =
    question.confidence === "low" &&
    question.answerMode === "direct_bible_answer" &&
    expansionTerms.length >= 2
      ? "medium"
      : question.confidence;

  return {
    ...question,
    theologicalAxes: hasGenericFallbackAxes && expansionTerms.length ? [] : question.theologicalAxes,
    searchQueries,
    confidence,
  };
}

export async function buildAnswerBundle(prompt: string, locale?: string, options: AnswerBundleOptions = {}): Promise<AnswerBundle | null> {
  const question = enrichQuestionWithExpansion(understandQuestion(prompt, locale), options);
  if (!BUNDLE_ELIGIBLE_MODES[question.answerMode]) return null;

  const rawCandidates = await retrieveHybridPassageCandidates(question);
  const candidates = rerankPassageCandidates(question, rawCandidates, 8);
  const confidence = confidenceFor(question, candidates);
  const primary = candidates[0];
  if (!primary || confidence === "low") return null;

  const supportLimit = question.answerMode === "survey_bundle" ? 5 : 4;
  const supporting = candidates.slice(1, supportLimit + 1);
  const bundleCandidates = [primary, ...supporting];
  const doctrinePresentation = buildDoctrinePresentation(question, bundleCandidates);
  const relationMap = buildRelationMap(question, bundleCandidates);

  return {
    question,
    primary,
    supporting,
    confidence,
    answerPolicy: question.answerMode,
    relationMap,
    passageExplanations: relationMap.map((relation) => relation.explanation),
    crossReferenceSupport: buildCrossReferenceSupport(bundleCandidates),
    doctrinePresentation,
  };
}

export function answerBundleReferences(bundle: AnswerBundle): BibleReference[] {
  return [bundle.primary, ...bundle.supporting].map((candidate) => candidate.unit.reference);
}
