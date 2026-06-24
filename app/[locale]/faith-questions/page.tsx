import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenText, Compass, ExternalLink, HelpCircle, Layers3, Route, Search } from "lucide-react";
import { FaithQuestionForm } from "@/components/faith-question-form";

import { buildBibleReferenceHref } from "@/lib/navigation";
import { buildPageMetadata } from "@/lib/page-metadata";
import { resolveLocale } from "@/lib/server-locale";

type Props = {
  params: Promise<{ locale: string }>;
};

type AppLocale = "ko" | "en";

type BibleReference = { code: string; chapter: number; startVerse: number; endVerse: number };

type PassageLink = {
  label: string;
  reference: BibleReference;
};

type ResourceLink = {
  label: string;
  href: string;
  source: string;
  kind: Record<AppLocale, string>;
  level: Record<AppLocale, string>;
};

type QuestionCard = {
  id: string;
  title: Record<AppLocale, string>;
  summary: Record<AppLocale, string>;
  tags: Record<AppLocale, string[]>;
  passages: PassageLink[];
  resources: ResourceLink[];
};

type ReadingPath = {
  title: Record<AppLocale, string>;
  summary: Record<AppLocale, string>;
  steps: Record<AppLocale, string[]>;
};

type CategoryGroup = {
  title: Record<AppLocale, string>;
  summary: Record<AppLocale, string>;
  links: { label: Record<AppLocale, string>; href: string }[];
};

const QUESTION_CARDS: QuestionCard[] = [
  {
    id: "who-is-god",
    title: { ko: "하나님은 누구신가?", en: "Who is God?" },
    summary: {
      ko: "성경의 하나님은 막연한 힘이 아니라 창조주, 인격적 하나님, 사랑과 거룩과 정의의 하나님으로 계시됩니다.",
      en: "The God of Scripture is not a vague force but the Creator: personal, holy, just, and loving.",
    },
    tags: { ko: ["하나님", "창조주", "삼위일체"], en: ["God", "Creator", "Trinity"] },
    passages: [
      { label: "Genesis 1:1", reference: { code: "GEN", chapter: 1, startVerse: 1, endVerse: 1 } },
      { label: "Exodus 3:14", reference: { code: "EXO", chapter: 3, startVerse: 14, endVerse: 14 } },
      { label: "John 1:1–18", reference: { code: "JOH", chapter: 1, startVerse: 1, endVerse: 18 } },
      { label: "Acts 17:24–31", reference: { code: "ACT", chapter: 17, startVerse: 24, endVerse: 31 } },
      { label: "1 John 4:7–12", reference: { code: "1JO", chapter: 4, startVerse: 7, endVerse: 12 } },
    ],
    resources: [
      { label: "BibleProject — God", href: "https://bibleproject.com/videos/god-video/", source: "BibleProject", kind: { ko: "영상", en: "Video" }, level: { ko: "입문", en: "Intro" } },
      { label: "GotQuestions — 하나님은 누구신가?", href: "https://www.gotquestions.org/Korean/Korean-who-is-God.html", source: "GotQuestions", kind: { ko: "글", en: "Article" }, level: { ko: "입문", en: "Intro" } },
      { label: "GotQuestions — 하나님은 영이신가?", href: "https://www.gotquestions.org/Korean/Korean-God-is-spirit.html", source: "GotQuestions", kind: { ko: "글", en: "Article" }, level: { ko: "입문", en: "Intro" } },
    ],
  },
  {
    id: "heaven",
    title: { ko: "천국은 죽어서 가는 곳인가?", en: "Is heaven simply where we go after death?" },
    summary: {
      ko: "성경의 소망은 영혼의 탈출만이 아니라 하나님 나라, 그리스도와 함께 있음, 부활, 새 하늘과 새 땅으로 이어집니다.",
      en: "Biblical hope includes God's kingdom, being with Christ, resurrection, and new creation—not only a disembodied afterlife.",
    },
    tags: { ko: ["천국", "하나님 나라", "새 창조"], en: ["Heaven", "Kingdom", "New creation"] },
    passages: [
      { label: "Matthew 6:10", reference: { code: "MAT", chapter: 6, startVerse: 10, endVerse: 10 } },
      { label: "Luke 23:43", reference: { code: "LUK", chapter: 23, startVerse: 43, endVerse: 43 } },
      { label: "John 14:1–3", reference: { code: "JOH", chapter: 14, startVerse: 1, endVerse: 3 } },
      { label: "1 Corinthians 15", reference: { code: "1CO", chapter: 15, startVerse: 1, endVerse: 58 } },
      { label: "Revelation 21:1–5", reference: { code: "REV", chapter: 21, startVerse: 1, endVerse: 5 } },
    ],
    resources: [
      { label: "BibleProject — Heaven and Earth", href: "https://bibleproject.com/videos/heaven-and-earth/", source: "BibleProject", kind: { ko: "영상", en: "Video" }, level: { ko: "입문", en: "Intro" } },
      { label: "BibleProject — Heaven & Hell Podcast", href: "https://bibleproject.com/podcasts/series/heaven-hell/", source: "BibleProject", kind: { ko: "팟캐스트", en: "Podcast" }, level: { ko: "깊이읽기", en: "Deep" } },
      { label: "GotQuestions — 천국과 지옥에 관한 질문들", href: "https://www.gotquestions.org/Korean/Korean-Q-eternity.html", source: "GotQuestions", kind: { ko: "Q&A 모음", en: "Q&A index" }, level: { ko: "입문", en: "Intro" } },
    ],
  },
  {
    id: "hell",
    title: { ko: "지옥은 무엇인가?", en: "What is hell?" },
    summary: {
      ko: "지옥은 공포 이미지 하나로 축소할 수 없고 죄, 심판, 하나님과의 분리, 새 창조 밖에 남는 상태와 연결해 검토해야 합니다.",
      en: "Hell should be considered through sin, judgment, separation from God, and exclusion from new creation—not only as a fear image.",
    },
    tags: { ko: ["지옥", "심판", "죽음 이후"], en: ["Hell", "Judgment", "Afterlife"] },
    passages: [
      { label: "Matthew 10:28", reference: { code: "MAT", chapter: 10, startVerse: 28, endVerse: 28 } },
      { label: "Matthew 25:31–46", reference: { code: "MAT", chapter: 25, startVerse: 31, endVerse: 46 } },
      { label: "Mark 9:43–48", reference: { code: "MAR", chapter: 9, startVerse: 43, endVerse: 48 } },
      { label: "Revelation 20:11–15", reference: { code: "REV", chapter: 20, startVerse: 11, endVerse: 15 } },
    ],
    resources: [
      { label: "GotQuestions — 천국과 지옥에 관한 질문들", href: "https://www.gotquestions.org/Korean/Korean-Q-eternity.html", source: "GotQuestions", kind: { ko: "Q&A 모음", en: "Q&A index" }, level: { ko: "입문", en: "Intro" } },
      { label: "잘잘법 — Is Hell Really Real?", href: "https://www.youtube.com/watch?v=MkI_5im80Lg", source: "YouTube", kind: { ko: "영상", en: "Video" }, level: { ko: "중급", en: "Middle" } },
    ],
  },
  {
    id: "why-believe",
    title: { ko: "왜 사람들은 신을 믿는가?", en: "Why do people believe in God?" },
    summary: {
      ko: "사람은 의미, 도덕, 죽음, 고통, 아름다움, 존재의 이유를 묻습니다. 기독교는 이 질문들을 창조주 하나님과 부활 소망 안에서 다룹니다.",
      en: "Humans ask about meaning, morality, death, suffering, beauty, and existence; Christianity addresses them through Creator, image of God, redemption, and resurrection.",
    },
    tags: { ko: ["신 존재", "의미", "변증"], en: ["God's existence", "Meaning", "Apologetics"] },
    passages: [
      { label: "Ecclesiastes 3:11", reference: { code: "ECC", chapter: 3, startVerse: 11, endVerse: 11 } },
      { label: "Psalm 19:1–4", reference: { code: "PSA", chapter: 19, startVerse: 1, endVerse: 4 } },
      { label: "Romans 1:19–20", reference: { code: "ROM", chapter: 1, startVerse: 19, endVerse: 20 } },
      { label: "Acts 17:22–31", reference: { code: "ACT", chapter: 17, startVerse: 22, endVerse: 31 } },
    ],
    resources: [
      { label: "GotQuestions — 하나님 존재 논증", href: "https://www.gotquestions.org/Korean/Korean-argument-existence-God.html", source: "GotQuestions", kind: { ko: "글", en: "Article" }, level: { ko: "중급", en: "Middle" } },
      { label: "Reasonable Faith — Existence and Nature of God", href: "https://www.reasonablefaith.org/writings/popular-writings/existence-nature-of-god/", source: "Reasonable Faith", kind: { ko: "글", en: "Article" }, level: { ko: "깊이읽기", en: "Deep" } },
      { label: "잘잘법 — 보이지도 않는 신을 왜 믿는 거지?", href: "https://www.youtube.com/watch?v=PFrtA9TUmZY", source: "YouTube", kind: { ko: "영상", en: "Video" }, level: { ko: "입문", en: "Intro" } },
    ],
  },
  {
    id: "many-religions",
    title: { ko: "왜 여러 신들과 종교가 있는가?", en: "Why are there many gods and religions?" },
    summary: {
      ko: "성경은 인간의 종교적 갈망을 인정하면서도 우상과 참 하나님을 구분합니다. 핵심은 여러 선택지 중 취향이 아니라 창조주 계시의 문제입니다.",
      en: "Scripture acknowledges humanity's religious search while distinguishing idols from the true God; the issue is revelation, not preference among options.",
    },
    tags: { ko: ["종교", "우상", "유일신"], en: ["Religion", "Idols", "Monotheism"] },
    passages: [
      { label: "Exodus 20:1–6", reference: { code: "EXO", chapter: 20, startVerse: 1, endVerse: 6 } },
      { label: "Deuteronomy 6:4", reference: { code: "DEU", chapter: 6, startVerse: 4, endVerse: 4 } },
      { label: "Isaiah 44", reference: { code: "ISA", chapter: 44, startVerse: 1, endVerse: 28 } },
      { label: "Acts 17:22–31", reference: { code: "ACT", chapter: 17, startVerse: 22, endVerse: 31 } },
      { label: "1 Corinthians 8:4–6", reference: { code: "1CO", chapter: 8, startVerse: 4, endVerse: 6 } },
    ],
    resources: [
      { label: "GotQuestions — 유일신론", href: "https://www.gotquestions.org/Korean/Korean-monotheism.html", source: "GotQuestions", kind: { ko: "글", en: "Article" }, level: { ko: "중급", en: "Middle" } },
      { label: "GotQuestions — 이단과 종교에 관한 질문들", href: "https://www.gotquestions.org/Korean/Korean-Q-religions.html", source: "GotQuestions", kind: { ko: "Q&A 모음", en: "Q&A index" }, level: { ko: "입문", en: "Intro" } },
      { label: "Reasonable Faith — Christianity and Other Faiths", href: "https://www.reasonablefaith.org/writings/popular-writings/christianity-other-faiths/", source: "Reasonable Faith", kind: { ko: "글", en: "Article" }, level: { ko: "깊이읽기", en: "Deep" } },
    ],
  },
  {
    id: "bible-myth",
    title: { ko: "성경은 그냥 신화가 아닌가?", en: "Is the Bible just mythology?" },
    summary: {
      ko: "성경은 다양한 장르를 가진 문헌입니다. 신화인가 역사인가의 질문은 장르, 사본, 역사성, 부활 증언을 함께 검토해야 합니다.",
      en: "The Bible contains many genres; the myth-or-history question requires genre, manuscripts, history, and resurrection testimony together.",
    },
    tags: { ko: ["성경", "신화", "역사"], en: ["Bible", "Myth", "History"] },
    passages: [
      { label: "Luke 1:1–4", reference: { code: "LUK", chapter: 1, startVerse: 1, endVerse: 4 } },
      { label: "John 20:30–31", reference: { code: "JOH", chapter: 20, startVerse: 30, endVerse: 31 } },
      { label: "1 Corinthians 15:3–8", reference: { code: "1CO", chapter: 15, startVerse: 3, endVerse: 8 } },
      { label: "2 Timothy 3:16–17", reference: { code: "2TI", chapter: 3, startVerse: 16, endVerse: 17 } },
      { label: "2 Peter 1:16", reference: { code: "2PE", chapter: 1, startVerse: 16, endVerse: 16 } },
    ],
    resources: [
      { label: "GotQuestions — 성경은 신화인가?", href: "https://www.gotquestions.org/Korean/Korean-Bible-mythology.html", source: "GotQuestions", kind: { ko: "글", en: "Article" }, level: { ko: "중급", en: "Middle" } },
      { label: "GotQuestions — 성경은 믿을 만한가?", href: "https://www.gotquestions.org/Korean/Korean-Bible-reliable.html", source: "GotQuestions", kind: { ko: "글", en: "Article" }, level: { ko: "중급", en: "Middle" } },
      { label: "생각하는 기독교 — 성경, 신화인가 역사인가?", href: "https://www.youtube.com/watch?v=WJK74j0jPG0", source: "YouTube", kind: { ko: "영상", en: "Video" }, level: { ko: "깊이읽기", en: "Deep" } },
    ],
  },
  {
    id: "without-faith",
    title: { ko: "굳이 신앙 없이도 살 수 있지 않은가?", en: "Can people live without faith?" },
    summary: {
      ko: "사람은 신앙 없이도 일상생활을 할 수 있습니다. 기독교가 묻는 질문은 단순 생존이 아니라 존재의 근거, 선악의 기준, 죽음 이후의 소망입니다.",
      en: "People can function without explicit faith; Christianity presses deeper questions of existence, goodness, death, hope, and relationship with God.",
    },
    tags: { ko: ["신앙", "의미", "삶"], en: ["Faith", "Meaning", "Life"] },
    passages: [
      { label: "Mark 8:36", reference: { code: "MAR", chapter: 8, startVerse: 36, endVerse: 36 } },
      { label: "John 10:10", reference: { code: "JOH", chapter: 10, startVerse: 10, endVerse: 10 } },
      { label: "Acts 17:24–31", reference: { code: "ACT", chapter: 17, startVerse: 24, endVerse: 31 } },
      { label: "Romans 2:14–16", reference: { code: "ROM", chapter: 2, startVerse: 14, endVerse: 16 } },
      { label: "Ecclesiastes 12:13", reference: { code: "ECC", chapter: 12, startVerse: 13, endVerse: 13 } },
    ],
    resources: [
      { label: "GotQuestions — 신앙은 나약한 사람의 버팀목인가?", href: "https://www.gotquestions.org/Korean/Korean-faith-God-crutch.html", source: "GotQuestions", kind: { ko: "글", en: "Article" }, level: { ko: "중급", en: "Middle" } },
      { label: "GotQuestions — 하나님이 존재하는지 왜 중요한가?", href: "https://www.gotquestions.org/Korean/Korean-care-God-exists.html", source: "GotQuestions", kind: { ko: "글", en: "Article" }, level: { ko: "중급", en: "Middle" } },
    ],
  },
  {
    id: "human-person",
    title: { ko: "인간은 어떤 존재인가? 몸만 있는가?", en: "What is a human person? Only a body?" },
    summary: {
      ko: "성경은 인간을 몸, 생명, 마음, 영, 혼 같은 다양한 언어로 설명합니다. 영·혼·육 구분은 유익한 지도일 수 있지만 기계적 공식은 아닙니다.",
      en: "Scripture speaks of humans with language like body, life, heart, spirit, and soul. Spirit-soul-body can be useful but should not become a mechanical formula.",
    },
    tags: { ko: ["인간", "영혼육", "몸"], en: ["Humanity", "Spirit/Soul/Body", "Body"] },
    passages: [
      { label: "Genesis 1:26–27", reference: { code: "GEN", chapter: 1, startVerse: 26, endVerse: 27 } },
      { label: "1 Thessalonians 5:23", reference: { code: "1TH", chapter: 5, startVerse: 23, endVerse: 23 } },
      { label: "Hebrews 4:12", reference: { code: "HEB", chapter: 4, startVerse: 12, endVerse: 12 } },
      { label: "Romans 12:1–2", reference: { code: "ROM", chapter: 12, startVerse: 1, endVerse: 2 } },
      { label: "1 Corinthians 6:19–20", reference: { code: "1CO", chapter: 6, startVerse: 19, endVerse: 20 } },
    ],
    resources: [
      { label: "내부 — 영혼육 입체 성경 지도", href: "/spirit-soul-body", source: "bible.ponslink.com", kind: { ko: "내부 지도", en: "Internal map" }, level: { ko: "중급", en: "Middle" } },
      { label: "GotQuestions — 인간은 두 부분인가, 세 부분인가?", href: "https://www.gotquestions.org/Korean/Korean-body-soul-spirit.html", source: "GotQuestions", kind: { ko: "글", en: "Article" }, level: { ko: "중급", en: "Middle" } },
      { label: "BibleProject — Nephesh / Soul", href: "https://bibleproject.com/videos/nephesh-soul/", source: "BibleProject", kind: { ko: "영상", en: "Video" }, level: { ko: "입문", en: "Intro" } },
    ],
  },
  {
    id: "who-is-jesus",
    title: { ko: "예수는 누구신가?", en: "Who is Jesus?" },
    summary: {
      ko: "기독교 신앙의 중심은 예수 그리스도입니다. 성경은 예수를 말씀, 하나님의 아들, 주, 그리스도, 낮아지신 구원자로 증언합니다.",
      en: "Christian faith centers on Jesus Christ. Scripture presents him as the Word, Son of God, Lord, Messiah, and the humbled Savior.",
    },
    tags: { ko: ["예수", "그리스도", "복음"], en: ["Jesus", "Christ", "Gospel"] },
    passages: [
      { label: "John 1:1–18", reference: { code: "JOH", chapter: 1, startVerse: 1, endVerse: 18 } },
      { label: "Mark 1:14–15", reference: { code: "MAR", chapter: 1, startVerse: 14, endVerse: 15 } },
      { label: "Philippians 2:5–11", reference: { code: "PHI", chapter: 2, startVerse: 5, endVerse: 11 } },
      { label: "Colossians 1:15–20", reference: { code: "COL", chapter: 1, startVerse: 15, endVerse: 20 } },
      { label: "Hebrews 1:1–4", reference: { code: "HEB", chapter: 1, startVerse: 1, endVerse: 4 } },
    ],
    resources: [
      { label: "BibleProject — What Are the Gospels?", href: "https://bibleproject.com/articles/what-are-the-gospels/", source: "BibleProject", kind: { ko: "글", en: "Article" }, level: { ko: "입문", en: "Intro" } },
      { label: "BibleProject — How to Read Gospel", href: "https://bibleproject.com/videos/how-to-read-gospel/", source: "BibleProject", kind: { ko: "영상", en: "Video" }, level: { ko: "입문", en: "Intro" } },
      { label: "GotQuestions — 예수 그리스도에 관한 질문들", href: "https://www.gotquestions.org/Korean/Korean-Q-Jesus.html", source: "GotQuestions", kind: { ko: "Q&A 모음", en: "Q&A index" }, level: { ko: "입문", en: "Intro" } },
    ],
  },
  {
    id: "holy-spirit",
    title: { ko: "성령은 누구신가?", en: "Who is the Holy Spirit?" },
    summary: {
      ko: "성령은 막연한 힘이 아니라 하나님의 임재와 새 창조의 영으로 증언됩니다. 예수님은 성령을 보혜사와 진리의 영으로 약속하셨습니다.",
      en: "The Holy Spirit is not an impersonal force but God's personal presence and the Spirit of new creation, promised by Jesus as Helper and Spirit of truth.",
    },
    tags: { ko: ["성령", "임재", "새 생명"], en: ["Holy Spirit", "Presence", "New life"] },
    passages: [
      { label: "Genesis 1:2", reference: { code: "GEN", chapter: 1, startVerse: 2, endVerse: 2 } },
      { label: "John 14:16–17", reference: { code: "JOH", chapter: 14, startVerse: 16, endVerse: 17 } },
      { label: "John 14:26", reference: { code: "JOH", chapter: 14, startVerse: 26, endVerse: 26 } },
      { label: "John 16:7–15", reference: { code: "JOH", chapter: 16, startVerse: 7, endVerse: 15 } },
      { label: "Galatians 5:22–23", reference: { code: "GAL", chapter: 5, startVerse: 22, endVerse: 23 } },
    ],
    resources: [
      { label: "BibleProject — Holy Spirit", href: "https://bibleproject.com/videos/holy-spirit/", source: "BibleProject", kind: { ko: "영상", en: "Video" }, level: { ko: "입문", en: "Intro" } },
      { label: "BibleProject — Who Is the Holy Spirit?", href: "https://bibleproject.com/guides/holy-spirit/", source: "BibleProject", kind: { ko: "가이드", en: "Guide" }, level: { ko: "중급", en: "Middle" } },
      { label: "GotQuestions — 성령에 관한 질문들", href: "https://www.gotquestions.org/Korean/Korean-Q-Spirit.html", source: "GotQuestions", kind: { ko: "Q&A 모음", en: "Q&A index" }, level: { ko: "입문", en: "Intro" } },
    ],
  },
  {
    id: "salvation-gospel",
    title: { ko: "구원과 복음은 무엇인가?", en: "What are salvation and the gospel?" },
    summary: {
      ko: "복음은 하나님 나라가 예수 안에서 가까이 왔고, 그의 죽음과 부활을 통해 죄와 죽음에서 구원받는 길이 열렸다는 좋은 소식입니다.",
      en: "The gospel is the good news that God's kingdom has come near in Jesus and that his death and resurrection open rescue from sin and death.",
    },
    tags: { ko: ["구원", "복음", "믿음"], en: ["Salvation", "Gospel", "Faith"] },
    passages: [
      { label: "Mark 1:14–15", reference: { code: "MAR", chapter: 1, startVerse: 14, endVerse: 15 } },
      { label: "John 3:16–17", reference: { code: "JOH", chapter: 3, startVerse: 16, endVerse: 17 } },
      { label: "Romans 3:21–26", reference: { code: "ROM", chapter: 3, startVerse: 21, endVerse: 26 } },
      { label: "1 Corinthians 15:1–8", reference: { code: "1CO", chapter: 15, startVerse: 1, endVerse: 8 } },
      { label: "Ephesians 2:8–10", reference: { code: "EPH", chapter: 2, startVerse: 8, endVerse: 10 } },
    ],
    resources: [
      { label: "GotQuestions — 복음제시", href: "https://www.gotquestions.org/Korean/Korean-good-news.html", source: "GotQuestions", kind: { ko: "글", en: "Article" }, level: { ko: "입문", en: "Intro" } },
      { label: "GotQuestions — 구원에 관한 질문들", href: "https://www.gotquestions.org/Korean/Korean-Q-salvation.html", source: "GotQuestions", kind: { ko: "Q&A 모음", en: "Q&A index" }, level: { ko: "입문", en: "Intro" } },
      { label: "BibleProject — Gospel of the Kingdom", href: "https://bibleproject.com/explore/video/gospel-kingdom/", source: "BibleProject", kind: { ko: "영상", en: "Video" }, level: { ko: "입문", en: "Intro" } },
    ],
  },
];

const READING_PATHS: ReadingPath[] = [
  {
    title: { ko: "처음 묻는 사람", en: "For first questions" },
    summary: { ko: "기독교의 큰 흐름을 부담 없이 훑습니다.", en: "A light path through the big Christian questions." },
    steps: {
      ko: ["하나님은 누구신가?", "예수는 누구신가?", "복음은 무엇인가?", "하나님 나라는 무엇인가?", "천국과 지옥은 무엇인가?"],
      en: ["Who is God?", "Who is Jesus?", "What is the gospel?", "What is God's kingdom?", "What are heaven and hell?"],
    },
  },
  {
    title: { ko: "다시 정리하는 신자", en: "For believers rebuilding clarity" },
    summary: { ko: "익숙하지만 흐릿한 주제를 성경 본문과 함께 재정렬합니다.", en: "Reorder familiar but blurry topics around Scripture." },
    steps: {
      ko: ["하나님 나라와 천국", "복음과 구원", "성령과 새 생명", "성경의 큰 이야기", "부활과 새 창조", "인간·영혼·몸"],
      en: ["Kingdom and heaven", "Gospel and salvation", "Spirit and new life", "The Bible's big story", "Resurrection and new creation", "Humanity, soul, and body"],
    },
  },
  {
    title: { ko: "회의적인 사람", en: "For skeptics and doubters" },
    summary: { ko: "믿음 이전에 걸리는 질문들을 숨기지 않고 다룹니다.", en: "Take the blocking questions seriously before moving on." },
    steps: {
      ko: ["하나님이 존재하는가?", "왜 여러 종교가 있는가?", "성경은 신화인가?", "예수의 부활은 믿을 만한가?", "악과 고통은 왜 있는가?"],
      en: ["Does God exist?", "Why many religions?", "Is the Bible mythology?", "Is the resurrection credible?", "Why evil and suffering?"],
    },
  },
  {
    title: { ko: "설명해야 하는 사람", en: "For people explaining faith" },
    summary: { ko: "짧은 답, 긴 답, 성경 본문, 외부 자료를 분리합니다.", en: "Separate short answers, longer answers, Scripture, and external resources." },
    steps: {
      ko: ["질문을 공격으로 받지 않기", "짧은 답과 긴 답 구분하기", "성경 본문으로 연결하기", "변증 자료로 보완하기", "모르는 것은 모른다고 말하기"],
      en: ["Do not treat every question as an attack", "Separate short and long answers", "Move toward Scripture", "Use apologetics carefully", "Say when you do not know"],
    },
  },
];

const GOTQUESTIONS_GROUPS: CategoryGroup[] = [
  {
    title: { ko: "핵심 입문", en: "Core entry points" },
    summary: { ko: "복음, 핵심 질문, 자주 묻는 질문으로 빠르게 들어갑니다.", en: "Start with gospel, crucial questions, and frequently asked questions." },
    links: [
      { label: { ko: "복음제시", en: "Good news" }, href: "https://www.gotquestions.org/Korean/Korean-good-news.html" },
      { label: { ko: "핵심적인 질문들", en: "Crucial questions" }, href: "https://www.gotquestions.org/Korean/Korean-crucial.html" },
      { label: { ko: "대중적인 질문들", en: "Popular questions" }, href: "https://www.gotquestions.org/Korean/Korean-FAQ.html" },
    ],
  },
  {
    title: { ko: "하나님과 삼위일체", en: "God and Trinity" },
    summary: { ko: "하나님, 예수 그리스도, 성령에 관한 Q&A 모음입니다.", en: "Question indexes about God, Jesus Christ, and the Holy Spirit." },
    links: [
      { label: { ko: "하나님에 관한 질문들", en: "Questions about God" }, href: "https://www.gotquestions.org/Korean/Korean-Q-God.html" },
      { label: { ko: "예수 그리스도에 관한 질문들", en: "Questions about Jesus Christ" }, href: "https://www.gotquestions.org/Korean/Korean-Q-Jesus.html" },
      { label: { ko: "성령에 관한 질문들", en: "Questions about the Holy Spirit" }, href: "https://www.gotquestions.org/Korean/Korean-Q-Spirit.html" },
    ],
  },
  {
    title: { ko: "구원과 신앙생활", en: "Salvation and Christian life" },
    summary: { ko: "구원, 신앙생활, 기도, 죄를 다루는 실제적 질문들입니다.", en: "Practical questions about salvation, Christian living, prayer, and sin." },
    links: [
      { label: { ko: "구원에 관한 질문들", en: "Questions about salvation" }, href: "https://www.gotquestions.org/Korean/Korean-Q-salvation.html" },
      { label: { ko: "신앙생활에 관한 질문들", en: "Questions about Christian living" }, href: "https://www.gotquestions.org/Korean/Korean-Q-Christian.html" },
      { label: { ko: "기도에 관한 질문들", en: "Questions about prayer" }, href: "https://www.gotquestions.org/Korean/Korean-Q-prayer.html" },
      { label: { ko: "죄에 관한 질문들", en: "Questions about sin" }, href: "https://www.gotquestions.org/Korean/Korean-Q-sin.html" },
    ],
  },
  {
    title: { ko: "성경과 신학", en: "Bible and theology" },
    summary: { ko: "성경의 신뢰성, 성경개관, 성경 인물, 신학 주제로 이동합니다.", en: "Bible reliability, surveys, Bible people, and theology topics." },
    links: [
      { label: { ko: "성경에 관한 질문들", en: "Questions about the Bible" }, href: "https://www.gotquestions.org/Korean/Korean-Q-Bible.html" },
      { label: { ko: "성경 개관 / 요약", en: "Bible survey" }, href: "https://www.gotquestions.org/Korean/Korean-Q-Bible-Survey.html" },
      { label: { ko: "성경에 나오는 사람들", en: "People in the Bible" }, href: "https://www.gotquestions.org/Korean/Korean-Q-Bible-people.html" },
      { label: { ko: "신학에 관한 질문들", en: "Questions about theology" }, href: "https://www.gotquestions.org/Korean/Korean-Q-theology.html" },
    ],
  },
  {
    title: { ko: "교회와 종말", en: "Church and last things" },
    summary: { ko: "교회, 종말, 천국과 지옥, 천사와 악마 주제입니다.", en: "Church, end times, heaven and hell, angels and demons." },
    links: [
      { label: { ko: "교회에 관한 질문들", en: "Questions about church" }, href: "https://www.gotquestions.org/Korean/Korean-Q-church.html" },
      { label: { ko: "종말에 관한 질문들", en: "Questions about end times" }, href: "https://www.gotquestions.org/Korean/Korean-Q-end-times.html" },
      { label: { ko: "천국과 지옥에 관한 질문들", en: "Questions about heaven and hell" }, href: "https://www.gotquestions.org/Korean/Korean-Q-eternity.html" },
      { label: { ko: "천사와 악마에 관한 질문들", en: "Questions about angels and demons" }, href: "https://www.gotquestions.org/Korean/Korean-Q-angels.html" },
    ],
  },
  {
    title: { ko: "인간, 세계관, 변증", en: "Humanity, worldview, apologetics" },
    summary: { ko: "인간 이해, 세계관, 창조, 신앙의 이유를 탐색합니다.", en: "Humanity, worldview, creation, and reasons for faith." },
    links: [
      { label: { ko: "인간에 관한 질문들", en: "Questions about humanity" }, href: "https://www.gotquestions.org/Korean/Korean-Q-humanity.html" },
      { label: { ko: "세계관에 대한 질문", en: "Questions about apologetics and worldview" }, href: "https://www.gotquestions.org/Korean/Korean-Q-Apologetics-Worldview.html" },
      { label: { ko: "창조에 관한 질문들", en: "Questions about creation" }, href: "https://www.gotquestions.org/Korean/Korean-Q-creation.html" },
    ],
  },
  {
    title: { ko: "종교, 이단, 거짓교리", en: "Religions, cults, false teaching" },
    summary: { ko: "여러 종교, 이단, 거짓교리 관련 질문을 원문 Q&A로 보냅니다.", en: "Indexes for religions, cults, and false teaching questions." },
    links: [
      { label: { ko: "이단과 종교에 관한 질문들", en: "Questions about cults and religions" }, href: "https://www.gotquestions.org/Korean/Korean-Q-religions.html" },
      { label: { ko: "거짓교리에 관한 질문들", en: "Questions about false doctrine" }, href: "https://www.gotquestions.org/Korean/Korean-Q-false.html" },
    ],
  },
  {
    title: { ko: "삶의 문제", en: "Life issues" },
    summary: { ko: "결혼, 연애, 가족, 인생결정, 시사 문제로 확장합니다.", en: "Marriage, relationships, family, decisions, and topical questions." },
    links: [
      { label: { ko: "결혼에 관한 질문들", en: "Questions about marriage" }, href: "https://www.gotquestions.org/Korean/Korean-Q-marriage.html" },
      { label: { ko: "연애에 관한 질문들", en: "Questions about relationships" }, href: "https://www.gotquestions.org/Korean/Korean-Q-relationships.html" },
      { label: { ko: "가족과 자녀양육", en: "Questions about family" }, href: "https://www.gotquestions.org/Korean/Korean-Q-family.html" },
      { label: { ko: "인생결정에 관한 질문들", en: "Questions about life decisions" }, href: "https://www.gotquestions.org/Korean/Korean-Q-life.html" },
      { label: { ko: "시사적인 질문들", en: "Topical questions" }, href: "https://www.gotquestions.org/Korean/Korean-Q-topical.html" },
      { label: { ko: "기타 질문들", en: "Miscellaneous questions" }, href: "https://www.gotquestions.org/Korean/Korean-Q-miscellaneous.html" },
    ],
  },
];

function T({ locale, ko, en }: { locale: AppLocale; ko: string; en: string }) {
  return locale === "ko" ? ko : en;
}

function localizedExternalHref(href: string, locale: AppLocale) {
  return href.startsWith("/") ? `/${locale}${href}` : href;
}

function isInternalHref(href: string) {
  return href.startsWith("/");
}

function ScriptureLink({ passage, locale }: { passage: PassageLink; locale: AppLocale }) {
  return (
    <Link
      href={buildBibleReferenceHref(passage.reference, { locale, from: "faith-questions" })}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface-2)] px-3 py-2 text-xs font-medium text-[var(--ink-muted)] transition hover:border-[var(--gold)]/40 hover:text-[var(--gold)]"
    >
      <BookOpenText className="h-3.5 w-3.5" aria-hidden="true" />
      {passage.label}
    </Link>
  );
}

function ResourceAnchor({ resource, locale }: { resource: ResourceLink; locale: AppLocale }) {
  const href = localizedExternalHref(resource.href, locale);
  const className = "rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] p-3 transition hover:border-[var(--gold)]/40";
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold text-[var(--ink)]">{resource.label}</span>
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-none text-[var(--gold)]" aria-hidden="true" />
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-[var(--ink-muted)]">
        <span className="rounded-full border border-[var(--hairline)] px-2 py-1">{resource.source}</span>
        <span className="rounded-full border border-[var(--hairline)] px-2 py-1">{resource.kind[locale]}</span>
        <span className="rounded-full border border-[var(--hairline)] px-2 py-1">{resource.level[locale]}</span>
      </div>
    </>
  );

  return isInternalHref(resource.href) ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {content}
    </a>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  const title = locale === "ko" ? "신앙 질문 지도" : "Faith Questions Map";
  const description =
    locale === "ko"
      ? "하나님, 성경, 천국과 지옥, 여러 종교, 신앙의 이유를 성경 본문과 선별된 외부 자료로 연결하는 질문 지도입니다."
      : "A Scripture-centered map connecting questions about God, the Bible, heaven and hell, religions, and faith to curated resources.";

  return buildPageMetadata(locale, title, description, "/faith-questions");
}

export default async function FaithQuestionsPage({ params }: Props) {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);

  return (
    <main className="page-shell-wide page-enter">
      <section className="relative overflow-hidden rounded-[2rem] border border-[var(--hairline)] bg-[var(--surface-1)] p-5 sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,168,83,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(138,180,232,0.08),transparent_32%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div>
            <div className="section-title text-base">
              <T locale={locale} ko="처음 묻는 사람과 다시 묻는 신자를 위한 지도" en="For first questions and renewed clarity" />
            </div>
            <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-tight tracking-[-0.04em] text-[var(--ink)] sm:text-5xl lg:text-6xl">
              <T locale={locale} ko="신앙 질문 지도" en="Faith Questions Map" />
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--muted)] sm:text-lg">
              <T
                locale={locale}
                ko="하나님, 예수, 성령, 구원, 성경, 천국과 지옥, 여러 종교, 신앙의 이유를 성경 본문과 검증 가능한 외부 자료로 연결합니다. 이 페이지는 외부 Q&A를 복제하지 않고, 읽기 쉬운 질문 경로를 제공합니다."
                en="Connect questions about God, Jesus, the Spirit, salvation, Scripture, heaven and hell, other religions, and reasons for faith to Bible passages and curated external resources. This page routes readers; it does not mirror external Q&A archives."
              />
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#questions" className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-4 py-2.5 text-sm font-semibold text-[var(--canvas)] transition hover:bg-[var(--gold-hover)]">
                <HelpCircle className="h-4 w-4" aria-hidden="true" />
                <T locale={locale} ko="질문별로 보기" en="Browse questions" />
              </a>
              <a href="https://www.gotquestions.org/Korean/Korean-search.html" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--hairline-strong)] bg-[var(--surface-2)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--gold)]/40 hover:text-[var(--gold)]">
                <Search className="h-4 w-4" aria-hidden="true" />
                <T locale={locale} ko="GotQuestions 검색" en="Search GotQuestions" />
              </a>
            </div>
          </div>
          <aside className="rounded-3xl border border-[var(--gold)]/20 bg-[var(--surface-0)]/70 p-5 shadow-2xl shadow-black/20 sm:p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <Compass className="h-5 w-5 text-[var(--gold)]" aria-hidden="true" />
              <T locale={locale} ko="설계 원칙" en="Design rule" />
            </div>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-[var(--muted)]">
              <li className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4">
                <T locale={locale} ko="짧은 답보다 성경 본문과 원문 자료로 가는 길을 먼저 제공합니다." en="Prefer a path to Scripture and source material over a shallow answer." />
              </li>
              <li className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4">
                <T locale={locale} ko="GotQuestions의 방대한 Q&A는 링크로 활용하고 전문을 저장하지 않습니다." en="Use GotQuestions as linked reference indexes, not mirrored article storage." />
              </li>
              <li className="rounded-2xl border border-[var(--gold)]/20 bg-[var(--gold)]/[0.08] p-4">
                <T locale={locale} ko="AI 답변은 다음 단계에서 읽기 도우미로 붙이고, 최종 근거는 성경과 원문 링크에 둡니다." en="AI assistance comes later as a reading guide; the grounding stays in Scripture and source links." />
              </li>
            </ul>
          </aside>
        </div>
      </section>
      <FaithQuestionForm locale={locale} />

      <section id="questions" className="mt-8 rounded-3xl border border-[var(--hairline)] bg-[var(--surface-2)] p-5 sm:p-7">
        <div className="section-title"><T locale={locale} ko="핵심 질문" en="Core questions" /></div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--ink)]">
          <T locale={locale} ko="짧은 방향, 성경 본문, 깊이 읽을 자료를 한 카드에 묶기" en="One card: short direction, Scripture, and deeper resources" />
        </h2>
        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          {QUESTION_CARDS.map((question) => (
            <article key={question.id} className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-5">
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-[var(--gold)]">
                {question.tags[locale].map((tag) => (
                  <span key={tag} className="rounded-full border border-[var(--gold)]/20 bg-[var(--gold)]/[0.08] px-2.5 py-1">
                    {tag}
                  </span>
                ))}
              </div>
              <h3 className="mt-4 text-xl font-semibold tracking-tight text-[var(--ink)]">{question.title[locale]}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{question.summary[locale]}</p>
              <div className="mt-5 rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--gold)]">
                  <T locale={locale} ko="먼저 읽을 성경" en="Start in Scripture" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {question.passages.map((passage) => (
                    <ScriptureLink key={`${question.id}-${passage.label}`} passage={passage} locale={locale} />
                  ))}
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {question.resources.map((resource) => (
                  <ResourceAnchor key={`${question.id}-${resource.href}`} resource={resource} locale={locale} />
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="paths" className="mt-8 rounded-3xl border border-[var(--hairline)] bg-[var(--surface-2)] p-5 sm:p-7">
        <div className="section-title"><T locale={locale} ko="읽기 경로" en="Reading paths" /></div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--ink)]">
          <T locale={locale} ko="사용자의 상태에 따라 질문 순서를 다르게 잡기" en="Choose a route by the reader's starting point" />
        </h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          {READING_PATHS.map((path) => (
            <article key={path.title.ko} className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--gold)]">
                <Route className="h-4 w-4" aria-hidden="true" />
                <T locale={locale} ko="경로" en="Route" />
              </div>
              <h3 className="mt-3 text-lg font-semibold text-[var(--ink)]">{path.title[locale]}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{path.summary[locale]}</p>
              <ol className="mt-4 space-y-2 text-sm leading-6 text-[var(--muted)]">
                {path.steps[locale].map((step, index) => (
                  <li key={step} className="flex gap-2">
                    <span className="font-semibold text-[var(--gold)]">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>

      <section id="gotquestions" className="mt-8 rounded-3xl border border-[var(--hairline)] bg-[var(--surface-2)] p-5 sm:p-7">
        <div className="section-title"><T locale={locale} ko="방대한 외부 Q&A로 이동" en="Move into larger Q&A archives" /></div>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
              <T locale={locale} ko="GotQuestions 한국어 카테고리 허브" en="GotQuestions Korean category hub" />
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base">
              <T locale={locale} ko="아래 링크들은 GotQuestions 한국어의 주제별 Q&A 모음입니다. 이 사이트는 핵심 질문의 방향과 성경 본문을 연결하고, 세부 질문은 원문 Q&A로 이동해 확인하도록 설계합니다." en="These links point to GotQuestions Korean category indexes. This site provides direction and Bible anchors; detailed Q&A remains at the source." />
            </p>
          </div>
          <a href="https://www.gotquestions.org/Korean/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--hairline-strong)] bg-[var(--surface-1)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--gold)]/40 hover:text-[var(--gold)]">
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            <T locale={locale} ko="전체 Q&A 보기" en="Open all Q&A" />
          </a>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {GOTQUESTIONS_GROUPS.map((group) => (
            <article key={group.title.ko} className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--gold)]">
                <Layers3 className="h-4 w-4" aria-hidden="true" />
                <T locale={locale} ko="카테고리" en="Category" />
              </div>
              <h3 className="mt-3 text-lg font-semibold text-[var(--ink)]">{group.title[locale]}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{group.summary[locale]}</p>
              <div className="mt-4 grid gap-2">
                {group.links.map((link) => (
                  <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] px-3 py-2.5 text-sm font-medium text-[var(--ink-muted)] transition hover:border-[var(--gold)]/40 hover:text-[var(--ink)]">
                    <span>{link.label[locale]}</span>
                    <ArrowRight className="h-3.5 w-3.5 flex-none text-[var(--gold)]" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
