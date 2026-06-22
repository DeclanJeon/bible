import type { BibleReference } from "@/lib/bible";
import { findPassageUnit, type BiblePassageUnit } from "@/lib/bible-passage-index";
import { findCandidatePassageUnits } from "@/lib/passage-index-db";
import { createEmbedding, cosineSimilarity as cosineEmbeddingSimilarity, getEmbeddingProviderConfig } from "@/lib/embeddings";
import { STORY_CLUSTERS, type StoryCluster } from "@/lib/app-data";
import { localizeStoryCluster, resolveAppLocale } from "@/lib/content";
import { answerBundleReferences, buildAnswerBundle, type AnswerBundle } from "@/lib/answer-bundle";
import { retrieveHybridPassageCandidates, type HybridPassageCandidate } from "@/lib/hybrid-retrieval";
import { rerankPassageCandidates } from "@/lib/passage-reranker";
import { understandQuestion, type QuestionUnderstanding } from "@/lib/question-understanding";
import type { RetrievalQueryPlan } from "@/lib/rag-query";

export type RetrievalReason = {
  matchedHints: string[];
  matchedThemes: string[];
  matchedEmotions: string[];
  passageKeywords: string[];
  semanticTerms: string[];
};

export type RetrievalConfidence = "high" | "medium" | "low";

export type PassageCandidate = {
  reference: BibleReference;
  excerpt: string;
  score: number;
  matchedTerms: string[];
  matchedConcepts: string[];
};

export type RetrievalOptions = {
  queryPlan?: RetrievalQueryPlan;
  expansionTerms?: string[];
  expansionSummary?: string;
  expansionProvider?: string;
};


export type RetrievalResult = {
  cluster: StoryCluster;
  score: number;
  laneScore: number;
  passageScore: number;
  semanticScore: number;
  embeddingScore: number;
  retrievalMode: "tfidf" | "embeddings" | "embedding-fallback";
  embeddingModel: string | null;
  reasons: RetrievalReason;
  rationale: string;
  confidence: RetrievalConfidence;
  primaryReference: BibleReference;
  primaryExcerpt: string;
  supportingReferences: BibleReference[];
  passageCandidates: PassageCandidate[];
  expansionSummary: string | null;
  expansionProvider: string | null;
  question?: AnswerBundle["question"];
  answerBundle?: AnswerBundle;
};

export function isRetrievalReliable(
  retrieval: Pick<RetrievalResult, "confidence" | "passageScore" | "supportingReferences" | "reasons">,
) {
  return (
    retrieval.confidence !== "low" &&
    (retrieval.passageScore >= 5 ||
      retrieval.supportingReferences.length > 0 ||
      retrieval.reasons.passageKeywords.length >= 2)
  );
}


const ENGLISH_STOP_WORDS = new Set([
  "the",
  "and",
  "that",
  "with",
  "have",
  "this",
  "from",
  "your",
  "about",
  "feel",
  "feels",
  "again",
  "into",
  "keep",
  "very",
  "just",
  "what",
  "when",
  "where",
  "them",
  "they",
  "dont",
  "cant",
  "wont",
  "after",
  "before",
  "know",
  "still",
  "front",
  "not",
  "how",
  "does",
  "doing",
]);

const KOREAN_STOP_WORDS = new Set([
  "그냥",
  "너무",
  "정말",
  "진짜",
  "계속",
  "요즘",
  "많이",
  "조금",
  "나는",
  "내가",
  "제가",
  "저는",
  "나를",
  "저를",
  "나의",
  "내",
  "제",
  "우리",
  "일이",
  "일도",
  "것",
  "거",
  "같아",
  "같아요",
  "싶어",
  "싶어요",
  "해야",
  "하고",
  "하는",
  "오늘",
  "점심",
  "먹지",
  "먹을",
  "아무",
  "생각",
  "없어",
  "없는",
  "합니다",
]);

function normalizeKoreanToken(token: string) {
  return token.replace(/(으로는|으로도|에게는|에게도|에서는|에서|에게|부터|까지|처럼|보다|라도|이며|이고|라는|이라|입니다|해요|어요|아요|이에요|예요|은|는|이|가|을|를|에|의|와|과|도|만|로|으로|요)$/u, "");
}

function tokenize(input: string) {
  return (input.toLowerCase().match(/[a-z]+|[가-힣]+/g) ?? []).flatMap((rawToken) => {
    if (/^[a-z]+$/.test(rawToken)) {
      return rawToken.length > 2 && !ENGLISH_STOP_WORDS.has(rawToken) ? [rawToken] : [];
    }

    const token = normalizeKoreanToken(rawToken);
    return token.length > 1 && !KOREAN_STOP_WORDS.has(rawToken) && !KOREAN_STOP_WORDS.has(token) ? [token] : [];
  });
}

const ENABLE_RUNTIME_CLUSTER_EMBEDDINGS = process.env.ENABLE_RUNTIME_CLUSTER_EMBEDDINGS === "1";

const QUERY_EXPANSIONS = [
  { match: /(힘들|지쳤|지쳐|지친|지침|피곤|번아웃|무기력|수고|부담|weary|burden|burnout|exhausted|tired)/i, terms: "수고 무거운 짐 부담 쉬게 하리라 위로 환난 견디게 피곤 능력 weary burden rest comfort" },
  { match: /(기다|침묵|조용|응답|delay|wait|silence|unheard)/i, terms: "어느 때까지 잠잠 구원 도우소서 영혼 낙망 소망 wait hope silence help" },
  { match: /(회복|실패|수치|죄책|죄|restore|failure|shame|guilt|repent)/i, terms: "죄악 사하소서 깨끗 정한 마음 회개 긍휼 restore mercy repentance" },
  { match: /(두려|부르심|책임|감당|calling|afraid|fear|responsibility)/i, terms: "두려워 말라 강하고 담대 함께 보내리라 courage presence" },
  { match: /(슬픔|상실|애도|눈물|죽음|grief|loss|mourning|tears|death)/i, terms: "눈물 슬픔 애통 사망 위로 소망 comfort resurrection" },
  { match: /(지혜|인도|결정|혼란|길|wisdom|guidance|decision|confused|path)/i, terms: "지혜 길 가르치소서 명철 인도 wisdom path teach" },
  { match: /(용서|배신|원망|분노|forgive|betray|resent|anger|revenge)/i, terms: "용서 원수 선 악 긍휼 자비 갚지 mercy enemy forgive" },
  { match: /(천국|하늘나라|하늘|영생|낙원|부활|들림|강림|살아있는|살아 남|산 자|죽은 자|heaven|kingdom|eternal life|paradise|resurrection|alive|rapture)/i, terms: "천국 하늘 하늘나라 영생 낙원 부활 변화 강림 살아 남은 자 산 자 죽은 자 공중 주와 함께 올라간 자 들어가지 못 eternal life resurrection alive heaven kingdom paradise" },
  { match: /(나는 누구|내가 누구|정체성|존재|가치|나는 뭘까|who am i|identity|worth|purpose)/i, terms: "하나님의 형상 자녀 지으심 창조 사랑 택하심 그리스도 안에서 identity image of god child created beloved" },
  { match: /(왜\s?살아야|살아야\s?(하는|되는|될)?지|살\s?이유|사는\s?이유|삶.*(목적|의미)|무엇을 위해 살아|버텨야|견뎌야|희망이\s?없|소망.*없|reason to live|why.*live|purpose.*life|meaning.*life)/i, terms: "지으심 선한 일 하나님의 형상 창조 자녀 생명 소망 낙망 인자 긍휼 목적 created workmanship hope life purpose" },
] as const;

type PassagePriorProfile = {
  match: RegExp;
  references: BibleReference[];
  terms: string[];
};

const PHILOSOPHICAL_PASSAGE_PRIORS: PassagePriorProfile[] = [
  { match: /(왜.*태어|무엇을 위해 살아|왜\s?살아야|살아야\s?(하는|되는|될)?지|살\s?이유|사는\s?이유|사람은\s?왜\s?사는|인간은\s?왜\s?사는|삶의 목적|삶.*의미|존재.*이유|purpose.*born|why.*born|reason to live|why.*live|purpose.*life|meaning.*life)/i, references: [{ code: "EPH", chapter: 2, startVerse: 10, endVerse: 10 }, { code: "PSA", chapter: 139, startVerse: 13, endVerse: 16 }, { code: "ECC", chapter: 12, startVerse: 13, endVerse: 14 }, { code: "GEN", chapter: 1, startVerse: 26, endVerse: 28 }], terms: ["목적", "살아야", "태어", "지으심", "형상", "소망", "하나님"] },
  { match: /(양심|conscience)/i, references: [{ code: "ROM", chapter: 2, startVerse: 14, endVerse: 15 }, { code: "HEB", chapter: 10, startVerse: 22, endVerse: 22 }, { code: "1TI", chapter: 1, startVerse: 5, endVerse: 5 }, { code: "PRO", chapter: 20, startVerse: 27, endVerse: 27 }], terms: ["양심", "마음", "율법", "선", "하나님"] },
  { match: /(불공평|불공정|선하게 사는|선하게 살|unfair)/i, references: [{ code: "PSA", chapter: 73, startVerse: 16, endVerse: 17 }, { code: "GAL", chapter: 6, startVerse: 9, endVerse: 9 }, { code: "MIC", chapter: 6, startVerse: 8, endVerse: 8 }, { code: "ROM", chapter: 12, startVerse: 21, endVerse: 21 }], terms: ["불공평", "선", "의미", "공의", "낙심"] },
  { match: /(이뤘는데도|원하던.*이뤘|마음이 비어|공허|empty.*success)/i, references: [{ code: "ECC", chapter: 2, startVerse: 10, endVerse: 11 }, { code: "MAR", chapter: 8, startVerse: 36, endVerse: 36 }, { code: "JOH", chapter: 6, startVerse: 35, endVerse: 35 }, { code: "PSA", chapter: 16, startVerse: 11, endVerse: 11 }], terms: ["성취", "마음", "공허", "헛됨", "생명"] },
  { match: /(부당|분노.*정당|정당한가|anger.*injustice)/i, references: [{ code: "EPH", chapter: 4, startVerse: 26, endVerse: 27 }, { code: "JAM", chapter: 1, startVerse: 19, endVerse: 20 }, { code: "ROM", chapter: 12, startVerse: 19, endVerse: 21 }, { code: "PSA", chapter: 4, startVerse: 4, endVerse: 4 }], terms: ["분노", "부당", "의", "악", "원수"] },
  { match: /(기계|AI|인간다움|technology.*human)/i, references: [{ code: "GEN", chapter: 1, startVerse: 26, endVerse: 28 }, { code: "PSA", chapter: 8, startVerse: 3, endVerse: 8 }, { code: "EPH", chapter: 2, startVerse: 10, endVerse: 10 }, { code: "ECC", chapter: 3, startVerse: 11, endVerse: 11 }], terms: ["인간", "형상", "일", "창조", "지으심"] },
  { match: /(선택.*망칠|인생 전체.*망칠|choice.*regret)/i, references: [{ code: "PRO", chapter: 3, startVerse: 5, endVerse: 6 }, { code: "ROM", chapter: 8, startVerse: 28, endVerse: 28 }, { code: "PHI", chapter: 3, startVerse: 13, endVerse: 14 }, { code: "JAM", chapter: 1, startVerse: 5, endVerse: 5 }], terms: ["선택", "두려움", "길", "인도", "회복"] },
  { match: /(속마음|모르는 내 속|마음까지.*판단|hidden heart)/i, references: [{ code: "1SA", chapter: 16, startVerse: 7, endVerse: 7 }, { code: "HEB", chapter: 4, startVerse: 12, endVerse: 13 }, { code: "PSA", chapter: 139, startVerse: 23, endVerse: 24 }, { code: "JER", chapter: 17, startVerse: 10, endVerse: 10 }], terms: ["속마음", "마음", "판단", "감찰", "하나님"] },
  { match: /(몸인가 영혼|몸.*영혼|영혼.*몸|body.*soul)/i, references: [{ code: "GEN", chapter: 2, startVerse: 7, endVerse: 7 }, { code: "1CO", chapter: 6, startVerse: 19, endVerse: 20 }, { code: "1TH", chapter: 5, startVerse: 23, endVerse: 23 }, { code: "MAT", chapter: 10, startVerse: 28, endVerse: 28 }], terms: ["몸", "영혼", "생기", "성전", "하나님"] },
  { match: /(희망.*이유|소망.*이유|희망.*찾지|despair.*hope)/i, references: [{ code: "ROM", chapter: 15, startVerse: 13, endVerse: 13 }, { code: "LAM", chapter: 3, startVerse: 21, endVerse: 24 }, { code: "PSA", chapter: 42, startVerse: 5, endVerse: 5 }, { code: "1PE", chapter: 1, startVerse: 3, endVerse: 3 }], terms: ["희망", "소망", "이유", "인자", "하나님"] },
  { match: /(공동체|혼자 완전|community|individual)/i, references: [{ code: "1CO", chapter: 12, startVerse: 12, endVerse: 27 }, { code: "GEN", chapter: 2, startVerse: 18, endVerse: 18 }, { code: "HEB", chapter: 10, startVerse: 24, endVerse: 25 }, { code: "ECC", chapter: 4, startVerse: 9, endVerse: 12 }], terms: ["혼자", "공동체", "몸", "서로", "필요"] },
  { match: /(자랑|해낸 일|교만|pride.*achievement)/i, references: [{ code: "1CO", chapter: 4, startVerse: 7, endVerse: 7 }, { code: "JAM", chapter: 4, startVerse: 6, endVerse: 6 }, { code: "DEU", chapter: 8, startVerse: 17, endVerse: 18 }, { code: "PRO", chapter: 16, startVerse: 18, endVerse: 18 }], terms: ["자랑", "교만", "은혜", "위험", "하나님"] },
  { match: /(침묵 속|잠잠.*의미|silence.*meaning)/i, references: [{ code: "PSA", chapter: 46, startVerse: 10, endVerse: 10 }, { code: "LAM", chapter: 3, startVerse: 26, endVerse: 26 }, { code: "HAB", chapter: 2, startVerse: 20, endVerse: 20 }, { code: "PSA", chapter: 62, startVerse: 1, endVerse: 1 }], terms: ["침묵", "의미", "잠잠", "기다림", "하나님"] },
  { match: /(나 자신을 용서|자신.*용서|self.*forgive)/i, references: [{ code: "1JO", chapter: 1, startVerse: 9, endVerse: 9 }, { code: "ROM", chapter: 8, startVerse: 1, endVerse: 1 }, { code: "2CO", chapter: 5, startVerse: 17, endVerse: 17 }, { code: "PSA", chapter: 103, startVerse: 10, endVerse: 12 }], terms: ["용서", "자신", "정죄", "새", "죄"] },
  { match: /(자연.*파괴|인간.*특별|creation.*nature|environment)/i, references: [{ code: "GEN", chapter: 1, startVerse: 26, endVerse: 28 }, { code: "PSA", chapter: 24, startVerse: 1, endVerse: 1 }, { code: "ROM", chapter: 8, startVerse: 19, endVerse: 22 }, { code: "REV", chapter: 11, startVerse: 18, endVerse: 18 }], terms: ["자연", "창조", "인간", "다스림", "땅"] },
  { match: /(인간 이성|이성.*믿|어디서 멈|reason.*limit)/i, references: [{ code: "PRO", chapter: 3, startVerse: 5, endVerse: 7 }, { code: "1CO", chapter: 13, startVerse: 12, endVerse: 12 }, { code: "ROM", chapter: 11, startVerse: 33, endVerse: 36 }, { code: "JAM", chapter: 1, startVerse: 5, endVerse: 5 }], terms: ["이성", "지혜", "믿음", "명철", "하나님"] },
  { match: /(하고 싶은 대로|정말 자유|freedom.*slavery)/i, references: [{ code: "JOH", chapter: 8, startVerse: 31, endVerse: 36 }, { code: "GAL", chapter: 5, startVerse: 13, endVerse: 13 }, { code: "ROM", chapter: 6, startVerse: 16, endVerse: 18 }, { code: "1PE", chapter: 2, startVerse: 16, endVerse: 16 }], terms: ["자유", "하고 싶은", "종", "진리", "사랑"] },
  { match: /(희생.*어리석|남을 위해|sacrifice)/i, references: [{ code: "JOH", chapter: 15, startVerse: 13, endVerse: 13 }, { code: "PHI", chapter: 2, startVerse: 3, endVerse: 8 }, { code: "MAR", chapter: 10, startVerse: 45, endVerse: 45 }, { code: "1JO", chapter: 3, startVerse: 16, endVerse: 16 }], terms: ["희생", "남", "사랑", "섬김", "생명"] },
  { match: /(이름 없이|기억되는가|remember.*name)/i, references: [{ code: "ISA", chapter: 49, startVerse: 15, endVerse: 16 }, { code: "LUK", chapter: 12, startVerse: 6, endVerse: 7 }, { code: "HEB", chapter: 6, startVerse: 10, endVerse: 10 }, { code: "MAL", chapter: 3, startVerse: 16, endVerse: 16 }], terms: ["이름", "기억", "사라짐", "알다", "하나님"] },
  { match: /(우주.*기도|작은 기도|prayer.*universe)/i, references: [{ code: "PSA", chapter: 8, startVerse: 3, endVerse: 4 }, { code: "MAT", chapter: 6, startVerse: 6, endVerse: 8 }, { code: "LUK", chapter: 12, startVerse: 6, endVerse: 7 }, { code: "PHI", chapter: 4, startVerse: 6, endVerse: 7 }], terms: ["우주", "작은", "기도", "의미", "돌봄"] },
  { match: /(나는 누구|내가 누구|정체성|존재.*근거|존재.*가치|who am i|identity|worth)/i, references: [{ code: "GEN", chapter: 1, startVerse: 26, endVerse: 28 }, { code: "PSA", chapter: 139, startVerse: 13, endVerse: 14 }, { code: "EPH", chapter: 2, startVerse: 10, endVerse: 10 }, { code: "JOH", chapter: 1, startVerse: 12, endVerse: 13 }], terms: ["정체성", "존재", "하나님의 형상", "창조", "자녀"] },
  { match: /(고통|고난).*(의미|삶)|meaning.*suffer|suffer.*meaning/i, references: [{ code: "ROM", chapter: 5, startVerse: 3, endVerse: 5 }, { code: "2CO", chapter: 4, startVerse: 16, endVerse: 18 }, { code: "JAM", chapter: 1, startVerse: 2, endVerse: 4 }, { code: "1PE", chapter: 1, startVerse: 6, endVerse: 7 }], terms: ["고통", "환난", "인내", "소망", "의미"] },
  { match: /(하나님의 뜻|뜻).*(자유의지|자유)|freewill|free will|sovereignty/i, references: [{ code: "PHI", chapter: 2, startVerse: 12, endVerse: 13 }, { code: "PRO", chapter: 16, startVerse: 9, endVerse: 9 }, { code: "JOS", chapter: 24, startVerse: 15, endVerse: 15 }, { code: "ROM", chapter: 9, startVerse: 20, endVerse: 21 }], terms: ["뜻", "자유", "선택", "순종", "하나님"] },
  { match: /(선하신 하나님|하나님).*(악|불의)|악.*불의|problem of evil/i, references: [{ code: "GEN", chapter: 50, startVerse: 20, endVerse: 20 }, { code: "ROM", chapter: 8, startVerse: 28, endVerse: 28 }, { code: "PSA", chapter: 73, startVerse: 16, endVerse: 17 }, { code: "HAB", chapter: 1, startVerse: 2, endVerse: 4 }], terms: ["악", "불의", "공의", "선", "하나님"] },
  { match: /(죽음|사망).*(허무|의미)|허무.*죽음|death.*meaning/i, references: [{ code: "ROM", chapter: 6, startVerse: 22, endVerse: 23 }, { code: "1CO", chapter: 15, startVerse: 54, endVerse: 58 }, { code: "JOH", chapter: 11, startVerse: 25, endVerse: 26 }, { code: "ECC", chapter: 12, startVerse: 13, endVerse: 14 }], terms: ["죽음", "허무", "부활", "영생", "생명"] },
  { match: /(진리).*(상대|성경)|상대.*진리|truth.*relative/i, references: [{ code: "JOH", chapter: 14, startVerse: 6, endVerse: 6 }, { code: "JOH", chapter: 17, startVerse: 17, endVerse: 17 }, { code: "2TI", chapter: 3, startVerse: 16, endVerse: 17 }, { code: "PSA", chapter: 119, startVerse: 160, endVerse: 160 }], terms: ["진리", "말씀", "성경", "의미"] },
  { match: /(사랑).*(감정|의무|계명)|love.*(duty|feeling)/i, references: [{ code: "1CO", chapter: 13, startVerse: 4, endVerse: 7 }, { code: "1JO", chapter: 4, startVerse: 7, endVerse: 12 }, { code: "JOH", chapter: 14, startVerse: 15, endVerse: 15 }, { code: "ROM", chapter: 13, startVerse: 8, endVerse: 10 }], terms: ["사랑", "계명", "순종", "행함", "마음"] },
  { match: /(정의|공의).*(자비|긍휼)|자비.*정의|justice.*mercy/i, references: [{ code: "MIC", chapter: 6, startVerse: 8, endVerse: 8 }, { code: "JAM", chapter: 2, startVerse: 13, endVerse: 13 }, { code: "PSA", chapter: 85, startVerse: 10, endVerse: 10 }, { code: "MAT", chapter: 23, startVerse: 23, endVerse: 23 }], terms: ["정의", "자비", "공의", "긍휼", "우선"] },
  { match: /(통제|미래|염려|불안).*(받아|어떻게)|future.*control|anxiety/i, references: [{ code: "MAT", chapter: 6, startVerse: 25, endVerse: 34 }, { code: "PHI", chapter: 4, startVerse: 6, endVerse: 7 }, { code: "PRO", chapter: 3, startVerse: 5, endVerse: 6 }, { code: "1PE", chapter: 5, startVerse: 7, endVerse: 7 }], terms: ["미래", "염려", "맡기", "믿음", "받아들임"] },
  { match: /(가면|진짜 나|진실|외식|authentic)/i, references: [{ code: "MAT", chapter: 23, startVerse: 27, endVerse: 28 }, { code: "1SA", chapter: 16, startVerse: 7, endVerse: 7 }, { code: "PSA", chapter: 139, startVerse: 23, endVerse: 24 }, { code: "EPH", chapter: 4, startVerse: 22, endVerse: 25 }], terms: ["가면", "진짜", "마음", "외식", "진실"] },
  { match: /(욕망|욕심|갈망|정욕).*(악|선|좋은)|desire/i, references: [{ code: "JAM", chapter: 1, startVerse: 14, endVerse: 15 }, { code: "GAL", chapter: 5, startVerse: 16, endVerse: 24 }, { code: "PSA", chapter: 37, startVerse: 4, endVerse: 4 }, { code: "ROM", chapter: 7, startVerse: 18, endVerse: 25 }], terms: ["욕망", "욕심", "갈망", "선", "악"] },
  { match: /(용서).*(선한 사람|선|못하는)|forgive/i, references: [{ code: "MAT", chapter: 6, startVerse: 14, endVerse: 15 }, { code: "EPH", chapter: 4, startVerse: 32, endVerse: 32 }, { code: "LEV", chapter: 19, startVerse: 18, endVerse: 18 }, { code: "COL", chapter: 3, startVerse: 13, endVerse: 13 }], terms: ["용서", "선", "사랑", "긍휼", "원수"] },
  { match: /(혼자|이해하지 못|외로|lonely|alone)/i, references: [{ code: "DEU", chapter: 31, startVerse: 6, endVerse: 6 }, { code: "PSA", chapter: 139, startVerse: 1, endVerse: 12 }, { code: "ISA", chapter: 43, startVerse: 1, endVerse: 2 }, { code: "HEB", chapter: 13, startVerse: 5, endVerse: 5 }], terms: ["혼자", "함께", "버리지", "이해", "하나님"] },
  { match: /(성과|업적|가치|worth).*(사라|없으면|work)|성과.*가치/i, references: [{ code: "EPH", chapter: 2, startVerse: 8, endVerse: 10 }, { code: "2TI", chapter: 1, startVerse: 9, endVerse: 9 }, { code: "GEN", chapter: 1, startVerse: 26, endVerse: 28 }, { code: "MAT", chapter: 6, startVerse: 26, endVerse: 26 }], terms: ["성과", "가치", "은혜", "행위", "창조"] },
  { match: /(의심).*(믿음|진짜)|믿음.*의심|doubt.*faith/i, references: [{ code: "MAR", chapter: 9, startVerse: 24, endVerse: 24 }, { code: "JAM", chapter: 1, startVerse: 5, endVerse: 6 }, { code: "JOH", chapter: 20, startVerse: 27, endVerse: 29 }, { code: "HEB", chapter: 11, startVerse: 1, endVerse: 1 }], terms: ["의심", "믿음", "도움", "구하", "확신"] },
  { match: /(행복|기쁨).*(같은|무엇)|joy.*happiness/i, references: [{ code: "PHI", chapter: 4, startVerse: 4, endVerse: 4 }, { code: "JOH", chapter: 15, startVerse: 11, endVerse: 11 }, { code: "PSA", chapter: 16, startVerse: 11, endVerse: 11 }, { code: "1TH", chapter: 5, startVerse: 16, endVerse: 18 }], terms: ["행복", "기쁨", "즐거움", "주", "마음"] },
  { match: /(시간).*(영원)|영원.*시간|eternity.*time/i, references: [{ code: "ECC", chapter: 3, startVerse: 11, endVerse: 11 }, { code: "PSA", chapter: 90, startVerse: 1, endVerse: 4 }, { code: "2PE", chapter: 3, startVerse: 8, endVerse: 8 }, { code: "REV", chapter: 1, startVerse: 8, endVerse: 8 }], terms: ["시간", "영원", "인간", "이해", "하나님"] },
  { match: /(힘|권세|권력).*(겸손)|겸손.*힘|power.*humility/i, references: [{ code: "PHI", chapter: 2, startVerse: 3, endVerse: 8 }, { code: "MAR", chapter: 10, startVerse: 42, endVerse: 45 }, { code: "JAM", chapter: 4, startVerse: 6, endVerse: 6 }, { code: "1PE", chapter: 5, startVerse: 5, endVerse: 6 }], terms: ["힘", "겸손", "권세", "섬김", "낮추"] },
  { match: /(과거|후회).*(규정|나를)|regret|past/i, references: [{ code: "PHI", chapter: 3, startVerse: 13, endVerse: 14 }, { code: "2CO", chapter: 5, startVerse: 17, endVerse: 17 }, { code: "ROM", chapter: 3, startVerse: 23, endVerse: 24 }, { code: "ISA", chapter: 43, startVerse: 18, endVerse: 19 }], terms: ["과거", "후회", "새", "용서", "규정"] },
  { match: /(아름|아름다움|초월|갈망).*(초월|아름|갈망)|beauty|transcend/i, references: [{ code: "PSA", chapter: 19, startVerse: 1, endVerse: 4 }, { code: "ROM", chapter: 1, startVerse: 20, endVerse: 20 }, { code: "ECC", chapter: 3, startVerse: 11, endVerse: 11 }, { code: "PSA", chapter: 27, startVerse: 4, endVerse: 4 }], terms: ["아름", "초월", "영광", "창조", "영원"] },
  { match: /(부활이 없다면|부활.*헛것|resurrection.*vain|vain.*faith)/i, references: [{ code: "1CO", chapter: 15, startVerse: 14, endVerse: 19 }, { code: "1CO", chapter: 15, startVerse: 20, endVerse: 22 }, { code: "ROM", chapter: 4, startVerse: 25, endVerse: 25 }, { code: "1PE", chapter: 1, startVerse: 3, endVerse: 3 }], terms: ["부활", "헛것", "믿음", "소망", "그리스도"] },
  { match: /(무덤이 비어|빈 무덤|empty tomb)/i, references: [{ code: "LUK", chapter: 24, startVerse: 1, endVerse: 7 }, { code: "JOH", chapter: 20, startVerse: 1, endVerse: 8 }, { code: "1CO", chapter: 15, startVerse: 3, endVerse: 8 }, { code: "ACT", chapter: 2, startVerse: 24, endVerse: 32 }], terms: ["무덤", "비어", "부활", "살아나", "증언"] },
  { match: /(영혼과 육체|육체와 영혼|영혼.*육체|육체.*영혼)/i, references: [{ code: "GEN", chapter: 2, startVerse: 7, endVerse: 7 }, { code: "1TH", chapter: 5, startVerse: 23, endVerse: 23 }, { code: "1CO", chapter: 6, startVerse: 19, endVerse: 20 }, { code: "MAT", chapter: 10, startVerse: 28, endVerse: 28 }], terms: ["영혼", "육체", "생기", "몸", "하나님"] },
  { match: /(죄란 무엇인가|what is sin)/i, references: [{ code: "1JO", chapter: 3, startVerse: 4, endVerse: 4 }, { code: "ROM", chapter: 3, startVerse: 23, endVerse: 23 }, { code: "JAM", chapter: 4, startVerse: 17, endVerse: 17 }, { code: "ROM", chapter: 7, startVerse: 7, endVerse: 12 }], terms: ["죄", "법", "불법", "어김", "하나님"] },
  { match: /(모든 사람이 죄인|everyone.*sinner|all.*sinned)/i, references: [{ code: "ROM", chapter: 3, startVerse: 23, endVerse: 23 }, { code: "ROM", chapter: 3, startVerse: 10, endVerse: 12 }, { code: "PSA", chapter: 14, startVerse: 2, endVerse: 3 }, { code: "GAL", chapter: 3, startVerse: 22, endVerse: 22 }], terms: ["죄인", "의인", "다", "죄", "사람"] },
  { match: /(죄의 결과|wages of sin|result of sin)/i, references: [{ code: "ROM", chapter: 6, startVerse: 23, endVerse: 23 }, { code: "JAM", chapter: 1, startVerse: 15, endVerse: 15 }, { code: "GEN", chapter: 2, startVerse: 17, endVerse: 17 }, { code: "REV", chapter: 20, startVerse: 14, endVerse: 15 }], terms: ["죽음", "삯", "멸망", "죄", "사망"] },
  { match: /(죄의 유혹.*이기|유혹을 이기는|overcome temptation|temptation)/i, references: [{ code: "1CO", chapter: 10, startVerse: 13, endVerse: 13 }, { code: "MAT", chapter: 26, startVerse: 41, endVerse: 41 }, { code: "JAM", chapter: 4, startVerse: 7, endVerse: 8 }, { code: "GAL", chapter: 5, startVerse: 16, endVerse: 17 }], terms: ["유혹", "이기", "기도", "피할 길", "성령"] },
  { match: /(속량이 무엇|redemption)/i, references: [{ code: "EPH", chapter: 1, startVerse: 7, endVerse: 7 }, { code: "COL", chapter: 1, startVerse: 13, endVerse: 14 }, { code: "MAR", chapter: 10, startVerse: 45, endVerse: 45 }, { code: "1PE", chapter: 1, startVerse: 18, endVerse: 19 }], terms: ["속량", "피", "해방", "사함", "구속"] },
  { match: /(특별하지 않은 것 같|not special)/i, references: [{ code: "PSA", chapter: 139, startVerse: 13, endVerse: 14 }, { code: "ISA", chapter: 43, startVerse: 4, endVerse: 4 }, { code: "EPH", chapter: 2, startVerse: 10, endVerse: 10 }, { code: "GEN", chapter: 1, startVerse: 26, endVerse: 28 }], terms: ["특별", "존귀", "택하", "지으심", "사랑"] },
  { match: /(실패를 경험|왜 우리는 실패|failure)/i, references: [{ code: "PRO", chapter: 24, startVerse: 16, endVerse: 16 }, { code: "MIC", chapter: 7, startVerse: 8, endVerse: 8 }, { code: "ROM", chapter: 8, startVerse: 28, endVerse: 28 }, { code: "2CO", chapter: 12, startVerse: 9, endVerse: 10 }], terms: ["실패", "넘어지", "일으키", "은혜", "소망"] },
  { match: /(영원을 사모|사모하는 마음|long for eternity)/i, references: [{ code: "ECC", chapter: 3, startVerse: 11, endVerse: 11 }, { code: "PSA", chapter: 42, startVerse: 1, endVerse: 2 }, { code: "COL", chapter: 3, startVerse: 1, endVerse: 2 }, { code: "HEB", chapter: 11, startVerse: 13, endVerse: 16 }], terms: ["영원", "사모", "하늘", "마음", "하나님"] },
  { match: /(하늘나라에서 서로 알아볼 수|heaven.*recognize|recognize.*heaven)/i, references: [{ code: "MAT", chapter: 8, startVerse: 11, endVerse: 11 }, { code: "MAT", chapter: 17, startVerse: 1, endVerse: 3 }, { code: "1TH", chapter: 4, startVerse: 13, endVerse: 18 }, { code: "LUK", chapter: 16, startVerse: 22, endVerse: 23 }], terms: ["알", "만나", "하늘", "함께", "나라"] },
  { match: /(배신당한 마음|배신.*치유|betrayal.*heal)/i, references: [{ code: "PSA", chapter: 55, startVerse: 12, endVerse: 14 }, { code: "PSA", chapter: 34, startVerse: 18, endVerse: 18 }, { code: "1PE", chapter: 5, startVerse: 7, endVerse: 7 }, { code: "MAT", chapter: 11, startVerse: 28, endVerse: 30 }], terms: ["치유", "상처", "예수", "위로", "마음"] },
  { match: /(진정한 친구란|true friend)/i, references: [{ code: "PRO", chapter: 17, startVerse: 17, endVerse: 17 }, { code: "JOH", chapter: 15, startVerse: 13, endVerse: 15 }, { code: "PRO", chapter: 18, startVerse: 24, endVerse: 24 }, { code: "ECC", chapter: 4, startVerse: 9, endVerse: 10 }], terms: ["친구", "사랑", "항상", "함께", "위로"] },
  { match: /(나쁜 습관|습관을.*변화|bad habit)/i, references: [{ code: "EPH", chapter: 4, startVerse: 22, endVerse: 24 }, { code: "ROM", chapter: 12, startVerse: 2, endVerse: 2 }, { code: "COL", chapter: 3, startVerse: 9, endVerse: 10 }, { code: "1CO", chapter: 10, startVerse: 13, endVerse: 13 }], terms: ["습관", "변화", "이기", "새 사람", "마음"] },
  { match: /(환난이란 무엇|왜 오는가.*환난|tribulation)/i, references: [{ code: "JOH", chapter: 16, startVerse: 33, endVerse: 33 }, { code: "ACT", chapter: 14, startVerse: 22, endVerse: 22 }, { code: "ROM", chapter: 5, startVerse: 3, endVerse: 5 }, { code: "REV", chapter: 7, startVerse: 14, endVerse: 14 }], terms: ["환난", "고통", "구원", "인내", "세상"] },
  { match: /(짐승의 표|666|mark of the beast)/i, references: [{ code: "REV", chapter: 13, startVerse: 16, endVerse: 18 }, { code: "REV", chapter: 14, startVerse: 9, endVerse: 11 }, { code: "REV", chapter: 16, startVerse: 2, endVerse: 2 }, { code: "REV", chapter: 20, startVerse: 4, endVerse: 4 }], terms: ["표", "666", "짐승", "지혜", "경배"] },
  { match: /(이스라엘 회복|restoration of israel)/i, references: [{ code: "ROM", chapter: 11, startVerse: 25, endVerse: 27 }, { code: "EZE", chapter: 36, startVerse: 24, endVerse: 28 }, { code: "JER", chapter: 31, startVerse: 31, endVerse: 34 }, { code: "AMO", chapter: 9, startVerse: 14, endVerse: 15 }], terms: ["이스라엘", "회복", "구원", "언약", "돌아옴"] },
  { match: /(다른 사람의 시선|사람의 시선|시선이 너무 의식|approval of others|fear of man)/i, references: [{ code: "PRO", chapter: 29, startVerse: 25, endVerse: 25 }, { code: "GAL", chapter: 1, startVerse: 10, endVerse: 10 }, { code: "1CO", chapter: 4, startVerse: 3, endVerse: 5 }, { code: "PSA", chapter: 118, startVerse: 8, endVerse: 8 }], terms: ["시선", "인정", "하나님", "두려움", "사람"] },
  { match: /(비교하는 마음|comparison|compare myself)/i, references: [{ code: "GAL", chapter: 6, startVerse: 4, endVerse: 5 }, { code: "2CO", chapter: 10, startVerse: 12, endVerse: 12 }, { code: "PHI", chapter: 2, startVerse: 3, endVerse: 4 }, { code: "JOH", chapter: 21, startVerse: 21, endVerse: 22 }], terms: ["비교", "각각", "겸손", "자랑", "부르심"] },
  { match: /(원죄|original sin)/i, references: [{ code: "ROM", chapter: 5, startVerse: 12, endVerse: 19 }, { code: "PSA", chapter: 51, startVerse: 5, endVerse: 5 }, { code: "EPH", chapter: 2, startVerse: 1, endVerse: 3 }, { code: "1CO", chapter: 15, startVerse: 21, endVerse: 22 }], terms: ["원죄", "죄", "아담", "죽음", "모든 사람"] },
  { match: /(같은 죄.*반복|죄를 반복|반복.*죄|repeat.*sin|same sin)/i, references: [{ code: "ROM", chapter: 7, startVerse: 15, endVerse: 25 }, { code: "JAM", chapter: 1, startVerse: 14, endVerse: 15 }, { code: "GAL", chapter: 5, startVerse: 16, endVerse: 17 }, { code: "PSA", chapter: 51, startVerse: 10, endVerse: 12 }], terms: ["반복", "죄", "원함", "행함", "갈등"] },
  { match: /(타인의 죄.*판단|남의 죄.*판단|판단해도 되는가|judge.*others.*sin|judge.*sin)/i, references: [{ code: "MAT", chapter: 7, startVerse: 1, endVerse: 5 }, { code: "ROM", chapter: 2, startVerse: 1, endVerse: 3 }, { code: "JAM", chapter: 4, startVerse: 11, endVerse: 12 }, { code: "JOH", chapter: 8, startVerse: 7, endVerse: 7 }], terms: ["판단", "죄", "형제", "먼저", "들보"] },
  { match: /(무지한 죄|알지 못.*죄|ignorant sin|sin of ignorance|ignorance)/i, references: [{ code: "LUK", chapter: 12, startVerse: 47, endVerse: 48 }, { code: "ACT", chapter: 17, startVerse: 30, endVerse: 30 }, { code: "JAM", chapter: 4, startVerse: 17, endVerse: 17 }, { code: "LEV", chapter: 5, startVerse: 17, endVerse: 18 }], terms: ["무지", "죄", "알지 못", "책임", "행위"] },
  { match: /(유아.*죽으면|아기가 죽으면|아기.*죽으면|infant.*die|baby.*die)/i, references: [{ code: "2SA", chapter: 12, startVerse: 22, endVerse: 23 }, { code: "MAR", chapter: 10, startVerse: 13, endVerse: 16 }, { code: "DEU", chapter: 1, startVerse: 39, endVerse: 39 }, { code: "LUK", chapter: 18, startVerse: 16, endVerse: 16 }], terms: ["유아", "죽음", "아이", "하나님", "소망"] },
  { match: /(왜 이 시대에 태어|이 시대에 태어|born.*this age|born.*this time)/i, references: [{ code: "ACT", chapter: 17, startVerse: 26, endVerse: 27 }, { code: "EST", chapter: 4, startVerse: 14, endVerse: 14 }, { code: "EPH", chapter: 2, startVerse: 10, endVerse: 10 }, { code: "PSA", chapter: 139, startVerse: 16, endVerse: 16 }], terms: ["시대", "태어", "정하심", "찾", "하나님"] },
  { match: /(죽음은 적인가 친구인가|death.*enemy|death.*friend)/i, references: [{ code: "1CO", chapter: 15, startVerse: 26, endVerse: 26 }, { code: "PHI", chapter: 1, startVerse: 21, endVerse: 23 }, { code: "ROM", chapter: 6, startVerse: 23, endVerse: 23 }, { code: "HEB", chapter: 2, startVerse: 14, endVerse: 15 }], terms: ["죽음", "적", "소멸", "두려움", "그리스도"] },
  { match: /(왜 어떤 사람은 믿고 어떤 사람은 믿지 않는가|어떤 사람은 믿고 어떤 사람은 믿지|some people.*believe.*others.*not|why.*some.*believe.*not)/i, references: [{ code: "JOH", chapter: 6, startVerse: 44, endVerse: 45 }, { code: "ROM", chapter: 10, startVerse: 17, endVerse: 17 }, { code: "MAT", chapter: 13, startVerse: 13, endVerse: 16 }, { code: "2CO", chapter: 4, startVerse: 3, endVerse: 4 }], terms: ["믿음", "듣음", "아버지", "마음", "은혜"] },
  { match: /(평가에 흔들|사람들의 평가|남의 시선|fear of man|people.*approval|people.*evaluation)/i, references: [{ code: "PRO", chapter: 29, startVerse: 25, endVerse: 25 }, { code: "GAL", chapter: 1, startVerse: 10, endVerse: 10 }, { code: "1SA", chapter: 16, startVerse: 7, endVerse: 7 }, { code: "PSA", chapter: 118, startVerse: 8, endVerse: 8 }], terms: ["평가", "흔들", "두려움", "사람", "하나님"] },
];

type RoutingRule = {
  match: RegExp;
  primaryReference: BibleReference;
  supportingReferences: BibleReference[];
  rationaleKo: string;
  rationaleEn: string;
  passageKeywordsKo: string[];
  semanticTermsKo: string[];
};

const DOCTRINAL_ROUTING_RULES: RoutingRule[] = [
  {
    match: /(살아있는|살아 남|산 자).*(천국|하늘나라|하늘)|((천국|하늘나라|하늘).*(살아있는|살아 남|산 자))|(living|alive).*(heaven|kingdom)|(heaven|kingdom).*(living|alive)/i,
    primaryReference: { code: "1TH", chapter: 4, startVerse: 15, endVerse: 17 },
    supportingReferences: [
      { code: "1CO", chapter: 15, startVerse: 51, endVerse: 52 },
      { code: "JOH", chapter: 11, startVerse: 25, endVerse: 26 },
      { code: "JOH", chapter: 3, startVerse: 13, endVerse: 13 },
      { code: "MAT", chapter: 7, startVerse: 21, endVerse: 21 },
    ],
    rationaleKo: "질문이 ‘살아 있는 사람’과 ‘천국/하늘’을 직접 함께 묻기 때문에, 주 강림 때 살아 남은 자와 죽은 자의 순서를 직접 다루는 데살로니가전서 4:15-17을 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt directly combines living persons with heaven, the primary passage is 1 Thessalonians 4:15-17, which directly addresses the order of the living and the dead at the Lord's coming.",
    passageKeywordsKo: ["살아", "남은 자", "공중", "주와 함께"],
    semanticTermsKo: ["살아", "천국", "하늘", "죽은 자"],
  },
  {
    match: /(죽으면|죽은 후|죽고 나면|바로).*(천국|하늘나라|낙원)|((천국|하늘나라|낙원).*(죽으면|죽은 후|바로))|((after death|immediately|right after|right away).*(heaven|paradise))|((heaven|paradise).*(after death|immediately|right after))/i,
    primaryReference: { code: "LUK", chapter: 23, startVerse: 43, endVerse: 43 },
    supportingReferences: [
      { code: "PHI", chapter: 1, startVerse: 23, endVerse: 23 },
      { code: "2CO", chapter: 5, startVerse: 8, endVerse: 8 },
      { code: "REV", chapter: 6, startVerse: 9, endVerse: 11 },
    ],
    rationaleKo: "질문이 죽은 직후 곧바로 천국/낙원에 가는지를 묻고 있어서, 예수님이 강도에게 ‘오늘 네가 나와 함께 낙원에 있으리라’고 말씀하신 누가복음 23:43을 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt asks about immediately going to heaven after death, the primary passage is Luke 23:43 where Jesus says, 'Today you will be with me in Paradise.'",
    passageKeywordsKo: ["오늘", "낙원", "함께"],
    semanticTermsKo: ["죽으면", "천국", "낙원", "바로"],
  },
  {
    match: /(부활).*(살아있는|살아 남|산 자)|((살아있는|살아 남|산 자).*(부활))|((마지막 날|마지막날|변화).*(살아|남은 자|산 자))|((resurrection|last day|changed).*(living|alive))|((living|alive).*(resurrection|last day|changed))/i,
    primaryReference: { code: "1CO", chapter: 15, startVerse: 51, endVerse: 52 },
    supportingReferences: [
      { code: "1TH", chapter: 4, startVerse: 15, endVerse: 17 },
      { code: "PHI", chapter: 3, startVerse: 20, endVerse: 21 },
    ],
    rationaleKo: "질문이 부활 때 살아 있는 사람이 어떻게 되는지를 직접 묻고 있어서, ‘우리가 다 잠잘 것이 아니요 ... 우리도 변화하리라’고 말하는 고린도전서 15:51-52를 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt asks what happens to the living at the resurrection, the primary passage is 1 Corinthians 15:51-52, which directly states that the living will be changed.",
    passageKeywordsKo: ["잠잘", "변화하리", "다시 살고"],
    semanticTermsKo: ["부활", "살아있는", "변화", "죽은 자"],
  },
  {
    match: /(영원히 죽지|영생|예수 믿으면).*(죽지)|((죽지).*(영생|예수 믿으면))|((believe in jesus|eternal life).*(never die|death))|((never die).*(believe|eternal life))/i,
    primaryReference: { code: "JOH", chapter: 11, startVerse: 25, endVerse: 26 },
    supportingReferences: [
      { code: "JOH", chapter: 3, startVerse: 16, endVerse: 16 },
      { code: "JOH", chapter: 5, startVerse: 24, endVerse: 24 },
      { code: "1JO", chapter: 5, startVerse: 11, endVerse: 13 },
    ],
    rationaleKo: "질문이 예수님을 믿는 사람이 영원히 죽지 않는다는 약속을 묻고 있어서, ‘살아서 나를 믿는 자는 영원히 죽지 아니하리니’라고 직접 말하는 요한복음 11:25-26을 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt asks whether believers truly do not die eternally, the primary passage is John 11:25-26, where Jesus directly says the living believer will never die.",
    passageKeywordsKo: ["살아서", "믿는 자", "영원히 죽지"],
    semanticTermsKo: ["영생", "예수", "죽지", "믿으면"],
  },
  {
    match: /(죽어도|죽어).*(다시 살|살 수 있나)|((다시 살|부활).*(죽어도|죽어))|((die|death).*(live again|rise|resurrection))|((live again|rise).*(die|death))/i,
    primaryReference: { code: "JOH", chapter: 11, startVerse: 25, endVerse: 26 },
    supportingReferences: [
      { code: "1CO", chapter: 15, startVerse: 51, endVerse: 52 },
      { code: "1TH", chapter: 4, startVerse: 14, endVerse: 17 },
      { code: "JOH", chapter: 5, startVerse: 24, endVerse: 29 },
    ],
    rationaleKo: "질문이 죽음 이후 다시 사는 소망을 직접 묻고 있어서, ‘나는 부활이요 생명이니 ... 죽어도 살겠고’라고 직접 말하는 요한복음 11:25-26을 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt asks whether one can live again after death, the primary passage is John 11:25-26 where Jesus directly says, 'whoever dies shall live.'",
    passageKeywordsKo: ["죽어도", "살겠고", "부활", "생명"],
    semanticTermsKo: ["죽어도", "다시 살", "부활", "생명"],
  },
  {
    match: /(천국).*(못 들어|들어갈 수 있나|누가 들어가|들어가나)|((구원받은|구원).*(천국|하늘나라))|((천국|하늘나라).*(누가|어떻게).*(들어가))|((saved|kingdom|heaven).*(enter|fail to enter|who enters))|((who|actually).*(enter).*(kingdom|heaven))/i,
    primaryReference: { code: "MAT", chapter: 7, startVerse: 21, endVerse: 21 },
    supportingReferences: [
      { code: "MAT", chapter: 25, startVerse: 34, endVerse: 34 },
      { code: "REV", chapter: 21, startVerse: 27, endVerse: 27 },
      { code: "HEB", chapter: 12, startVerse: 14, endVerse: 14 },
    ],
    rationaleKo: "질문이 천국에 실제로 들어가는 기준을 묻고 있어서, ‘천국에 다 들어갈 것이 아니요 ... 아버지의 뜻대로 행하는 자’라고 직접 말하는 마태복음 7:21을 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt asks who actually enters the kingdom, the primary passage is Matthew 7:21, which directly distinguishes profession from doing the Father's will.",
    passageKeywordsKo: ["천국에", "들어갈", "아버지의 뜻"],
    semanticTermsKo: ["천국", "구원", "들어갈", "못"],
  },
  {
    match: /(hope).*(losing).*(family member)|((losing).*(family member).*(hope))|((family member).*(loss|losing))/i,
    primaryReference: { code: "1TH", chapter: 4, startVerse: 13, endVerse: 18 },
    supportingReferences: [
      { code: "JOH", chapter: 11, startVerse: 25, endVerse: 26 },
      { code: "PSA", chapter: 34, startVerse: 18, endVerse: 18 },
      { code: "REV", chapter: 21, startVerse: 4, endVerse: 4 },
    ],
    rationaleKo: "질문이 사랑하는 사람의 죽음 앞에서 슬픔과 소망을 함께 묻고 있어서, ‘소망 없는 다른 이와 같이 슬퍼하지 않게 하려 함이라’고 직접 말하는 데살로니가전서 4:13-18을 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt combines grief and hope after losing a family member, the primary passage is 1 Thessalonians 4:13-18, which directly addresses grief with resurrection hope.",
    passageKeywordsKo: ["슬퍼하지", "소망", "죽은 자"],
    semanticTermsKo: ["죽음", "슬퍼", "사랑하는", "소망"],
  },
  {
    match: /(사랑하는 사람|사람이|가족).*(죽어서|죽었|죽음|슬퍼|잃고)|((죽어서|죽음|슬퍼|잃고).*(사랑하는 사람|사람이|가족))|((슬픈데|슬퍼).*(소망))|((someone i love|family member|loved one).*(died|death|grief|loss))|((grief|lost|loss|losing).*(hope|loved one|family|family member))|((hope).*(losing|lost).*(family member|loved one|family))|((family member|loved one).*(lost|losing|died|death))/i,
    primaryReference: { code: "1TH", chapter: 4, startVerse: 13, endVerse: 18 },
    supportingReferences: [
      { code: "JOH", chapter: 11, startVerse: 25, endVerse: 26 },
      { code: "PSA", chapter: 34, startVerse: 18, endVerse: 18 },
      { code: "REV", chapter: 21, startVerse: 4, endVerse: 4 },
    ],
    rationaleKo: "질문이 사랑하는 사람의 죽음 앞에서 슬픔과 소망을 함께 묻고 있어서, ‘소망 없는 다른 이와 같이 슬퍼하지 않게 하려 함이라’고 직접 말하는 데살로니가전서 4:13-18을 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt combines grief and hope after a loved one's death, the primary passage is 1 Thessalonians 4:13-18, which directly addresses grief with resurrection hope.",
    passageKeywordsKo: ["슬퍼하지", "소망", "죽은 자"],
    semanticTermsKo: ["죽음", "슬퍼", "사랑하는", "소망"],
  },
  {
    match: /(침묵|응답이 없|응답이 없으|기도해도|잠잠|응답).*(하나님)|((하나님).*(침묵|기도해도|잠잠|응답))|((god).*(silent|silence|not answer|no answer))|((prayer|prayers).*(silent|no answer|not answer))/i,
    primaryReference: { code: "PSA", chapter: 13, startVerse: 1, endVerse: 2 },
    supportingReferences: [
      { code: "HAB", chapter: 1, startVerse: 2, endVerse: 3 },
      { code: "LAM", chapter: 3, startVerse: 25, endVerse: 26 },
      { code: "PSA", chapter: 42, startVerse: 5, endVerse: 5 },
    ],
    rationaleKo: "질문이 하나님의 침묵과 지연된 응답을 묻고 있어서, ‘어느 때까지니이까’로 시작하는 시편 13:1-2를 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt asks about God's silence, the primary passage is Psalm 13:1-2, which directly voices, 'How long, O Lord?'",
    passageKeywordsKo: ["어느 때까지", "잊으시나이까", "근심"],
    semanticTermsKo: ["침묵", "기도", "하나님", "응답"],
  },
  {
    match: /(죄책감|내 죄|용서하셨|못 가겠어|정죄).*(하나님)|((하나님).*(죄책감|용서하셨|정죄))|((guilt|forgiven|forgive|condemnation).*(god|sin))|((has god).*(forgiven|forgive))/i,
    primaryReference: { code: "1JO", chapter: 1, startVerse: 9, endVerse: 9 },
    supportingReferences: [
      { code: "ROM", chapter: 8, startVerse: 1, endVerse: 1 },
      { code: "PSA", chapter: 103, startVerse: 10, endVerse: 12 },
      { code: "PSA", chapter: 51, startVerse: 10, endVerse: 12 },
    ],
    rationaleKo: "질문이 죄책감과 실제 용서를 묻고 있어서, ‘우리 죄를 자백하면 ... 깨끗케 하실 것이요’라고 직접 말하는 요한일서 1:9를 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt asks whether God has truly forgiven sin, the primary passage is 1 John 1:9, which directly promises forgiveness and cleansing to the one who confesses.",
    passageKeywordsKo: ["죄를 자백", "용서", "깨끗케"],
    semanticTermsKo: ["죄책감", "용서", "죄", "정죄"],
  },
  {
    match: /(부르심|부르시는|두렵|두려워|미래|감당).*(모르겠|무섭|맞는지)|((모르겠|무섭|맞는지).*(부르심|부르시는|두렵|미래))|((calling|future|afraid|fear).*(unsure|don't know|not sure))|((god).*(calling).*(afraid|fear))/i,
    primaryReference: { code: "JOS", chapter: 1, startVerse: 9, endVerse: 9 },
    supportingReferences: [
      { code: "EXO", chapter: 3, startVerse: 11, endVerse: 12 },
      { code: "ISA", chapter: 41, startVerse: 10, endVerse: 10 },
      { code: "JDG", chapter: 6, startVerse: 14, endVerse: 16 },
    ],
    rationaleKo: "질문이 부르심 앞의 두려움과 미래를 묻고 있어서, ‘두려워 말라 ... 네 하나님 여호와가 함께 하느니라’고 직접 말하는 여호수아 1:9를 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt asks about fear and calling, the primary passage is Joshua 1:9, which directly joins courage with God's presence.",
    passageKeywordsKo: ["두려워 말라", "강하고 담대", "함께"],
    semanticTermsKo: ["두렵", "부르심", "미래", "감당"],
  },
  {
    match: /(지혜|결정|혼란|분별|인도).*(싶|필요)|((싶|필요).*(지혜|결정|혼란))|((wisdom|decision|confused|guidance).*(need|major|big))|((decision).*(wisdom|confused))/i,
    primaryReference: { code: "JAM", chapter: 1, startVerse: 5, endVerse: 5 },
    supportingReferences: [
      { code: "PRO", chapter: 3, startVerse: 5, endVerse: 6 },
      { code: "PSA", chapter: 25, startVerse: 4, endVerse: 5 },
      { code: "COL", chapter: 1, startVerse: 9, endVerse: 10 },
    ],
    rationaleKo: "질문이 지혜와 결정을 묻고 있어서, ‘너희 중에 누구든지 지혜가 부족하거든 ... 하나님께 구하라’고 직접 말하는 야고보서 1:5를 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt asks for wisdom in decision-making, the primary passage is James 1:5, which directly calls the person lacking wisdom to ask God.",
    passageKeywordsKo: ["지혜가 부족", "구하라"],
    semanticTermsKo: ["지혜", "결정", "혼란", "인도"],
  },
  {
    match: /(믿음이\s*뭔데|믿음은\s*뭔데|믿음이\s*뭐야|믿음은\s*뭐야|what is faith|define faith)/i,
    primaryReference: { code: "HEB", chapter: 11, startVerse: 1, endVerse: 3 },
    supportingReferences: [
      { code: "ROM", chapter: 10, startVerse: 17, endVerse: 17 },
      { code: "EPH", chapter: 2, startVerse: 8, endVerse: 10 },
      { code: "JAM", chapter: 2, startVerse: 17, endVerse: 18 },
    ],
    rationaleKo: "질문이 믿음의 뜻 자체를 묻고 있어서, ‘바라는 것들의 실상’으로 믿음을 정의하는 히브리서 11:1-3을 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt asks what faith is, the primary passage is Hebrews 11:1-3, which defines faith as assurance and conviction.",
    passageKeywordsKo: ["믿음", "바라는 것들", "실상", "보이지 않는 것들"],
    semanticTermsKo: ["믿음", "정의", "신뢰", "은혜"],
  },
  {
    match: /(일이.*불안|불안.*일이|마음이\s*무너|무너지는\s*것\s*같아|anxious.*work|work.*anxious|falling apart)/i,
    primaryReference: { code: "MAT", chapter: 11, startVerse: 28, endVerse: 30 },
    supportingReferences: [
      { code: "PHI", chapter: 4, startVerse: 6, endVerse: 7 },
      { code: "PSA", chapter: 34, startVerse: 18, endVerse: 18 },
      { code: "ISA", chapter: 41, startVerse: 10, endVerse: 10 },
    ],
    rationaleKo: "질문이 일과 마음의 무너짐을 함께 말하므로, 먼저 수고하고 무거운 짐 진 자를 쉬게 하시겠다는 마태복음 11:28-30을 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt joins work-anxiety with emotional collapse, the primary passage is Matthew 11:28-30, where Jesus invites the weary and burdened to rest.",
    passageKeywordsKo: ["수고", "무거운 짐", "쉬게", "불안"],
    semanticTermsKo: ["불안", "마음", "무너짐", "쉼"],
  },
  {
    match: /(용서하기|용서하는|배신한|원수|분노|원망).*(힘들|어려)|((힘들|어려).*(용서|배신))|((forgive|forgiving|betrayed|betrayal).*(hard|difficult|impossible))|((hard|difficult).*(forgive|betrayed))/i,
    primaryReference: { code: "MAT", chapter: 18, startVerse: 21, endVerse: 22 },
    supportingReferences: [
      { code: "EPH", chapter: 4, startVerse: 31, endVerse: 32 },
      { code: "ROM", chapter: 12, startVerse: 19, endVerse: 21 },
      { code: "COL", chapter: 3, startVerse: 12, endVerse: 13 },
    ],
    rationaleKo: "질문이 배신한 사람을 용서하기 어려운 상황을 묻고 있어서, ‘일곱 번뿐 아니라 일흔 번씩 일곱 번이라도 할찌니라’고 직접 말하는 마태복음 18:21-22를 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt asks about the difficulty of forgiving betrayal, the primary passage is Matthew 18:21-22, where Jesus directly answers how often to forgive.",
    passageKeywordsKo: ["용서하여", "일흔 번씩 일곱 번"],
    semanticTermsKo: ["용서", "배신", "원수", "분노"],
  },
  {
    match: /((삶|사는|살아야|살\s?이유|왜\s?살).*(지치|지쳤|지쳐|지친|무기력|힘들|피곤))|((지치|지쳤|지쳐|지친|무기력|힘들|피곤).*(삶|살아야|살\s?이유|왜\s?살|모르겠))|(weary|tired|exhausted).*(reason to live|why live|purpose)/i,
    primaryReference: { code: "MAT", chapter: 11, startVerse: 28, endVerse: 30 },
    supportingReferences: [
      { code: "EPH", chapter: 2, startVerse: 10, endVerse: 10 },
      { code: "PSA", chapter: 139, startVerse: 13, endVerse: 16 },
      { code: "LAM", chapter: 3, startVerse: 21, endVerse: 24 },
      { code: "PSA", chapter: 42, startVerse: 5, endVerse: 5 },
    ],
    rationaleKo: "입력이 지침과 ‘왜 살아야 하는지’라는 존재·목적 질문을 함께 말하기 때문에, 먼저 지친 사람을 쉬게 하겠다고 초대하는 마태복음 11:28-30을 중심 본문으로 두고 목적과 소망 본문을 함께 붙였습니다.",
    rationaleEn: "Because the prompt joins weariness with a reason-to-live or purpose question, the primary passage is Matthew 11:28-30, with supporting passages for purpose and hope.",
    passageKeywordsKo: ["지침", "수고", "무거운 짐", "쉬게", "살아야"],
    semanticTermsKo: ["지쳤", "삶", "목적", "소망", "존재"],
  },
  {
    match: /(희망이\s?없|아무\s?희망|버티기\s?힘들|더는\s?못\s?버티|왜\s?버텨야|버텨야\s?하는지|왜\s?견뎌야|견뎌야\s?하는지|살\s?이유가\s?없|소망.*없|hopeless|no reason to live|can't go on|cant go on)/i,
    primaryReference: { code: "LAM", chapter: 3, startVerse: 21, endVerse: 24 },
    supportingReferences: [
      { code: "ROM", chapter: 15, startVerse: 13, endVerse: 13 },
      { code: "PSA", chapter: 42, startVerse: 5, endVerse: 5 },
      { code: "1PE", chapter: 1, startVerse: 3, endVerse: 3 },
      { code: "MAT", chapter: 11, startVerse: 28, endVerse: 30 },
    ],
    rationaleKo: "입력이 희망을 잃은 절망을 말하기 때문에, ‘오히려 소망이 있사옴은 ... 주의 긍휼이 무궁하심’으로 소망의 근거를 말하는 예레미야애가 3:21-24를 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt names despair or loss of hope, the primary passage is Lamentations 3:21-24, which explicitly grounds hope in God's mercies.",
    passageKeywordsKo: ["소망", "긍휼", "인자", "새로우니"],
    semanticTermsKo: ["희망", "소망", "절망", "버티기"],
  },
  {
    match: /(왜\s?살아야|살아야\s?(하는|되는|될)?지|살\s?이유|사는\s?이유|삶.*(목적|의미)|무엇을 위해 살아|존재.*이유|reason to live|why.*live|purpose.*life|meaning.*life)/i,
    primaryReference: { code: "EPH", chapter: 2, startVerse: 10, endVerse: 10 },
    supportingReferences: [
      { code: "PSA", chapter: 139, startVerse: 13, endVerse: 16 },
      { code: "GEN", chapter: 1, startVerse: 26, endVerse: 28 },
      { code: "ECC", chapter: 12, startVerse: 13, endVerse: 14 },
      { code: "JOH", chapter: 1, startVerse: 12, endVerse: 13 },
    ],
    rationaleKo: "입력이 삶의 목적이나 살아야 할 이유를 묻고 있어서, ‘선한 일을 위하여 지으심을 받은 자’라고 말하는 에베소서 2:10을 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt asks about purpose or a reason to live, the primary passage is Ephesians 2:10, which speaks of being created for good works.",
    passageKeywordsKo: ["지으심", "선한 일", "살아야", "목적"],
    semanticTermsKo: ["삶", "목적", "존재", "이유"],
  },
  {
    match: /(힘들|지치|지쳤|지쳐|지친|지침|피곤|번아웃|무기력|수고|무거운 짐|부담|weary|burden|burnout|exhausted|tired)/i,
    primaryReference: { code: "MAT", chapter: 11, startVerse: 28, endVerse: 30 },
    supportingReferences: [
      { code: "ISA", chapter: 40, startVerse: 29, endVerse: 31 },
      { code: "2CO", chapter: 1, startVerse: 3, endVerse: 6 },
      { code: "GAL", chapter: 6, startVerse: 2, endVerse: 2 },
    ],
    rationaleKo: "입력이 지침·피곤함·무거운 부담을 말하기 때문에, ‘수고하고 무거운 짐 진 자들아 ... 쉬게 하리라’고 직접 초대하는 마태복음 11:28-30을 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt names weariness or a heavy burden, the primary passage is Matthew 11:28-30, where Jesus directly invites the weary and burdened to rest.",
    passageKeywordsKo: ["수고", "무거운 짐", "쉬게"],
    semanticTermsKo: ["힘들", "지쳐", "피곤", "부담"],
  },
];

const PASSAGE_CONCEPTS = [
  { key: "heaven", prompt: /(천국|하늘나라|하늘|영생|낙원|heaven|kingdom|eternal life|paradise)/i, verse: /(천국|하늘나라|하늘|영생|낙원|하늘에|공중|주와 함께)/i },
  { key: "alive", prompt: /(살아있는|살아 남|살아서|산 자|alive|living)/i, verse: /(살아|남은 자|산 자|살아서|잠잘 것이 아니|변화하리|죽지 아니하리)/i },
  { key: "resurrection", prompt: /(부활|죽은 자|죽지|변화|들림|강림|resurrection|dead|changed|rapture)/i, verse: /(부활|죽은 자|다시 살고|변화하리|끌어올려|강림|일어나고)/i },
  { key: "entry", prompt: /(못가|들어가|올라가|들어갈|go|enter|ascend)/i, verse: /(들어가지 못|들어가리라|올라간 자|영접하게|끌어올려)/i },
] as const;

function expandQuery(input: string) {
  const additions = QUERY_EXPANSIONS.filter((entry) => entry.match.test(input)).map((entry) => entry.terms);
  return additions.length ? `${input} ${additions.join(" ")}` : input;
}

function buildTermFrequency(tokens: string[]) {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

function cosineTfIdfSimilarity(promptTf: Map<string, number>, corpusTf: Map<string, number>, idf: Map<string, number>) {
  const terms = new Set([...promptTf.keys(), ...corpusTf.keys()]);
  let dot = 0;
  let promptNorm = 0;
  let corpusNorm = 0;
  for (const term of terms) {
    const weight = idf.get(term) ?? 0;
    const promptWeight = (promptTf.get(term) ?? 0) * weight;
    const corpusWeight = (corpusTf.get(term) ?? 0) * weight;
    dot += promptWeight * corpusWeight;
    promptNorm += promptWeight * promptWeight;
    corpusNorm += corpusWeight * corpusWeight;
  }
  if (!promptNorm || !corpusNorm) return 0;
  return dot / (Math.sqrt(promptNorm) * Math.sqrt(corpusNorm));
}

type ClusterCorpusEntry = { cluster: StoryCluster; corpus: string; tokens: string[]; tf: Map<string, number> };
type CorporaResult = { corpora: ClusterCorpusEntry[]; idf: Map<string, number> };
const corporaCache = new Map<string, CorporaResult>();

async function loadClusterCorpora(locale?: string): Promise<CorporaResult> {
  const appLocale = resolveAppLocale(locale);
  const cached = corporaCache.get(appLocale);
  if (cached) return cached;

  const corpora = await Promise.all(
    STORY_CLUSTERS.map(async (baseCluster) => {
      const cluster = localizeStoryCluster(baseCluster, appLocale);
      const primaryUnit = await findPassageUnit(cluster.primary, appLocale);
      const passageCorpus = [
        primaryUnit?.text,
        primaryUnit?.excerpt,
        primaryUnit?.summary,
        primaryUnit?.searchCorpus,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const descriptorCorpus = [
        cluster.title,
        cluster.pastoralPrompt,
        cluster.starterPrompt,
        cluster.searchHints.join(" "),
        cluster.themes.join(" "),
        cluster.emotions.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      const corpus = `${descriptorCorpus} ${passageCorpus}`.trim();
      const tokens = tokenize(corpus);
      const tf = buildTermFrequency(tokens);
      return { cluster, corpus, tokens, tf };
    }),
  );
  const documentFrequency = new Map<string, number>();
  for (const entry of corpora) for (const term of new Set(entry.tokens)) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  const idf = new Map<string, number>();
  const totalDocs = corpora.length;
  for (const [term, df] of documentFrequency.entries()) idf.set(term, Math.log((1 + totalDocs) / (1 + df)) + 1);
  const result = { corpora, idf };
  corporaCache.set(appLocale, result);
  return result;
}

type EmbeddingsResult = { model: string | null; vectors: Map<string, number[]> | null };
const embeddingsCache = new Map<string, EmbeddingsResult>();

async function loadClusterEmbeddings(locale?: string): Promise<EmbeddingsResult> {
  const appLocale = resolveAppLocale(locale);
  const cached = embeddingsCache.get(appLocale);
  if (cached) return cached;
  if (!ENABLE_RUNTIME_CLUSTER_EMBEDDINGS) return { model: null, vectors: null };
  const config = await getEmbeddingProviderConfig();
  if (!config.ready) return { model: null, vectors: null };
  const { corpora } = await loadClusterCorpora(locale);
  const pairs: Array<readonly [string, number[] | null]> = [];
  for (const { cluster, corpus } of corpora) pairs.push([cluster.slug, await createEmbedding(corpus)] as const);
  const vectors = new Map<string, number[]>();
  for (const [slug, embedding] of pairs) if (embedding) vectors.set(slug, embedding);
  const result = { model: vectors.size ? config.model : null, vectors: vectors.size ? vectors : null };
  embeddingsCache.set(appLocale, result);
  return result;
}


function formatPassageReference(reference: BibleReference) {
  const tail = reference.startVerse === reference.endVerse ? `${reference.chapter}:${reference.startVerse}` : `${reference.chapter}:${reference.startVerse}-${reference.endVerse}`;
  return `${reference.code} ${tail}`;
}

function passageKey(reference: BibleReference) {
  return `${reference.code}-${reference.chapter}-${reference.startVerse}-${reference.endVerse}`;
}

function buildReferenceCandidateFromUnit(
  unit: BiblePassageUnit,
  score: number,
  matchedTerms: string[],
): PassageCandidate {
  return {
    reference: unit.reference,
    excerpt: unit.text ?? unit.excerpt ?? "",
    score,
    matchedTerms,
    matchedConcepts: ["curated-prior"],
  };
}

async function buildPriorPassageCandidates(locale: string | undefined, prompt: string): Promise<PassageCandidate[]> {
  const profile = PHILOSOPHICAL_PASSAGE_PRIORS.find((entry) => entry.match.test(prompt));
  if (!profile) return [];

  const candidates = await Promise.all(
    profile.references.map(async (reference, index) => {
      const unit = await findPassageUnit(reference, locale);
      return unit ? buildReferenceCandidateFromUnit(unit, 120 - index * 4, profile.terms) : null;
    }),
  );
  return candidates.filter((candidate): candidate is PassageCandidate => !!candidate);
}

function mergePassageCandidates(primary: PassageCandidate[], fallback: PassageCandidate[], limit = 12) {
  const merged: PassageCandidate[] = [];
  const seen = new Set<string>();
  for (const candidate of [...primary, ...fallback]) {
    const key = passageKey(candidate.reference);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(candidate);
    if (merged.length >= limit) break;
  }
  return merged;
}

function scoreUnitCandidate(unit: BiblePassageUnit, promptTokens: string[], conceptPrompt: string) {
  const lowerText = [unit.text ?? unit.excerpt ?? "", unit.searchCorpus ?? "", unit.summary]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const matchedTerms = [...new Set(promptTokens.filter((token) => lowerText.includes(token)))];
  const matchedConcepts = PASSAGE_CONCEPTS.filter((rule) => rule.prompt.test(conceptPrompt) && rule.verse.test(lowerText)).map((rule) => rule.key);
  let score = matchedTerms.length * 2 + matchedConcepts.length * 3;
  if (matchedTerms.length >= 2) score += 2;
  if (matchedConcepts.includes("heaven") && matchedConcepts.includes("alive")) score += 4;
  if (matchedConcepts.includes("alive") && matchedConcepts.includes("resurrection")) score += 3;
  if (matchedConcepts.includes("entry")) score += 2;
  return { score, matchedTerms, matchedConcepts };
}

function buildGlobalPassageCandidates(
  units: BiblePassageUnit[],
  promptTokens: string[],
  conceptPrompt: string,
  limit = 8,
): PassageCandidate[] {
  if (!units.length) return [];
  return units
    .map((unit) => ({ unit, ...scoreUnitCandidate(unit, promptTokens, conceptPrompt) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => ({
      reference: entry.unit.reference,
      excerpt: entry.unit.text ?? entry.unit.excerpt ?? "",
      score: entry.score,
      matchedTerms: entry.matchedTerms,
      matchedConcepts: entry.matchedConcepts,
    }));
}

function confidenceFor(score: number, passageScore: number, matchedConcepts: number): RetrievalConfidence {
  if (passageScore >= 12 || score >= 28 || matchedConcepts >= 2) return "high";
  if (passageScore >= 5 || score >= 14) return "medium";
  return "low";
}

type ClusterRetrievalScoreParams = {
  appLocale: ReturnType<typeof resolveAppLocale>;
  expandedPrompt: string;
  promptTokens: string[];
  promptTf: Map<string, number>;
  corpora: ClusterCorpusEntry[];
  idf: Map<string, number>;
  bestPassage: PassageCandidate | null;
  supportingReferences: BibleReference[];
  passageCandidates: PassageCandidate[];
  options: RetrievalOptions;
  question: QuestionUnderstanding;
  embeddingModel: string | null;
  clusterVectors: Map<string, number[]> | null;
  promptEmbedding: number[] | null;
};

function shouldUseClusterEmbeddings(promptTokens: string[], tfidfBest: RetrievalResult | null) {
  if (!ENABLE_RUNTIME_CLUSTER_EMBEDDINGS) return false;
  if (promptTokens.length < 3) return false;
  return !tfidfBest || tfidfBest.confidence === "low";
}

function scoreClusterRetrievals({
  appLocale,
  expandedPrompt,
  promptTokens,
  promptTf,
  corpora,
  idf,
  bestPassage,
  supportingReferences,
  passageCandidates,
  options,
  question,
  embeddingModel,
  clusterVectors,
  promptEmbedding,
}: ClusterRetrievalScoreParams): RetrievalResult[] {
  const lowerPrompt = expandedPrompt.toLowerCase();
  const embeddingEnabled = !!promptEmbedding && !!clusterVectors && !!embeddingModel;

  return corpora.map(({ cluster, corpus, tf }) => {
    const matchedHints = cluster.searchHints.filter((hint) => lowerPrompt.includes(hint.toLowerCase()));
    const matchedThemes = cluster.themes.filter((theme) => lowerPrompt.includes(theme.toLowerCase()));
    const matchedEmotions = cluster.emotions.filter((emotion) => lowerPrompt.includes(emotion.toLowerCase()));
    const semanticTerms = [...new Set(promptTokens.filter((token) => tf.has(token)))].sort((a, b) => (idf.get(b) ?? 0) - (idf.get(a) ?? 0)).slice(0, 5);
    const semanticScore = cosineTfIdfSimilarity(promptTf, tf, idf);
    const embeddingScore = embeddingEnabled && clusterVectors.has(cluster.slug) ? cosineEmbeddingSimilarity(promptEmbedding, clusterVectors.get(cluster.slug) ?? []) : 0;
    const passageMatch = bestPassage && bestPassage.reference.code === cluster.primary.code ? bestPassage : null;
    const passageKeywords = passageMatch?.matchedTerms.slice(0, 6) ?? [...new Set(promptTokens.filter((token) => corpus.includes(token)))].slice(0, 6);
    const laneScore = matchedHints.length * 3 + matchedThemes.length * 2 + matchedEmotions.length * 2 + semanticScore * 6 + embeddingScore * 10;
    const passageScore = passageMatch?.score ?? 0;
    const score = laneScore + passageScore * 6;
    const confidence = confidenceFor(score, passageScore, passageMatch?.matchedConcepts.length ?? 0);
    const rationaleParts = appLocale === "ko"
      ? [
          passageMatch ? `대표 본문: ${formatPassageReference(passageMatch.reference)}` : null,
          passageKeywords.length ? `맞은 본문어: ${passageKeywords.join(", ")}` : null,
          passageMatch?.matchedConcepts.length ? `질문 개념: ${passageMatch.matchedConcepts.join(", ")}` : null,
          semanticTerms.length ? `의미상 핵심어: ${semanticTerms.join(", ")}` : null,
          passageScore ? `본문 점수: ${passageScore.toFixed(2)}` : null,
          semanticScore ? `의미 점수: ${semanticScore.toFixed(3)}` : null,
          embeddingScore ? `임베딩 점수: ${embeddingScore.toFixed(3)}` : null,
        ].filter(Boolean)
      : [
          passageMatch ? `primary passage: ${formatPassageReference(passageMatch.reference)}` : null,
          passageKeywords.length ? `matched passage terms: ${passageKeywords.join(", ")}` : null,
          passageMatch?.matchedConcepts.length ? `query concepts: ${passageMatch.matchedConcepts.join(", ")}` : null,
          semanticTerms.length ? `semantic terms: ${semanticTerms.join(", ")}` : null,
          passageScore ? `passage score: ${passageScore.toFixed(2)}` : null,
          semanticScore ? `semantic score: ${semanticScore.toFixed(3)}` : null,
          embeddingScore ? `embedding score: ${embeddingScore.toFixed(3)}` : null,
        ].filter(Boolean);

    return {
      cluster,
      score,
      laneScore,
      passageScore,
      semanticScore,
      embeddingScore,
      retrievalMode: embeddingEnabled ? "embeddings" : embeddingModel ? "embedding-fallback" : "tfidf",
      embeddingModel,
      reasons: { matchedHints, matchedThemes, matchedEmotions, passageKeywords, semanticTerms },
      rationale: rationaleParts.join(" · ") || (appLocale === "ko" ? "66권 성경 코퍼스 기본 매칭" : "66-book corpus baseline match"),
      confidence,
      primaryReference: passageMatch?.reference ?? cluster.primary,
      primaryExcerpt: passageMatch?.excerpt ?? "",
      supportingReferences,
      passageCandidates,
      expansionSummary: options.queryPlan?.expansionSummary ?? options.expansionSummary ?? null,
      expansionProvider: options.queryPlan?.expansionProvider ?? options.expansionProvider ?? null,
      question,
    } satisfies RetrievalResult;
  });
}

function buildRuleBasedRetrieval(prompt: string, locale?: string, options: RetrievalOptions = {}): RetrievalResult | null {
  const appLocale = resolveAppLocale(locale);
  const matchedRule = DOCTRINAL_ROUTING_RULES.find((rule) => rule.match.test(prompt));
  if (!matchedRule) return null;
  const cluster = localizeStoryCluster(STORY_CLUSTERS.find((entry) => entry.primary.code === matchedRule.primaryReference.code) ?? STORY_CLUSTERS[0], appLocale);
  return {
    cluster,
    score: 72,
    laneScore: 12,
    passageScore: 10,
    semanticScore: 0.75,
    embeddingScore: 0,
    retrievalMode: "tfidf",
    embeddingModel: null,
    reasons: {
      matchedHints: [],
      matchedThemes: [],
      matchedEmotions: [],
      passageKeywords: [...matchedRule.passageKeywordsKo],
      semanticTerms: [...matchedRule.semanticTermsKo],
    },
    rationale: appLocale === "ko" ? matchedRule.rationaleKo : matchedRule.rationaleEn,
    confidence: "high",
    primaryReference: matchedRule.primaryReference,
    primaryExcerpt: "",
    supportingReferences: matchedRule.supportingReferences,
    passageCandidates: [
      {
        reference: matchedRule.primaryReference,
        excerpt: "",
        score: 10,
        matchedTerms: [...matchedRule.passageKeywordsKo],
        matchedConcepts: [...matchedRule.semanticTermsKo],
      },
    ],
    expansionSummary: options.expansionSummary ?? null,
    expansionProvider: options.expansionProvider ?? null,
  };
}

function buildPriorProfileRetrieval(prompt: string, locale?: string, options: RetrievalOptions = {}): RetrievalResult | null {
  const appLocale = resolveAppLocale(locale);
  const profile = PHILOSOPHICAL_PASSAGE_PRIORS.find((entry) => entry.match.test(prompt));
  if (!profile) return null;

  const [primaryReference, ...supportingReferences] = profile.references;
  if (!primaryReference) return null;
  const cluster = localizeStoryCluster(
    STORY_CLUSTERS.find((entry) => entry.primary.code === primaryReference.code) ?? STORY_CLUSTERS[0],
    appLocale,
  );
  const rationale = appLocale === "ko"
    ? `${formatPassageReference(primaryReference)}를 중심 본문으로 우선 고정하고, 같은 질문을 보강하는 본문들을 함께 읽습니다.`
    : `Use ${formatPassageReference(primaryReference)} as the primary passage with supporting passages that strengthen the same question.`;

  return {
    cluster,
    score: 72,
    laneScore: 10,
    passageScore: 10,
    semanticScore: 0.8,
    embeddingScore: 0,
    retrievalMode: "tfidf",
    embeddingModel: null,
    reasons: {
      matchedHints: [],
      matchedThemes: [],
      matchedEmotions: [],
      passageKeywords: [...profile.terms],
      semanticTerms: [...profile.terms],
    },
    rationale,
    confidence: "high",
    primaryReference,
    primaryExcerpt: "",
    supportingReferences: supportingReferences.slice(0, 4),
    passageCandidates: [primaryReference, ...supportingReferences.slice(0, 4)].map((reference, index) => ({
      reference,
      excerpt: "",
      score: 10 - index,
      matchedTerms: [...profile.terms],
      matchedConcepts: [...profile.terms],
    })),
    expansionSummary: options.queryPlan?.expansionSummary ?? options.expansionSummary ?? null,
    expansionProvider: options.queryPlan?.expansionProvider ?? options.expansionProvider ?? null,
  };
}
function isOffTopicEverydayPrompt(prompt: string) {
  const hasEverydayChoice = /(점심|저녁|아침|뭐 먹|메뉴|노트북|컴퓨터|핸드폰|쇼핑|살까 말까|구매|가격|여행지|영화|게임|주식|코인|맛집|coffee|tea|buy|purchase|lunch|dinner|breakfast|menu|movie|game|stock|crypto|restaurant)/i.test(prompt);
  const hasVagueNonConcern = /(아무 생각|그냥 모르|딱히|할 말 없|nothing much|no thoughts)/i.test(prompt);
  const hasSpiritualFrame = /(하나님|예수|성경|기도|믿음|죄|용서|소망|사랑|정의|자비|진리|영원|죽음|고통|의미|정체성|존재|가치|겸손|의심|기쁨|아름|초월|불안|미래|외로|선|악|철학|삶|무기력|슬픔|두려|힘들|지쳐)/i.test(prompt);
  return (hasEverydayChoice || hasVagueNonConcern) && !hasSpiritualFrame;
}

function lowConfidenceFallback(appLocale: ReturnType<typeof resolveAppLocale>, options: RetrievalOptions, rationale: string, question?: QuestionUnderstanding): RetrievalResult {
  const cluster = localizeStoryCluster(STORY_CLUSTERS[0], appLocale);
  return {
    cluster,
    score: 0,
    laneScore: 0,
    passageScore: 0,
    semanticScore: 0,
    embeddingScore: 0,
    retrievalMode: "tfidf",
    embeddingModel: null,
    reasons: { matchedHints: [], matchedThemes: [], matchedEmotions: [], passageKeywords: [], semanticTerms: [] },
    rationale,
    confidence: "low",
    primaryReference: cluster.primary,
    primaryExcerpt: "",
    supportingReferences: [],
    passageCandidates: [],
    expansionSummary: options.queryPlan?.expansionSummary ?? options.expansionSummary ?? null,
    expansionProvider: options.queryPlan?.expansionProvider ?? options.expansionProvider ?? null,
    question,
  };
}

function buildAnswerBundleRetrieval(bundle: AnswerBundle, appLocale: ReturnType<typeof resolveAppLocale>, options: RetrievalOptions): RetrievalResult {
  const primaryReference = bundle.primary.unit.reference;
  const cluster = localizeStoryCluster(STORY_CLUSTERS.find((entry) => entry.primary.code === primaryReference.code) ?? STORY_CLUSTERS[0], appLocale);
  const references = answerBundleReferences(bundle);
  const supportingReferences = references.slice(1);
  const passageKeywords = [...new Set([bundle.primary, ...bundle.supporting].flatMap((candidate) => candidate.matchedQueries))].slice(0, 8);
  const semanticTerms = [...new Set([bundle.primary, ...bundle.supporting].flatMap((candidate) => candidate.matchedAxes))].slice(0, 8);

  return {
    cluster,
    score: bundle.primary.finalScore,
    laneScore: bundle.primary.axisScore * 20,
    passageScore: bundle.primary.finalScore,
    semanticScore: Math.max(bundle.primary.semanticScore, bundle.primary.axisScore),
    embeddingScore: 0,
    retrievalMode: "tfidf",
    embeddingModel: null,
    reasons: {
      matchedHints: [],
      matchedThemes: [],
      matchedEmotions: [],
      passageKeywords,
      semanticTerms,
    },
    rationale: bundle.relationMap.map((relation) => `${relation.reference}: ${relation.userConnection}`).join(" · "),
    confidence: bundle.confidence,
    primaryReference,
    primaryExcerpt: bundle.primary.unit.text ?? bundle.primary.unit.excerpt ?? "",
    supportingReferences,
    passageCandidates: [bundle.primary, ...bundle.supporting].map((candidate) => ({
      reference: candidate.unit.reference,
      excerpt: candidate.unit.text ?? candidate.unit.excerpt ?? "",
      score: candidate.finalScore,
      matchedTerms: candidate.matchedQueries,
      matchedConcepts: candidate.matchedAxes,
    })),
    expansionSummary: options.queryPlan?.expansionSummary ?? options.expansionSummary ?? null,
    expansionProvider: options.queryPlan?.expansionProvider ?? options.expansionProvider ?? null,
    question: bundle.question,
    answerBundle: bundle,
  };
}

function buildPassageUnitFallbackRetrieval(
  candidates: HybridPassageCandidate[],
  question: QuestionUnderstanding,
  appLocale: ReturnType<typeof resolveAppLocale>,
  options: RetrievalOptions,
): RetrievalResult | null {
  const primary = candidates[0];
  if (!primary) return null;

  const supporting = candidates
    .slice(1)
    .filter((candidate) => candidate.directness !== "weak" && candidate.finalScore >= Math.max(16, primary.finalScore * 0.3))
    .slice(0, 4);
  const cluster = localizeStoryCluster(STORY_CLUSTERS.find((entry) => entry.primary.code === primary.unit.reference.code) ?? STORY_CLUSTERS[0], appLocale);
  const passageKeywords = [...new Set([primary, ...supporting].flatMap((candidate) => candidate.matchedQueries))].slice(0, 8);
  const semanticTerms = [...new Set([primary, ...supporting].flatMap((candidate) => candidate.matchedAxes))].slice(0, 8);
  const rationale = appLocale === "ko"
    ? [
        primary.reason,
        supporting.length ? `보조 본문: ${supporting.map((candidate) => formatPassageReference(candidate.unit.reference)).join(", ")}` : null,
        "질문과 맞물리는 본문은 찾았지만, 중심 답변 묶음으로 확정할 만큼 강하지 않아 낮은 신뢰도로 유지합니다.",
      ].filter(Boolean).join(" · ")
    : [
        primary.reason,
        supporting.length ? `supporting passages: ${supporting.map((candidate) => formatPassageReference(candidate.unit.reference)).join(", ")}` : null,
        "A passage-level match was found, but it is not strong enough to lock as the central answer bundle, so confidence stays low.",
      ].filter(Boolean).join(" · ");

  return {
    cluster,
    score: primary.finalScore,
    laneScore: 0,
    passageScore: primary.finalScore,
    semanticScore: Math.max(primary.semanticScore, primary.axisScore),
    embeddingScore: 0,
    retrievalMode: "tfidf",
    embeddingModel: null,
    reasons: {
      matchedHints: [],
      matchedThemes: [],
      matchedEmotions: [],
      passageKeywords,
      semanticTerms,
    },
    rationale,
    confidence: "low",
    primaryReference: primary.unit.reference,
    primaryExcerpt: primary.unit.text ?? primary.unit.excerpt ?? "",
    supportingReferences: supporting.map((candidate) => candidate.unit.reference),
    passageCandidates: [primary, ...supporting].map((candidate) => ({
      reference: candidate.unit.reference,
      excerpt: candidate.unit.text ?? candidate.unit.excerpt ?? "",
      score: candidate.finalScore,
      matchedTerms: candidate.matchedQueries,
      matchedConcepts: candidate.matchedAxes,
    })),
    expansionSummary: options.queryPlan?.expansionSummary ?? options.expansionSummary ?? null,
    expansionProvider: options.queryPlan?.expansionProvider ?? options.expansionProvider ?? null,
    question,
  };
}


export async function retrieveClusterForPrompt(prompt: string, locale?: string, options: RetrievalOptions = {}): Promise<RetrievalResult> {
  const appLocale = resolveAppLocale(locale);
  const normalizedPrompt = prompt.trim() || (appLocale === "ko" ? "성경 본문을 문맥과 연결 본문으로 공부" : "study scripture with context and cross references");
  const question = options.queryPlan?.question ?? understandQuestion(normalizedPrompt, appLocale);
  const ruleBased = buildRuleBasedRetrieval(normalizedPrompt, appLocale, options);
  if (ruleBased) return { ...ruleBased, question };

  const priorBased = buildPriorProfileRetrieval(normalizedPrompt, appLocale, options);
  if (priorBased) return { ...priorBased, question };

  if (question.intent === "external_fact" || (question.answerMode === "clarify_with_starters" && question.confidence === "high")) {
    return lowConfidenceFallback(appLocale, options, appLocale === "ko" ? "성경 본문으로 직접 단정할 수 없는 입력으로 감지되어 응답 정책만 반환합니다." : "Prompt detected as not directly answerable from a Bible passage; returning response policy only.", question);
  }
  if (isOffTopicEverydayPrompt(normalizedPrompt)) {
    return lowConfidenceFallback(appLocale, options, appLocale === "ko" ? "일상 선택 질문으로 감지되어 성경 본문 추천을 보류합니다." : "Everyday choice prompt detected; pausing scripture recommendation.", question);
  }

  const answerBundle = await buildAnswerBundle(normalizedPrompt, appLocale, options);
  if (answerBundle) return buildAnswerBundleRetrieval(answerBundle, appLocale, options);

  const fallbackHybridCandidates = rerankPassageCandidates(question, await retrieveHybridPassageCandidates(question), 5);
  const passageUnitFallback = buildPassageUnitFallbackRetrieval(fallbackHybridCandidates, question, appLocale, options);
  if (passageUnitFallback) return passageUnitFallback;

  const queryExpansionTerms = options.queryPlan
    ? [...options.queryPlan.expansionTerms, ...options.queryPlan.searchQueries, ...options.queryPlan.concernAxes, ...options.queryPlan.theologicalAxes]
    : options.expansionTerms ?? [];
  const externalExpansion = queryExpansionTerms.length ? ` ${queryExpansionTerms.join(" ")}` : "";
  const expandedPrompt = `${expandQuery(normalizedPrompt)}${externalExpansion}`;
  const promptTokens = tokenize(expandedPrompt);
  const promptTf = buildTermFrequency(promptTokens);
  const [candidateUnits, { corpora, idf }, priorPassageCandidates] = await Promise.all([
    findCandidatePassageUnits({ locale: appLocale, terms: promptTokens, limit: 72 }),
    loadClusterCorpora(appLocale),
    buildPriorPassageCandidates(appLocale, normalizedPrompt),
  ]);
  const passageCandidates = mergePassageCandidates(
    priorPassageCandidates,
    buildGlobalPassageCandidates(candidateUnits ?? [], promptTokens, normalizedPrompt),
  );
  const bestPassage = passageCandidates[0] ?? null;
  const supportingReferences = passageCandidates.slice(1, 5).map((candidate) => candidate.reference);
  const tfidfScored = scoreClusterRetrievals({
    appLocale,
    expandedPrompt,
    promptTokens,
    promptTf,
    corpora,
    idf,
    bestPassage,
    supportingReferences,
    passageCandidates,
    options,
    question,
    embeddingModel: null,
    clusterVectors: null,
    promptEmbedding: null,
  });
  tfidfScored.sort((a, b) => b.score - a.score);
  const tfidfBest = tfidfScored[0] ?? null;

  if (!shouldUseClusterEmbeddings(promptTokens, tfidfBest)) {
    return tfidfBest ?? {
      cluster: localizeStoryCluster(STORY_CLUSTERS[0], appLocale),
      score: 0,
      laneScore: 0,
      passageScore: 0,
      semanticScore: 0,
      embeddingScore: 0,
      retrievalMode: "tfidf",
      embeddingModel: null,
      reasons: { matchedHints: [], matchedThemes: [], matchedEmotions: [], passageKeywords: [], semanticTerms: [] },
      rationale: appLocale === "ko" ? "66권 성경 코퍼스 기본 매칭" : "66-book corpus baseline match",
      confidence: "low",
      primaryReference: STORY_CLUSTERS[0].primary,
      primaryExcerpt: "",
      supportingReferences: [],
      passageCandidates: [],
      expansionSummary: options.queryPlan?.expansionSummary ?? options.expansionSummary ?? null,
      expansionProvider: options.queryPlan?.expansionProvider ?? options.expansionProvider ?? null,
      question,
    };
  }

  const clusterEmbeddings = await loadClusterEmbeddings(appLocale);
  const promptEmbedding = clusterEmbeddings.vectors ? await createEmbedding(expandedPrompt) : null;
  const embeddingScored = scoreClusterRetrievals({
    appLocale,
    expandedPrompt,
    promptTokens,
    promptTf,
    corpora,
    idf,
    bestPassage,
    supportingReferences,
    passageCandidates,
    options,
    question,
    embeddingModel: clusterEmbeddings.model,
    clusterVectors: clusterEmbeddings.vectors,
    promptEmbedding,
  });
  embeddingScored.sort((a, b) => b.score - a.score);
  return embeddingScored[0] ?? tfidfBest ?? {
    cluster: localizeStoryCluster(STORY_CLUSTERS[0], appLocale),
    score: 0,
    laneScore: 0,
    passageScore: 0,
    semanticScore: 0,
    embeddingScore: 0,
    retrievalMode: clusterEmbeddings.model ? "embedding-fallback" : "tfidf",
    embeddingModel: clusterEmbeddings.model,
    reasons: { matchedHints: [], matchedThemes: [], matchedEmotions: [], passageKeywords: [], semanticTerms: [] },
    rationale: appLocale === "ko" ? "66권 성경 코퍼스 기본 매칭" : "66-book corpus baseline match",
    confidence: "low",
    primaryReference: STORY_CLUSTERS[0].primary,
    primaryExcerpt: "",
    supportingReferences: [],
    passageCandidates: [],
    expansionSummary: options.queryPlan?.expansionSummary ?? options.expansionSummary ?? null,
    expansionProvider: options.queryPlan?.expansionProvider ?? options.expansionProvider ?? null,
    question,
  };
}
