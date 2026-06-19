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

export type DoctrineDivergence = "shared_core" | "divergent" | "tradition_requested";

export type TraditionKey =
  | "catholic"
  | "orthodox"
  | "reformed"
  | "lutheran"
  | "baptist_evangelical"
  | "wesleyan_arminian"
  | "pentecostal_charismatic";

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
  doctrineDivergence?: DoctrineDivergence;
  doctrineTopic?: string;
  requestedTradition?: TraditionKey;
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
    key: "creation-origin",
    ko: /세상.*시작|세상.*어떻게|만물.*시작|태초|창조.*질문|왜.*만들|어떻게.*생기|우주.*시작|인간.*만들/,
    en: /\b(how did the world begin|creation|how was the universe created|origin of the world|how did everything start)\b/i,
    rule: {
      normalized: "세상은 어떻게 시작되었는가",
      intent: "doctrine",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["origin", "creation", "truth"],
      theologicalAxes: ["creation", "Genesis", "God the Creator", "beginning", "word of God"],
      searchQueries: ["태초에 하나님이", "창조", "태초", "말씀", "만물", "creation beginning Genesis word"],
    },
  },
  {
    key: "pharisee-hypocrisy",
    ko: /바리새인.*꾸짖|바리새인.*비판|외식|위선.*바리새|율법.*바리새|바리새인.*왜/,
    en: /\b(pharisee|hypocrisy|hypocrite|jesus criticized pharisees|why did jesus rebuke)\b/i,
    rule: {
      normalized: "예수님은 왜 바리새인들을 꾸짖으셨는가",
      intent: "doctrine",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["진리", "진정성", "순종"],
      theologicalAxes: ["외식", "율법", "전통", "마음", "참된 예배"],
      searchQueries: ["바리새인", "외식", "율법", "전통", "마음", "pharisee hypocrisy law tradition heart"],
    },
  },
  {
    key: "heaven-activities",
    ko: /하늘나라.*무엇.*하|천국.*무엇.*하|천국.*하는\s*일|하늘.*做什么|천국.*생활|영원.*세계.*무엇/,
    en: /\b(what will we do in heaven|heaven activities|what happens in heaven|life in heaven|eternal life activities)\b/i,
    rule: {
      normalized: "하늘나라에서 우리는 무엇을 하는가",
      intent: "meaning",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["소망", "미래", "목적"],
      theologicalAxes: ["천국", "예배", "섬김", "기쁨", "영생", "그리스도와 함께 다스림"],
      searchQueries: ["하늘나라", "섬기", "다스리", "기쁨", "영생", "천국", "heaven worship service joy reign"],
    },
  },
  {
    key: "faith-individual-collective",
    ko: /신앙.*개인|신앙.*집단|믿음.*개인|믿음.*공동체|개인.*신앙|집단.*신앙|혼자.*믿|함께.*믿/,
    en: /\b(individual faith|collective faith|personal faith|communal faith|faith alone|faith together)\b/i,
    rule: {
      normalized: "신앙은 개인적인 것인가 집단적인 것인가",
      intent: "doctrine",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["공동체", "개인", "교제"],
      theologicalAxes: ["교회", "공동체", "교제", "그리스도의 몸", "모임"],
      searchQueries: ["공동체", "모이", "교제", "교회", "그리스도의 몸", "community fellowship church gathering"],
    },
  },
  {
    key: "identity-in-christ",
    ko: /그리스도\s*안.*나|그리스도\s*안.*누구|예수\s*안.*나|예수\s*안.*누구|주\s*안.*나|주\s*안.*identity/,
    en: /\b(who am i in christ|identity in christ|who i am in jesus|in christ i am)\b/i,
    rule: {
      normalized: "그리스도 안에서의 나는 누구인가",
      intent: "meaning",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["정체성", "가치", "소속"],
      theologicalAxes: ["새로운 피조물", "하나님의 자녀", "존귀", "택하심", "사랑받는 자"],
      searchQueries: ["새롭", "자녀", "존귀", "택하심", "사랑", "그리스도 안에서", "new creation children precious chosen"],
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
    key: "jesus-atonement",
    ko: /예수.*왜.*죽|예수.*죽.*왜|예수님이\s*왜\s*죽|십자가.*왜|속죄|대속|화목제물/,
    en: /\b(why did jesus die|why did christ die|why was jesus crucified|why the cross|atonement|substitutionary atonement)\b/i,
    rule: {
      normalized: "예수님은 왜 죽으셨는가",
      intent: "doctrine",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["forgiveness", "guilt", "peace", "hope"],
      theologicalAxes: ["Jesus", "cross", "atonement", "substitution", "reconciliation", "salvation"],
      searchQueries: ["예수님은 왜 죽으셨는가", "자기 목숨을 많은 사람의 대속물", "그리스도께서 죄를 위하여 단번에 죽으심", "우리의 죄악을 담당", "Jesus died for sins"],
    },
  },
  {
    key: "jesus-deity",
    ko: /예수.*하나님|예수님은\s*하나님|예수는\s*하나님|그리스도.*하나님|예수.*신성/,
    en: /\b(is jesus god|is christ god|deity of christ|is jesus divine|jesus is god)\b/i,
    rule: {
      normalized: "예수님은 하나님이신가",
      intent: "doctrine",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["truth", "hope", "worship"],
      theologicalAxes: ["Jesus", "deity of Christ", "Son of God", "revelation of God", "incarnation", "worship"],
      searchQueries: ["예수님은 하나님이신가", "말씀이 하나님이시니라", "나의 주시며 나의 하나님", "하나님의 영광의 광채", "보이지 않는 하나님의 형상", "Is Jesus God"],
    },
  },
  {
    key: "trinity",
    ko: /삼위일체|성부와\s*성자와\s*성령|아버지와\s*아들과\s*성령/,
    en: /\b(trinity|triune god|father son and holy spirit)\b/i,
    rule: {
      normalized: "삼위일체는 무엇인가",
      intent: "doctrine",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["truth", "worship", "belonging"],
      theologicalAxes: ["God", "Father", "Son", "Holy Spirit", "unity of God", "distinction of persons"],
      searchQueries: ["삼위일체는 무엇인가", "아버지와 아들과 성령의 이름", "주 예수 그리스도의 은혜와 하나님의 사랑과 성령의 교통", "예수 세례 성령 비둘기 아버지 음성", "what is the Trinity"],
    },
  },
  {
    key: "jesus",
    ko: /예수님|예수\s*그리스도|예수는|예수는\s*누구|그리스도는|메시아|메시야/,
    en: /\b(who is jesus|jesus christ|who is christ|who is the messiah|messiah|son of god)\b/i,
    rule: {
      normalized: "예수님은 누구인가",
      intent: "doctrine",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["truth", "hope", "belonging"],
      theologicalAxes: ["Jesus", "Christology", "Son of God", "incarnation", "salvation", "revelation of God"],
      searchQueries: ["예수님은 누구인가", "말씀이 육신이 되심", "보이지 아니하시는 하나님의 형상", "하나님의 영광의 광채", "길과 진리와 생명", "Jesus Christ Son of God"],
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
  {
    key: "repentance",
    ko: /회개|돌이키|뉘우침|회심/,
    en: /\b(repent|repentance|turn away|turn back)\b/i,
    rule: {
      normalized: "회개란 무엇인가",
      intent: "definition",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["guilt", "change", "forgiveness"],
      theologicalAxes: ["repentance", "forgiveness", "salvation", "new life", "grace"],
      searchQueries: ["회개란 무엇인가", "회개하여 돌이키라", "죄를 자백", "회개하고 복음을 믿으라", "repentance forgiveness salvation"],
    },
  },
  {
    key: "cross-message",
    ko: /십자가.*도|십자가.*의미|십자가.*왜|왜.*십자가/,
    en: /\b(message of the cross|cross meaning|why the cross|foolishness of cross)\b/i,
    rule: {
      normalized: "십자가의 도란 무엇인가",
      intent: "doctrine",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["truth", "wisdom", "salvation"],
      theologicalAxes: ["cross", "atonement", "salvation", "wisdom of God", "power of God"],
      searchQueries: ["십자가의 도", "십자가가 미련한 자에게는", "하나님의 능력", "message of the cross atonement"],
    },
  },
  {
    key: "evil-origin",
    ko: /악.*시작|악.*기원|왜.*악|악.*존재|사탄.*시작|마귀.*시작/,
    en: /\b(origin of evil|why evil|where does evil come from|satan origin|devil origin)\b/i,
    rule: {
      normalized: "악은 어디서 시작되었는가",
      intent: "doctrine",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["suffering", "justice", "understanding"],
      theologicalAxes: ["sin", "fall", "satan", "free will", "God's sovereignty", "judgment"],
      searchQueries: ["악의 기원", "사탄의 타락", "선악과", "죄가 세상에 들어온 것", "origin of evil fall of satan"],
    },
  },
  {
    key: "angels",
    ko: /천사|천사들|天使/,
    en: /\b(angels|angel|archangel|seraphim|cherubim)\b/i,
    rule: {
      normalized: "천사들은 누구인가",
      intent: "definition",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["wonder", "spiritual world"],
      theologicalAxes: ["angels", "spiritual beings", "creation", "ministry", "worship"],
      searchQueries: ["천사", "하나님의 아들들", "천사장 미가엘", "천사는 부리는 영", "angels spiritual beings ministry"],
    },
  },
  {
    key: "death-meaning",
    ko: /죽음.*의미|왜.*죽|죽는가|사망|죽음.*이후/,
    en: /\b(why do we die|meaning of death|death|what happens after death)\b/i,
    rule: {
      normalized: "인간은 왜 죽는가",
      intent: "meaning",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["mortality", "fear", "hope"],
      theologicalAxes: ["death", "sin", "resurrection", "eternal life", "hope"],
      searchQueries: ["인간은 왜 죽는가", "죄의 삯은 사망", "부활", "영생", "death sin resurrection eternal life"],
    },
  },
  {
    key: "loneliness",
    ko: /외로|고독|혼자|孤独/,
    en: /\b(lonely|loneliness|alone|isolated)\b/i,
    rule: {
      normalized: "외로움을 어떻게 극복하는가",
      intent: "pastoral_care",
      answerMode: "pastoral_care",
      confidence: "high",
      concernAxes: ["loneliness", "belonging", "comfort"],
      theologicalAxes: ["God's presence", "community", "comfort", "belonging", "love"],
      searchQueries: ["외로움", "하나님의 임재", "혼자 두지 않겠다", "함께 하시리라", "loneliness God presence comfort"],
    },
  },
  {
    key: "grace-definition",
    ko: /은혜.*란|은혜.*무엇|은혜.*의미|값없/,
    en: /\b(what is grace|meaning of grace|grace|unmerited favor)\b/i,
    rule: {
      normalized: "은혜란 무엇인가",
      intent: "definition",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["grace", "salvation", "worth"],
      theologicalAxes: ["grace", "salvation", "faith", "mercy", "gift"],
      searchQueries: ["은혜란 무엇인가", "값없이 주시는 은혜", "은혜로 믿음으로 구원", "grace salvation faith gift"],
    },
  },
  {
    key: "new-birth",
    ko: /중생|거듭나|새로\s*태어나|重生/,
    en: /\b(born again|new birth|regeneration|rebirth)\b/i,
    rule: {
      normalized: "중생이란 무엇인가",
      intent: "doctrine",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["salvation", "new life", "transformation"],
      theologicalAxes: ["new birth", "Holy Spirit", "salvation", "new creation", "water and spirit"],
      searchQueries: ["중생이란 무엇인가", "거듭나지 아니하면", "물과 성령으로", "새로 지으심을 받은 자", "born again new birth regeneration"],
    },
  },
  {
    key: "adoption",
    ko: /양자|양子|입양|하나님.*자녀/,
    en: /\b(adoption|adopted|children of God|sonship)\b/i,
    rule: {
      normalized: "양자가 무엇인가",
      intent: "definition",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["identity", "belonging", "worth"],
      theologicalAxes: ["adoption", "children of God", "heirs", "Holy Spirit", "inheritance"],
      searchQueries: ["양자가 무엇인가", "하나님의 자녀", "상속자", "아바 아버지", "adoption children of God heirs"],
    },
  },
  {
    key: "hell",
    ko: /지옥|영벌|영원.*벌|지옥.*실제/,
    en: /\b(hell|eternal punishment|lake of fire|gehenna)\b/i,
    rule: {
      normalized: "지옥은 실제인가",
      intent: "doctrine",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["fear", "justice", "judgment"],
      theologicalAxes: ["judgment", "hell", "eternal punishment", "God's justice", "salvation"],
      searchQueries: ["지옥은 실제인가", "영원한 불", "심판", "지옥", "hell eternal punishment judgment"],
    },
  },
  {
    key: "atheism",
    ko: /무신론|무신론자|신이\s*없|하나님.*없/,
    en: /\b(atheism|atheist|no god|does god exist|god doesn't exist)\b/i,
    rule: {
      normalized: "하나님의 존재에 대한 무신론적 질문",
      intent: "doctrine",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["doubt", "truth", "meaning"],
      theologicalAxes: ["existence of God", "creation", "revelation", "faith", "meaning"],
      searchQueries: ["하나님의 존재", "어리석은 자는 그의 마음에 이르기를 하나님이 없다 하도다", "하늘이 하나님의 영광을 선포", "atheism existence of God creation"],
    },
  },
  {
    key: "human-philosophy",
    ko: /인간은\s*왜|사람은\s*왜|인생.*목적|존재.*이유|왜\s*존재|왜\s*태어나|어디서\s*왔/,
    en: /\b(why do humans|why do people|human purpose|why exist|where did we come from|why were we born)\b/i,
    rule: {
      normalized: "인간의 존재 이유는 무엇인가",
      intent: "meaning",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["purpose", "identity", "existence"],
      theologicalAxes: ["image of God", "creation", "calling", "love", "meaning"],
      searchQueries: ["하나님의 형상대로 지으심", "사람의 목적", "선한 일을 위하여", "하나님 사랑 이웃 사랑", "human purpose image of God creation"],
    },
  },
  {
    key: "flood",
    ko: /홍수|대홍수|노아.*방주|방주/,
    en: /\b(flood|noah|ark|great flood|genesis flood)\b/i,
    rule: {
      normalized: "대홍수는 정말 일어났는가",
      intent: "biblical_context",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["truth", "history", "judgment"],
      theologicalAxes: ["flood", "Noah", "judgment", "covenant", "salvation"],
      searchQueries: ["노아의 홍수", "방주", "하나님의 심판", "무지개 언약", "Noah flood ark judgment covenant"],
    },
  },
  {
    key: "worship",
    ko: /예배|예배란|예배.*무엇|왜.*예배/,
    en: /\b(worship|what is worship|why worship)\b/i,
    rule: {
      normalized: "예배란 무엇인가",
      intent: "practice",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["worship", "connection", "purpose"],
      theologicalAxes: ["worship", "spirit and truth", "God's glory", "community", "praise"],
      searchQueries: ["예배란 무엇인가", "영과 진리로 예배", "하나님의 영광", "찬양", "worship spirit truth glory"],
    },
  },
  {
    key: "bible-authority",
    ko: /성경.*하나님|성경.*말씀|성경.*영감|성경.*무엇|성경.*진짜/,
    en: /\b(is the bible god's word|bible inspired|what is the bible|bible truth)\b/i,
    rule: {
      normalized: "성경은 무엇인가",
      intent: "definition",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["truth", "authority", "trust"],
      theologicalAxes: ["Scripture", "inspiration", "revelation", "truth", "teaching"],
      searchQueries: ["성경은 무엇인가", "하나님의 감동으로 된 성경", "말씀은 살아있고", "성경 진리", "bible inspired scripture truth"],
    },
  },
  {
    key: "family-marriage",
    ko: /결혼|부부|가정|자녀\s*양육|부모|시부모|며느리/,
    en: /\b(marriage|husband|wife|family|parenting|parent|child rearing)\b/i,
    rule: {
      normalized: "하나님이 원하시는 결혼과 가정",
      intent: "practice",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["relationships", "family", "love"],
      theologicalAxes: ["marriage", "family", "love", "submission", "nurture"],
      searchQueries: ["결혼", "부부", "하나님이 짝지어 주신 것", "자녀 양육", "부모 공경", "marriage family love nurture"],
    },
  },
  {
    key: "money-material",
    ko: /돈|재물|십일조|부자|가난|재정|물질/,
    en: /\b(money|wealth|tithe|rich|poor|finance|material)\b/i,
    rule: {
      normalized: "하나님은 돈에 대해 무엇을 말씀하시는가",
      intent: "ethics",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["money", "stewardship", "contentment"],
      theologicalAxes: ["stewardship", "generosity", "contentment", "idolatry", "treasure"],
      searchQueries: ["돈", "재물", "하나님과 재물을 겸하여 섬기지 못하느니라", "십일조", "가난한 자에게 구제하라", "money wealth stewardship generosity"],
    },
  },
  {
    key: "vocation-calling",
    ko: /소명|직업|부르심|은사.*직업|일.*하나님/,
    en: /\b(vocation|calling|career|work|job|profession)\b/i,
    rule: {
      normalized: "소명과 직업이란 무엇인가",
      intent: "practice",
      answerMode: "wisdom_principle",
      confidence: "high",
      concernAxes: ["purpose", "work", "meaning"],
      theologicalAxes: ["calling", "stewardship", "service", "glory", "good works"],
      searchQueries: ["소명", "부르심", "범사에 하나님의 영광을", "맡은 자에게 충성", "vocation calling work stewardship"],
    },
  },
  {
    key: "end-times",
    ko: /종말|재림|말세|휴거|천년왕국|적그리스도|심판\s*날/,
    en: /\b(end times|second coming|rapture|millennium|antichrist|judgment day|eschatology)\b/i,
    rule: {
      normalized: "종말과 재림에 대한 성경의 가르침",
      intent: "doctrine",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["future", "hope", "preparation"],
      theologicalAxes: ["second coming", "judgment", "resurrection", "new creation", "hope"],
      searchQueries: ["종말", "재림", "마지막 날", "새 하늘과 새 땅", "주 예수 그리스도의 강림", "end times second coming judgment hope"],
    },
  },
  {
    key: "ethics-moral",
    ko: /도덕|윤리|선과\s*악|올바른|정직|거짓말|안락사|낙태|동성애|이혼|전쟁|환경|세금|납세/,
    en: /\b(ethics|moral|right and wrong|honest|lie|euthanasia|abortion|divorce|war|environment|tax|taxes)\b/i,
    rule: {
      normalized: "기독교 윤리와 도덕",
      intent: "ethics",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["ethics", "discernment", "obedience"],
      theologicalAxes: ["righteousness", "justice", "love", "truth", "obedience"],
      searchQueries: ["기독교 윤리", "선과 악", "하나님의 뜻", "공의와 정의", "ethics morality righteousness justice"],
    },
  },
  {
    key: "christian-relationship",
    ko: /관계.*특징|건강.*관계|그리스도인.*관계|형제.*자매.*관계|교제.*관계/,
    en: /\b(christian relationship|healthy relationship|fellowship|brotherhood|sisterhood)\b/i,
    rule: {
      normalized: "건강한 그리스도인 관계의 특징",
      intent: "practice",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["relationships", "community", "love"],
      theologicalAxes: ["love", "humility", "encouragement", "fellowship", "unity"],
      searchQueries: ["그리스도인 관계", "사랑", "겸손", "격려", "교제", "christian relationship love fellowship"],
    },
  },
  {
    key: "appearance-self",
    ko: /외모|몸매|미용|self-image|appearance|容貌/,
    en: /\b(appearance|looks|self-image|body image|beauty standards)\b/i,
    rule: {
      normalized: "외모에 대한 고민을 다루는 방법",
      intent: "pastoral_care",
      answerMode: "pastoral_care",
      confidence: "high",
      concernAxes: ["appearance", "self-worth", "identity"],
      theologicalAxes: ["inner beauty", "God's creation", "worth", "image of God", "heart"],
      searchQueries: ["외모", "마음", "존귀", "하나님의 형상", "inner beauty worth"],
    },
  },
  {
    key: "biblical-figure",
    ko: /마리아|모세|아브라함|다윗|솔로몬|엘리야|베드로|바울|요한|룻|에스더|이사야|예레미야|욥|노아/,
    en: /\b(mary|moses|abraham|david|solomon|elijah|peter|paul|john|ruth|esther|isaiah|jeremiah|job|noah)\b/i,
    rule: {
      normalized: "성경 인물의 교훈",
      intent: "biblical_context",
      answerMode: "survey_bundle",
      confidence: "high",
      concernAxes: ["faith", "obedience", "example"],
      theologicalAxes: ["faith", "obedience", "God's plan", "humility", "courage"],
      searchQueries: ["성경 인물", "믿음", "순종", "겸손", "biblical figure faith obedience"],
    },
  },
];

const DIVERGENT_TOPICS: Record<string, { ko: RegExp; en: RegExp; topic: string }> = {
  baptism: {
    ko: /세례|침례|洗礼|침수|입교/,
    en: /\b(baptism|baptize|baptist|infant baptism|believers baptism)\b/i,
    topic: "baptism",
  },
  eucharist: {
    ko: /성찬|성체|영성체|주의\s*만찬|성만찬/,
    en: /\b(eucharist|lord'?s supper|communion|transubstantiation|real presence)\b/i,
    topic: "eucharist",
  },
  salvation_security: {
    ko: /구원.*잃|영생.*잃|구원.*확신|구원.*보장|영생.*보장/,
    en: /\b(lose salvation|eternal security|once saved|perseverance of the saints|assurance of salvation)\b/i,
    topic: "salvation_security",
  },
  predestination: {
    ko: /예정|선택.*구원|하나님.*선택|예정설|선택설|자유의지/,
    en: /\b(predestination|elected|election|free will|arminianism|calvinism|five points|tulip)\b/i,
    topic: "predestination",
  },
  spiritual_gifts: {
    ko: /방언|은사|성령.*세례|성령.*체험|치유.*은사|예언.*은사/,
    en: /\b(speaking in tongues|spiritual gifts|baptism of the holy spirit|charismatic|cessationism|continuationism|prophecy|healing)\b/i,
    topic: "spiritual_gifts",
  },
  eschatology: {
    ko: /휴거|재림|종말|천년왕국|대환란|말세|묵시록/,
    en: /\b(rapture|second coming|millennium|tribulation|end times|eschatology|revelation)\b/i,
    topic: "eschatology",
  },
};

const TRADITION_PATTERNS: Record<TraditionKey, { ko: RegExp; en: RegExp }> = {
  catholic: { ko: /가톨릭|천주교|로마\s*가톨릭|로마\s*교회|교황/, en: /\b(catholic|roman catholic|papacy|pope)\b/i },
  orthodox: { ko: /정교회|동방\s*정교회|그리스\s*정교회/, en: /\b(orthodox|eastern orthodox|greek orthodox|russian orthodox)\b/i },
  reformed: { ko: /개혁주의|칼뱅주의|장로교|改革/, en: /\b(reformed|calvinist|calvinism|presbyterian)\b/i },
  lutheran: { ko: /루터교|루터anism/, en: /\b(lutheran|lutheranism)\b/i },
  baptist_evangelical: { ko: /침례교|복음주의|evangelical/, en: /\b(baptist|evangelical|southern baptist)\b/i },
  wesleyan_arminian: { ko: /웨슬리안|아르미니우스주의|감리교|성결교/, en: /\b(wesleyan|arminian|methodist|holiness)\b/i },
  pentecostal_charismatic: { ko: /오순절|은사주의|성결运动/, en: /\b(pentecostal|charismatic|assembly of god)\b/i },
};

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

  let result!: QuestionUnderstanding;

  if (!original || NONSENSE_KO[stripped] || NONSENSE_EN[stripped]) {
    result = emptyOrNonsense(original, locale);
  } else if (KO_SAFETY.test(original) || EN_SAFETY.test(original)) {
    result = safetyFirst(original, locale);
  } else if (KO_EXTERNAL.test(original) || EN_EXTERNAL.test(original)) {
    result = limitedAnswer(original, locale);
  } else {
    let matched = false;
    for (const topic of TOPIC_RULES) {
      if (topic.ko.test(original) || topic.en.test(original)) {
        result = seedFromRule(original, locale, topic.rule);
        matched = true;
        break;
      }
    }
    if (!matched) {
      if (KO_PASTORAL.test(original) || EN_PASTORAL.test(original)) {
        result = pastoralCare(original, locale);
      } else if (KO_ETHICS.test(original) || EN_ETHICS.test(original)) {
        result = ethicsQuestion(original, locale);
      } else if (KO_EVERYDAY.test(original) || EN_EVERYDAY.test(original)) {
        result = everydayWisdom(original, locale);
      } else {
        result = fallback(original, locale);
      }
    }
  }

  // Reclassify non-doctrine intents when input matches doctrine-related patterns
  if (result.intent !== "doctrine") {
    for (const [, spec] of Object.entries(DIVERGENT_TOPICS)) {
      const regex = locale === "ko" ? spec.ko : spec.en;
      if (regex.test(original)) {
        result = { ...result, intent: "doctrine", confidence: "medium", answerMode: "survey_bundle" };
        break;
      }
    }
  }
  if (result.intent !== "doctrine") {
    for (const [, pattern] of Object.entries(TRADITION_PATTERNS)) {
      const regex = locale === "ko" ? pattern.ko : pattern.en;
      if (regex.test(original)) {
        result = { ...result, intent: "doctrine", confidence: "medium", answerMode: "survey_bundle" };
        break;
      }
    }
  }

  // Doctrine divergence classification
  let doctrineDivergence: DoctrineDivergence | undefined;
  let doctrineTopic: string | undefined;
  let requestedTradition: TraditionKey | undefined;

  if (result.intent === "doctrine") {
    // Check for tradition request first
    for (const [key, pattern] of Object.entries(TRADITION_PATTERNS)) {
      const regex = result.locale === "ko" ? pattern.ko : pattern.en;
      if (regex.test(original) || regex.test(result.normalized)) {
        requestedTradition = key as TraditionKey;
        doctrineDivergence = "tradition_requested";
        break;
      }
    }

    // If no tradition requested, check for divergent topics
    if (!doctrineDivergence) {
      for (const [, spec] of Object.entries(DIVERGENT_TOPICS)) {
        const regex = result.locale === "ko" ? spec.ko : spec.en;
        if (regex.test(original) || regex.test(result.normalized)) {
          doctrineDivergence = "divergent";
          doctrineTopic = spec.topic;
          break;
        }
      }
    }

    // Default to shared_core for doctrine questions
    if (!doctrineDivergence) {
      doctrineDivergence = "shared_core";
    }
  }

  return { ...result, doctrineDivergence, doctrineTopic, requestedTradition };
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
