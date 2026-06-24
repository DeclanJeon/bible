import {
  FAITH_QUESTION_NODES,
  getFaithResourcesByIds,
  type AppLocale,
  type FaithPassage,
  type FaithQuestionNode,
  type FaithResource,
} from "@/lib/faith-resources";

export type FaithQuestionMatch = {
  question: FaithQuestionNode;
  score: number;
  matchedTerms: string[];
};

export type FaithQuestionAnswer = {
  locale: AppLocale;
  query: string;
  summary: string;
  caveat: string;
  matches: FaithQuestionMatch[];
  passages: FaithPassage[];
  resources: FaithResource[];
  nextQuestions: string[];
};

const DEFAULT_LOCALE: AppLocale = "ko";
const MAX_MATCHES = 3;
const MAX_PASSAGES = 6;
const MAX_RESOURCES = 6;

function normalizeLocale(locale: string | null | undefined): AppLocale {
  return locale === "en" ? "en" : DEFAULT_LOCALE;
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function scoreQuestion(query: string, locale: AppLocale, question: FaithQuestionNode): FaithQuestionMatch {
  const matchedTerms: string[] = [];
  let score = 0;
  const localizedKeywords = question.keywords[locale] ?? [];
  const fallbackKeywords = locale === "ko" ? question.keywords.en : question.keywords.ko;
  const keywords = [...localizedKeywords, ...fallbackKeywords, ...question.topics];

  for (const keyword of keywords) {
    const normalizedKeyword = keyword.toLowerCase();
    if (normalizedKeyword && query.includes(normalizedKeyword)) {
      matchedTerms.push(keyword);
      score += normalizedKeyword.length >= 4 ? 3 : 2;
    }
  }


  return { question, score, matchedTerms: [...new Set(matchedTerms)] };
}

function uniquePassages(matches: FaithQuestionMatch[]) {
  const seen = new Set<string>();
  const passages: FaithPassage[] = [];

  for (const match of matches) {
    for (const passage of match.question.passages) {
      const key = `${passage.reference.code}-${passage.reference.chapter}-${passage.reference.startVerse}-${passage.reference.endVerse}`;
      if (!seen.has(key)) {
        seen.add(key);
        passages.push(passage);
      }
    }
  }

  return passages.slice(0, MAX_PASSAGES);
}

function uniqueResources(matches: FaithQuestionMatch[]) {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    for (const id of match.question.resourceIds) {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }

  return getFaithResourcesByIds(ids).slice(0, MAX_RESOURCES);
}

function buildSummary(locale: AppLocale, matches: FaithQuestionMatch[]) {
  const [primary, secondary] = matches;
  if (!primary) {
    return locale === "ko"
      ? "질문을 한 주제로 단정하기 어렵습니다. 먼저 하나님, 예수, 성경, 구원, 천국과 지옥 같은 큰 주제 중 어디에 가까운지 살펴보세요."
      : "The question is hard to route to one topic. Start by locating whether it is closest to God, Jesus, Scripture, salvation, or heaven and hell.";
  }

  if (!secondary) {
    return primary.question.shortAnswer[locale];
  }

  return locale === "ko"
    ? `${primary.question.shortAnswer.ko} 함께 보면 좋은 연결 주제는 “${secondary.question.title.ko}”입니다.`
    : `${primary.question.shortAnswer.en} A helpful related topic is “${secondary.question.title.en}.”`;
}

function fallbackMatch(locale: AppLocale): FaithQuestionMatch {
  const question = FAITH_QUESTION_NODES.find((node) => node.id === "god") ?? FAITH_QUESTION_NODES[0];
  return { question, score: 0, matchedTerms: locale === "ko" ? ["기본 질문"] : ["default"] };
}

export function routeFaithQuestion(input: { query: string; locale?: string | null }): FaithQuestionAnswer {
  const locale = normalizeLocale(input.locale);
  const query = normalizeQuery(input.query);
  const scored = FAITH_QUESTION_NODES
    .map((question) => scoreQuestion(query, locale, question))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.question.id.localeCompare(b.question.id));
  const matches = scored.length > 0 ? scored.slice(0, MAX_MATCHES) : [fallbackMatch(locale)];
  const passages = uniquePassages(matches);
  const resources = uniqueResources(matches);
  const nextQuestions = [...new Set(matches.flatMap((match) => match.question.nextQuestions[locale]))].slice(0, 5);

  return {
    locale,
    query: input.query.trim(),
    summary: buildSummary(locale, matches),
    caveat:
      locale === "ko"
        ? "이 답변은 성경 본문과 선별된 링크로 이동하기 위한 안내입니다. 외부 글 전문을 저장하거나 대신 재배포하지 않습니다."
        : "This answer is a guide toward Scripture and curated source links. It does not store or republish external article bodies.",
    matches,
    passages,
    resources,
    nextQuestions,
  };
}
