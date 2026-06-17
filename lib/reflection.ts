import { getPassage, type BibleReference } from "@/lib/bible";
import type { StoryCluster } from "@/lib/app-data";
import { localizeRelationTypeLabel, resolveAppLocale } from "@/lib/content";
import type { RetrievalResult } from "@/lib/retrieval";
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
  generationMode: "deterministic" | "hermes" | "hermes-fallback";
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
  const matchedTerms = retrieval?.reasons.passageKeywords.length ? retrieval.reasons.passageKeywords.join(", ") : concernTerms;
  const rationale = retrieval?.rationale ?? "";
  const primaryEvidence = evidence[0];

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
