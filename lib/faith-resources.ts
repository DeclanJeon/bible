export type AppLocale = "ko" | "en";

export type FaithBibleReference = {
  code: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
};

export type FaithPassage = {
  label: string;
  reference: FaithBibleReference;
  note: Record<AppLocale, string>;
};

export type FaithResource = {
  id: string;
  title: string;
  href: string;
  source: "GotQuestions" | "BibleProject" | "ReasonableFaith" | "YouTube" | "bible.ponslink.com" | "Other";
  language: "ko" | "en";
  kind: "article" | "video" | "podcast" | "guide" | "category" | "internal";
  level: "intro" | "middle" | "deep";
  topics: string[];
  questions: Record<AppLocale, string[]>;
  summary: Record<AppLocale, string>;
};

export type FaithQuestionNode = {
  id: string;
  title: Record<AppLocale, string>;
  shortAnswer: Record<AppLocale, string>;
  topics: string[];
  keywords: Record<AppLocale, string[]>;
  passages: FaithPassage[];
  resourceIds: string[];
  nextQuestions: Record<AppLocale, string[]>;
};

export const FAITH_RESOURCES: FaithResource[] = [
  {
    id: "bp-god",
    title: "BibleProject — God",
    href: "https://bibleproject.com/videos/god-video/",
    source: "BibleProject",
    language: "en",
    kind: "video",
    level: "intro",
    topics: ["god", "trinity"],
    questions: { ko: ["하나님은 누구신가?"], en: ["Who is God?"] },
    summary: { ko: "성경이 말하는 하나님 개념을 큰 이야기 안에서 설명하는 입문 영상입니다.", en: "An introductory BibleProject video on the biblical concept of God." },
  },
  {
    id: "gq-god-index",
    title: "GotQuestions — 하나님에 관한 질문들",
    href: "https://www.gotquestions.org/Korean/Korean-Q-God.html",
    source: "GotQuestions",
    language: "ko",
    kind: "category",
    level: "intro",
    topics: ["god", "trinity", "apologetics"],
    questions: { ko: ["하나님은 누구신가?", "하나님은 존재하시는가?"], en: ["Who is God?", "Does God exist?"] },
    summary: { ko: "하나님, 하나님의 속성, 존재, 삼위일체에 관한 한국어 Q&A 모음입니다.", en: "Korean Q&A index on God, attributes, existence, and Trinity." },
  },
  {
    id: "gq-jesus-index",
    title: "GotQuestions — 예수 그리스도에 관한 질문들",
    href: "https://www.gotquestions.org/Korean/Korean-Q-Jesus.html",
    source: "GotQuestions",
    language: "ko",
    kind: "category",
    level: "intro",
    topics: ["jesus", "gospel", "salvation"],
    questions: { ko: ["예수는 누구신가?"], en: ["Who is Jesus?"] },
    summary: { ko: "예수 그리스도의 정체성, 사역, 죽음과 부활에 관한 Q&A 모음입니다.", en: "Korean Q&A index on Jesus Christ, his identity, ministry, death, and resurrection." },
  },
  {
    id: "bp-gospels",
    title: "BibleProject — What Are the Gospels?",
    href: "https://bibleproject.com/articles/what-are-the-gospels/",
    source: "BibleProject",
    language: "en",
    kind: "article",
    level: "intro",
    topics: ["jesus", "gospel", "bible"],
    questions: { ko: ["예수는 누구신가?", "복음서는 무엇인가?"], en: ["Who is Jesus?", "What are the Gospels?"] },
    summary: { ko: "복음서가 예수의 이야기를 어떻게 전하는지 설명하는 BibleProject 자료입니다.", en: "BibleProject article explaining how the Gospels tell the story of Jesus." },
  },
  {
    id: "bp-holy-spirit",
    title: "BibleProject — Holy Spirit",
    href: "https://bibleproject.com/videos/holy-spirit/",
    source: "BibleProject",
    language: "en",
    kind: "video",
    level: "intro",
    topics: ["holy-spirit", "spirit", "new-life"],
    questions: { ko: ["성령은 누구신가?"], en: ["Who is the Holy Spirit?"] },
    summary: { ko: "성령을 하나님의 임재, 숨, 바람, 새 창조의 영이라는 성경 어휘로 설명합니다.", en: "Explains the Spirit through biblical language of presence, breath, wind, and new creation." },
  },
  {
    id: "gq-spirit-index",
    title: "GotQuestions — 성령에 관한 질문들",
    href: "https://www.gotquestions.org/Korean/Korean-Q-Spirit.html",
    source: "GotQuestions",
    language: "ko",
    kind: "category",
    level: "intro",
    topics: ["holy-spirit", "spirit", "new-life"],
    questions: { ko: ["성령은 누구신가?"], en: ["Who is the Holy Spirit?"] },
    summary: { ko: "성령의 인격, 사역, 은사, 인도하심에 관한 한국어 Q&A 모음입니다.", en: "Korean Q&A index on the Holy Spirit's person, work, gifts, and guidance." },
  },
  {
    id: "gq-good-news",
    title: "GotQuestions — 복음제시",
    href: "https://www.gotquestions.org/Korean/Korean-good-news.html",
    source: "GotQuestions",
    language: "ko",
    kind: "article",
    level: "intro",
    topics: ["gospel", "salvation", "faith"],
    questions: { ko: ["구원과 복음은 무엇인가?"], en: ["What are salvation and the gospel?"] },
    summary: { ko: "복음과 구원의 기본 내용을 제시하는 GotQuestions 한국어 자료입니다.", en: "GotQuestions Korean presentation of the good news and salvation." },
  },
  {
    id: "bp-gospel-kingdom",
    title: "BibleProject — Gospel of the Kingdom",
    href: "https://bibleproject.com/explore/video/gospel-kingdom/",
    source: "BibleProject",
    language: "en",
    kind: "video",
    level: "intro",
    topics: ["gospel", "kingdom", "salvation", "heaven"],
    questions: { ko: ["복음은 무엇인가?", "하나님 나라는 무엇인가?"], en: ["What is the gospel?", "What is God's kingdom?"] },
    summary: { ko: "복음을 하나님 나라의 좋은 소식으로 설명하는 BibleProject 영상입니다.", en: "BibleProject video presenting the gospel as the good news of God's kingdom." },
  },
  {
    id: "bp-heaven-earth",
    title: "BibleProject — Heaven and Earth",
    href: "https://bibleproject.com/videos/heaven-and-earth/",
    source: "BibleProject",
    language: "en",
    kind: "video",
    level: "intro",
    topics: ["heaven", "kingdom", "new-creation"],
    questions: { ko: ["천국은 무엇인가?"], en: ["What is heaven?"] },
    summary: { ko: "하늘과 땅, 하나님 나라, 새 창조를 연결해 천국 개념을 넓혀 주는 영상입니다.", en: "Connects heaven and earth, God's kingdom, and new creation." },
  },
  {
    id: "gq-eternity-index",
    title: "GotQuestions — 천국과 지옥에 관한 질문들",
    href: "https://www.gotquestions.org/Korean/Korean-Q-eternity.html",
    source: "GotQuestions",
    language: "ko",
    kind: "category",
    level: "intro",
    topics: ["heaven", "hell", "afterlife", "judgment"],
    questions: { ko: ["천국과 지옥은 무엇인가?"], en: ["What are heaven and hell?"] },
    summary: { ko: "천국, 지옥, 영생, 죽음 이후에 관한 한국어 Q&A 모음입니다.", en: "Korean Q&A index on heaven, hell, eternal life, and afterlife." },
  },
  {
    id: "gq-bible-myth",
    title: "GotQuestions — 성경은 신화인가?",
    href: "https://www.gotquestions.org/Korean/Korean-Bible-mythology.html",
    source: "GotQuestions",
    language: "ko",
    kind: "article",
    level: "middle",
    topics: ["bible", "myth", "history"],
    questions: { ko: ["성경은 신화인가?"], en: ["Is the Bible mythology?"] },
    summary: { ko: "성경과 신화/역사 질문으로 들어가는 한국어 Q&A 자료입니다.", en: "Korean Q&A entry point for Bible, mythology, and history questions." },
  },
  {
    id: "gq-bible-index",
    title: "GotQuestions — 성경에 관한 질문들",
    href: "https://www.gotquestions.org/Korean/Korean-Q-Bible.html",
    source: "GotQuestions",
    language: "ko",
    kind: "category",
    level: "intro",
    topics: ["bible", "history", "reliability"],
    questions: { ko: ["성경은 믿을 만한가?"], en: ["Is the Bible reliable?"] },
    summary: { ko: "성경의 영감, 오류, 정경, 신뢰성에 관한 한국어 Q&A 모음입니다.", en: "Korean Q&A index on inspiration, errors, canon, and reliability." },
  },
  {
    id: "gq-religions-index",
    title: "GotQuestions — 이단과 종교에 관한 질문들",
    href: "https://www.gotquestions.org/Korean/Korean-Q-religions.html",
    source: "GotQuestions",
    language: "ko",
    kind: "category",
    level: "intro",
    topics: ["religions", "idols", "monotheism"],
    questions: { ko: ["왜 여러 종교가 있는가?"], en: ["Why are there many religions?"] },
    summary: { ko: "여러 종교, 이단, 비교종교 질문으로 이동하는 한국어 Q&A 모음입니다.", en: "Korean Q&A index for religions, cults, and comparative religion." },
  },
  {
    id: "gq-faith-crutch",
    title: "GotQuestions — 신앙은 나약한 사람의 버팀목인가?",
    href: "https://www.gotquestions.org/Korean/Korean-faith-God-crutch.html",
    source: "GotQuestions",
    language: "ko",
    kind: "article",
    level: "middle",
    topics: ["faith", "meaning", "apologetics"],
    questions: { ko: ["굳이 신앙 없이도 살 수 있지 않은가?"], en: ["Can people live without faith?"] },
    summary: { ko: "신앙이 단지 심리적 버팀목인지 묻는 세계관/변증 Q&A 자료입니다.", en: "Korean apologetics Q&A on whether faith is merely a psychological crutch." },
  },
  {
    id: "gq-care-god-exists",
    title: "GotQuestions — 하나님이 존재하는지 왜 중요한가?",
    href: "https://www.gotquestions.org/Korean/Korean-care-God-exists.html",
    source: "GotQuestions",
    language: "ko",
    kind: "article",
    level: "middle",
    topics: ["faith", "meaning", "god"],
    questions: { ko: ["하나님 존재가 왜 중요한가?"], en: ["Why does it matter whether God exists?"] },
    summary: { ko: "하나님 존재 질문이 삶의 의미와 기준에 왜 중요한지 연결하는 Q&A 자료입니다.", en: "Korean Q&A connecting God's existence to meaning and moral reference points." },
  },
  {
    id: "ssb-internal",
    title: "bible.ponslink.com — 영혼육 입체 성경 지도",
    href: "/spirit-soul-body",
    source: "bible.ponslink.com",
    language: "ko",
    kind: "internal",
    level: "middle",
    topics: ["humanity", "spirit-soul-body", "body"],
    questions: { ko: ["인간은 어떤 존재인가?"], en: ["What is a human person?"] },
    summary: { ko: "영·혼·육을 성경 본문과 자료로 검토하는 내부 주제 지도입니다.", en: "Internal map for spirit, soul, and body through Scripture and sources." },
  },
];

export const FAITH_QUESTION_NODES: FaithQuestionNode[] = [
  {
    id: "god",
    title: { ko: "하나님은 누구신가?", en: "Who is God?" },
    shortAnswer: {
      ko: "성경은 하나님을 창조주이자 인격적이고 거룩하며 사랑과 정의의 하나님으로 증언합니다.",
      en: "Scripture presents God as Creator: personal, holy, loving, and just.",
    },
    topics: ["god", "trinity"],
    keywords: { ko: ["하나님", "창조주", "삼위일체"], en: ["god", "creator", "trinity", "divine"] },
    passages: [
      { label: "Genesis 1:1", reference: { code: "GEN", chapter: 1, startVerse: 1, endVerse: 1 }, note: { ko: "성경은 하나님을 창조주로 소개합니다.", en: "The Bible opens with God as Creator." } },
      { label: "Acts 17:24–31", reference: { code: "ACT", chapter: 17, startVerse: 24, endVerse: 31 }, note: { ko: "바울은 알지 못하는 신을 찾는 사람들에게 창조주 하나님을 설명합니다.", en: "Paul explains the Creator to people searching among many gods." } },
    ],
    resourceIds: ["bp-god", "gq-god-index"],
    nextQuestions: { ko: ["예수는 누구신가?", "왜 하나님을 믿어야 하는가?"], en: ["Who is Jesus?", "Why believe in God?"] },
  },
  {
    id: "jesus",
    title: { ko: "예수는 누구신가?", en: "Who is Jesus?" },
    shortAnswer: {
      ko: "기독교는 예수를 단순한 선생이 아니라 하나님의 아들, 주, 그리스도, 십자가와 부활의 구원자로 고백합니다.",
      en: "Christianity confesses Jesus not only as a teacher but as Son of God, Lord, Messiah, crucified and risen Savior.",
    },
    topics: ["jesus", "gospel"],
    keywords: { ko: ["예수", "그리스도", "메시아", "복음서"], en: ["jesus", "christ", "messiah", "gospel"] },
    passages: [
      { label: "John 1:1–18", reference: { code: "JOH", chapter: 1, startVerse: 1, endVerse: 18 }, note: { ko: "요한복음은 예수를 육신이 되신 말씀으로 소개합니다.", en: "John introduces Jesus as the Word made flesh." } },
      { label: "Philippians 2:5–11", reference: { code: "PHI", chapter: 2, startVerse: 5, endVerse: 11 }, note: { ko: "예수의 낮아지심과 높아지심을 압축해 보여줍니다.", en: "Shows Jesus' humility and exaltation." } },
    ],
    resourceIds: ["gq-jesus-index", "bp-gospels"],
    nextQuestions: { ko: ["복음은 무엇인가?", "부활은 왜 중요한가?"], en: ["What is the gospel?", "Why does resurrection matter?"] },
  },
  {
    id: "spirit",
    title: { ko: "성령은 누구신가?", en: "Who is the Holy Spirit?" },
    shortAnswer: {
      ko: "성령은 막연한 힘이 아니라 하나님의 임재와 새 생명의 영으로 증언됩니다.",
      en: "The Holy Spirit is not a vague force but God's personal presence and Spirit of new life.",
    },
    topics: ["holy-spirit", "spirit"],
    keywords: { ko: ["성령", "영", "보혜사", "은사"], en: ["holy spirit", "spirit", "helper", "gifts"] },
    passages: [
      { label: "John 14:16–17", reference: { code: "JOH", chapter: 14, startVerse: 16, endVerse: 17 }, note: { ko: "예수님은 보혜사, 진리의 영을 약속하십니다.", en: "Jesus promises the Helper, the Spirit of truth." } },
      { label: "Galatians 5:22–23", reference: { code: "GAL", chapter: 5, startVerse: 22, endVerse: 23 }, note: { ko: "성령의 열매는 실제 삶의 변화로 나타납니다.", en: "The Spirit's fruit appears in lived character." } },
    ],
    resourceIds: ["bp-holy-spirit", "gq-spirit-index"],
    nextQuestions: { ko: ["성령의 열매는 무엇인가?", "새 생명은 어떻게 살아지는가?"], en: ["What is the fruit of the Spirit?", "How is new life lived?"] },
  },
  {
    id: "salvation",
    title: { ko: "구원과 복음은 무엇인가?", en: "What are salvation and the gospel?" },
    shortAnswer: {
      ko: "복음은 예수 안에서 하나님 나라가 가까이 왔고, 그의 죽음과 부활을 통해 죄와 죽음에서 구원받는 길이 열렸다는 좋은 소식입니다.",
      en: "The gospel is the good news that God's kingdom has come near in Jesus and that his death and resurrection open rescue from sin and death.",
    },
    topics: ["salvation", "gospel", "faith"],
    keywords: { ko: ["구원", "복음", "믿음", "영생"], en: ["salvation", "gospel", "faith", "eternal life"] },
    passages: [
      { label: "John 3:16–17", reference: { code: "JOH", chapter: 3, startVerse: 16, endVerse: 17 }, note: { ko: "하나님의 사랑과 구원의 목적을 보여줍니다.", en: "Shows God's love and saving purpose." } },
      { label: "Ephesians 2:8–10", reference: { code: "EPH", chapter: 2, startVerse: 8, endVerse: 10 }, note: { ko: "구원은 은혜로 받고 선한 삶으로 이어집니다.", en: "Salvation is by grace and leads into good works." } },
    ],
    resourceIds: ["gq-good-news", "bp-gospel-kingdom"],
    nextQuestions: { ko: ["믿음은 무엇인가?", "회개는 무엇인가?"], en: ["What is faith?", "What is repentance?"] },
  },
  {
    id: "heaven-hell",
    title: { ko: "천국과 지옥은 무엇인가?", en: "What are heaven and hell?" },
    shortAnswer: {
      ko: "성경의 소망은 죽음 이후만이 아니라 하나님 나라, 부활, 새 하늘과 새 땅으로 이어지며, 심판과 지옥도 그 맥락에서 다뤄야 합니다.",
      en: "Biblical hope includes kingdom, resurrection, and new creation; judgment and hell should be considered in that wider frame.",
    },
    topics: ["heaven", "hell", "afterlife", "kingdom"],
    keywords: { ko: ["천국", "지옥", "죽어서", "죽으면", "하늘나라", "하나님 나라"], en: ["heaven", "hell", "afterlife", "kingdom", "death"] },
    passages: [
      { label: "Matthew 6:10", reference: { code: "MAT", chapter: 6, startVerse: 10, endVerse: 10 }, note: { ko: "하나님의 뜻이 하늘에서처럼 땅에서도 이루어지기를 구합니다.", en: "Prays for God's will on earth as in heaven." } },
      { label: "Revelation 21:1–5", reference: { code: "REV", chapter: 21, startVerse: 1, endVerse: 5 }, note: { ko: "새 하늘과 새 땅의 최종 소망을 보여줍니다.", en: "Shows the final hope of new heaven and new earth." } },
    ],
    resourceIds: ["bp-heaven-earth", "gq-eternity-index"],
    nextQuestions: { ko: ["부활은 무엇인가?", "하나님 나라는 무엇인가?"], en: ["What is resurrection?", "What is God's kingdom?"] },
  },
  {
    id: "bible-reliability",
    title: { ko: "성경은 그냥 신화인가?", en: "Is the Bible just mythology?" },
    shortAnswer: {
      ko: "성경은 여러 장르를 가진 문헌이므로 신화/역사 질문은 장르, 사본, 역사성, 부활 증언을 함께 검토해야 합니다.",
      en: "Because the Bible contains multiple genres, the myth/history question requires genre, manuscripts, history, and resurrection testimony together.",
    },
    topics: ["bible", "myth", "history", "reliability"],
    keywords: { ko: ["성경", "신화", "역사", "믿을", "오류"], en: ["bible", "myth", "history", "reliable", "errors"] },
    passages: [
      { label: "Luke 1:1–4", reference: { code: "LUK", chapter: 1, startVerse: 1, endVerse: 4 }, note: { ko: "누가는 조사와 증언의 질서를 언급합니다.", en: "Luke mentions ordered investigation and testimony." } },
      { label: "2 Peter 1:16", reference: { code: "2PE", chapter: 1, startVerse: 16, endVerse: 16 }, note: { ko: "사도적 증언은 교묘한 이야기를 따르지 않았다고 말합니다.", en: "Apostolic witness is contrasted with cleverly devised myths." } },
    ],
    resourceIds: ["gq-bible-myth", "gq-bible-index"],
    nextQuestions: { ko: ["복음서는 어떤 장르인가?", "부활 증언은 믿을 만한가?"], en: ["What genre are the Gospels?", "Is resurrection testimony credible?"] },
  },
  {
    id: "religions",
    title: { ko: "왜 여러 종교가 있는가?", en: "Why are there many religions?" },
    shortAnswer: {
      ko: "성경은 인간의 종교적 갈망을 인정하지만 우상과 참 하나님을 구분합니다.",
      en: "Scripture acknowledges humanity's religious search while distinguishing idols from the true God.",
    },
    topics: ["religions", "idols", "monotheism"],
    keywords: { ko: ["종교", "여러 신", "다른 신", "우상", "유일신"], en: ["religions", "many gods", "idols", "monotheism"] },
    passages: [
      { label: "Deuteronomy 6:4", reference: { code: "DEU", chapter: 6, startVerse: 4, endVerse: 4 }, note: { ko: "이스라엘의 신앙은 한 분 하나님 고백에서 출발합니다.", en: "Israel's faith begins with confession of one God." } },
      { label: "Acts 17:22–31", reference: { code: "ACT", chapter: 17, startVerse: 22, endVerse: 31 }, note: { ko: "바울은 여러 신앙 세계 안에서 창조주 하나님을 증언합니다.", en: "Paul witnesses to the Creator within a plural religious setting." } },
    ],
    resourceIds: ["gq-religions-index", "gq-god-index"],
    nextQuestions: { ko: ["우상은 무엇인가?", "기독교는 왜 예수를 중심에 두는가?"], en: ["What is idolatry?", "Why does Christianity center on Jesus?"] },
  },
  {
    id: "without-faith",
    title: { ko: "굳이 신앙 없이도 살 수 있지 않은가?", en: "Can people live without faith?" },
    shortAnswer: {
      ko: "사람은 신앙 없이도 일상생활을 할 수 있습니다. 하지만 기독교가 묻는 질문은 단순 생존이 아니라 존재의 근거, 선악의 기준, 죽음 이후의 소망, 하나님과의 관계입니다.",
      en: "People can function without explicit faith, but Christianity presses deeper questions of existence, moral reference points, hope beyond death, and relationship with God.",
    },
    topics: ["faith", "meaning", "life"],
    keywords: { ko: ["신앙 없이", "믿지 않아도", "살 수", "굳이 신앙", "필요 없어", "종교 없이"], en: ["without faith", "live without", "need religion", "why faith", "no faith"] },
    passages: [
      { label: "Mark 8:36", reference: { code: "MAR", chapter: 8, startVerse: 36, endVerse: 36 }, note: { ko: "온 세상을 얻어도 생명을 잃는 문제를 묻습니다.", en: "Asks what is gained if one forfeits life itself." } },
      { label: "Acts 17:24–31", reference: { code: "ACT", chapter: 17, startVerse: 24, endVerse: 31 }, note: { ko: "하나님은 모든 사람에게 생명과 호흡을 주시는 분으로 제시됩니다.", en: "God is presented as giver of life and breath to all people." } },
    ],
    resourceIds: ["gq-faith-crutch", "gq-care-god-exists"],
    nextQuestions: { ko: ["하나님 존재가 왜 중요한가?", "선악의 기준은 어디서 오는가?"], en: ["Why does God's existence matter?", "Where do moral reference points come from?"] },
  },
  {
    id: "humanity",
    title: { ko: "인간은 어떤 존재인가?", en: "What is a human person?" },
    shortAnswer: {
      ko: "성경은 인간을 하나님의 형상, 몸을 가진 생명, 마음과 영과 혼을 가진 통합된 존재로 설명합니다.",
      en: "Scripture describes humans as God's image, embodied life, and integrated persons spoken of with heart, spirit, and soul language.",
    },
    topics: ["humanity", "spirit-soul-body", "body"],
    keywords: { ko: ["인간", "영혼", "영혼육", "몸", "혼", "영"], en: ["human", "soul", "spirit", "body", "spirit soul body"] },
    passages: [
      { label: "Genesis 1:26–27", reference: { code: "GEN", chapter: 1, startVerse: 26, endVerse: 27 }, note: { ko: "인간 존엄의 출발점은 하나님의 형상입니다.", en: "Human dignity begins with the image of God." } },
      { label: "1 Thessalonians 5:23", reference: { code: "1TH", chapter: 5, startVerse: 23, endVerse: 23 }, note: { ko: "영과 혼과 몸을 한 사람 전체의 거룩함 안에서 언급합니다.", en: "Names spirit, soul, and body within whole-person sanctification." } },
    ],
    resourceIds: ["ssb-internal", "bp-holy-spirit"],
    nextQuestions: { ko: ["영과 혼은 어떻게 다른가?", "몸은 왜 중요한가?"], en: ["How are soul and spirit related?", "Why does the body matter?"] },
  },
];

export function getFaithResourcesByIds(ids: string[]) {
  const idSet = new Set(ids);
  return FAITH_RESOURCES.filter((resource) => idSet.has(resource.id));
}
