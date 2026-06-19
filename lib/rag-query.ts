import { resolveHermesProviderConfig, runHermesAgentOneshot } from "@/lib/hermes";
import { resolveAppLocale, type AppLocale } from "@/lib/content";
import { understandQuestion, type QuestionUnderstanding } from "@/lib/question-understanding";

export type RetrievalQueryPlan = {
  question: QuestionUnderstanding;
  expansionTerms: string[];
  expansionSummary: string | null;
  searchQueries: string[];
  concernAxes: string[];
  theologicalAxes: string[];
  plannerConfidence: "high" | "medium" | "low";
  expansionProvider: "deterministic" | "hermes" | "hermes-agent" | "hermes-fallback";
  expansionModel: string;
  expansionNote: string;
  droppedReferenceHints: string[];
};

type RagQueryShape = {
  intentSummary?: unknown;
  searchTerms?: unknown;
  searchQueries?: unknown;
  concernAxes?: unknown;
  theologicalAxes?: unknown;
  confidence?: unknown;
};

const MAX_TERMS = 18;
const MAX_QUERIES = 10;
const MAX_AXES = 8;
const REF_SHAPED_PATTERN = /\b(?:gen|exo|lev|num|deu|jos|jdg|rut|1sa|2sa|1ki|2ki|1ch|2ch|ezr|neh|est|job|psa|pro|ecc|sng|isa|jer|lam|ezk|dan|hos|jol|amo|oba|jon|mic|nam|hab|zep|hag|zec|mal|mat|mrk|luk|jhn|act|rom|1co|2co|gal|eph|php|col|1th|2th|1ti|2ti|tit|phm|heb|jas|1pe|2pe|1jn|2jn|3jn|jud|rev|창|출|레|민|신|수|삿|룻|삼상|삼하|왕상|왕하|대상|대하|스|느|에|욥|시|잠|전|아|사|렘|애|겔|단|호|욜|암|옵|욘|미|나|합|습|학|슥|말|마|막|눅|요|행|롬|고전|고후|갈|엡|빌|골|살전|살후|딤전|딤후|딛|몬|히|약|벧전|벧후|요일|요이|요삼|유|계)\s*\d{1,3}\s*[:.]\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?\b/i;

function unique(values: string[], limit: number) {
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || out.includes(trimmed)) continue;
    out.push(trimmed);
    if (out.length >= limit) break;
  }
  return out;
}

function cleanStringArray(value: unknown, limit: number, droppedReferenceHints: string[]) {
  if (!Array.isArray(value)) return [];
  const terms: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const term = item.trim();
    if (term.length < 2 || term.length > 60) continue;
    if (REF_SHAPED_PATTERN.test(term)) {
      if (!droppedReferenceHints.includes(term)) droppedReferenceHints.push(term);
      continue;
    }
    terms.push(term);
  }
  return unique(terms, limit);
}

function cleanTerms(value: unknown, droppedReferenceHints: string[] = []) {
  return cleanStringArray(value, MAX_TERMS, droppedReferenceHints).filter((term) => term.length <= 40);
}

function extractJson(text: string): RagQueryShape | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as RagQueryShape;
  } catch {
    return null;
  }
}

type DeterministicIntentProfile = {
  match: RegExp;
  ko: { summary: string; terms: string[]; concernAxes?: string[]; theologicalAxes?: string[] };
  en: { summary: string; terms: string[]; concernAxes?: string[]; theologicalAxes?: string[] };
};

const DETERMINISTIC_INTENT_PROFILES: DeterministicIntentProfile[] = [
  {
    match: /((삶|사는|살아야|살\s?이유|왜\s?살).*(지치|지쳤|지쳐|지친|무기력|힘들|피곤))|((지치|지쳤|지쳐|지친|무기력|힘들|피곤).*(삶|살아야|살\s?이유|왜\s?살|모르겠))|(weary|tired|exhausted).*(reason to live|why live|purpose)/i,
    ko: {
      summary: "지침과 삶의 이유를 함께 묻는 절망/목적 질문",
      terms: ["수고", "무거운 짐", "쉬게 하리라", "피곤", "능력", "낙망", "소망", "인자", "지으심", "선한 일", "하나님의 형상", "생명"],
      concernAxes: ["weariness", "purpose", "despair"],
      theologicalAxes: ["rest", "hope", "creation", "image of God"],
    },
    en: {
      summary: "weariness with purpose and reason-to-live concern",
      terms: ["weary", "burden", "rest", "faint", "strength", "hope", "steadfast love", "created", "workmanship", "image of God", "life"],
      concernAxes: ["weariness", "purpose", "despair"],
      theologicalAxes: ["rest", "hope", "creation", "image of God"],
    },
  },
  {
    match: /(희망이\s?없|아무\s?희망|버티기\s?힘들|더는\s?못\s?버티|왜\s?버텨야|버텨야\s?하는지|왜\s?견뎌야|견뎌야\s?하는지|살\s?이유가\s?없|소망.*없|hopeless|no reason to live|can't go on|cant go on)/i,
    ko: {
      summary: "소망을 잃은 절망 질문",
      terms: ["소망", "낙망", "인자", "긍휼", "새롭다", "기다림", "생명", "부활", "평안"],
      concernAxes: ["despair", "endurance", "hope"],
      theologicalAxes: ["steadfast love", "mercy", "resurrection", "peace"],
    },
    en: {
      summary: "despair and hope question",
      terms: ["hope", "despair", "steadfast love", "mercies", "wait", "life", "resurrection", "peace"],
      concernAxes: ["despair", "endurance", "hope"],
      theologicalAxes: ["steadfast love", "mercy", "resurrection", "peace"],
    },
  },
  {
    match: /(왜\s?살아야|살아야\s?(하는|되는|될)?지|살\s?이유|사는\s?이유|삶.*(목적|의미)|무엇을 위해 살아|존재.*이유|reason to live|why.*live|purpose.*life|meaning.*life)/i,
    ko: {
      summary: "삶의 목적과 존재 이유 질문",
      terms: ["지으심", "선한 일", "하나님의 형상", "창조", "자녀", "생명", "소망", "영원", "목적"],
      concernAxes: ["meaning", "purpose", "identity"],
      theologicalAxes: ["creation", "image of God", "new creation", "hope"],
    },
    en: {
      summary: "life purpose and reason-to-live question",
      terms: ["created", "workmanship", "good works", "image of God", "child of God", "life", "hope", "purpose"],
      concernAxes: ["meaning", "purpose", "identity"],
      theologicalAxes: ["creation", "image of God", "new creation", "hope"],
    },
  },
  {
    match: /(힘들|지치|지쳤|지쳐|지친|피곤|번아웃|무기력|수고|부담|weary|burden|burnout|exhausted|tired)/i,
    ko: {
      summary: "지침과 무거운 부담 질문",
      terms: ["수고", "무거운 짐", "쉬게 하리라", "피곤", "능력", "위로", "부담", "견디게"],
      concernAxes: ["weariness", "burden", "rest"],
      theologicalAxes: ["rest", "comfort", "strength"],
    },
    en: {
      summary: "weariness and burden question",
      terms: ["weary", "burden", "rest", "faint", "strength", "comfort", "endurance"],
      concernAxes: ["weariness", "burden", "rest"],
      theologicalAxes: ["rest", "comfort", "strength"],
    },
  },
  {
    match: /(나는 누구|내가 누구|정체성|존재|가치|나는 뭘까|who am i|identity|worth|purpose)/i,
    ko: {
      summary: "정체성과 존재 가치 질문",
      terms: ["하나님의 형상", "형상", "사람", "창조", "자녀", "지으심", "그리스도", "선한 일"],
      concernAxes: ["identity", "worth", "belonging"],
      theologicalAxes: ["image of God", "creation", "adoption", "union with Christ"],
    },
    en: {
      summary: "identity and personal worth question",
      terms: ["image of God", "created", "child of God", "workmanship", "identity", "beloved"],
      concernAxes: ["identity", "worth", "belonging"],
      theologicalAxes: ["image of God", "creation", "adoption", "union with Christ"],
    },
  },
  {
    match: /(혼자|외로|이해하지 못|버려진|lonely|alone|abandoned)/i,
    ko: {
      summary: "외로움과 버려짐 질문",
      terms: ["혼자", "함께", "버리지", "이해", "감찰", "두려워 말라"],
      concernAxes: ["loneliness", "abandonment", "fear"],
      theologicalAxes: ["presence", "covenant", "comfort"],
    },
    en: {
      summary: "loneliness and abandonment question",
      terms: ["alone", "with you", "never leave", "known", "fear not"],
      concernAxes: ["loneliness", "abandonment", "fear"],
      theologicalAxes: ["presence", "covenant", "comfort"],
    },
  },
  {
    match: /(불안|염려|통제|미래|두려|anxiety|worry|future|control|afraid)/i,
    ko: {
      summary: "불안과 미래 통제 질문",
      terms: ["염려", "평안", "맡기", "믿음", "미래", "인도", "두려워 말라"],
      concernAxes: ["anxiety", "future", "control"],
      theologicalAxes: ["peace", "trust", "providence"],
    },
    en: {
      summary: "anxiety and future-control question",
      terms: ["anxiety", "peace", "cast cares", "trust", "future", "guide", "fear not"],
      concernAxes: ["anxiety", "future", "control"],
      theologicalAxes: ["peace", "trust", "providence"],
    },
  },
  {
    match: /(다른\s?종교|믿는.*믿지|드러내|나타내|특별한.*사람|하나님.*(같|차이|계시|알|은혜|참)|god.*(reveal|true|faith|judge))/i,
    ko: {
      summary: "하나님의 자기계시와 믿음의 응답 질문",
      terms: ["여호와", "참되", "믿음", "영생", "심판", "계시", "알", "은혜", "겸손", "아기"],
      concernAxes: ["믿음", "계시", "심판", "은혜"],
      theologicalAxes: ["여호와", "참되", "영생", "겸손"],
    },
    en: {
      summary: "God's self-revelation and faith response question",
      terms: ["YHWH", "true God", "faith", "eternal life", "judgment", "revelation", "grace", "humility"],
      concernAxes: ["faith", "revelation", "judgment", "grace"],
      theologicalAxes: ["YHWH", "true God", "eternal life", "humility"],
    },
  },
  {
    match: /(예수.*(어디|보혈|피|씻|속죄|중보|보좌|하늘)|보혈|jesus.*(where|blood|atonement|throne|intercede))/i,
    ko: {
      summary: "예수님의 현재 사역과 보혈/속죄 질문",
      terms: ["하늘", "보좌", "중보", "피", "씻", "속죄", "대속", "부활"],
      concernAxes: ["중보", "속죄", "보혈"],
      theologicalAxes: ["하늘", "보좌", "피", "씻", "속죄"],
    },
    en: {
      summary: "Jesus' present ministry and blood/atonement question",
      terms: ["heaven", "throne", "intercession", "blood", "cleanse", "atonement", "ransom", "resurrection"],
      concernAxes: ["intercession", "atonement", "blood"],
      theologicalAxes: ["heaven", "throne", "cleanse", "atonement"],
    },
  },
  {
    match: /(창조|진화|6일|엿새|에덴|선악과|세상의\s?악|악.*시작|창조.*목적|창조.*계속|creation|evolution|eden|evil.*begin)/i,
    ko: {
      summary: "창조·에덴·악의 기원 질문",
      terms: ["진화", "창조", "설계", "엿새", "안식", "질서", "에덴", "동산", "강", "영광", "기쁨", "경외", "뱀", "마귀", "교만", "일하", "유지", "새롭"],
      concernAxes: ["창조", "악", "기원", "목적"],
      theologicalAxes: ["설계", "안식", "질서", "에덴", "영광", "경외", "마귀", "새롭"],
    },
    en: {
      summary: "creation, Eden, and origin of evil question",
      terms: ["evolution", "creation", "design", "six days", "sabbath", "order", "Eden", "garden", "river", "glory", "fear", "serpent", "devil", "pride", "sustain", "new creation"],
      concernAxes: ["creation", "evil", "origin", "purpose"],
      theologicalAxes: ["design", "sabbath", "order", "Eden", "glory", "serpent", "new creation"],
    },
  },
  {
    match: /(인간|사람|태어났|죽는가|동물과|완벽|완전|human|why.*die|born|perfect)/i,
    ko: {
      summary: "인간의 존재·죽음·존귀 질문",
      terms: ["태어나", "경외", "영광", "죄", "죽음", "흙", "형상", "영", "존귀", "완전", "좇", "부족"],
      concernAxes: ["인간", "죽음", "존귀", "부족"],
      theologicalAxes: ["형상", "영광", "죄", "흙", "완전"],
    },
    en: {
      summary: "human existence, death, and dignity question",
      terms: ["born", "fear", "glory", "sin", "death", "dust", "image", "spirit", "dignity", "perfect", "lack"],
      concernAxes: ["humanity", "death", "dignity", "lack"],
      theologicalAxes: ["image", "glory", "sin", "dust", "perfection"],
    },
  },
  {
    match: /(죄|선악과|불순종|sin|forbidden|evil)/i,
    ko: {
      summary: "죄와 그 결과 질문",
      terms: ["죄", "불순종", "뱀", "금지", "죽음", "삯", "멸망", "속죄"],
      concernAxes: ["죄", "불순종", "죽음"],
      theologicalAxes: ["금지", "삯", "멸망", "속죄"],
    },
    en: {
      summary: "sin and its consequence question",
      terms: ["sin", "disobedience", "serpent", "forbidden", "death", "wages", "perish", "atonement"],
      concernAxes: ["sin", "disobedience", "death"],
      theologicalAxes: ["forbidden", "wages", "perish", "atonement"],
    },
  },
  {
    match: /(믿음|신앙|교파|성장|전수|영적\s?성장|예수님을\s?믿|faith|denomination|spiritual growth)/i,
    ko: {
      summary: "믿음·신앙생활·교회 다양성 질문",
      terms: ["말씀", "듣", "자라", "겸손", "사랑", "변화", "소망", "인내", "가르치", "자녀", "전하", "분열", "하나", "다양", "열매", "덕", "영접", "고백", "살"],
      concernAxes: ["믿음", "신앙", "성장", "교회"],
      theologicalAxes: ["말씀", "소망", "인내", "분열", "하나", "다양", "열매"],
    },
    en: {
      summary: "faith, church life, and denominational diversity question",
      terms: ["word", "hear", "grow", "humility", "love", "transformation", "hope", "endurance", "teach", "children", "proclaim", "division", "one", "diversity", "fruit", "virtue", "receive", "confess", "live"],
      concernAxes: ["faith", "spiritual growth", "church"],
      theologicalAxes: ["word", "hope", "endurance", "unity", "diversity", "fruit"],
    },
  },
  {
    match: /(기도|응답|prayer|pray)/i,
    ko: {
      summary: "기도와 기다림 질문",
      terms: ["기도", "기다리", "인내", "소망", "아버지", "구하"],
      concernAxes: ["기도", "기다림", "응답"],
      theologicalAxes: ["인내", "소망", "아버지"],
    },
    en: {
      summary: "prayer and waiting question",
      terms: ["prayer", "wait", "endurance", "hope", "Father", "ask"],
      concernAxes: ["prayer", "waiting", "answer"],
      theologicalAxes: ["endurance", "hope", "Father"],
    },
  },
  {
    match: /(환생|죽음 이후|영원히\s?고통|지옥|구원받지 못|종말|재림|reincarnation|hell|eternal punishment|judgment)/i,
    ko: {
      summary: "죽음 이후·심판·종말 질문",
      terms: ["죽음", "심판", "부활", "영생", "영벌", "지옥", "소망"],
      concernAxes: ["죽음", "심판", "두려움"],
      theologicalAxes: ["부활", "영생", "영벌", "지옥"],
    },
    en: {
      summary: "afterlife, judgment, and last things question",
      terms: ["death", "judgment", "resurrection", "eternal life", "punishment", "hell", "hope"],
      concernAxes: ["death", "judgment", "fear"],
      theologicalAxes: ["resurrection", "eternal life", "hell"],
    },
  },
  {
    match: /(구약|신약|옛\s?언약|새\s?언약|old testament|new testament|old covenant|new covenant)/i,
    ko: {
      summary: "구약과 신약, 옛 언약과 새 언약의 관계 질문",
      terms: ["구약", "신약", "옛", "새", "언약", "성경", "약속", "성취"],
      concernAxes: ["성경", "언약", "차이"],
      theologicalAxes: ["옛", "새", "언약", "성취"],
    },
    en: {
      summary: "Old Testament and New Testament covenant relationship question",
      terms: ["Old Testament", "New Testament", "old", "new", "covenant", "Scripture", "promise", "fulfillment"],
      concernAxes: ["Scripture", "covenant", "difference"],
      theologicalAxes: ["old", "new", "covenant", "fulfillment"],
    },
  },
  {
    match: /(재정|돈|경제|직장|목회자|평신도|자존감|열등|스트레스|감사|부족|칭찬|work|money|stress|gratitude|inferior)/i,
    ko: {
      summary: "일상 삶·소명·정체성 적용 질문",
      terms: ["십일조", "축복", "나누", "하늘", "보물", "직장", "충성", "겸손", "목회", "평신도", "은사", "자존감", "존귀", "사랑", "열등", "비교", "능력", "스트레스", "안식", "평안", "감사", "범사", "기뻐", "부족", "은혜", "충분", "칭찬", "인정", "영광"],
      concernAxes: ["일상", "소명", "정체성", "염려"],
      theologicalAxes: ["나누", "보물", "충성", "은사", "존귀", "평안", "감사", "은혜"],
    },
    en: {
      summary: "daily life, vocation, and identity application question",
      terms: ["tithe", "blessing", "share", "treasure", "work", "faithfulness", "humility", "ministry", "gifts", "worth", "love", "comparison", "strength", "stress", "rest", "peace", "gratitude", "rejoice", "lack", "grace", "sufficient", "praise", "approval", "glory"],
      concernAxes: ["daily life", "vocation", "identity", "anxiety"],
      theologicalAxes: ["generosity", "treasure", "faithfulness", "gifts", "dignity", "peace", "grace"],
    },
  },
];

function isProtectedQuestion(question: QuestionUnderstanding) {
  return question.intent === "external_fact" || question.answerMode === "clarify_with_starters" || question.answerMode === "limited_answer";
}

function mergeQuestion(
  base: QuestionUnderstanding,
  expansionSummary: string | null,
  expansionTerms: string[],
  searchQueries: string[],
  concernAxes: string[],
  theologicalAxes: string[],
  confidence?: "high" | "medium" | "low",
): QuestionUnderstanding {
  if (isProtectedQuestion(base)) return base;

  const mergedSearchQueries = unique([
    ...base.searchQueries,
    ...(expansionSummary ? [expansionSummary] : []),
    ...searchQueries,
    ...expansionTerms,
  ], MAX_TERMS + MAX_QUERIES);
  const mergedConcernAxes = unique([...base.concernAxes, ...concernAxes], MAX_AXES + base.concernAxes.length);
  const hasGenericFallbackAxes =
    base.intent === "biblical_context" &&
    base.theologicalAxes.length === 2 &&
    base.theologicalAxes.includes("Bible") &&
    base.theologicalAxes.includes("discernment") &&
    expansionTerms.length > 0;
  const mergedTheologicalAxes = unique([
    ...(hasGenericFallbackAxes ? [] : base.theologicalAxes),
    ...theologicalAxes,
  ], MAX_AXES + base.theologicalAxes.length);
  const upgradedConfidence =
    base.confidence === "low" && base.answerMode === "direct_bible_answer" && expansionTerms.length >= 2
      ? "medium"
      : base.confidence;

  return {
    ...base,
    normalized: expansionSummary || base.normalized,
    searchQueries: mergedSearchQueries,
    concernAxes: mergedConcernAxes,
    theologicalAxes: mergedTheologicalAxes,
    confidence: confidence ?? upgradedConfidence,
  };
}

function buildPlan(params: {
  baseQuestion: QuestionUnderstanding;
  expansionTerms: string[];
  expansionSummary: string | null;
  searchQueries?: string[];
  concernAxes?: string[];
  theologicalAxes?: string[];
  confidence?: "high" | "medium" | "low";
  provider: RetrievalQueryPlan["expansionProvider"];
  model: string;
  note: string;
  droppedReferenceHints?: string[];
}): RetrievalQueryPlan {
  const question = mergeQuestion(
    params.baseQuestion,
    params.expansionSummary,
    params.expansionTerms,
    params.searchQueries ?? [],
    params.concernAxes ?? [],
    params.theologicalAxes ?? [],
    params.confidence,
  );
  return {
    question,
    expansionTerms: params.expansionTerms,
    expansionSummary: params.expansionSummary,
    searchQueries: question.searchQueries,
    concernAxes: question.concernAxes,
    theologicalAxes: question.theologicalAxes,
    plannerConfidence: question.confidence,
    expansionProvider: params.provider,
    expansionModel: params.model,
    expansionNote: params.note,
    droppedReferenceHints: params.droppedReferenceHints ?? [],
  };
}

function deterministicQueryPlan(prompt: string, appLocale: AppLocale): RetrievalQueryPlan {
  const baseQuestion = understandQuestion(prompt, appLocale);
  const localeKey = appLocale === "ko" ? "ko" : "en";
  const matches = DETERMINISTIC_INTENT_PROFILES.filter((profile) => profile.match.test(prompt));

  if (matches.length) {
    const droppedReferenceHints: string[] = [];
    const localeProfiles = matches.map((profile) => profile[localeKey]);
    const expansionTerms = cleanTerms(localeProfiles.flatMap((profile) => profile.terms), droppedReferenceHints);
    const expansionSummary = localeProfiles.map((profile) => profile.summary).filter((summary, index, summaries) => summaries.indexOf(summary) === index).join(" + ");

    return buildPlan({
      baseQuestion,
      expansionTerms,
      expansionSummary,
      concernAxes: localeProfiles.flatMap((profile) => profile.concernAxes ?? []),
      theologicalAxes: localeProfiles.flatMap((profile) => profile.theologicalAxes ?? []),
      provider: "deterministic",
      model: "deterministic-rag-query-planner",
      note: `Deterministic intent middleware matched ${matches.length} profile${matches.length === 1 ? "" : "s"}.`,
      droppedReferenceHints,
    });
  }

  return buildPlan({
    baseQuestion,
    expansionTerms: [],
    expansionSummary: null,
    provider: "deterministic",
    model: "deterministic-rag-query-planner",
    note: "No deterministic RAG query expansion matched.",
  });
}

function cleanConfidence(value: unknown): "high" | "medium" | "low" | undefined {
  return value === "high" || value === "medium" || value === "low" ? value : undefined;
}

export async function buildRagQueryPlan(prompt: string, locale?: string): Promise<RetrievalQueryPlan> {
  const appLocale = resolveAppLocale(locale);
  const fallback = deterministicQueryPlan(prompt, appLocale);

  if (process.env.NEXT_PHASE === "phase-production-build" || process.env.HERMES_RAG_QUERY === "0") {
    return fallback;
  }
  if (fallback.expansionTerms.length && process.env.HERMES_RAG_QUERY !== "force") {
    return fallback;
  }
  if (isProtectedQuestion(fallback.question)) {
    return fallback;
  }

  const config = await resolveHermesProviderConfig();
  if (!config.ready) return fallback;

  const system = [
    "You are a Bible RAG query planner, not an answer writer.",
    "Return only valid JSON with keys intentSummary, searchTerms, searchQueries, concernAxes, theologicalAxes, confidence.",
    "Generate search terms likely to appear in Bible passages, not application labels.",
    "For Korean prompts, include Korean Bible words and short English concept terms.",
    "Do not cite or invent references; retrieval will find passages separately.",
    "Do not include Bible reference strings such as John 3:16 or ROM 8:28.",
  ].join(" ");
  const user = JSON.stringify({ locale: appLocale, prompt, maxSearchTerms: MAX_TERMS, maxSearchQueries: MAX_QUERIES, maxAxes: MAX_AXES });

  const parsePlan = (content: string | null, provider: "hermes" | "hermes-agent", model: string, notePrefix: string): RetrievalQueryPlan | null => {
    const parsed = extractJson(content ?? "");
    const droppedReferenceHints: string[] = [];
    const expansionTerms = cleanTerms(parsed?.searchTerms, droppedReferenceHints);
    const searchQueries = cleanStringArray(parsed?.searchQueries, MAX_QUERIES, droppedReferenceHints);
    const concernAxes = cleanStringArray(parsed?.concernAxes, MAX_AXES, droppedReferenceHints);
    const theologicalAxes = cleanStringArray(parsed?.theologicalAxes, MAX_AXES, droppedReferenceHints);
    if (!expansionTerms.length && !searchQueries.length && !concernAxes.length && !theologicalAxes.length) return null;
    const intentSummary = typeof parsed?.intentSummary === "string" ? parsed.intentSummary.trim().slice(0, 240) : null;
    return buildPlan({
      baseQuestion: fallback.question,
      expansionTerms,
      expansionSummary: intentSummary || fallback.expansionSummary,
      searchQueries,
      concernAxes,
      theologicalAxes,
      confidence: cleanConfidence(parsed?.confidence),
      provider,
      model,
      note: `${notePrefix} generated ${expansionTerms.length} Bible RAG search terms, ${searchQueries.length} query phrases, and ${concernAxes.length + theologicalAxes.length} axes.`,
      droppedReferenceHints,
    });
  };

  if (config.transport === "agent-oneshot") {
    try {
      const content = await runHermesAgentOneshot(`${system}\n\nQuery request JSON:\n${user}`, 45_000);
      const plan = parsePlan(content, "hermes-agent", config.model, "Hermes agent");
      if (plan) return plan;
      return { ...fallback, expansionProvider: "hermes-fallback", expansionModel: "hermes-fallback", expansionNote: "Hermes agent RAG query planner returned no usable retrieval fields." };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { ...fallback, expansionProvider: "hermes-fallback", expansionModel: "hermes-fallback", expansionNote: `Hermes agent RAG query planner threw (${message}).` };
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { ...fallback, expansionProvider: "hermes-fallback", expansionModel: "hermes-fallback", expansionNote: `Hermes RAG query planner failed with status ${response.status}.` };
    }

    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content ?? "";
    const plan = parsePlan(content, "hermes", config.model, "Hermes");
    if (!plan) {
      return { ...fallback, expansionProvider: "hermes-fallback", expansionModel: "hermes-fallback", expansionNote: "Hermes RAG query planner returned no usable retrieval fields." };
    }

    return plan;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { ...fallback, expansionProvider: "hermes-fallback", expansionModel: "hermes-fallback", expansionNote: `Hermes RAG query planner threw (${message}).` };
  }
}
