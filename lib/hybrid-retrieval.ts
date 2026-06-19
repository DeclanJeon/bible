import type { BibleReference } from "@/lib/bible";
import { loadBiblePassageIndex, type BiblePassageUnit } from "@/lib/bible-passage-index";
import type { QuestionUnderstanding } from "@/lib/question-understanding";

export type HybridPassageCandidate = {
  unit: BiblePassageUnit;
  lexicalScore: number;
  semanticScore: number;
  axisScore: number;
  crossReferenceScore: number;
  canonicalCoverageScore: number;
  finalScore: number;
  directness: "direct" | "supporting" | "background" | "weak";
  matchedAxes: string[];
  matchedQueries: string[];
  reason: string;
};

type IndexedUnit = BiblePassageUnit & {
  id?: string;
  normalizedText?: string;
  doctrines?: string[];
  humanConcerns?: string[];
  questionsAnswered?: string[];
  entities?: string[];
  canonicalWeight?: number;
  crossReferenceDegree?: number;
  axes?: string[];
  crossReferences?: string[];
};

const ENGLISH_STOP_WORDS: Record<string, true> = {
  the: true, and: true, that: true, with: true, have: true, this: true, from: true, your: true, about: true, what: true, when: true, where: true, them: true, they: true,
  how: true, why: true, who: true, does: true, are: true, for: true, you: true, can: true, should: true, would: true, could: true, will: true, shall: true, into: true,
};

const KOREAN_STOP_WORDS: Record<string, true> = {
  그냥: true, 너무: true, 정말: true, 진짜: true, 계속: true, 요즘: true, 많이: true, 조금: true, 나는: true, 내가: true, 제가: true, 저는: true, 나를: true, 저를: true, 나의: true, 우리: true, 것: true, 뭐: true, 무엇: true,
};

const KOREAN_SUFFIX_PATTERN = /(으로는|으로도|에게는|에게도|에서는|에서|에게|부터|까지|처럼|보다|라도|이며|이고|라는|이라|입니다|해요|어요|아요|이에요|예요|은|는|이|가|을|를|에|의|와|과|도|만|로|으로|요)$/u;

function tokenize(input: string) {
  return (input.toLowerCase().match(/[a-z]+|[가-힣]+/g) ?? []).flatMap((rawToken) => {
    if (/^[a-z]+$/.test(rawToken)) return rawToken.length > 2 && !ENGLISH_STOP_WORDS[rawToken] ? [rawToken] : [];
    const token = rawToken.replace(KOREAN_SUFFIX_PATTERN, "");
    return token.length > 1 && !KOREAN_STOP_WORDS[rawToken] && !KOREAN_STOP_WORDS[token] ? [token] : [];
  });
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function fieldValues(unit: IndexedUnit) {
  return unique([
    ...(unit.themes ?? []),
    ...(unit.keywords ?? []),
    ...(unit.doctrines ?? []),
    ...(unit.humanConcerns ?? []),
    ...(unit.questionsAnswered ?? []),
    ...(unit.entities ?? []),
    ...(unit.axes ?? []),
  ]);
}

function unitCorpus(unit: IndexedUnit) {
  return [unit.text, unit.normalizedText, unit.summary, ...fieldValues(unit)].filter(Boolean).join(" ").toLowerCase();
}

function scoreTermCoverage(terms: string[], corpus: string) {
  if (!terms.length) return { score: 0, matched: [] as string[] };
  const matched = unique(terms.filter((term) => corpus.includes(term.toLowerCase())));
  return { score: matched.length / Math.max(terms.length, 1), matched };
}

function scoreAxisCoverage(question: QuestionUnderstanding, values: string[]) {
  const axes = unique([...question.concernAxes, ...question.theologicalAxes]);
  if (!axes.length || !values.length) return { score: 0, matched: [] as string[] };
  const lowerValues = values.map((value) => value.toLowerCase());
  const matched = axes.filter((axis) => {
    const lowerAxis = axis.toLowerCase();
    return lowerValues.some((value) => value.includes(lowerAxis) || lowerAxis.includes(value));
  });
  return { score: matched.length / Math.max(axes.length, 1), matched: unique(matched) };
}

function directnessFor(score: number, axisScore: number, lexicalScore: number): HybridPassageCandidate["directness"] {
  if (score >= 76 || axisScore >= 0.5) return "direct";
  if (score >= 48 || lexicalScore >= 0.25) return "supporting";
  if (score >= 25) return "background";
  return "weak";
}

function reasonFor(question: QuestionUnderstanding, candidate: Omit<HybridPassageCandidate, "reason">) {
  const reference = formatReference(candidate.unit.reference);
  const pieces = question.locale === "ko"
    ? [
        `${reference} 본문 단위가 선택되었습니다`,
        candidate.matchedAxes.length ? `질문 축: ${candidate.matchedAxes.join(", ")}` : null,
        candidate.matchedQueries.length ? `검색어: ${candidate.matchedQueries.slice(0, 5).join(", ")}` : null,
      ]
    : [
        `${reference} was selected from the passage index`,
        candidate.matchedAxes.length ? `question axes: ${candidate.matchedAxes.join(", ")}` : null,
        candidate.matchedQueries.length ? `queries: ${candidate.matchedQueries.slice(0, 5).join(", ")}` : null,
      ];
  return pieces.filter(Boolean).join(" · ");
}

export function formatReference(reference: BibleReference) {
  const tail = reference.startVerse === reference.endVerse ? `${reference.chapter}:${reference.startVerse}` : `${reference.chapter}:${reference.startVerse}-${reference.endVerse}`;
  return `${reference.code} ${tail}`;
}

export async function retrieveHybridPassageCandidates(question: QuestionUnderstanding, limit = 12): Promise<HybridPassageCandidate[]> {
  if (question.answerMode === "clarify_with_starters" || question.confidence === "low") return [];

  const { units } = await loadBiblePassageIndex(question.locale);
  const queryTerms = unique([
    ...tokenize(question.normalized),
    ...question.searchQueries.flatMap(tokenize),
    ...question.concernAxes.flatMap(tokenize),
    ...question.theologicalAxes.flatMap(tokenize),
  ]);

  const scored = units.map((unit) => {
    const indexedUnit = unit as IndexedUnit;
    const corpus = unitCorpus(indexedUnit);
    const values = fieldValues(indexedUnit);
    const lexical = scoreTermCoverage(queryTerms, corpus);
    const axis = scoreAxisCoverage(question, values);
    const semantic = scoreTermCoverage(question.searchQueries.flatMap(tokenize), [indexedUnit.summary, ...values].filter(Boolean).join(" ").toLowerCase());
    const crossReferenceDegree = indexedUnit.crossReferenceDegree ?? indexedUnit.crossReferences?.length ?? 0;
    const canonicalWeight = indexedUnit.canonicalWeight ?? 1;
    const crossReferenceScore = Math.min(crossReferenceDegree / 12, 1);
    const canonicalCoverageScore = Math.max(0, Math.min(canonicalWeight, 1));
    const matchScore = lexical.score * 34 + semantic.score * 22 + axis.score * 30;
    const finalScore = matchScore > 0 ? matchScore + crossReferenceScore * 6 + canonicalCoverageScore * 8 : 0;
    const base = {
      unit,
      lexicalScore: lexical.score,
      semanticScore: semantic.score,
      axisScore: axis.score,
      crossReferenceScore,
      canonicalCoverageScore,
      finalScore,
      directness: directnessFor(finalScore, axis.score, lexical.score),
      matchedAxes: axis.matched,
      matchedQueries: unique([...lexical.matched, ...semantic.matched]),
    } satisfies Omit<HybridPassageCandidate, "reason">;

    return { ...base, reason: reasonFor(question, base) };
  });

  return scored
    .filter((candidate) => candidate.finalScore > 0)
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, limit);
}
