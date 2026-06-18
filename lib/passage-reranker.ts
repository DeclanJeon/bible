import type { QuestionUnderstanding } from "@/lib/question-understanding";
import type { HybridPassageCandidate } from "@/lib/hybrid-retrieval";

const MODE_DIRECTNESS_BOOST: Record<QuestionUnderstanding["answerMode"], Partial<Record<HybridPassageCandidate["directness"], number>>> = {
  direct_bible_answer: { direct: 10, supporting: 4 },
  survey_bundle: { direct: 6, supporting: 7, background: 2 },
  wisdom_principle: { supporting: 8, background: 5, direct: -8 },
  pastoral_care: { direct: 7, supporting: 6 },
  safety_first: { direct: 8, supporting: 6 },
  clarify_with_starters: { weak: 0 },
  limited_answer: { supporting: 3, background: 3 },
};

const CANONICAL_SECTION_RANK_BY_BOOK: Record<string, number> = {
  GEN: 1, EXO: 1, LEV: 1, NUM: 1, DEU: 1,
  PSA: 2, PRO: 2, ECC: 2, JOB: 2, SNG: 2,
  ISA: 3, JER: 3, LAM: 3, EZK: 3, DAN: 3, HOS: 3, JOL: 3, AMO: 3, OBA: 3, JON: 3, MIC: 3, NAM: 3, HAB: 3, ZEP: 3, HAG: 3, ZEC: 3, MAL: 3,
  MAT: 4, MRK: 4, LUK: 4, JOH: 4,
  ROM: 5, "1CO": 5, "2CO": 5, GAL: 5, EPH: 5, PHI: 5, COL: 5, "1TH": 5, "2TH": 5, "1TI": 5, "2TI": 5, TIT: 5, PHM: 5, HEB: 5, JAM: 5, "1PE": 5, "2PE": 5, "1JO": 5, "2JO": 5, "3JO": 5, JUD: 5,
  REV: 6,
};

function rerankScore(question: QuestionUnderstanding, candidate: HybridPassageCandidate, index: number) {
  const modeBoost = MODE_DIRECTNESS_BOOST[question.answerMode][candidate.directness] ?? 0;
  const axisBoost = candidate.matchedAxes.length * 4;
  const queryBoost = Math.min(candidate.matchedQueries.length, 6) * 1.5;
  const sectionBoost = (CANONICAL_SECTION_RANK_BY_BOOK[candidate.unit.reference.code] ?? 0) * 0.75;
  const firstPassPenalty = index * 0.2;
  return candidate.finalScore + modeBoost + axisBoost + queryBoost + sectionBoost - firstPassPenalty;
}

function demoteEverydayDirectAnswer(question: QuestionUnderstanding, candidate: HybridPassageCandidate): HybridPassageCandidate {
  if (question.answerMode !== "wisdom_principle" || candidate.directness !== "direct") return candidate;
  return {
    ...candidate,
    finalScore: Math.max(0, candidate.finalScore - 12),
    directness: "supporting",
    reason: question.locale === "ko"
      ? `${candidate.reason} · 일상 선택에는 결정을 대신하지 않는 지혜 원칙으로만 사용합니다`
      : `${candidate.reason} · for an everyday choice, this is used as a wisdom principle rather than a concrete decision`,
  };
}

export function rerankPassageCandidates(question: QuestionUnderstanding, candidates: HybridPassageCandidate[], limit = 8) {
  return candidates
    .map(demoteEverydayDirectAnswer.bind(null, question))
    .map((candidate, index) => ({ candidate, score: rerankScore(question, candidate, index) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ candidate, score }) => ({ ...candidate, finalScore: score }));
}
