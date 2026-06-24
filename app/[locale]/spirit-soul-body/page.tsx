import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenText, ExternalLink, GitBranch, Layers3, Link2, ScrollText } from "lucide-react";

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
  note: Record<AppLocale, string>;
};

type Theme = {
  id: string;
  title: Record<AppLocale, string>;
  summary: Record<AppLocale, string>;
  claims: Record<AppLocale, string[]>;
  passages: PassageLink[];
};

type TeachingPoint = {
  title: Record<AppLocale, string>;
  speakerClaim: Record<AppLocale, string>;
  transcriptGround: Record<AppLocale, string>;
  implication: Record<AppLocale, string>;
  passages: PassageLink[];
};

const SOURCE_VIDEO = "https://www.youtube.com/watch?v=q0LY9wPiZOk";

const PASSAGES = {
  wholePerson: {
    label: "1 Thessalonians 5:23",
    reference: { code: "1TH", chapter: 5, startVerse: 23, endVerse: 23 },
    note: {
      ko: "영·혼·몸을 한 사람 전체의 보존과 거룩함이라는 틀에서 함께 언급합니다.",
      en: "Names spirit, soul, and body within the sanctification of the whole person.",
    },
  },
  wordDiscerns: {
    label: "Hebrews 4:12",
    reference: { code: "HEB", chapter: 4, startVerse: 12, endVerse: 12 },
    note: {
      ko: "말씀이 혼과 영, 관절과 골수를 찔러 쪼개며 마음의 생각과 뜻을 판단한다고 말합니다.",
      en: "The word discerns soul and spirit, joints and marrow, thoughts and intentions.",
    },
  },
  newCreation: {
    label: "2 Corinthians 5:17",
    reference: { code: "2CO", chapter: 5, startVerse: 17, endVerse: 17 },
    note: {
      ko: "그리스도 안에 있으면 새 창조라는 정체성 본문입니다.",
      en: "The identity text: in Christ, a person is a new creation.",
    },
  },
  joinedSpirit: {
    label: "1 Corinthians 6:17",
    reference: { code: "1CO", chapter: 6, startVerse: 17, endVerse: 17 },
    note: {
      ko: "주와 합하는 자는 한 영이라는, 거듭난 영의 연합을 설명하는 핵심 본문입니다.",
      en: "Those joined to the Lord become one spirit with him.",
    },
  },
  renewMind: {
    label: "Romans 12:1–2",
    reference: { code: "ROM", chapter: 12, startVerse: 1, endVerse: 2 },
    note: {
      ko: "몸을 산 제물로 드리고 마음을 새롭게 함으로 변화를 받으라는 적용 축입니다.",
      en: "Offers the body and renews the mind as the axis of transformation.",
    },
  },
  oldNewSelf: {
    label: "Ephesians 4:22–24",
    reference: { code: "EPH", chapter: 4, startVerse: 22, endVerse: 24 },
    note: {
      ko: "옛 사람을 벗고 심령이 새롭게 되어 새 사람을 입으라는 구조를 제공합니다.",
      en: "Put off the old self, be renewed, and put on the new self.",
    },
  },
  spiritLife: {
    label: "John 6:63",
    reference: { code: "JOH", chapter: 6, startVerse: 63, endVerse: 63 },
    note: {
      ko: "살리는 것은 영이며 육은 무익하고 예수님의 말씀이 영과 생명이라고 말합니다.",
      en: "The Spirit gives life; Jesus' words are spirit and life.",
    },
  },
  worshipSpirit: {
    label: "John 4:23–24",
    reference: { code: "JOH", chapter: 4, startVerse: 23, endVerse: 24 },
    note: {
      ko: "하나님은 영이시므로 예배가 영과 진리 안에서 드려져야 함을 밝힙니다.",
      en: "God is spirit, so worship is in spirit and truth.",
    },
  },
  fleshSpirit: {
    label: "Galatians 5:16–25",
    reference: { code: "GAL", chapter: 5, startVerse: 16, endVerse: 25 },
    note: {
      ko: "육체의 욕망과 성령의 열매를 대비하여 실제 삶의 분별표를 제공합니다.",
      en: "Contrasts desires of the flesh with the fruit of the Spirit.",
    },
  },
  perfectLove: {
    label: "1 John 4:17–18",
    reference: { code: "1JO", chapter: 4, startVerse: 17, endVerse: 18 },
    note: {
      ko: "사랑이 온전히 이루어지면 심판 날 담대함을 갖고 두려움이 쫓겨난다는 정체성 본문입니다.",
      en: "Perfect love gives confidence and casts out fear.",
    },
  },
  allSpiritualBlessing: {
    label: "Ephesians 1:3–14",
    reference: { code: "EPH", chapter: 1, startVerse: 3, endVerse: 14 },
    note: {
      ko: "그리스도 안에서 이미 받은 영적 복, 택하심, 속량, 성령의 인치심을 묶습니다.",
      en: "Blessing, adoption, redemption, and sealing by the Spirit in Christ.",
    },
  },
  completeInChrist: {
    label: "Colossians 2:9–10",
    reference: { code: "COL", chapter: 2, startVerse: 9, endVerse: 10 },
    note: {
      ko: "그리스도 안에서 충만해졌다는 완성 선언입니다.",
      en: "A declaration of fullness in Christ.",
    },
  },
  bodyTemple: {
    label: "1 Corinthians 6:19–20",
    reference: { code: "1CO", chapter: 6, startVerse: 19, endVerse: 20 },
    note: {
      ko: "몸이 성령의 전이며 값으로 산 것이므로 몸으로 하나님께 영광을 돌리라고 말합니다.",
      en: "The body is a temple of the Holy Spirit and belongs to God.",
    },
  },
  tongueLife: {
    label: "Proverbs 18:21",
    reference: { code: "PRO", chapter: 18, startVerse: 21, endVerse: 21 },
    note: {
      ko: "말의 열매와 생명·사망의 방향성을 다루며, 고백과 묵상 적용과 연결됩니다.",
      en: "Connects speech with life, death, fruit, confession, and meditation.",
    },
  },
} satisfies Record<string, PassageLink>;

const THEMES: Theme[] = [
  {
    id: "whole-person",
    title: { ko: "사람은 분리 가능한 부품이 아니라 통합된 존재다", en: "The person is integrated, not a pile of parts" },
    summary: {
      ko: "출처 영상은 1 Thessalonians 5:23을 출발점으로 삼아 사람을 영·혼·육의 상호작용으로 설명합니다. 다만 성경 전체의 어휘는 기계적 삼분법만 말하지 않고, 하나님 앞에 선 인간 전체를 다양한 각도에서 묘사합니다.",
      en: "The source teaching starts from 1 Thessalonians 5:23, while the broader biblical vocabulary describes the whole person from multiple angles.",
    },
    claims: {
      ko: ["영·혼·육 구분은 유익한 지도이지만 인간을 쪼개는 해부도가 아니라 관계도다.", "말씀은 보이지 않는 내면과 보이는 몸의 삶을 함께 드러낸다.", "페이지의 모든 성구 링크는 성경 읽기 화면으로 이동해 앞뒤 문맥을 확인하게 한다."],
      en: ["Spirit, soul, and body are a useful map, not a mechanical dissection.", "Scripture exposes both hidden inner life and visible bodily practice.", "Each passage link opens the Bible reader for context."],
    },
    passages: [PASSAGES.wholePerson, PASSAGES.wordDiscerns, PASSAGES.renewMind, PASSAGES.bodyTemple],
  },
  {
    id: "spirit",
    title: { ko: "영: 하나님과 연합하고 새 창조를 받는 깊은 중심", en: "Spirit: the deep center joined to God" },
    summary: {
      ko: "영상의 핵심은 거듭날 때 가장 먼저 바뀌는 영역이 ‘영’이라는 주장입니다. 이 관점은 새 창조, 주와 한 영 됨, 성령의 인치심, 그리스도 안의 충만함을 한 묶음으로 읽습니다.",
      en: "The teaching claims that the spirit is the part made new at rebirth, read alongside new creation and union with Christ.",
    },
    claims: {
      ko: ["영은 하나님을 인식하고 하나님과 교제하는 자리로 설명된다.", "그리스도 안의 정체성은 감정 상태보다 먼저 주어진 선언으로 다뤄진다.", "‘이미 받은 것’과 ‘아직 경험으로 나타나야 할 것’을 구분한다."],
      en: ["The spirit is described as the place of communion with God.", "Identity in Christ is treated as a declaration prior to feeling.", "It distinguishes what is already given from what must be embodied."],
    },
    passages: [PASSAGES.newCreation, PASSAGES.joinedSpirit, PASSAGES.allSpiritualBlessing, PASSAGES.completeInChrist, PASSAGES.worshipSpirit],
  },
  {
    id: "soul",
    title: { ko: "혼: 생각·의지·감정이 말씀으로 새로워지는 전장", en: "Soul: mind, will, and emotions being renewed" },
    summary: {
      ko: "영상은 혼을 생각, 의지, 감정의 영역으로 풀고, 거듭난 영의 실재가 삶에 나타나는 통로가 혼의 갱신이라고 설명합니다. 그래서 말씀 묵상, 정체성 고백, 두려움과 믿음의 분별이 중요해집니다.",
      en: "The soul is framed as mind, will, and emotions—the channel through which renewed identity becomes lived experience.",
    },
    claims: {
      ko: ["혼은 자동으로 성숙하지 않으며 말씀으로 훈련된다.", "두려움, 정죄, 자기 이미지가 그리스도 안의 정체성과 충돌할 수 있다.", "믿음은 정보를 아는 것에서 끝나지 않고 마음의 방향과 말의 습관을 바꾼다."],
      en: ["The soul does not mature automatically; it is trained by the word.", "Fear, condemnation, and self-image can resist identity in Christ.", "Faith reshapes attention, imagination, and speech."],
    },
    passages: [PASSAGES.renewMind, PASSAGES.oldNewSelf, PASSAGES.perfectLove, PASSAGES.tongueLife, PASSAGES.wordDiscerns],
  },
  {
    id: "body",
    title: { ko: "육/몸: 악 자체가 아니라 순종이 드러나는 현장", en: "Body/flesh: the visible arena of obedience" },
    summary: {
      ko: "영상에서 ‘육’은 때로 물리적 몸, 때로 하나님 없이 작동하는 옛 습관과 감각 중심의 삶을 가리킵니다. 성경도 몸을 성령의 전으로 높이면서 동시에 육체의 욕망을 경계합니다.",
      en: "The teaching uses flesh/body for both the physical body and sense-driven habits apart from God; Scripture honors the body while warning against fleshly desires.",
    },
    claims: {
      ko: ["몸은 버릴 껍데기가 아니라 하나님께 영광 돌리는 장소다.", "육체의 욕망은 영의 생명과 충돌할 수 있어 분별과 훈련이 필요하다.", "말씀과 성령 안에서 걷는 것은 추상이 아니라 실제 선택, 말, 습관으로 확인된다."],
      en: ["The body is not disposable; it glorifies God.", "Fleshly desires can resist life in the Spirit.", "Walking by the Spirit becomes visible in choices and habits."],
    },
    passages: [PASSAGES.bodyTemple, PASSAGES.fleshSpirit, PASSAGES.spiritLife, PASSAGES.renewMind],
  },
];

const CROSS_CHECKS = [
  {
    title: { ko: "거듭남과 정체성", en: "New birth and identity" },
    description: { ko: "새 창조가 이미 선언되었는가? 그 선언이 생각과 몸의 삶으로 어떻게 번역되는가?", en: "What is already declared, and how does it become lived practice?" },
    passages: [PASSAGES.newCreation, PASSAGES.joinedSpirit, PASSAGES.completeInChrist, PASSAGES.renewMind],
  },
  {
    title: { ko: "말씀과 분별", en: "Word and discernment" },
    description: { ko: "내 감각·감정·경험이 말씀이 말하는 정체성과 충돌할 때 무엇을 기준으로 삼는가?", en: "When feeling and Scripture collide, what becomes the governing reference?" },
    passages: [PASSAGES.wordDiscerns, PASSAGES.spiritLife, PASSAGES.oldNewSelf, PASSAGES.tongueLife],
  },
  {
    title: { ko: "사랑과 두려움", en: "Love and fear" },
    description: { ko: "하나님의 사랑이 두려움, 정죄, 자기방어를 어떻게 밀어내는가?", en: "How does God's love displace fear, condemnation, and self-defense?" },
    passages: [PASSAGES.perfectLove, PASSAGES.allSpiritualBlessing, PASSAGES.fleshSpirit],
  },
] as const;

const TEACHING_FLOW: TeachingPoint[] = [
  {
    title: {
      ko: "1. ‘이 계시가 내 삶을 바꿨다’ — 개인 간증으로 시작한다",
      en: "1. 'This revelation changed my life' — the teaching starts autobiographically",
    },
    speakerClaim: {
      ko: "영혼육은 추상 교리가 아니라 명목상 신앙과 행위 의존에서 벗어나게 하는 실제적인 신앙 구조로 제시됩니다. 전사본은 거듭난 뒤에도 종교적 바리새인처럼 살았고, 1968년 하나님의 사랑을 강하게 경험한 뒤에도 감정이 사라지자 다시 절망했다는 개인 간증에서 출발합니다.",
      en: "Spirit-soul-body is framed not as an abstract doctrine but as a practical structure that moves a believer beyond nominal faith and performance-based religion.",
    },
    transcriptGround: {
      ko: "전사본 초반부는 ‘하나님께서 제게 보여주신 첫 번째 것 중 하나’, ‘제 삶을 변화시켰습니다’, ‘진정으로 거듭은 났지만… 종교적인 바리새인처럼 행동’했다는 흐름으로 시작한다.",
      en: "The transcript opens with phrases like 'one of the first things God showed me,' 'it changed my life,' and his admission that he was truly born again yet behaved like a religious Pharisee.",
    },
    implication: {
      ko: "그래서 이 페이지는 전사본의 논지를 먼저 요약하고, 그 다음 성구와 외부 자료로 검토합니다. 핵심 문제의식은 ‘왜 성경은 새 피조물이라고 하는데 내 경험은 그대로인가?’라는 괴리입니다.",
      en: "The live question is why Scripture says 'new creation' while experience may still feel unchanged.",
    },
    passages: [PASSAGES.newCreation, PASSAGES.wholePerson, PASSAGES.renewMind],
  },
  {
    title: {
      ko: "2. 2 Corinthians 5:17의 난제 — 무엇이 실제로 새로워졌는가",
      en: "2. The 2 Corinthians 5:17 problem — what actually became new?",
    },
    speakerClaim: {
      ko: "‘이전 것은 지나갔고 모든 것이 새롭게 되었다’는 말씀을 문자 그대로 붙잡지만, 몸과 감정과 생각은 즉시 새로워지지 않는다는 관찰에서 출발합니다. 따라서 변화된 영역은 몸도 혼도 아니라 보이지 않는 영이라는 결론으로 이어집니다.",
      en: "The teaching takes 'the old has passed away; the new has come' seriously, but argues that the body, emotions, and ordinary thought patterns do not instantly become new; the changed part is the unseen spirit.",
    },
    transcriptGround: {
      ko: "전사본은 ‘제 삶은 그렇지 않았습니다. 여전히 좌절하고 두려워하고… 병도 앓고 있었습니다’라고 말한 뒤, 1 Thessalonians 5:23을 통해 영·혼·몸의 구분을 제시한다.",
      en: "The transcript says his life did not look new—fear, insecurity, and sickness remained—then turns to 1 Thessalonians 5:23 to distinguish spirit, soul, and body.",
    },
    implication: {
      ko: "이 대목은 페이지의 핵심 축이다. 성구 링크는 2 Corinthians 5:17만 따로 보지 않고 1 Thessalonians 5:23, Romans 12:2와 함께 읽도록 배치했다.",
      en: "This is the page's core axis: read 2 Corinthians 5:17 with 1 Thessalonians 5:23 and Romans 12:2.",
    },
    passages: [PASSAGES.newCreation, PASSAGES.wholePerson, PASSAGES.renewMind],
  },
  {
    title: {
      ko: "3. 영 — 이미 완전하고 그리스도와 연합한 정체성",
      en: "3. Spirit — already complete and joined to Christ",
    },
    speakerClaim: {
      ko: "거듭난 영은 ‘자라서 완전해지는 아기 상태’가 아니라 이미 예수님의 영과 연합되어 순수하고 거룩하고 완전하다는 관점으로 설명됩니다. 그리스도인의 삶은 무엇인가가 되려고 애쓰는 것이 아니라 이미 된 사람을 인식하는 과정이라는 흐름입니다.",
      en: "The born-again spirit is presented not as a baby version that must grow into completeness, but as joined to Christ and already righteous, holy, and complete.",
    },
    transcriptGround: {
      ko: "전사본에는 ‘우리의 영은 예수님만큼 순수하고 거룩하고 완전하고 성숙합니다’, ‘나머지 그리스도인의 삶은 무엇인가가 되는 것이 아닙니다. 우리가 이미 된 사람을 인식하는 것입니다’라는 요지가 반복된다.",
      en: "The transcript repeatedly says the spirit is as pure, holy, complete, and mature as Jesus, and that Christian life is recognizing who one already is in Christ.",
    },
    implication: {
      ko: "이 주장은 강한 명제이므로 1 Corinthians 6:17, Colossians 2:9–10, Ephesians 1:3–14 같은 본문을 함께 열어 실제 문맥을 확인하게 했다.",
      en: "Because this is a strong claim, the page links it to 1 Corinthians 6:17, Colossians 2:9–10, and Ephesians 1:3–14 for contextual checking.",
    },
    passages: [PASSAGES.joinedSpirit, PASSAGES.completeInChrist, PASSAGES.allSpiritualBlessing],
  },
  {
    title: {
      ko: "4. 혼 — 영과 몸 사이에서 어느 쪽에 동의할지 결정하는 영역",
      en: "4. Soul — the deciding arena between spirit and body",
    },
    speakerClaim: {
      ko: "혼은 지성·의지·감정으로 설명되고, 혼이 몸의 감각과 상황에 동의하면 몸이 삶을 지배하지만 혼이 말씀을 통해 영의 실재에 동의하면 영의 생명이 몸의 삶에 나타난다는 구조입니다.",
      en: "The soul is defined as intellect, will, and emotions. If the soul agrees with bodily senses and circumstances, the body dominates; if it agrees with the spirit through the Word, spiritual life becomes visible.",
    },
    transcriptGround: {
      ko: "전사본은 ‘혼이 몸과 일치하면… 상황과 느낌이 우리를 지배’, ‘혼이 영과 일체하게 되면 몸은 자연스럽게 치유, 풍요, 기쁨, 평화, 승리 등을 나타낸다’는 다수결 비유를 사용한다.",
      en: "The transcript uses a majority-rule analogy: when soul agrees with body, circumstances rule; when soul agrees with spirit, life, peace, and victory become manifest.",
    },
    implication: {
      ko: "따라서 혼의 갱신은 부가 과목이 아니라 이 가르침의 작동 원리다. Romans 12:2와 Ephesians 4:22–24가 여기의 중심 링크다.",
      en: "Mind renewal is not a side topic; it is the mechanism of the teaching. Romans 12:2 and Ephesians 4:22–24 are central here.",
    },
    passages: [PASSAGES.renewMind, PASSAGES.oldNewSelf, PASSAGES.wordDiscerns],
  },
  {
    title: {
      ko: "5. 몸/육 — 즉시 구원받은 것처럼 보이지 않는 현실과 성령 안의 훈련",
      en: "5. Body/flesh — unchanged visible reality and training in the Spirit",
    },
    speakerClaim: {
      ko: "거듭날 때 몸이 즉시 바뀌지 않는다는 현실을 분명히 다룹니다. 몸은 성별, 키, 체중, 질병, 감각의 세계를 통해 계속 현실처럼 느껴지며, 그래서 말씀과 성령 안에서 감각을 훈련해야 한다는 적용으로 이어집니다.",
      en: "The body does not instantly change at the new birth. It remains the realm of visible facts, senses, health, habits, and training.",
    },
    transcriptGround: {
      ko: "전사본은 ‘여러분이 거듭날 때 여러분의 몸은 변하지 않습니다’라고 말하며, 마지막 부분에서는 ‘감각과 감정을 훈련시켜야 합니다… 하나님의 말씀을 우선해 두고 방언으로 기도하고 성령 안에서 행하라’는 적용으로 닫힌다.",
      en: "The transcript says the body does not change when one is born again, and closes by urging the training of senses and emotions through the Word, praying in tongues, and walking in the Spirit.",
    },
    implication: {
      ko: "몸은 버릴 대상이 아니라 훈련과 순종의 장소다. 그래서 1 Corinthians 6:19–20과 Galatians 5:16–25를 몸/육 섹션의 중심으로 배치했다.",
      en: "The body is not discarded; it is trained and offered. That is why 1 Corinthians 6:19–20 and Galatians 5:16–25 anchor the body/flesh section.",
    },
    passages: [PASSAGES.bodyTemple, PASSAGES.fleshSpirit, PASSAGES.spiritLife],
  },
] as const;

const SOURCES = [
  {
    label: "Source transcript — 주안에스토리 YouTube 영상",
    href: SOURCE_VIDEO,
    note: {
      ko: "이 페이지의 1차 정리 대상입니다. 로컬 원문 파일은 Downloads의 마크다운 전사본이며, 영상 제목·채널·URL을 출처로 표기했습니다.",
      en: "Primary source for this page; the local Markdown transcript was generated from this video.",
    },
  },
  {
    label: "Andrew Wommack Ministries — Spirit, Soul, and Body",
    href: "https://www.awmi.net/blog/spirit-soul-and-body/",
    note: {
      ko: "영·혼·몸 구분, 거듭난 영, 혼의 갱신, 몸의 순종이라는 원 강의의 공식 사역 자료입니다.",
      en: "Official ministry article summarizing spirit, soul, body, the born-again spirit, renewed soul, and bodily obedience.",
    },
  },
  {
    label: "AWMI Store — Spirit, Soul & Body book",
    href: "https://store.awmi.net/purchase/318",
    note: {
      ko: "Andrew Wommack 저서의 공식 상품 페이지이며 ISBN 9781606830055로 확인됩니다.",
      en: "Official book listing for Andrew Wommack's Spirit, Soul & Body, ISBN 9781606830055.",
    },
  },
  {
    label: "BibleProject — Soul / Nephesh",
    href: "https://bibleproject.com/videos/nephesh-soul/",
    note: {
      ko: "히브리어 nephesh가 현대적 ‘비물질 영혼’보다 ‘살아 숨 쉬는 생명/사람 전체’에 가깝다는 균형점을 제공합니다.",
      en: "Shows nephesh as living, breathing life/the whole person rather than only an immaterial soul.",
    },
  },
  {
    label: "BibleProject — God's Spirit in Creation",
    href: "https://bibleproject.com/podcasts/gods-spirit-creation/",
    note: {
      ko: "ruakh를 숨, 바람, 보이지 않는 생명 에너지로 설명해 영/성령 어휘의 성경적 폭을 보완합니다.",
      en: "Explains ruakh as breath, wind, and invisible life-energy, widening the biblical vocabulary of spirit.",
    },
  },
] as const;

function T({ locale, ko, en }: { locale: AppLocale; ko: string; en: string }) {
  return locale === "ko" ? ko : en;
}

function referenceKey(passage: PassageLink) {
  const { code, chapter, startVerse, endVerse } = passage.reference;
  return `${code}-${chapter}-${startVerse}-${endVerse}`;
}

function ScriptureChip({ passage, locale, from = "spirit-soul-body" }: { passage: PassageLink; locale: AppLocale; from?: string }) {
  return (
    <Link
      href={buildBibleReferenceHref(passage.reference, { locale, from })}
      title={passage.note[locale]}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface-2)] px-3 py-2 text-xs font-medium text-[var(--ink-muted)] transition hover:border-[var(--gold)]/40 hover:text-[var(--gold)]"
    >
      <BookOpenText className="h-3.5 w-3.5" aria-hidden="true" />
      {passage.label}
    </Link>
  );
}

function ScripturePanel({ title, passages, locale }: { title: string; passages: readonly PassageLink[]; locale: AppLocale }) {
  return (
    <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--gold)]">
        <GitBranch className="h-4 w-4" aria-hidden="true" />
        {title}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {passages.map((passage) => (
          <ScriptureChip key={referenceKey(passage)} passage={passage} locale={locale} />
        ))}
      </div>
      <ul className="mt-4 space-y-2 text-sm leading-6 text-[var(--muted)]">
        {passages.map((passage) => (
          <li key={`${referenceKey(passage)}-note`}>
            <span className="font-semibold text-[var(--ink)]">{passage.label}</span> — {passage.note[locale]}
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  const title = locale === "ko" ? "영혼육 입체 성경 지도" : "Spirit, Soul, and Body Bible Map";
  const description =
    locale === "ko"
      ? "영·혼·육의 의미, 앤드류 워맥 강의 출처, 관련 성구와 외부 자료를 상호 링크로 정리한 성경 검토 페이지입니다."
      : "A linked Bible map for spirit, soul, and body, with Andrew Wommack source notes, Scripture, and external references.";

  return buildPageMetadata(locale, title, description, "/spirit-soul-body");
}

export default async function SpiritSoulBodyPage({ params }: Props) {
  const { locale: requestedLocale } = await params;
  const locale = await resolveLocale(requestedLocale);
  const sectionLinks = [
    { href: "#concept-model", label: { ko: "컨셉 모델", en: "Concept model" } },
    { href: "#scripture-map", label: { ko: "성구 검토", en: "Scripture map" } },
    { href: "#argument-flow", label: { ko: "사례 전사본", en: "Case transcript" } },
    { href: "#sources", label: { ko: "출처", en: "Sources" } },
  ] as const;
  const passagePath = [PASSAGES.wholePerson, PASSAGES.newCreation, PASSAGES.renewMind, PASSAGES.fleshSpirit] as const;

  return (
    <main className="page-shell-wide page-enter">
      <section className="relative overflow-hidden rounded-[2rem] border border-[var(--hairline)] bg-[var(--surface-1)] p-5 sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,168,83,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(138,180,232,0.09),transparent_32%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.04fr)_minmax(320px,0.96fr)] lg:items-center">
          <div>
            <div className="section-title text-base">
              <T locale={locale} ko="영·혼·육 검토 지도" en="Spirit, soul, and body review map" />
            </div>
            <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-tight tracking-[-0.04em] text-[var(--ink)] sm:text-5xl lg:text-6xl">
              <T locale={locale} ko="성구에서 시작하는 영·혼·육 검토 지도" en="A Scripture-first map for spirit, soul, and body" />
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--muted)] sm:text-lg">
              <T
                locale={locale}
                ko="이 페이지의 중심은 특정 강의가 아니라 성경 본문입니다. 영·혼·육을 기계적 삼분법으로 고정하지 않고, 새 창조의 선언과 생각·감정·몸의 현실을 먼저 성구로 검토한 뒤 주안에스토리 전사본은 하나의 사례 자료로 대조합니다."
                en="The center of this page is Scripture, not one teaching source. It tests spirit, soul, and body through passages first, then uses the Juane Story transcript as one case source rather than the controlling frame."
              />
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={SOURCE_VIDEO}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-4 py-2.5 text-sm font-semibold text-[var(--canvas)] transition hover:bg-[var(--gold-hover)]"
              >
                <Link2 className="h-4 w-4" aria-hidden="true" />
                <T locale={locale} ko="사례 영상 보기" en="Open case video" />
              </a>
              <Link
                href={buildBibleReferenceHref(PASSAGES.wholePerson.reference, { locale, from: "spirit-soul-body" })}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--hairline-strong)] bg-[var(--surface-2)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--gold)]/40 hover:text-[var(--gold)]"
              >
                <BookOpenText className="h-4 w-4" aria-hidden="true" />
                1 Thessalonians 5:23
              </Link>
            </div>
            <div className="mt-7 grid gap-3 text-sm text-[var(--ink-muted)] sm:grid-cols-3">
              {[
                { ko: "관계도", en: "Relational map" },
                { ko: "전사본 → 성구", en: "Transcript → Scripture" },
                { ko: "주장과 검토 분리", en: "Claim and review separated" },
              ].map((item) => (
                <div key={item.ko} className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-2)]/80 px-4 py-3">
                  {item[locale]}
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-3xl border border-[var(--gold)]/20 bg-[var(--surface-0)]/70 p-5 shadow-2xl shadow-black/20 sm:p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <ScrollText className="h-5 w-5 text-[var(--gold)]" aria-hidden="true" />
              <T locale={locale} ko="읽기 기준" en="Reading standard" />
            </div>
            <dl className="mt-5 space-y-5 text-sm leading-6 text-[var(--muted)]">
              <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4">
                <dt className="font-semibold text-[var(--ink)]"><T locale={locale} ko="질문" en="Question" /></dt>
                <dd className="mt-2"><T locale={locale} ko="왜 성경은 새 피조물이라 하는데 내 생각·감정·몸의 현실은 그대로처럼 느껴지는가?" en="Why does Scripture call me new while thought, emotion, and body can still feel unchanged?" /></dd>
              </div>
              <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4">
                <dt className="font-semibold text-[var(--ink)]"><T locale={locale} ko="구조" en="Structure" /></dt>
                <dd className="mt-2"><T locale={locale} ko="영은 정체성, 혼은 동의와 갱신, 몸은 순종이 드러나는 현장으로 읽게 합니다." en="Spirit frames identity, soul frames agreement and renewal, body frames visible obedience." /></dd>
              </div>
              <div className="rounded-2xl border border-[var(--gold)]/20 bg-[var(--gold)]/[0.08] p-4">
                <dt className="font-semibold text-[var(--ink)]"><T locale={locale} ko="주의" en="Caution" /></dt>
                <dd className="mt-2"><T locale={locale} ko="기계적 삼분법으로 고정하지 않고, 전체 인간을 말하는 성경 어휘와 함께 검토합니다." en="Do not freeze the page into a mechanical trichotomy; test it with the Bible's whole-person vocabulary." /></dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4 lg:sticky lg:top-24">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--gold)]">
            <T locale={locale} ko="페이지 여정" en="Page journey" />
          </div>
          <nav className="mt-3 grid gap-2" aria-label={locale === "ko" ? "영혼육 페이지 섹션" : "Spirit soul body page sections"}>
            {sectionLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex min-h-[44px] items-center rounded-xl border border-transparent px-3 text-sm font-medium text-[var(--ink-muted)] transition hover:border-[var(--gold)]/25 hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
              >
                {item.label[locale]}
              </a>
            ))}
          </nav>
          <div className="mt-4 rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] p-3 text-xs leading-5 text-[var(--ink-muted)]">
            <T locale={locale} ko="UX 원칙: 한 화면에서는 하나의 판단만 요구하고, 더 깊은 근거는 다음 층에서 펼칩니다." en="UX rule: ask for one decision per screen, then reveal deeper evidence in the next layer." />
          </div>
        </aside>

        <div className="space-y-8">
          <section id="concept-model" className="rounded-3xl border border-[var(--hairline)] bg-[var(--surface-2)] p-5 sm:p-7">
            <div className="section-title">
              <T locale={locale} ko="컨셉 모델" en="Concept model" />
            </div>
            <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <article className="rounded-2xl border border-[var(--gold)]/20 bg-[var(--surface-1)] p-5">
                <h2 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">{THEMES[0].title[locale]}</h2>
                <p className="mt-4 text-sm leading-7 text-[var(--muted)] sm:text-base">{THEMES[0].summary[locale]}</p>
                <ul className="mt-5 space-y-3 text-sm leading-6 text-[var(--muted)]">
                  {THEMES[0].claims[locale].map((claim) => (
                    <li key={claim} className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] p-4">
                      {claim}
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  <ScripturePanel title={locale === "ko" ? "핵심 균형 본문" : "Balancing passages"} passages={THEMES[0].passages} locale={locale} />
                </div>
              </article>

              <div className="grid gap-4">
                {THEMES.slice(1).map((theme, index) => (
                  <article key={theme.id} id={theme.id} className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--gold)]">
                          <T locale={locale} ko={`층위 0${index + 1}`} en={`Layer 0${index + 1}`} />
                        </div>
                        <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--ink)]">{theme.title[locale]}</h3>
                      </div>
                      <span className="rounded-full border border-[var(--gold)]/20 bg-[var(--gold)]/[0.08] px-3 py-1 text-xs font-semibold text-[var(--gold)]">
                        {theme.id}
                      </span>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{theme.summary[locale]}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {theme.passages.slice(0, 3).map((passage) => (
                        <ScriptureChip key={referenceKey(passage)} passage={passage} locale={locale} />
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section id="argument-flow" className="rounded-3xl border border-[var(--hairline)] bg-[var(--surface-2)] p-5 sm:p-7">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <GitBranch className="h-5 w-5 text-[var(--gold)]" aria-hidden="true" />
              <T locale={locale} ko="사례 전사본 흐름" en="Case transcript flow" />
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--ink)]">
              <T locale={locale} ko="주안에스토리 자료는 ‘검토 대상’으로 읽기" en="Read the Juane Story source as a case to test" />
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base">
              <T
                locale={locale}
                ko="이 섹션은 페이지의 결론이 아니라 한 자료의 주장 구조를 투명하게 펼친 것입니다. 각 단계는 ‘강의 주장’, ‘전사본 근거’, ‘검토 포인트’를 분리해 독자가 주장과 성경 검증을 혼동하지 않게 합니다."
                en="This section is not the page's verdict; it transparently lays out one source's argument. Each step separates teaching claim, transcript basis, and review point so readers do not confuse the claim with biblical verification."
              />
            </p>
            <div className="mt-7 space-y-5">
              {TEACHING_FLOW.map((point, index) => (
                <article key={point.title.ko} className="grid gap-4 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4 sm:p-5 lg:grid-cols-[72px_minmax(0,1fr)]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--gold)]/20 bg-[var(--gold)]/[0.08] text-sm font-bold text-[var(--gold)]">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-[var(--ink)]">{point.title[locale]}</h3>
                    <div className="mt-4 grid gap-4 xl:grid-cols-3">
                      <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--gold)]">
                          <T locale={locale} ko="핵심 주장" en="Core claim" />
                        </div>
                        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{point.speakerClaim[locale]}</p>
                      </div>
                      <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--gold)]">
                          <T locale={locale} ko="전사본 근거" en="Transcript basis" />
                        </div>
                        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{point.transcriptGround[locale]}</p>
                      </div>
                      <div className="rounded-xl border border-[var(--gold)]/20 bg-[var(--gold)]/[0.06] p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--gold)]">
                          <T locale={locale} ko="검토 포인트" en="Review point" />
                        </div>
                        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{point.implication[locale]}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {point.passages.map((passage) => (
                            <ScriptureChip key={referenceKey(passage)} passage={passage} locale={locale} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="scripture-map" className="rounded-3xl border border-[var(--hairline)] bg-[var(--surface-2)] p-5 sm:p-7">
            <div className="section-title">
              <T locale={locale} ko="성구 검토 지도" en="Scripture review map" />
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--ink)]">
              <T locale={locale} ko="세 렌즈와 네 본문으로 과장 없이 확인하기" en="Use three lenses and four passages to test the claim" />
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {CROSS_CHECKS.map((item) => (
                <article key={item.title.ko} className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--gold)]">
                    <T locale={locale} ko="검토 렌즈" en="Review lens" />
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-[var(--ink)]">{item.title[locale]}</h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.description[locale]}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.passages.map((passage) => (
                      <ScriptureChip key={referenceKey(passage)} passage={passage} locale={locale} />
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                <Layers3 className="h-5 w-5 text-[var(--gold)]" aria-hidden="true" />
                <T locale={locale} ko="추천 읽기 순서" en="Recommended reading path" />
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-4">
                {passagePath.map((passage, index) => (
                  <div key={referenceKey(passage)} className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] p-4">
                    <ScriptureChip passage={passage} locale={locale} />
                    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{passage.note[locale]}</p>
                    {index < passagePath.length - 1 ? (
                      <ArrowRight className="mt-4 hidden h-4 w-4 text-[var(--gold)] lg:block" aria-hidden="true" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="sources" className="rounded-3xl border border-[var(--hairline)] bg-[var(--surface-2)] p-5 sm:p-7">
            <div className="section-title"><T locale={locale} ko="출처와 보조 근거" en="Sources and corroboration" /></div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--ink)]">
              <T locale={locale} ko="강의 출처와 외부 자료를 분리해서 확인하기" en="Separate the teaching source from corroborating references" />
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base">
              <T locale={locale} ko="신뢰 설계의 초점은 출처 표시입니다. 1차 전사본, 공식 사역 자료, 성경 어휘 보조 자료를 같은 무게로 섞지 않고 구분해 둡니다." en="The trust design centers source separation: primary transcript, official ministry material, and biblical word-study aids are not blended as if they carry the same weight." />
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {SOURCES.map((source) => (
                <a
                  key={source.href}
                  href={source.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4 transition hover:border-[var(--gold)]/40"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                    <ExternalLink className="h-4 w-4 text-[var(--gold)]" aria-hidden="true" />
                    {source.label}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{source.note[locale]}</p>
                </a>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
