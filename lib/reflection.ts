import { getPassage, type BibleReference } from "@/lib/bible";
import type { StoryCluster } from "@/lib/app-data";
import { localizeRelationTypeLabel, resolveAppLocale } from "@/lib/content";
import { isRetrievalReliable, type RetrievalResult } from "@/lib/retrieval";
import type { CrossReferenceSuggestion } from "@/lib/knowledge";

export type EvidencePassage = {
  title: string;
  reference: string;
  excerpt: string;
};

export type ReflectionResponse = {
  concernSummary: string;
  relevanceSummary: string;
  whyTheseTexts: string;
  primaryStory: string;
  datePlaceAudience: string;
  originalAudience: string;
  linkedScriptures: string;
  jesusAndPaul: string;
  personalConnection: string;
  reflectionQuestions: string[];
  evidence: EvidencePassage[];
  generationMode: "deterministic" | "hermes" | "hermes-agent" | "hermes-fallback";
  generationModel: string;
  generationNote: string;
};

function preview(text: string, max = 220) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

async function buildEvidence(reference: BibleReference, locale?: string): Promise<EvidencePassage> {
  const passage = await getPassage(reference, locale);
  return {
    title: passage.book?.name ?? reference.code,
    reference: passage.reference,
    excerpt: preview(passage.verses.map((verse) => `${verse.verse}. ${verse.text}`).join(" ")),
  };
}

type ReflectionOptions = {
  retrieval?: RetrievalResult;
  graphSuggestions?: CrossReferenceSuggestion[];
  primaryReference?: BibleReference;
  supportingReferences?: BibleReference[];
};

export async function buildReflectionResponse(
  cluster: StoryCluster,
  prompt: string,
  locale?: string,
  options: ReflectionOptions = {},
): Promise<ReflectionResponse> {
  const appLocale = resolveAppLocale(locale);
  const primaryReference = options.primaryReference ?? cluster.primary;
  const supportingReferences = options.supportingReferences ?? cluster.supporting;
  const evidence = await Promise.all([buildEvidence(primaryReference, appLocale), ...supportingReferences.map((reference) => buildEvidence(reference, appLocale))]);
  const concernTerms = (cluster.emotions.length ? cluster.emotions : cluster.themes).join(", ");
  const expansionReferences = evidence.slice(1).map((item) => item.reference);
  const linkedLine =
    options.graphSuggestions && options.graphSuggestions.length > 0
      ? options.graphSuggestions
          .slice(0, 3)
          .map((suggestion) => `${suggestion.displayReference} (${suggestion.supportLine ?? suggestion.supportLabel})`)
          .join("; ")
      : cluster.linkedTexts.length > 0
        ? cluster.linkedTexts.map((text) => `${text.label} (${localizeRelationTypeLabel(text.type, appLocale)})`).join("; ")
        : null;
  const retrieval = options.retrieval;
  const scoreLine = retrieval
    ? appLocale === "ko"
      ? `매칭 점수 ${retrieval.score.toFixed(2)} · 본문 점수 ${retrieval.passageScore.toFixed(2)} · 신뢰도 ${retrieval.confidence}`
      : `Match score ${retrieval.score.toFixed(2)} · passage score ${retrieval.passageScore.toFixed(2)} · confidence ${retrieval.confidence}`
    : null;
  const directMatchedTerms = retrieval?.reasons.passageKeywords.length ? retrieval.reasons.passageKeywords.join(", ") : "";
  const matchedTerms = directMatchedTerms || concernTerms;
  const rationale = retrieval?.rationale ?? "";
  const primaryEvidence = evidence[0];
  const reliableRetrieval = retrieval ? isRetrievalReliable(retrieval) : true;

  if (!reliableRetrieval) {
    if (appLocale === "ko") {
      const weakTerms = directMatchedTerms ? `현재 잡힌 단어는 ${directMatchedTerms} 정도입니다.` : "현재 직접 잡힌 본문 단어가 충분하지 않습니다.";
      return {
        concernSummary: `입력한 질문 “${prompt}”에 정확히 연결되는 중심 본문을 아직 확정하지 않았습니다. 자동 후보가 있더라도 최종 추천 본문처럼 단정하지 않습니다.`,
        relevanceSummary: scoreLine ? `${scoreLine}. ${rationale || "직접 겹치는 본문 근거가 부족합니다."}` : "직접 겹치는 본문 근거가 부족합니다.",
        whyTheseTexts: `${weakTerms} 그래서 ${primaryEvidence.reference}는 확정된 답이 아니라 검토 후보입니다. 사용자 입력의 핵심 표현과 본문 문장이 더 분명히 만나는 경우에만 핵심 본문으로 승격해야 합니다.`,
        primaryStory: `검토 후보는 ${primaryEvidence.reference}입니다. 본문 일부는 “${primaryEvidence.excerpt}”입니다. 다만 이 후보가 질문을 직접 다룬다고 단정하지 말고, 더 구체적인 고민 표현으로 다시 검색하는 편이 안전합니다.`,
        datePlaceAudience: `${primaryEvidence.title}의 책 배경은 보조 정보입니다. ${cluster.context.date.body} ${cluster.context.place.body}`,
        originalAudience: `${cluster.context.audience.body} 현재 단계에서는 원청중 설명보다 먼저, 이 본문이 정말 사용자의 질문과 같은 문제를 말하는지 확인해야 합니다.`,
        linkedScriptures: "중심 본문 신뢰도가 낮기 때문에 상호참조 확장은 보류합니다. 잘못 고른 본문에서 연결 본문을 넓히면 관련 없는 성구가 더 많이 따라올 수 있습니다.",
        jesusAndPaul: `${cluster.jesusLayer.body} ${cluster.paulLayer.body}`,
        personalConnection: `이번 매칭은 낮은 신뢰도입니다. 이 본문을 바로 개인 상황에 적용하지 말고, 입력을 더 구체화하거나 다른 후보 본문과 비교한 뒤 읽어야 합니다.`,
        reflectionQuestions: [
          `내 질문의 핵심은 감정, 상황, 교리 질문 중 무엇인가요?`,
          `${primaryEvidence.reference}의 실제 문장이 내 질문의 어떤 표현과 직접 만나는지 확인할 수 있나요?`,
          `더 정확한 본문을 찾기 위해 어떤 단어를 빼거나 추가해야 하나요?`,
        ],
        evidence,
        generationMode: "deterministic",
        generationModel: "deterministic-reflection-builder",
        generationNote: "낮은 신뢰도 검색을 핵심 본문으로 단정하지 않는 결정형 응답입니다.",
      };
    }

    const weakTerms = directMatchedTerms ? `The current matched terms are only ${directMatchedTerms}.` : "There are not enough direct passage terms yet.";
    return {
      concernSummary: `For the prompt “${prompt}”, no primary passage has been confirmed as a direct match yet. Any automatic candidate should be treated as tentative, not as the final recommended text.`,
      relevanceSummary: scoreLine ? `${scoreLine}. ${rationale || "Direct passage evidence is weak."}` : "Direct passage evidence is weak.",
      whyTheseTexts: `${weakTerms} Therefore ${primaryEvidence.reference} is only a review candidate. A passage should be promoted to primary only when the user's wording and the passage wording or concepts meet more clearly.`,
      primaryStory: `The review candidate is ${primaryEvidence.reference}. Its excerpt is “${primaryEvidence.excerpt}”. Do not treat it as a direct answer until the prompt is narrowed or a stronger candidate is found.`,
      datePlaceAudience: `Book context is secondary here: ${cluster.context.date.body} ${cluster.context.place.body}`,
      originalAudience: `${cluster.context.audience.body} At this stage, first test whether this passage is addressing the same issue as the prompt.`,
      linkedScriptures: "Cross-reference expansion is paused because the primary match is weak; expanding from a weak primary can amplify unrelated passages.",
      jesusAndPaul: `${cluster.jesusLayer.body} ${cluster.paulLayer.body}`,
      personalConnection: "This is a low-confidence match. Do not apply this passage directly to the personal situation without narrowing the prompt or comparing stronger candidates.",
      reflectionQuestions: [
        "Is the prompt mainly naming an emotion, a situation, or a doctrinal question?",
        `Which exact words in ${primaryEvidence.reference} connect to the prompt?`,
        "Which words should be removed or added to search more accurately?",
      ],
      evidence,
      generationMode: "deterministic",
      generationModel: "deterministic-reflection-builder",
      generationNote: "Deterministic response that refuses to promote low-confidence retrieval as a primary answer.",
    };
  }

  const answerBundle = retrieval?.answerBundle;
  if (answerBundle) {
    const relationLines = answerBundle.relationMap.map((relation) => `${relation.reference}: ${relation.answers} ${relation.userConnection}`);
    const supportLine = relationLines.slice(1).join(" ");
    if (appLocale === "ko") {
      const policyLabel = answerBundle.answerPolicy === "wisdom_principle"
        ? "성경이 구체적 선택을 대신 결정하지는 않지만, 판단을 세우는 지혜 원칙으로 답합니다"
        : answerBundle.answerPolicy === "safety_first"
          ? "안전을 먼저 확인한 뒤, 가까이 계시는 하나님과 소망의 본문으로 답합니다"
          : answerBundle.answerPolicy === "pastoral_care"
            ? "고민을 목회적 돌봄 질문으로 이해하고, 위로와 방향을 주는 본문 묶음으로 답합니다"
            : "넓은 질문이므로 한 구절만 단정하지 않고 성경 본문 묶음으로 답합니다";
      return {
        concernSummary: `질문 “${prompt}”을(를) “${answerBundle.question.normalized}”로 이해했습니다. ${policyLabel}.`,
        relevanceSummary: scoreLine ? `${scoreLine}. ${answerBundle.primary.reason}` : answerBundle.primary.reason,
        whyTheseTexts: `${primaryEvidence.reference}를 중심 본문으로 두고, ${supportLine || "보조 본문 없이 중심 본문만"}을 함께 읽도록 묶었습니다. 이 묶음은 질문 축(${[...answerBundle.question.concernAxes, ...answerBundle.question.theologicalAxes].join(", ") || "본문 근거"})을 따라 선택되었습니다.`,
        primaryStory: `중심 본문은 ${primaryEvidence.reference}입니다. 핵심 구절은 “${primaryEvidence.excerpt}”입니다. 이 본문은 질문에 대한 출발점을 주고, 보조 본문들은 같은 질문을 다른 정경 위치에서 보강합니다.`,
        datePlaceAudience: `${primaryEvidence.title}의 책 배경도 확인해야 합니다. ${cluster.context.date.body} ${cluster.context.place.body} ${cluster.context.author.body}`,
        originalAudience: `${cluster.context.audience.body} 오늘의 적용은 이 원래 문맥을 지나서 조심스럽게 이어져야 합니다.`,
        linkedScriptures: supportLine || (linkedLine ? `${linkedLine}.` : "이 답변은 현재 선택된 중심 본문을 우선 evidence로 사용합니다."),
        jesusAndPaul: `${cluster.jesusLayer.body} ${cluster.paulLayer.body}`,
        personalConnection: answerBundle.answerPolicy === "wisdom_principle"
          ? "이 본문들은 결정을 대신 내려 주지 않습니다. 대신 하나님 앞에서 지혜를 구하고, 신뢰할 조언과 책임 있는 판단을 세우도록 돕습니다."
          : answerBundle.answerPolicy === "safety_first"
            ? "지금 질문은 안전이 먼저입니다. 본문은 혼자 견디라는 압박이 아니라, 가까운 사람과 전문 도움을 함께 붙들면서 하나님이 버리지 않으신다는 소망을 확인하도록 돕습니다."
            : "이 본문 묶음은 질문을 성경의 언어로 다시 붙들게 합니다. 바로 단정하기보다 중심 본문과 보조 본문을 함께 읽으며, 질문이 무엇을 묻고 무엇을 아직 남겨 두는지 구분하도록 돕습니다.",
        reflectionQuestions: [
          `이 질문은 ${answerBundle.question.answerMode} 응답 모드로 분류되었습니다. 이 분류가 내 질문을 잘 설명하나요?`,
          `${primaryEvidence.reference}는 내 질문에 대해 무엇을 직접 말하나요?`,
          answerBundle.supporting[0] ? `${answerBundle.relationMap[1]?.reference ?? "보조 본문"}은 중심 본문을 어떻게 보강하나요?` : "이 중심 본문 하나로 충분한가요, 아니면 연결 본문을 더 읽어야 하나요?",
        ],
        evidence,
        generationMode: "deterministic",
        generationModel: "deterministic-answer-bundle-builder",
        generationNote: "질문 이해, passage index, reranker, answer bundle을 사용한 결정형 응답입니다.",
      };
    }

    return {
      concernSummary: `The prompt “${prompt}” was understood as “${answerBundle.question.normalized}” and answered with a Bible evidence bundle.`,
      relevanceSummary: scoreLine ? `${scoreLine}. ${answerBundle.primary.reason}` : answerBundle.primary.reason,
      whyTheseTexts: `${primaryEvidence.reference} is the primary passage. ${supportLine || "No supporting passage was needed."}`,
      primaryStory: `The primary passage is ${primaryEvidence.reference}: “${primaryEvidence.excerpt}”.`,
      datePlaceAudience: `Book context still matters: ${cluster.context.date.body} ${cluster.context.place.body} ${cluster.context.author.body}`,
      originalAudience: `${cluster.context.audience.body} Application should move through that context before reaching the user.`,
      linkedScriptures: supportLine || (linkedLine ? `${linkedLine}.` : "The answer uses the selected evidence bundle."),
      jesusAndPaul: `${cluster.jesusLayer.body} ${cluster.paulLayer.body}`,
      personalConnection: answerBundle.answerPolicy === "wisdom_principle"
        ? "These texts give wisdom principles; they do not decide the concrete choice for the user."
        : "The bundle connects the user's question to passages that directly answer or support the same concern.",
      reflectionQuestions: [
        `Does the ${answerBundle.question.answerMode} response mode describe the question well?`,
        `What does ${primaryEvidence.reference} answer directly?`,
        answerBundle.supporting[0] ? `How does ${answerBundle.relationMap[1]?.reference ?? "the supporting passage"} support the primary text?` : "Is one primary passage enough, or should the linked texts be expanded?",
      ],
      evidence,
      generationMode: "deterministic",
      generationModel: "deterministic-answer-bundle-builder",
      generationNote: "Deterministic response built from question understanding, passage index, reranking, and answer bundle evidence.",
    };
  }

  if (appLocale === "ko") {
    return {
      concernSummary: `입력한 질문 “${prompt}”에 대해 우선 ${primaryEvidence.reference}를 중심 본문으로 붙들었습니다. 이 답변은 책 소개를 먼저 말하기보다, 질문과 실제로 겹치는 본문 언어를 먼저 앞세우도록 바꿨습니다.`,
      relevanceSummary: scoreLine ? `${scoreLine}. ${rationale}` : rationale,
      whyTheseTexts: `${primaryEvidence.reference}는 질문 속 표현과 가장 직접 맞닿은 본문으로 선택되었습니다. 현재 매칭은 ${matchedTerms} 같은 단어/개념을 따라가며, 연결 본문은 그 판단을 정경 안에서 교차 검증하도록 붙였습니다.`,
      primaryStory: `중심 본문은 ${primaryEvidence.reference}입니다. 핵심 구절은 “${primaryEvidence.excerpt}”입니다. ${expansionReferences.length ? `이후 ${expansionReferences.join(", ")}이 같은 질문을 다른 자리에서 어떻게 다시 말하는지 확인하도록 돕습니다.` : "추가 연결은 아래 상호참조 데이터에서 이어집니다."}`,
      datePlaceAudience: `${primaryEvidence.title}의 책 배경을 완전히 버릴 수는 없으므로, ${cluster.context.date.body} ${cluster.context.place.body} ${cluster.context.author.body}`,
      originalAudience: `${cluster.context.audience.body} 따라서 오늘의 질문에 바로 단정적으로 뛰어들기보다, 이 본문이 처음 누구에게 어떤 소식으로 들렸는지 먼저 확인하는 편이 더 안전합니다.`,
      linkedScriptures: linkedLine ? `${linkedLine}. 여기서의 연결은 단순 추천이 아니라, 같은 주제가 실제로 다시 나타나는 본문을 근거와 함께 보여 주기 위한 것입니다.` : "직접 연결된 상호참조 본문이 충분하지 않으면, 관련 공부 레인은 보조 자료로만 사용합니다.",
      jesusAndPaul: `${cluster.jesusLayer.body} ${cluster.paulLayer.body}`,
      personalConnection: retrieval?.confidence === "low"
        ? `다만 이번 매칭은 아직 낮은 신뢰도입니다. 즉, 본문이 질문과 완전히 직결된다고 단정하기보다, 먼저 ${primaryEvidence.reference}를 읽고 아래 연결 본문이 정말 같은 질문을 다루는지 함께 검토하는 편이 맞습니다.`
        : `이번 매칭은 질문과 본문 사이에 실제 겹치는 언어와 개념이 있어, 적어도 “어떤 성구에서부터 읽기 시작해야 하는가”에 대해서는 근거가 있습니다. 최종 결론은 아래 근거 본문들을 함께 읽으며 조심스럽게 세우는 것이 맞습니다.`,
      reflectionQuestions: [
        `${primaryEvidence.reference}는 질문에 대해 무엇을 직접 말하고, 무엇은 아직 말하지 않나요?`,
        `${expansionReferences.length ? expansionReferences[0] : primaryEvidence.reference}는 중심 본문을 보강하나요, 수정하나요, 아니면 긴장시키나요?`,
        `점수와 근거를 봤을 때 지금 매칭이 충분히 직접적인가요, 아니면 더 정확한 검색어가 필요한가요?`,
      ],
      evidence,
      generationMode: "deterministic",
      generationModel: "deterministic-reflection-builder",
      generationNote: "근거 본문, 매칭 점수, 상호참조 근거를 함께 사용하는 결정형 응답입니다.",
    };
  }

  return {
    concernSummary: `For the prompt “${prompt}”, the answer now begins with ${primaryEvidence.reference} because it overlaps the question more directly than a generic book-introduction lane.`,
    relevanceSummary: scoreLine ? `${scoreLine}. ${rationale}` : rationale,
    whyTheseTexts: `${primaryEvidence.reference} was selected because its wording and concepts overlap the prompt most clearly. The linked passages are there to cross-check that first match inside the canon rather than to decorate it with generic references.`,
    primaryStory: `The primary passage is ${primaryEvidence.reference}. Its key wording is “${primaryEvidence.excerpt}”. ${expansionReferences.length ? `The study then expands through ${expansionReferences.join(", ")}.` : "Further expansion continues through the cross-reference data below."}`,
    datePlaceAudience: `Book-level context still matters: ${cluster.context.date.body} ${cluster.context.place.body} ${cluster.context.author.body}`,
    originalAudience: `${cluster.context.audience.body} That is why the answer tries to stay with what the first hearers could have recognized before jumping to a modern conclusion.`,
    linkedScriptures: linkedLine ? `${linkedLine}. These are not filler recommendations; they are the passages most directly connected in the supporting datasets.` : "If direct cross-references are weak, related lanes should be treated as secondary context only.",
    jesusAndPaul: `${cluster.jesusLayer.body} ${cluster.paulLayer.body}`,
    personalConnection: retrieval?.confidence === "low"
      ? `This match is still low-confidence. The safest use is to read ${primaryEvidence.reference} first, then test whether the linked passages truly answer the same question before drawing a conclusion.`
      : `This match has enough direct overlap to justify starting here. The answer should still remain evidence-bound: read the cited passages together before making a final claim.` ,
    reflectionQuestions: [
      `What does ${primaryEvidence.reference} state directly, and what does it leave unstated?`,
      `${expansionReferences.length ? expansionReferences[0] : primaryEvidence.reference}: does it support, refine, or complicate the first reading?`,
      `Does the score and rationale show a strong match, or should the prompt be narrowed further?`,
    ],
    evidence,
    generationMode: "deterministic",
    generationModel: "deterministic-reflection-builder",
    generationNote: "Deterministic response built from evidence passages, retrieval scores, and cross-reference data.",
  };
}
