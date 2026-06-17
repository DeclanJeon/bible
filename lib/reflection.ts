import { getPassage, type BibleReference } from "@/lib/bible";
import type { StoryCluster } from "@/lib/app-data";
import { localizeRelationTypeLabel, resolveAppLocale } from "@/lib/content";

export type EvidencePassage = {
  title: string;
  reference: string;
  excerpt: string;
};

export type ReflectionResponse = {
  concernSummary: string;
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

export async function buildReflectionResponse(
  cluster: StoryCluster,
  prompt: string,
  locale?: string,
): Promise<ReflectionResponse> {
  const appLocale = resolveAppLocale(locale);
  const evidence = await Promise.all([
    buildEvidence(cluster.primary, appLocale),
    ...cluster.supporting.map((reference) => buildEvidence(reference, appLocale)),
  ]);
  const concernTerms = (cluster.emotions.length ? cluster.emotions : cluster.themes).join(", ");
  const expansionReferences = evidence.slice(1).map((item) => item.reference);
  const linkedLine =
    cluster.linkedTexts.length > 0
      ? cluster.linkedTexts.map((text) => `${text.label} (${localizeRelationTypeLabel(text.type, appLocale)})`).join("; ")
      : null;

  if (appLocale === "ko") {
    return {
      concernSummary: `이 묵상은 ${concernTerms}의 결을 따라갑니다. 앱은 고립된 약속 구절을 억지로 끌어오지 않고, ${cluster.title}에서 출발해 지금의 고민을 더 큰 성경 패턴 안에서 읽도록 돕습니다.`,
      whyTheseTexts: `핵심 본문이 먼저 본문의 언어를 주고, 연결 본문이 그 틀을 ${cluster.themes.join(", ")} 쪽으로 넓혀 줍니다. 그래서 답변은 한 장면에 머무르지 않고 성경 전체의 대화로 이동합니다.`,
      primaryStory: `${cluster.context.meaning.body} 중심 레인은 ${evidence[0].reference}입니다. ${expansionReferences.length ? `공부는 이어서 ${expansionReferences.join(", ")}까지 확장됩니다.` : "연결 본문은 아래 상호참조 데이터에서 확장됩니다."}`,
      datePlaceAudience: `${cluster.context.date.body} ${cluster.context.place.body} ${cluster.context.author.body}`,
      originalAudience: `${cluster.context.audience.body} 이렇게 읽는 것이 오늘의 적용으로 곧장 뛰기 전에, 처음 들은 공동체와 후대 예배 공동체가 무엇을 들었는지 가장 안전하게 붙드는 방식입니다.`,
      linkedScriptures: linkedLine
        ? `${linkedLine}. 각 연결은 성경이 같은 고민을 어디에서 다시 쓰고, 울리고, 평행하게 놓는지 보여 주기 위해 있습니다.`
        : "고정 목업 연결이 아니라 OpenBible 및 Bible Cross References 데이터셋에서 계산한 연결 본문을 상호참조 섹션에 제시합니다.",
      jesusAndPaul: `${cluster.jesusLayer.body} ${cluster.paulLayer.body}`,
      personalConnection: `지금의 입력 “${prompt}”에 대해, 이 본문들이 당신의 상황을 직접 예언한다기보다, 하나님의 백성이 ${concernTerms}을 어떻게 이름 붙이고 자기 삶을 하나님의 더 큰 이야기 안에서 계속 읽어 가는지 가르친다고 보는 편이 가장 알맞습니다.`,
      reflectionQuestions: cluster.reflectionQuestions,
      evidence,
      generationMode: "deterministic",
      generationModel: "deterministic-reflection-builder",
      generationNote: "근거 기반 결정형 템플릿으로 한국어 묵상을 생성했습니다.",
    };
  }

  return {
    concernSummary: `Your reflection follows ${concernTerms}. Instead of forcing an isolated promise text, the app begins with ${cluster.title.toLowerCase()} so the concern can be read inside a fuller biblical pattern.`,
    whyTheseTexts: `The main passage gives the first textual vocabulary, while the linked texts widen the frame into ${cluster.themes.join(", ")}. This lets the answer move from one scene into a canon-wide conversation.`,
    primaryStory: `${cluster.context.meaning.body} The primary lane is ${evidence[0].reference}. ${expansionReferences.length ? `The study then expands through ${expansionReferences.join(", ")}.` : "Linked passages are expanded below from cross-reference datasets."}`,
    datePlaceAudience: `${cluster.context.date.body} ${cluster.context.place.body} ${cluster.context.author.body}`,
    originalAudience: `${cluster.context.audience.body} This is the safest way to answer what the first hearers or later worshiping community likely recognized before jumping to today's application.`,
    linkedScriptures: linkedLine
      ? `${linkedLine}. Each connection is there to show where the Bible reuses, echoes, or parallels the same concern.`
      : "Instead of fixed mock links, the cross-reference section uses OpenBible and Bible Cross References data to calculate connected passages.",
    jesusAndPaul: `${cluster.jesusLayer.body} ${cluster.paulLayer.body}`,
    personalConnection: `For the current prompt — “${prompt}” — the likely fit is not that these passages predict your situation, but that they teach how God's people name ${concernTerms} and keep reading their life inside God's larger story.`,
    reflectionQuestions: cluster.reflectionQuestions,
    evidence,
    generationMode: "deterministic",
    generationModel: "deterministic-reflection-builder",
    generationNote: "Reflection generated from deterministic evidence-based templates.",
  };
}