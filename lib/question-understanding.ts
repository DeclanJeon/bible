import { resolveAppLocale, type AppLocale } from "@/lib/content";

export type QuestionIntent =
  | "definition"
  | "meaning"
  | "pastoral_care"
  | "doctrine"
  | "ethics"
  | "practice"
  | "biblical_context"
  | "everyday_wisdom"
  | "external_fact"
  | "empty_or_nonsense"
  | "safety_first";

export type AnswerMode =
  | "direct_bible_answer"
  | "survey_bundle"
  | "wisdom_principle"
  | "pastoral_care"
  | "safety_first"
  | "clarify_with_starters"
  | "limited_answer";

export type QuestionUnderstanding = {
  original: string;
  normalized: string;
  locale: AppLocale;
  intent: QuestionIntent;
  concernAxes: string[];
  theologicalAxes: string[];
  searchQueries: string[];
  answerMode: AnswerMode;
  confidence: "high" | "medium" | "low";
};

type UnderstandingSeed = Omit<QuestionUnderstanding, "original" | "locale">;

type Rule = {
  intent: QuestionIntent;
  answerMode: AnswerMode;
  confidence: QuestionUnderstanding["confidence"];
  concernAxes?: string[];
  theologicalAxes?: string[];
  searchQueries: string[];
  normalized: string;
};

const NONSENSE_KO: Record<string, true> = {
  "그냥 아무거나": true,
  아무거나: true,
  몰라: true,
  음: true,
  "ㅇㅇ": true,
  "ㅋㅋ": true,
  "ㅎㅎ": true,
};
const NONSENSE_EN: Record<string, true> = {
  anything: true,
  whatever: true,
  idk: true,
  lol: true,
  hmm: true,
  test: true,
  asdf: true,
};

const KO_SAFETY = /죽고\s*싶|자살|극단적\s*선택|살기\s*싫|끝내고\s*싶|사라지고\s*싶|해치고\s*싶|죽어버/;
const EN_SAFETY = /\b(suicide|kill myself|end my life|self[-\s]?harm|want to die|hurt myself|no reason to live)\b/i;

const KO_EVERYDAY = /회사\s*그만|퇴사|이직|사야\s*돼|살까|팔까|고백할까|이사\s*갈까|선택|결정|어느\s*쪽|뭘\s*해야|해야\s*돼\??$/;
const EN_EVERYDAY = /\b(quit my job|change jobs|buy|sell|move|which should i choose|what should i do|should i)\b/i;

const KO_EXTERNAL = /(오늘|내일|이번\s*주|서울|부산|대구).*날씨|날씨\s*알려|주가|코인|로또|시험\s*답|몇\s*시|대통령|뉴스|월드컵|어디가\s*맛집|오늘\s*(점심|저녁|아침)|뭐\s*먹지|메뉴\s*추천/;
const EN_EXTERNAL = /\b(weather|stock price|bitcoin price|lottery|exam answer|latest news|who won|president of|what should i eat|lunch recommendation|dinner recommendation|breakfast recommendation)\b/i;

const KO_PASTORAL = /불안|걱정|두려|외로|우울|슬프|지쳤|힘들|죄책감|분노|화가|부끄|수치|상처|위로|쉼|절망/;
const EN_PASTORAL = /\b(anxious|anxiety|worry|afraid|lonely|depressed|sad|tired|weary|guilt|angry|ashamed|hurt|comfort|rest|despair)\b/i;

const KO_ETHICS = /용서|미워|거짓말|정직|돈|성|폭력|복수|원수|공의|정의|해야\s*하나|해야\s*돼/;
const EN_ETHICS = /\b(forgive|hate|lie|honest|money|sex|violence|revenge|enemy|justice|right or wrong|is it sin)\b/i;

const TOPIC_RULES: Array<{ key: string; ko: RegExp; en: RegExp; rule: Rule }> = [
  {
    key: "scripture",
    ko: /성경|말씀|성서/,
    en: /\b(bible|scripture|word of god)\b/i,
    rule: {
      normalized: "성경은 무엇인가",
      intent: "definition",
      answerMode: "survey_bundle",
      confidence: "high",
      theologicalAxes: ["Scripture", "revelation", "teaching", "formation", "truth"],
      searchQueries: ["성경은 무엇인가", "하나님의 감동으로 된 성경", "가르침과 책망과 바르게 함", "scripture inspired by God"],
    },
  },
  {
    key: "identity",
    ko: /나는\s*누구|내가\s*누구|정체성|하나님\s*안에서\s*나는|그리스도\s*안에서\s*나는/,
    en: /\b(who am i|identity|who am i in god|who am i in christ)\b/i,
    rule: {
      normalized: "하나님 안에서 나는 누구인가",
      intent: "meaning",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["identity", "worth", "belonging"],
      theologicalAxes: ["image of God", "children of God", "created in Christ", "calling"],
      searchQueries: ["하나님의 형상", "하나님의 자녀", "그리스도 안에서 지음받음", "identity image of God child of God"],
    },
  },
  {
    key: "god",
    ko: /하나님|하느님|신은|신이|여호와/,
    en: /\b(god|who is god|what is god|lord|yahweh)\b/i,
    rule: {
      normalized: "하나님은 누구인가",
      intent: "definition",
      answerMode: "survey_bundle",
      confidence: "high",
      theologicalAxes: ["God", "creator", "self-existence", "spirit", "love"],
      searchQueries: ["하나님은 누구인가", "창조주", "스스로 있는 자", "하나님은 영", "하나님은 사랑", "God creator I AM"],
    },
  },
  {
    key: "human-purpose",
    ko: /사람.*왜|인생.*의미|삶.*의미|왜\s*사는|목적|존재\s*이유/,
    en: /\b(why do (we|people|humans) live|meaning of life|human purpose|why am i here|purpose of life)\b/i,
    rule: {
      normalized: "사람은 왜 사는가",
      intent: "meaning",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["purpose", "identity", "worth"],
      theologicalAxes: ["image of God", "creation", "calling", "love of God and neighbor", "good works"],
      searchQueries: ["하나님의 형상", "사람의 목적", "선한 일", "하나님 사랑 이웃 사랑", "image of God good works"],
    },
  },
  {
    key: "faith",
    ko: /믿음|믿는다는|신앙/,
    en: /\b(faith|believe|belief)\b/i,
    rule: {
      normalized: "믿음은 무엇인가",
      intent: "definition",
      answerMode: "survey_bundle",
      confidence: "high",
      theologicalAxes: ["faith", "trust", "grace", "salvation", "obedience"],
      searchQueries: ["믿음은 무엇인가", "은혜로 믿음으로", "바라는 것들의 실상", "faith grace salvation"],
    },
  },
  {
    key: "salvation",
    ko: /구원|구원받|영생|죄.*구함/,
    en: /\b(salvation|saved|eternal life|born again|gospel)\b/i,
    rule: {
      normalized: "구원은 무엇인가",
      intent: "definition",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["guilt", "hope", "belonging"],
      theologicalAxes: ["salvation", "grace", "faith", "Jesus", "new life", "good works"],
      searchQueries: ["구원은 무엇인가", "은혜로 믿음으로 구원", "영생", "예수 그리스도", "salvation grace faith eternal life"],
    },
  },
  {
    key: "prayer",
    ko: /기도/,
    en: /\b(pray|prayer)\b/i,
    rule: {
      normalized: "기도는 왜 하는가",
      intent: "practice",
      answerMode: "direct_bible_answer",
      confidence: "high",
      theologicalAxes: ["prayer", "dependence", "Father", "petition", "trust"],
      searchQueries: ["기도는 왜 하는가", "주기도문", "염려를 맡김", "pray father kingdom daily bread"],
    },
  },
  {
    key: "forgiveness",
    ko: /용서/,
    en: /\b(forgive|forgiveness)\b/i,
    rule: {
      normalized: "용서는 무엇을 요구하는가",
      intent: "ethics",
      answerMode: "direct_bible_answer",
      confidence: "high",
      concernAxes: ["hurt", "anger", "relationship"],
      theologicalAxes: ["forgiveness", "mercy", "reconciliation", "justice"],
      searchQueries: ["용서해야 하는가", "우리가 우리에게 죄 지은 자를 사하여 준 것 같이", "서로 용서", "forgive as God forgave"],
    },
  },
  {
    key: "love",
    ko: /사랑/,
    en: /\b(love|charity)\b/i,
    rule: {
      normalized: "사랑은 무엇인가",
      intent: "definition",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["relationships", "belonging", "neighbor"],
      theologicalAxes: ["love", "God is love", "neighbor love", "patience", "truth"],
      searchQueries: ["사랑은 무엇인가", "하나님은 사랑", "하나님 사랑 이웃 사랑", "사랑은 오래 참고", "God is love"],
    },
  },
  {
    key: "truth",
    ko: /진리|참된|참말/,
    en: /\b(truth|true)\b/i,
    rule: {
      normalized: "진리는 무엇인가",
      intent: "definition",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["direction", "trust", "discernment"],
      theologicalAxes: ["truth", "Jesus", "scripture", "way", "life"],
      searchQueries: ["진리는 무엇인가", "길과 진리와 생명", "성경 진리", "truth way life", "scripture truth"],
    },
  },
  {
    key: "suffering",
    ko: /고난|고통|아픔|괴로|힘들|상한\\s*마음/,
    en: /\b(suffering|pain|hardship|affliction|brokenhearted)\b/i,
    rule: {
      normalized: "고난 중에 성경은 무엇을 말하는가",
      intent: "pastoral_care",
      answerMode: "pastoral_care",
      confidence: "high",
      concernAxes: ["suffering", "grief", "endurance", "comfort"],
      theologicalAxes: ["God's nearness", "comfort", "hope", "Jesus' rest", "endurance"],
      searchQueries: ["고난 중 위로", "상한 마음", "수고하고 무거운 짐 진 자", "인내와 위로", "suffering comfort hope"],
    },
  },
  {
    key: "hope",
    ko: /소망|희망|기대|낙심/,
    en: /\\b(hope|hopeless|discouraged|encouragement)\\b/i,
    rule: {
      normalized: "소망은 어디에서 오는가",
      intent: "pastoral_care",
      answerMode: "pastoral_care",
      confidence: "high",
      concernAxes: ["discouragement", "future", "endurance"],
      theologicalAxes: ["hope", "scripture", "encouragement", "resurrection", "God's faithfulness"],
      searchQueries: ["소망은 어디에서 오는가", "인내와 위로로 소망", "성경 소망", "hope endurance encouragement"],
    },
  },
  {
    key: "wisdom",
    ko: /지혜|분별|어떻게\\s*결정|결정.*어떻게/,
    en: /\\b(wisdom|discernment|how should i decide|make a decision)\\b/i,
    rule: {
      normalized: "지혜롭게 결정하려면 어떻게 해야 하는가",
      intent: "everyday_wisdom",
      answerMode: "wisdom_principle",
      confidence: "high",
      concernAxes: ["choice", "discernment", "responsibility"],
      theologicalAxes: ["wisdom", "prayer", "trust", "counsel", "everyday choice"],
      searchQueries: ["지혜", "여호와를 신뢰", "지혜가 부족하면 구하라", "wisdom decision trust prayer"],
    },
  },
];

function uniq(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function compactQuestion(raw: string) {
  return raw
    .normalize("NFKC")
    .trim()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ");
}

function stripQuestionNoise(value: string) {
  return value
    .replace(/[?!？。、.,]+$/g, "")
    .replace(/\b(please|pls)\b/gi, "")
    .replace(/뭐야|뭔데|무엇이야|누구야/g, "무엇인가")
    .replace(/사는거지|사는 거지|사는걸까/g, "사는가")
    .replace(/해야 돼|해야되|해야 하나/g, "해야 하는가")
    .replace(/\s+/g, " ")
    .trim();
}

function detectLocale(input: string, requested?: string): AppLocale {
  if (requested === "ko" || requested === "en") return requested;
  if (/[가-힣]/.test(input)) return "ko";
  return resolveAppLocale(requested);
}

function seedFromRule(original: string, locale: AppLocale, rule: Rule): QuestionUnderstanding {
  const normalized = locale === "ko" ? rule.normalized : stripQuestionNoise(original).toLowerCase();
  return {
    original,
    normalized,
    locale,
    intent: rule.intent,
    concernAxes: rule.concernAxes ?? [],
    theologicalAxes: rule.theologicalAxes ?? [],
    searchQueries: uniq([normalized, ...rule.searchQueries]),
    answerMode: rule.answerMode,
    confidence: rule.confidence,
  };
}

function emptyOrNonsense(original: string, locale: AppLocale): QuestionUnderstanding {
  return {
    original,
    normalized: "",
    locale,
    intent: "empty_or_nonsense",
    concernAxes: [],
    theologicalAxes: [],
    searchQueries:
      locale === "ko"
        ? ["성경은 무엇인가", "하나님은 누구인가", "기도는 왜 하는가", "삶의 목적"]
        : ["what is the Bible", "who is God", "why pray", "purpose of life"],
    answerMode: "clarify_with_starters",
    confidence: "high",
  };
}

function safetyFirst(original: string, locale: AppLocale): QuestionUnderstanding {
  return {
    original,
    normalized: locale === "ko" ? "안전이 먼저 필요한 절망 표현" : "safety first despair language",
    locale,
    intent: "safety_first",
    concernAxes: ["safety", "despair", "urgent help"],
    theologicalAxes: ["God's nearness", "comfort", "hope", "life"],
    searchQueries:
      locale === "ko"
        ? ["상한 마음", "두려워하지 말라", "수고하고 무거운 짐 진 자", "소망"]
        : ["brokenhearted", "fear not", "weary and burdened", "hope"],
    answerMode: "safety_first",
    confidence: "high",
  };
}

function everydayWisdom(original: string, locale: AppLocale): QuestionUnderstanding {
  const normalized = stripQuestionNoise(original);
  return {
    original,
    normalized,
    locale,
    intent: "everyday_wisdom",
    concernAxes: ["choice", "discernment", "responsibility"],
    theologicalAxes: ["wisdom", "counsel", "work", "trust", "neighbor love"],
    searchQueries:
      locale === "ko"
        ? [normalized, "지혜", "의논", "여호와를 신뢰", "먼저 하나님의 나라"]
        : [normalized, "wisdom", "counsel", "trust in the Lord", "seek first the kingdom"],
    answerMode: "wisdom_principle",
    confidence: "high",
  };
}

function limitedAnswer(original: string, locale: AppLocale): QuestionUnderstanding {
  const normalized = stripQuestionNoise(original);
  return {
    original,
    normalized,
    locale,
    intent: "external_fact",
    concernAxes: [],
    theologicalAxes: [],
    searchQueries: [normalized],
    answerMode: "limited_answer",
    confidence: "high",
  };
}

function pastoralCare(original: string, locale: AppLocale): QuestionUnderstanding {
  const normalized = stripQuestionNoise(original);
  return {
    original,
    normalized,
    locale,
    intent: "pastoral_care",
    concernAxes: ["weariness", "fear", "comfort"],
    theologicalAxes: ["rest", "God's care", "hope", "prayer"],
    searchQueries:
      locale === "ko"
        ? [normalized, "수고하고 무거운 짐 진 자", "두려워하지 말라", "염려", "소망"]
        : [normalized, "weary and burdened", "fear not", "anxiety", "hope"],
    answerMode: "pastoral_care",
    confidence: "medium",
  };
}

function ethicsQuestion(original: string, locale: AppLocale): QuestionUnderstanding {
  const normalized = stripQuestionNoise(original);
  return {
    original,
    normalized,
    locale,
    intent: "ethics",
    concernAxes: ["moral responsibility", "neighbor", "conscience"],
    theologicalAxes: ["love", "truth", "mercy", "holiness"],
    searchQueries:
      locale === "ko"
        ? [normalized, "하나님 사랑 이웃 사랑", "진리", "긍휼", "거룩"]
        : [normalized, "love God and neighbor", "truth", "mercy", "holiness"],
    answerMode: "direct_bible_answer",
    confidence: "medium",
  };
}

function fallback(original: string, locale: AppLocale): QuestionUnderstanding {
  const normalized = stripQuestionNoise(original);
  const isQuestion = /[?？]|\b(what|why|how|who|where|when|should|does|is)\b/i.test(original) || /뭐|왜|어떻게|누구|언제|해야|인가/.test(original);
  return {
    original,
    normalized,
    locale,
    intent: isQuestion ? "biblical_context" : "empty_or_nonsense",
    concernAxes: [],
    theologicalAxes: isQuestion ? ["Bible", "discernment"] : [],
    searchQueries: isQuestion ? [normalized] : locale === "ko" ? ["성경 질문", "삶의 고민"] : ["Bible question", "life concern"],
    answerMode: isQuestion ? "direct_bible_answer" : "clarify_with_starters",
    confidence: isQuestion ? "low" : "medium",
  };
}

export function understandQuestion(input: string, requestedLocale?: string): QuestionUnderstanding {
  const original = compactQuestion(input);
  const locale = detectLocale(original, requestedLocale);
  const lowered = original.toLowerCase();
  const stripped = stripQuestionNoise(lowered);

  if (!original || NONSENSE_KO[stripped] || NONSENSE_EN[stripped]) {
    return emptyOrNonsense(original, locale);
  }

  if (KO_SAFETY.test(original) || EN_SAFETY.test(original)) {
    return safetyFirst(original, locale);
  }

  if (KO_EXTERNAL.test(original) || EN_EXTERNAL.test(original)) {
    return limitedAnswer(original, locale);
  }

  for (const topic of TOPIC_RULES) {
    if (topic.ko.test(original) || topic.en.test(original)) {
      return seedFromRule(original, locale, topic.rule);
    }
  }

  if (KO_PASTORAL.test(original) || EN_PASTORAL.test(original)) {
    return pastoralCare(original, locale);
  }

  if (KO_ETHICS.test(original) || EN_ETHICS.test(original)) {
    return ethicsQuestion(original, locale);
  }

  if (KO_EVERYDAY.test(original) || EN_EVERYDAY.test(original)) {
    return everydayWisdom(original, locale);
  }

  return fallback(original, locale);
}

export function isQuestionUnderstanding(value: unknown): value is QuestionUnderstanding {
  const candidate = value as Partial<QuestionUnderstanding>;
  return (
    !!candidate &&
    typeof candidate.original === "string" &&
    typeof candidate.normalized === "string" &&
    (candidate.locale === "ko" || candidate.locale === "en") &&
    typeof candidate.intent === "string" &&
    Array.isArray(candidate.concernAxes) &&
    Array.isArray(candidate.theologicalAxes) &&
    Array.isArray(candidate.searchQueries) &&
    typeof candidate.answerMode === "string" &&
    (candidate.confidence === "high" || candidate.confidence === "medium" || candidate.confidence === "low")
  );
}

export function coerceQuestionUnderstanding(value: unknown, fallbackInput: string, locale?: string): QuestionUnderstanding {
  if (!isQuestionUnderstanding(value)) return understandQuestion(fallbackInput, locale);

  const resolvedLocale = resolveAppLocale(value.locale);
  const seed: UnderstandingSeed = {
    normalized: value.normalized.trim(),
    intent: value.intent,
    concernAxes: uniq(value.concernAxes.map(String)),
    theologicalAxes: uniq(value.theologicalAxes.map(String)),
    searchQueries: uniq(value.searchQueries.map(String)),
    answerMode: value.answerMode,
    confidence: value.confidence,
  };

  if (!seed.normalized || seed.searchQueries.length === 0) return understandQuestion(fallbackInput, locale);

  return {
    original: value.original || compactQuestion(fallbackInput),
    locale: resolvedLocale,
    ...seed,
  };
}
