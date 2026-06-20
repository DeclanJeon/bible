import type { BibleReference } from "@/lib/bible";
import type { ContextNote, SourceLink } from "@/lib/app-data";
import { getBookMetadata } from "@/lib/book-metadata";
import { resolveAppLocale, type AppLocale } from "@/lib/content";
import type { HybridPassageCandidate } from "@/lib/hybrid-retrieval";

export type BackgroundSource = {
  id: string;
  title: string;
  url?: string;
  license?: string;
  retrievedAt: string;
  sourceTier: 1 | 2 | 3;
};

export type PassageBackgroundPack = {
  reference: BibleReference;
  book: {
    title: string;
    genre: string;
    authorship: ContextNote;
    date: ContextNote;
    place: ContextNote;
    audience: ContextNote;
  };
  passageContext: {
    literaryUnit: string;
    beforeAfter: string;
    argumentFlow?: string;
    narrativeSetting?: string;
    genreCaution?: string;
  };
  historicalContext: {
    period?: string;
    location?: string;
    peopleGroups?: string[];
    institutions?: string[];
    confidence: "high" | "medium" | "disputed";
  };
  lexicalContext: Array<{
    term: string;
    originalLanguage?: "hebrew" | "greek" | "aramaic";
    gloss: string;
    whyItMatters: string;
    sourceIds: string[];
  }>;
  themeContext: Array<{
    theme: string;
    storyline: string;
    canonicalLinks: BibleReference[];
    sourceIds: string[];
  }>;
  sources: BackgroundSource[];
  generatedBy?: {
    model: string;
    promptHash: string;
    generatedAt: string;
  };
};

const STATIC_RETRIEVED_AT = "2026-06-19";

function sourceId(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "source";
}

function toBackgroundSources(sources: SourceLink[], tier: BackgroundSource["sourceTier"]): BackgroundSource[] {
  return sources.map((source) => ({
    id: sourceId(source.label),
    title: source.label,
    url: source.url,
    retrievedAt: STATIC_RETRIEVED_AT,
    sourceTier: tier,
  }));
}

function uniqueSources(notes: ContextNote[]): BackgroundSource[] {
  const byId = new Map<string, BackgroundSource>();
  for (const note of notes) {
    for (const source of toBackgroundSources(note.sources, 2)) {
      byId.set(source.id, source);
    }
  }
  return [...byId.values()];
}

function genreCaution(genre: string, locale: AppLocale) {
  const lower = genre.toLowerCase();
  if (lower.includes("poetry") || lower.includes("wisdom") || genre.includes("지혜") || genre.includes("시")) {
    return locale === "ko"
      ? "시와 지혜문학은 명령문처럼 바로 적용하기보다, 기도·탄식·묵상·지혜의 장르 안에서 읽어야 합니다."
      : "Poetry and wisdom should be applied through their genre of prayer, lament, reflection, and wisdom rather than as flat commands.";
  }
  if (lower.includes("prophetic") || genre.includes("예언")) {
    return locale === "ko"
      ? "예언서는 죄의 폭로와 회복의 약속을 함께 말하므로, 위로만 떼어내지 말고 언약적 부름 안에서 읽어야 합니다."
      : "Prophetic literature combines exposure, judgment, and restoration; comfort should be read inside that covenant summons.";
  }
  if (lower.includes("gospel") || genre.includes("복음")) {
    return locale === "ko"
      ? "복음서는 예수님의 말과 행동을 이야기 흐름 안에서 보여 주므로, 한 문장만 떼지 말고 사건의 진행을 함께 봐야 합니다."
      : "Gospel narrative should be read inside the movement of Jesus' words, actions, death, and resurrection.";
  }
  if (lower.includes("epistle") || lower.includes("letter") || genre.includes("서신")) {
    return locale === "ko"
      ? "서신서는 실제 공동체의 문제를 향한 목회적 논증이므로, 권면 앞뒤의 논리 흐름을 함께 봐야 합니다."
      : "Letters are pastoral arguments to real communities; read exhortations with their surrounding logic.";
  }
  return locale === "ko"
    ? "본문 장르와 앞뒤 문맥을 지나서 적용해야 합니다."
    : "Application should move through the passage genre and surrounding context.";
}

function unitThemeStory(candidate: HybridPassageCandidate, sourceIds: string[], locale: AppLocale) {
  const unit = candidate.unit;
  const themes = [...new Set([...(unit.themes ?? []), ...(unit.doctrines ?? []), ...(unit.humanConcerns ?? [])])].slice(0, 6);
  return themes.map((theme) => ({
    theme,
    storyline: locale === "ko"
      ? `이 주제는 ${unit.summary || (unit.text ?? unit.excerpt ?? "").slice(0, 80)} 안에서 사용자의 질문을 성경의 더 큰 이야기로 연결합니다.`
      : `This theme connects the user's question to the wider biblical storyline through ${unit.summary || (unit.text ?? unit.excerpt ?? "").slice(0, 80)}.`,
    canonicalLinks: [],
    sourceIds,
  }));
}

export function buildPassageBackgroundPack(candidate: HybridPassageCandidate, locale?: string): PassageBackgroundPack {
  const appLocale = resolveAppLocale(locale);
  const metadata = getBookMetadata(candidate.unit.reference.code, appLocale);
  const bookTitle = metadata?.title ?? candidate.unit.reference.code;
  const genre = metadata?.genre ?? (appLocale === "ko" ? "성경 문헌" : "Biblical literature");
  const fallbackNote: ContextNote = {
    title: appLocale === "ko" ? "출처 제한" : "Limited source",
    body: appLocale === "ko"
      ? "이 책의 세부 배경 메타데이터가 없어서 본문 자체와 색인 정보를 우선합니다."
      : "Detailed book metadata is unavailable, so the passage text and index metadata control the explanation.",
    confidence: "medium",
    sources: [{ label: "Local Bible corpus", url: "local://world_english_bible-and-korean_bible" }],
  };
  const authorship = metadata?.notes.authorship ?? fallbackNote;
  const date = metadata?.notes.date ?? fallbackNote;
  const place = metadata?.notes.place ?? fallbackNote;
  const audience = metadata?.notes.audience ?? fallbackNote;
  const sources = uniqueSources([authorship, date, place, audience]);
  const sourceIds = sources.length ? sources.map((source) => source.id) : ["local-bible-corpus"];

  return {
    reference: candidate.unit.reference,
    book: {
      title: bookTitle,
      genre,
      authorship,
      date,
      place,
      audience,
    },
    passageContext: {
      literaryUnit: candidate.unit.summary || (appLocale === "ko" ? `${bookTitle} 안의 선택 본문 단위` : `Selected passage unit in ${bookTitle}`),
      beforeAfter: appLocale === "ko"
        ? "정확한 앞뒤 문맥은 본문 범위와 주변 절을 함께 읽어 확인해야 합니다. 현재 설명은 저장된 책 배경과 passage index 근거에 묶입니다."
        : "The immediate before/after context should be checked by reading the surrounding verses; this explanation stays bound to stored book context and passage-index evidence.",
      genreCaution: genreCaution(genre, appLocale),
    },
    historicalContext: {
      period: date.body,
      location: place.body,
      confidence: date.confidence === "disputed" || place.confidence === "disputed" ? "disputed" : date.confidence === "high" && place.confidence === "high" ? "high" : "medium",
    },
    lexicalContext: candidate.matchedQueries.slice(0, 5).map((term) => ({
      term,
      gloss: term,
      whyItMatters: appLocale === "ko"
        ? `이 표현은 사용자의 질문과 본문 색인이 만난 지점입니다.`
        : "This expression is where the user's prompt and passage index met.",
      sourceIds,
    })),
    themeContext: unitThemeStory(candidate, sourceIds, appLocale),
    sources: sources.length ? sources : [{ id: "local-bible-corpus", title: "Local Bible corpus", url: "local://world_english_bible-and-korean_bible", retrievedAt: STATIC_RETRIEVED_AT, sourceTier: 1 }],
  };
}
