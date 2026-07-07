import type { BibleReference } from "@/lib/bible";
import { findPassageUnit } from "@/lib/bible-passage-index";
import { getBookMetadata } from "@/lib/book-metadata";
import { resolveAppLocale, type AppLocale } from "@/lib/content";
import type { BackgroundSource, PassageBackgroundPack } from "@/lib/background-pack";
import { findYoutubeVideosByExactReference } from "@/lib/youtube-catalog";

export type PassageYoutubeResourceMatch = "exact" | "book" | "keyword";

export type PassageYoutubeResource = {
  videoId: string;
  title: string;
  url: string;
  channelId: string;
  channelTitle: string;
  channelHandle?: string;
  publishedAt?: string;
  durationSeconds?: number;
  summary?: string;
  transcriptStatus: "ok" | "missing" | "error";
  mentionedPassages: string[];
  keywords: string[];
  topics: string[];
  matchType: PassageYoutubeResourceMatch;
  matchedReference?: string;
  matchedBook?: string;
  matchedKeyword?: string;
};

const YOUTUBE_RESOURCE_LIMIT = 6;

type YoutubeCatalogVideoRecord = {
  videoId: string;
  title: string;
  url: string;
  channelId: string;
  channelTitle: string;
  channelHandle?: string;
  publishedAt?: string;
  durationSeconds?: number;
  summary?: string;
  transcriptStatus: "ok" | "missing" | "error";
  mentionedPassages?: string[];
  keywords?: string[];
  topics?: string[];
  resourceKind?: "teaching" | "music" | "mixed";
};

const STATIC_RETRIEVED_AT = "2026-06-20";

export type PassageBackgroundPerson = {
  name: string;
  role: string;
  relevance: string;
};

export type PassageBackgroundSetting = {
  historical: string;
  literary: string;
  cultural: string;
};

export type PassageBackgroundMessage = {
  original: string;
  theological: string;
  pastoral: string;
  cautions: string[];
};

export type PassageBackgroundApplication = {
  comfort: string;
  challenge: string;
  prayerPrompt: string;
  takeaway: string;
};


export type PassageBackgroundSummary = {
  bookName: string;
  author?: string;
  date?: string;
  place?: string;
  audience?: string;
  storyContext: string;
  canonicalContext?: string;
  sources: BackgroundSource[];
  youtubeResources?: PassageYoutubeResource[];
  people?: PassageBackgroundPerson[];
  setting?: PassageBackgroundSetting;
  message?: PassageBackgroundMessage;
  application?: PassageBackgroundApplication;
};

function source(id: string, title: string, sourceTier: BackgroundSource["sourceTier"]): BackgroundSource {
  return {
    id,
    title,
    retrievedAt: STATIC_RETRIEVED_AT,
    sourceTier,
  };
}

function canonicalContext(locale: AppLocale, bookName: string, genre: string, audience?: string) {
  if (locale === "ko") {
    return `${bookName}은 ${genre} 장르 안에서 읽어야 하며, 오늘의 적용은 먼저 원래 청중과 문맥을 지나서 세워야 합니다.${audience ? ` ${audience}` : ""}`;
  }

  return `${bookName} should be read within its ${genre} genre, and present application should move through the original audience and context first.${audience ? ` ${audience}` : ""}`;
}

function fallbackStoryContext(locale: AppLocale, bookName: string, reference: BibleReference) {
  if (locale === "ko") {
    return `${bookName} ${reference.chapter}장에서 선택된 본문입니다. 앞뒤 문맥은 해당 장 전체를 함께 읽으며 확인해야 합니다.`;
  }

  return `This passage is selected from ${bookName} chapter ${reference.chapter}. Its immediate story flow should be checked by reading the whole chapter.`;
}

function normalizeResourceTerms(values: string[] | undefined) {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function buildReferenceLabels(reference: BibleReference, bookName: string) {
  const range =
    reference.startVerse === reference.endVerse
      ? `${reference.chapter}:${reference.startVerse}`
      : `${reference.chapter}:${reference.startVerse}-${reference.endVerse}`;

  return [
    `${bookName} ${range}`,
    `${reference.code} ${range}`,
  ].map((value) => value.toLowerCase());
}

function mapYoutubeResource(
  video: YoutubeCatalogVideoRecord,
  matchType: PassageYoutubeResourceMatch,
  matchValue: string,
): PassageYoutubeResource {
  return {
    videoId: video.videoId,
    title: video.title,
    url: video.url,
    channelId: video.channelId,
    channelTitle: video.channelTitle,
    channelHandle: video.channelHandle,
    publishedAt: video.publishedAt,
    durationSeconds: video.durationSeconds,
    summary: video.summary,
    transcriptStatus: video.transcriptStatus,
    mentionedPassages: normalizeResourceTerms(video.mentionedPassages),
    keywords: normalizeResourceTerms(video.keywords),
    topics: normalizeResourceTerms(video.topics),
    matchType,
    matchedReference: matchType === "exact" ? matchValue : undefined,
    matchedBook: matchType === "book" ? matchValue : undefined,
    matchedKeyword: matchType === "keyword" ? matchValue : undefined,
  };
}

function sortYoutubeResources(left: PassageYoutubeResource, right: PassageYoutubeResource) {
  const mentionDelta = right.mentionedPassages.length - left.mentionedPassages.length;
  if (mentionDelta !== 0) return mentionDelta;

  const leftPublished = left.publishedAt ? Date.parse(left.publishedAt) : Number.NEGATIVE_INFINITY;
  const rightPublished = right.publishedAt ? Date.parse(right.publishedAt) : Number.NEGATIVE_INFINITY;
  if (leftPublished !== rightPublished) return rightPublished - leftPublished;

  return left.videoId.localeCompare(right.videoId);
}

export async function loadCachedYoutubeResources(
  reference: BibleReference,
  options: { locale?: string; prompt?: string; bookName?: string } = {},
): Promise<PassageYoutubeResource[]> {
  const appLocale = resolveAppLocale(options.locale);
  const bookName = options.bookName ?? getBookMetadata(reference.code, appLocale)?.title ?? reference.code;
  const referenceLabels = buildReferenceLabels(reference, bookName);
  try {
    const seen = new Set<string>();
    const exact: PassageYoutubeResource[] = [];

    for (const label of referenceLabels) {
      for (const video of await findYoutubeVideosByExactReference(label)) {
        if (video.resourceKind && video.resourceKind !== "teaching") continue;
        if (seen.has(video.videoId)) continue;
        seen.add(video.videoId);
        exact.push(mapYoutubeResource(video, "exact", label));
      }
    }

    return exact.sort(sortYoutubeResources).slice(0, YOUTUBE_RESOURCE_LIMIT);
  } catch {
    return [];
  }
}

export async function withCachedYoutubeResources(
  background: PassageBackgroundSummary,
  reference: BibleReference,
  options: { locale?: string; prompt?: string } = {},
): Promise<PassageBackgroundSummary> {
  const youtubeResources = await loadCachedYoutubeResources(reference, {
    locale: options.locale,
    prompt: options.prompt,
    bookName: background.bookName,
  });

  return {
    ...background,
    youtubeResources,
  };
}

export function summarizeBackgroundPack(pack: PassageBackgroundPack, locale?: string): PassageBackgroundSummary {
  const appLocale = resolveAppLocale(locale);
  return {
    bookName: pack.book.title,
    author: pack.book.authorship.body,
    date: pack.book.date.body,
    place: pack.book.place.body,
    audience: pack.book.audience.body,
    storyContext: pack.passageContext.literaryUnit || pack.passageContext.beforeAfter,
    canonicalContext:
      pack.passageContext.genreCaution ||
      canonicalContext(appLocale, pack.book.title, pack.book.genre, pack.book.audience.body),
    sources: pack.sources,
    youtubeResources: [],
  };
}

function referenceRange(reference: BibleReference) {
  return reference.startVerse === reference.endVerse
    ? `${reference.chapter}:${reference.startVerse}`
    : `${reference.chapter}:${reference.startVerse}-${reference.endVerse}`;
}

function buildPeople(locale: AppLocale, genre: string): PassageBackgroundPerson[] {
  const normalized = genre.toLowerCase();
  const isGospel = normalized.includes("gospel") || normalized.includes("복음");
  const isPoetry = normalized.includes("poetry") || normalized.includes("wisdom") || normalized.includes("시가") || normalized.includes("지혜") || normalized.includes("예배 모음집") || normalized.includes("탄식") || normalized.includes("찬양");
  const isProphetic = normalized.includes("prophet") || normalized.includes("apocalypse") || normalized.includes("예언") || normalized.includes("묵시");
  const isLetter = normalized.includes("letter") || normalized.includes("epistle") || normalized.includes("서신");

  if (locale === "ko") {
    if (isGospel) {
      return [
        {
          name: "예수님",
          role: "본문의 중심에서 하나님 나라를 말과 행동으로 드러내시는 분",
          relevance: "복음서 본문은 먼저 예수님이 누구신지, 무엇을 행하시고 가르치시는지를 중심으로 읽어야 합니다.",
        },
        {
          name: "예수님의 말씀을 듣는 사람들",
          role: "제자들, 무리, 혹은 논쟁 상대처럼 본문 안에서 예수님의 말씀을 받는 사람들",
          relevance: "오늘의 적용은 그들이 처한 질문과 반응을 살핀 뒤에 세울 때 더 안전합니다.",
        },
      ];
    }
    if (isPoetry) {
      return [
        {
          name: "시편의 기도자",
          role: "기쁨, 탄식, 두려움, 신뢰를 하나님 앞에 가져가는 목소리",
          relevance: "시와 지혜 본문은 상황을 단정하기보다 하나님 앞에서 감정과 믿음을 어떻게 말하는지 보여 줍니다.",
        },
        {
          name: "예배 공동체",
          role: "개인의 기도를 함께 기억하고 노래하며 신앙의 언어로 삼는 공동체",
          relevance: "개인적 위로와 공동체적 고백이 함께 놓인 본문으로 읽을 수 있습니다.",
        },
      ];
    }
    if (isProphetic) {
      return [
        {
          name: normalized.includes("묵시") ? "묵시적 증언의 목소리" : "예언자의 목소리",
          role: "언약 백성에게 하나님의 심판, 회개, 소망을 전하는 증언자",
          relevance: "예언과 묵시 본문은 위로와 경고, 현재 고난과 최종 소망을 함께 붙들며 문맥의 방향을 확인해야 합니다.",
        },
        {
          name: "언약 백성",
          role: "하나님의 말씀 앞에서 삶의 방향을 다시 점검하도록 부름받는 공동체",
          relevance: "본문의 메시지는 개인 감정만이 아니라 하나님과 백성의 관계, 그리고 하나님이 열어 가시는 끝의 소망 안에서 들려옵니다.",
        },
      ];
    }
    if (isLetter) {
      return [
        {
          name: "편지를 보낸 사도적 목소리",
          role: "교회가 복음 안에서 바르게 서도록 권면하고 가르치는 목소리",
          relevance: "서신서는 개인 격언이 아니라 실제 공동체의 믿음과 삶을 세우는 권면으로 읽어야 합니다.",
        },
        {
          name: "수신 공동체",
          role: "구체적인 신앙 질문, 갈등, 소망, 순종의 과제를 안고 편지를 받은 성도들",
          relevance: "오늘의 적용은 먼저 그 공동체가 들었던 권면의 방향을 통과해야 합니다.",
        },
      ];
    }
    return [
      {
        name: "원래 청중",
        role: "이 본문을 먼저 들었거나 읽었던 신앙 공동체",
        relevance: "본문의 첫 의미를 지나 오늘의 적용으로 나아가게 해 주는 기준점입니다.",
      },
    ];
  }

  if (isGospel) {
    return [
      {
        name: "Jesus",
        role: "The central figure revealing God's kingdom through word and action",
        relevance: "Gospel passages should first be read around who Jesus is and what he teaches or does.",
      },
      {
        name: "Those who hear Jesus",
        role: "Disciples, crowds, or opponents receiving Jesus' words in the scene",
        relevance: "Their questions and responses help keep present application grounded.",
      },
    ];
  }
  if (isPoetry) {
    return [
      {
        name: "The praying voice",
        role: "A worshiping voice bringing joy, lament, fear, and trust before God",
        relevance: "Poetry and wisdom often teach how faith speaks, not merely what situation happened.",
      },
      {
        name: "The worshiping community",
        role: "The community that remembers and prays these words together",
        relevance: "The text carries both personal comfort and communal confession.",
      },
    ];
  }
  if (isProphetic) {
    return [
      {
        name: normalized.includes("apocalypse") ? "The apocalyptic witness" : "The prophetic voice",
        role: "A witness announcing judgment, repentance, and hope to God's covenant people",
        relevance: "Prophetic and apocalyptic comfort and warning must be held together according to context.",
      },
      {
        name: "The covenant people",
        role: "A community called to re-hear God's word and turn toward faithfulness",
        relevance: "The passage speaks within God's relationship with his people and the hope God opens.",
      },
    ];
  }
  if (isLetter) {
    return [
      {
        name: "The apostolic sender",
        role: "A teaching voice forming the church in the gospel",
        relevance: "Letters are not isolated slogans; they address concrete communities and discipleship.",
      },
      {
        name: "The receiving community",
        role: "Believers facing concrete questions of faith, conflict, endurance, or hope",
        relevance: "Present application should move through the original communal exhortation.",
      },
    ];
  }
  return [
    {
      name: "Original audience",
      role: "The first community that heard or preserved this passage",
      relevance: "This keeps present application accountable to the passage's first setting.",
    },
  ];
}

function buildSetting(locale: AppLocale, bookName: string, genre: string, reference: BibleReference, storyContext: string, date?: string, place?: string): PassageBackgroundSetting {
  if (locale === "ko") {
    return {
      historical: `${date ? `${date} ` : ""}${place ? `${place} ` : ""}${bookName}의 배경 안에서 ${referenceRange(reference)} 본문을 읽습니다.`.trim(),
      literary: storyContext,
      cultural: `${genre} 장르의 표현 방식을 존중해야 합니다. 장르와 앞뒤 흐름을 건너뛰면 본문이 단순한 표어나 즉흥적 조언처럼 오해될 수 있습니다.`,
    };
  }

  return {
    historical: `${date ? `${date} ` : ""}${place ? `${place} ` : ""}Read ${referenceRange(reference)} within the setting of ${bookName}.`.trim(),
    literary: storyContext,
    cultural: `Respect the passage's ${genre} form. Skipping genre and surrounding flow can flatten the text into a slogan or quick advice.`,
  };
}

function buildMessage(locale: AppLocale, bookName: string, genre: string, audience: string | undefined): PassageBackgroundMessage {
  const normalized = genre.toLowerCase();
  const caution =
    locale === "ko"
      ? "이 본문을 현재 상황에 바로 대입하기보다, 먼저 원래 문맥과 장르 안에서 확인한 뒤 적용해야 합니다."
      : "Apply this passage after first checking its original context and genre rather than lifting it straight into the present.";
  if (locale === "ko") {
    return {
      original: `${bookName}은${audience ? ` ${audience}에게` : ""} 하나님이 어떤 분이시며 그분의 백성이 어떻게 응답해야 하는지를 본문 흐름 안에서 보여 줍니다.`,
      theological: normalized.includes("gospel") || normalized.includes("복음")
        ? "복음서의 중심 메시지는 예수님 안에서 하나님의 나라와 구원의 길이 드러난다는 데 있습니다."
        : normalized.includes("letter") || normalized.includes("서신")
          ? "서신서는 복음이 실제 공동체의 믿음, 소망, 사랑, 순종을 어떻게 빚는지 보여 줍니다."
          : "이 본문은 성경 전체의 흐름 안에서 하나님과 그 백성의 관계, 신실하심, 응답의 길을 비춥니다.",
      pastoral: "오늘의 고민에는 본문이 말하는 하나님, 사람, 소망의 방향을 따라 천천히 연결하는 것이 좋습니다.",
      cautions: [caution],
    };
  }

  return {
    original: `${bookName} shows${audience ? ` its first audience` : ""} who God is and how his people are called to respond within the passage flow.`,
    theological: normalized.includes("gospel")
      ? "The Gospels center on Jesus revealing God's kingdom and the way of salvation."
      : normalized.includes("letter") || normalized.includes("epistle")
        ? "The letters show how the gospel shapes the faith, hope, love, and obedience of real communities."
        : "This passage contributes to the larger biblical witness about God, his people, his faithfulness, and faithful response.",
    pastoral: "For the present concern, connect the passage slowly through what it reveals about God, people, and hope.",
    cautions: [caution],
  };
}

function buildApplication(locale: AppLocale, bookName: string): PassageBackgroundApplication {
  if (locale === "ko") {
    return {
      comfort: "하나님은 지금의 마음을 본문 밖으로 밀어내지 않으시고, 말씀의 흐름 안에서 다시 보게 하십니다.",
      challenge: "본문이 먼저 말하는 바를 붙든 뒤, 오늘 내가 붙들 태도와 한 걸음을 조용히 정리해 보세요.",
      prayerPrompt: `주님, ${bookName}의 이 말씀을 제 상황에 억지로 끼워 맞추지 않고 바르게 듣게 해 주세요.`,
      takeaway: "말씀은 내 상황을 즉시 단순화하기보다, 하나님 앞에서 다시 해석하도록 초대합니다.",
    };
  }

  return {
    comfort: "God does not push the present concern outside the text; he invites it to be seen again within Scripture's flow.",
    challenge: "Hold what the passage first says, then name one posture or step to carry today.",
    prayerPrompt: `Lord, help me hear this word from ${bookName} faithfully rather than forcing it onto my situation.`,
    takeaway: "Scripture does not merely simplify my situation; it invites me to reinterpret it before God.",
  };
}

export async function buildLocalPassageBackground(
  reference: BibleReference,
  locale?: string,
): Promise<PassageBackgroundSummary> {
  const appLocale = resolveAppLocale(locale);
  const metadata = getBookMetadata(reference.code, appLocale);
  const bookName = metadata?.title ?? reference.code;
  const author = metadata?.notes.authorship.body;
  const date = metadata?.notes.date.body;
  const place = metadata?.notes.place.body;
  const audience = metadata?.notes.audience.body;
  const genre = metadata?.genre ?? (appLocale === "ko" ? "성경 문헌" : "Biblical literature");

  let storyContext = fallbackStoryContext(appLocale, bookName, reference);
  const sources: BackgroundSource[] = [source("local-book-metadata", "Local book metadata", 1)];

  try {
    const matchingUnit = await findPassageUnit(reference, appLocale);
    if (matchingUnit?.summary) {
      storyContext = matchingUnit.summary;
      sources.push(source("local-passage-index", "Local passage index", 2));
    }
  } catch {
    // Keep local metadata fallback only.
  }

  return {
    bookName,
    author,
    date,
    place,
    audience,
    storyContext,
    canonicalContext: canonicalContext(appLocale, bookName, genre, audience),
    people: buildPeople(appLocale, genre),
    setting: buildSetting(appLocale, bookName, genre, reference, storyContext, date, place),
    message: buildMessage(appLocale, bookName, genre, audience),
    application: buildApplication(appLocale, bookName),
    sources,
    youtubeResources: [],
  };
}
