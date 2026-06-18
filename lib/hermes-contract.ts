import type { StoryCluster } from "@/lib/app-data";
import type { BookMetadata } from "@/lib/book-metadata";
import type { CrossReferenceSuggestion } from "@/lib/knowledge";
import type { CrossReferenceEdge, CrossReferenceNetworkSummary } from "@/lib/crossref-graph";
import type { RetrievalResult } from "@/lib/retrieval";
import type { ReflectionResponse } from "@/lib/reflection";
import type { SafetyAssessment } from "@/lib/safety";

export type HermesEvidenceContract = {
  prompt: string;
  safety: SafetyAssessment;
  retrieval: RetrievalResult;
  cluster: Pick<StoryCluster, "slug" | "title" | "themes" | "emotions" | "pastoralPrompt" | "reflectionQuestions">;
  primaryBookMetadata: BookMetadata | undefined;
  linkedTexts: StoryCluster["linkedTexts"];
  context: StoryCluster["context"];
  jesusLayer: StoryCluster["jesusLayer"];
  paulLayer: StoryCluster["paulLayer"];
  jewishReception: StoryCluster["jewishReception"];
  graphSuggestions: CrossReferenceSuggestion[];
  crossReferenceSummary?: CrossReferenceNetworkSummary | null;
  crossReferenceHighlights?: CrossReferenceEdge[];
  crossReferenceNetworkUrl?: string | null;
  allowedEvidenceIds?: string[];
  deterministicReflection: ReflectionResponse;
};

export type HermesGenerationPolicy = {
  mode: "evidence-locked";
  allowedClaims: string[];
  forbiddenClaims: string[];
  outputSchema: Record<string, string>;
};

export function buildHermesPolicy(): HermesGenerationPolicy {
  return {
    mode: "evidence-locked",
    allowedClaims: [
      "Summarize only from provided passages, metadata notes, cross-reference graph evidence, and safety assessment.",
      "Use tentative language for disputed authorship, date, and place claims.",
      "Identify Jesus, Paul, and Jewish reception as distinct interpretive layers.",
      "Point back to the cited evidence whenever making a personal connection.",
      "When cross-reference network evidence is present, mention the full-network count and link only from the provided contract fields.",
      "If safety level is caution or crisis, keep supportive guidance secondary to immediate human help and safety.",
    ],
    forbiddenClaims: [
      "Do not invent historical facts not present in the evidence contract.",
      "Do not produce new citations, verses, or quotations not present in the provided evidence.",
      "Do not state that God is directly promising or predicting the user's situation.",
      "Do not collapse disputed scholarly issues into certainty.",
      "Do not downplay crisis language or replace urgent safety guidance with spiritualized reassurance.",
    ],
    outputSchema: {
      concernSummary: "1-2 sentence summary rooted in the prompt and retrieval signals.",
      whyTheseTexts: "Explain why these passages were selected from the evidence bundle.",
      primaryStory: "Summarize the main story or poetic unit using only cited evidence.",
      datePlaceAudience: "State date / place / audience with confidence-sensitive wording.",
      originalAudience: "Explain what the original audience likely heard, tied to evidence.",
      linkedScriptures: "Describe linked texts and graph suggestions without inventing new links.",
      jesusAndPaul: "Keep Jesus layer, Paul layer, and Jewish reception distinct.",
      personalConnection: "Offer cautious personal application grounded in the cited evidence.",
      reflectionQuestions: "Return 2-3 reflection questions, not commands or prophecies.",
    },
  };
}

export function buildHermesContract(args: HermesEvidenceContract) {
  return {
    evidence: args,
    policy: buildHermesPolicy(),
  };
}
