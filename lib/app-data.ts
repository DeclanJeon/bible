import type { BibleReference } from "@/lib/bible";
import { getBookMetadata, type BookMetadata } from "@/lib/book-metadata";
import webBibleMetadata from "@/world_english_bible/metadata.json";
import koreanBibleMetadata from "@/korean_bible/metadata.json";

export type SourceLink = {
  label: string;
  url: string;
};

export type LinkedReference = {
  label: string;
  type: "parallel" | "quotation" | "echo" | "fulfillment" | "theme";
  summary: string;
  reference: BibleReference;
};

export type ContextNote = {
  title: string;
  body: string;
  confidence: "high" | "medium" | "disputed";
  sources: SourceLink[];
};

export type StoryClusterLocalization = Pick<
  StoryCluster,
  | "title"
  | "pastoralPrompt"
  | "starterPrompt"
  | "searchHints"
  | "themes"
  | "emotions"
  | "reflectionQuestions"
  | "context"
  | "linkedTexts"
  | "jesusLayer"
  | "paulLayer"
  | "jewishReception"
  | "topicLabel"
>;

export type StoryCluster = {
  slug: string;
  title: string;
  pastoralPrompt: string;
  starterPrompt: string;
  searchHints: string[];
  primary: BibleReference;
  supporting: BibleReference[];
  themes: string[];
  emotions: string[];
  reflectionQuestions: string[];
  context: {
    author: ContextNote;
    date: ContextNote;
    place: ContextNote;
    audience: ContextNote;
    meaning: ContextNote;
  };
  linkedTexts: LinkedReference[];
  jesusLayer: ContextNote;
  paulLayer: ContextNote;
  jewishReception: ContextNote;
  topicLabel: string;
  localizations?: {
    ko?: StoryClusterLocalization;
  };
};

type CanonBook = {
  order: number;
  code: string;
  name: string;
  testament: string;
  chapters: number;
  verses: number;
  file: string;
};

const SOURCE_GROUPS = {
  scripture: [
    { label: "World English Bible text", url: "https://worldenglish.bible" },
    { label: "Open Bibles Korean Bible text (not NKRV)", url: "https://github.com/seven1m/open-bibles" },
  ],
  crossReferences: [
    { label: "Bible Cross References project", url: "https://crossreferences.org/project/" },
    { label: "Bible Cross References developers", url: "https://crossreferences.org/project/developers/" },
    { label: "OpenBible cross references", url: "https://www.openbible.info/labs/cross-references/" },
  ],
  places: [
    { label: "OpenBible geocoding", url: "https://www.openbible.info/geo/" },
    { label: "STEPBible places", url: "https://www.stepbible.org/html/places.html" },
  ],
  data: [
    { label: "STEPBible data", url: "https://github.com/STEPBible/STEPBible-Data" },
    { label: "Open Bibles kor-korean.osis.xml source", url: "https://github.com/seven1m/open-bibles" },
  ],
};

const WEB_BOOKS = (webBibleMetadata as { books: CanonBook[] }).books;
const KOREAN_BOOKS_BY_CODE = new Map(
  (koreanBibleMetadata as { books: CanonBook[] }).books.map((book) => [book.code, book]),
);

const TOPIC_GROUPS = [
  { label: "Torah", codes: ["GEN", "EXO", "LEV", "NUM", "DEU"] },
  { label: "History", codes: ["JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST"] },
  { label: "Poetry and Wisdom", codes: ["JOB", "PSA", "PRO", "ECC", "SOL"] },
  { label: "Major Prophets", codes: ["ISA", "JER", "LAM", "EZE", "DAN"] },
  { label: "Minor Prophets", codes: ["HOS", "JOE", "AMO", "OBA", "JON", "MIC", "NAH", "HAB", "ZEP", "HAG", "ZEC", "MAL"] },
  { label: "Gospels", codes: ["MAT", "MAR", "LUK", "JOH"] },
  { label: "Acts", codes: ["ACT"] },
  { label: "Pauline Letters", codes: ["ROM", "1CO", "2CO", "GAL", "EPH", "PHI", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM"] },
  { label: "General Letters", codes: ["HEB", "JAM", "1PE", "2PE", "1JO", "2JO", "3JO", "JUD"] },
  { label: "Apocalyptic", codes: ["REV"] },
] as const;

function note(title: string, body: string, confidence: ContextNote["confidence"], sources: SourceLink[]): ContextNote {
  return { title, body, confidence, sources };
}

function topicForBook(code: string) {
  return TOPIC_GROUPS.find((group) => (group.codes as readonly string[]).includes(code))?.label ?? "Canon";
}

function keywordsFrom(value: string) {
  return value
    .split(/[·,;:()\-\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 2);
}

function primaryReferenceForBook(book: CanonBook): BibleReference {
  return {
    code: book.code,
    chapter: 1,
    startVerse: 1,
    endVerse: Math.min(6, book.verses),
  };
}

function bookThemes(book: CanonBook, metadata: BookMetadata, topicLabel: string) {
  return [...new Set([topicLabel, book.testament, ...keywordsFrom(metadata.genre)].slice(0, 8))];
}

function buildMeaningNote(metadata: BookMetadata, locale: "en" | "ko"): ContextNote {
  if (locale === "ko") {
    return note(
      "읽기 초점",
      `${metadata.title} 레인은 미리 써 둔 고민 목업이 아니라 로컬 한국어 성경 본문, 책 메타데이터, 상호참조 데이터에서 만들어집니다. 먼저 책의 첫 본문을 읽고, 이어서 데이터셋이 제시하는 연결 본문으로 넓혀 갑니다.`,
      "medium",
      [...SOURCE_GROUPS.scripture, ...SOURCE_GROUPS.crossReferences],
    );
  }

  return note(
    "Reading focus",
    `${metadata.title} is a source-backed lane generated from local Bible text, book metadata, and cross-reference datasets rather than a prewritten pastoral mock scenario. Start with the book's opening passage, then let the data-backed links widen the study.`,
    "medium",
    [...SOURCE_GROUPS.scripture, ...SOURCE_GROUPS.crossReferences],
  );
}

function buildJesusLayer(book: CanonBook, metadata: BookMetadata, locale: "en" | "ko"): ContextNote {
  const isGospel = ["MAT", "MAR", "LUK", "JOH"].includes(book.code);
  const isNewTestament = book.testament.toLowerCase().includes("new");

  if (locale === "ko") {
    return note(
      "예수님 층위",
      isGospel
        ? `${metadata.title} 자체가 예수님의 사역과 말씀을 증언합니다. 적용은 이 증언이 예수님을 어떻게 드러내는지 먼저 읽은 뒤에 이어져야 합니다.`
        : isNewTestament
          ? `${metadata.title}은 예수 그리스도의 복음 이후 공동체가 그분의 주권과 가르침 아래 어떻게 살아가는지를 보여 줍니다.`
          : `${metadata.title}은 먼저 자기 고유의 구약 문맥 안에서 읽어야 합니다. 그 다음에야 기독교 독자는 예수님 안에서 이 정경적 주제가 어떻게 이어지는지 조심스럽게 연결할 수 있습니다.`,
      isGospel ? "high" : "medium",
      SOURCE_GROUPS.crossReferences,
    );
  }

  return note(
    "Jesus layer",
    isGospel
      ? `${metadata.title} directly witnesses to Jesus' ministry and words, so application should begin with what this testimony reveals about him.`
      : isNewTestament
        ? `${metadata.title} shows how the post-gospel community lives under the lordship and teaching of Jesus Christ.`
        : `${metadata.title} should first be read in its own Old Testament setting; Christian readers can then trace how its canonical themes continue in Jesus without flattening that first horizon.`,
    isGospel ? "high" : "medium",
    SOURCE_GROUPS.crossReferences,
  );
}

function buildPaulLayer(book: CanonBook, metadata: BookMetadata, locale: "en" | "ko"): ContextNote {
  const isPauline = (((TOPIC_GROUPS.find((group) => group.label === "Pauline Letters")?.codes ?? []) as readonly string[])).includes(book.code);

  if (locale === "ko") {
    return note(
      "바울/사도적 층위",
      isPauline
        ? `${metadata.title}은 바울 서신권 안에 있으므로, 논증의 흐름과 교회 상황을 따라 읽는 것이 우선입니다.`
        : `바울과 사도적 증언은 ${metadata.title}을 직접 대체하지 않습니다. 대신 같은 정경 안에서 창조, 언약, 지혜, 복음, 교회적 삶의 주제가 어떻게 다시 울리는지 비교하도록 돕습니다.`,
      isPauline ? "high" : "medium",
      SOURCE_GROUPS.crossReferences,
    );
  }

  return note(
    "Paul / apostolic layer",
    isPauline
      ? `${metadata.title} belongs inside the Pauline letter collection, so the flow of argument and church setting should control the reading.`
      : `Paul and the wider apostolic witness do not replace ${metadata.title}; they help compare how creation, covenant, wisdom, gospel, and communal life echo across the canon.`,
    isPauline ? "high" : "medium",
    SOURCE_GROUPS.crossReferences,
  );
}

function buildReceptionLayer(book: CanonBook, metadata: BookMetadata, locale: "en" | "ko"): ContextNote {
  const isOldTestament = book.testament.toLowerCase().includes("old");

  if (locale === "ko") {
    return note(
      isOldTestament ? "유대 전승의 수용" : "초기 수용",
      isOldTestament
        ? `${metadata.title}은 유대 성경의 일부로 먼저 보존되고 낭독되었습니다. 그러므로 기독교적 적용 전에 이스라엘의 예배, 기억, 지혜, 예언 전통 안에서 들리는 의미를 먼저 존중해야 합니다.`
        : `${metadata.title}은 초기 예수 공동체의 증언 안에서 보존되었습니다. 역사적 청중과 문학적 목적을 먼저 확인해야 오늘의 적용도 과장되지 않습니다.`,
      "medium",
      SOURCE_GROUPS.data,
    );
  }

  return note(
    isOldTestament ? "Jewish reception" : "Early reception",
    isOldTestament
      ? `${metadata.title} was preserved and read first as part of the Jewish scriptures, so Christian application should respect its place in Israel's worship, memory, wisdom, and prophetic traditions before moving forward.`
      : `${metadata.title} was preserved inside early Jesus-community testimony. Its historical audience and literary purpose should shape contemporary use before application becomes too broad.`,
    "medium",
    SOURCE_GROUPS.data,
  );
}

function buildBookCluster(book: CanonBook): StoryCluster {
  const metadata = getBookMetadata(book.code, "en") ?? {
    code: book.code,
    title: book.name,
    genre: book.testament,
    notes: {
      authorship: note("Traditional authorship", "Source metadata for this book is limited in the local catalog.", "disputed", SOURCE_GROUPS.data),
      date: note("Date range", "Source metadata for this book is limited in the local catalog.", "disputed", SOURCE_GROUPS.data),
      place: note("Place", "Source metadata for this book is limited in the local catalog.", "disputed", SOURCE_GROUPS.places),
      audience: note("Audience", "Source metadata for this book is limited in the local catalog.", "medium", SOURCE_GROUPS.data),
    },
  };
  const koBook = KOREAN_BOOKS_BY_CODE.get(book.code);
  const koMetadata = getBookMetadata(book.code, "ko") ?? metadata;
  const topicLabel = topicForBook(book.code);
  const primary = primaryReferenceForBook(book);
  const themes = bookThemes(book, metadata, topicLabel);
  const koThemes = bookThemes(
    {
      ...book,
      name: koBook?.name ?? book.name,
      testament: koBook?.testament ?? book.testament,
    },
    koMetadata,
    topicLabel,
  );

  return {
    slug: `book-${book.code.toLowerCase()}`,
    title: metadata.title,
    pastoralPrompt: `A source-backed lane for reading ${metadata.title} through its local Bible text, book profile, and dataset cross-references.`,
    starterPrompt: `Help me study ${metadata.title} with book context and linked passages.`,
    searchHints: [book.code, book.name, metadata.title, metadata.genre, book.testament, topicLabel, ...themes],
    primary,
    supporting: [],
    themes,
    emotions: [topicLabel],
    reflectionQuestions: [
      `What does ${metadata.title}'s opening passage emphasize before later application?`,
      `Which data-backed cross-references most clarify ${metadata.title}'s canonical neighbors?`,
      `Where should interpretation stay tentative because the book profile marks confidence or debate?`,
    ],
    context: {
      author: metadata.notes.authorship,
      date: metadata.notes.date,
      place: metadata.notes.place,
      audience: metadata.notes.audience,
      meaning: buildMeaningNote(metadata, "en"),
    },
    linkedTexts: [],
    jesusLayer: buildJesusLayer(book, metadata, "en"),
    paulLayer: buildPaulLayer(book, metadata, "en"),
    jewishReception: buildReceptionLayer(book, metadata, "en"),
    topicLabel,
    localizations: {
      ko: {
        topicLabel,
        title: koMetadata.title,
        pastoralPrompt: `${koMetadata.title}을 로컬 한국어 성경 본문, 책 프로필, 데이터셋 상호참조로 읽는 출처 기반 레인입니다.`,
        starterPrompt: `${koMetadata.title}의 책 문맥과 연결 본문을 함께 공부하고 싶어요.`,
        searchHints: [book.code, koBook?.name ?? koMetadata.title, koMetadata.title, koMetadata.genre, koBook?.testament ?? "", topicLabel, ...koThemes].filter(Boolean),
        themes: koThemes,
        emotions: [topicLabel],
        reflectionQuestions: [
          `${koMetadata.title}의 첫 본문은 오늘의 적용보다 먼저 무엇을 강조하나요?`,
          `데이터 기반 연결 본문 가운데 어떤 말씀이 ${koMetadata.title}의 정경적 이웃을 가장 잘 보여 주나요?`,
          `책 프로필의 신뢰도나 논쟁 표시 때문에 어디에서 해석을 조심스럽게 붙들어야 하나요?`,
        ],
        context: {
          author: koMetadata.notes.authorship,
          date: koMetadata.notes.date,
          place: koMetadata.notes.place,
          audience: koMetadata.notes.audience,
          meaning: buildMeaningNote(koMetadata, "ko"),
        },
        linkedTexts: [],
        jesusLayer: buildJesusLayer(
          { ...book, name: koBook?.name ?? book.name, testament: koBook?.testament ?? book.testament },
          koMetadata,
          "ko",
        ),
        paulLayer: buildPaulLayer(
          { ...book, name: koBook?.name ?? book.name, testament: koBook?.testament ?? book.testament },
          koMetadata,
          "ko",
        ),
        jewishReception: buildReceptionLayer(
          { ...book, name: koBook?.name ?? book.name, testament: koBook?.testament ?? book.testament },
          koMetadata,
          "ko",
        ),
      },
    },
  };
}

export const STORY_CLUSTERS: StoryCluster[] = WEB_BOOKS
  .slice()
  .sort((a, b) => a.order - b.order)
  .map(buildBookCluster);

export function getClusterBySlug(slug: string) {
  return STORY_CLUSTERS.find((cluster) => cluster.slug === slug);
}

export function getClusterForPrompt(prompt: string | undefined) {
  const normalized = (prompt ?? "").toLowerCase();
  if (!normalized.trim()) {
    return STORY_CLUSTERS[0];
  }

  const scored = STORY_CLUSTERS.map((cluster) => ({
    cluster,
    score:
      cluster.searchHints.reduce((score, hint) => score + (normalized.includes(hint.toLowerCase()) ? 2 : 0), 0) +
      cluster.themes.reduce((score, theme) => score + (normalized.includes(theme.toLowerCase()) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score);

  return scored[0]?.score ? scored[0].cluster : STORY_CLUSTERS[0];
}

export function getRelatedClusters(slug: string, limit = 3) {
  const current = getClusterBySlug(slug);
  if (!current) {
    return [];
  }

  return STORY_CLUSTERS
    .filter((cluster) => cluster.slug !== slug)
    .map((cluster) => {
      const sameTopic = cluster.topicLabel === current.topicLabel ? 4 : 0;
      const sharedThemes = cluster.themes.filter((theme) => current.themes.includes(theme));
      return { cluster, score: sameTopic + sharedThemes.length };
    })
    .sort((a, b) => b.score - a.score || a.cluster.title.localeCompare(b.cluster.title))
    .slice(0, limit)
    .map(({ cluster }) => cluster);
}

export function getRelatedClustersFromReferences(
  currentSlug: string,
  codes: string[],
  limit = 3,
) {
  const seen = new Set<string>([currentSlug]);
  const related: StoryCluster[] = [];

  for (const code of codes) {
    const slug = `book-${code.toLowerCase()}`;
    if (seen.has(slug)) {
      continue;
    }
    const cluster = getClusterBySlug(slug);
    if (!cluster) {
      continue;
    }
    seen.add(slug);
    related.push(cluster);
    if (related.length >= limit) {
      return related;
    }
  }

  return related.length ? related : getRelatedClusters(currentSlug, limit);
}

export function relationTypeLabel(type: LinkedReference["type"]) {
  const labels: Record<LinkedReference["type"], string> = {
    parallel: "Parallel story or pattern",
    quotation: "Direct quotation",
    echo: "Canonical echo",
    fulfillment: "Fulfillment claim",
    theme: "Shared theme",
  };

  return labels[type];
}

export function getTopicStarts() {
  return TOPIC_GROUPS.map((topic) => {
    const clusters = STORY_CLUSTERS.filter((cluster) => cluster.topicLabel === topic.label);
    const first = clusters[0];
    if (!first) {
      return null;
    }

    return {
      label: topic.label,
      slug: first.slug,
      title: topic.label,
      pastoralPrompt: `Browse ${topic.label.toLowerCase()} books from the 66-book local Bible corpus.`,
      starterPrompt: `Help me study the ${topic.label.toLowerCase()} books with context and linked passages.`,
      themes: [topic.label],
      count: clusters.length,
    };
  }).filter((topic): topic is NonNullable<typeof topic> => topic !== null);
}

export function getClusterCatalog() {
  return STORY_CLUSTERS.map((cluster) => ({
    slug: cluster.slug,
    title: cluster.title,
    pastoralPrompt: cluster.pastoralPrompt,
    starterPrompt: cluster.starterPrompt,
    primary: cluster.primary,
    supporting: cluster.supporting,
    themes: cluster.themes,
    emotions: cluster.emotions,
    topicLabel: cluster.topicLabel,
    relatedSlugs: getRelatedClusters(cluster.slug, 3).map((related) => related.slug),
  }));
}

export function filterClusterCatalog(options: { topic?: string; q?: string; locale?: "en" | "ko" | string }) {
  const topicStarts = getTopicStarts();
  const clusters = getClusterCatalog();
  const activeTopic = topicStarts.find((entry) => entry.label === options.topic)?.label ?? null;
  const query = options.q?.trim().toLowerCase() ?? "";
  const locale = options.locale === "ko" ? "ko" : "en";
  const topicFiltered = activeTopic
    ? clusters.filter((cluster) => cluster.topicLabel === activeTopic)
    : clusters;

  const visibleClusters = query
    ? topicFiltered.filter((cluster) => {
        const fullCluster = getClusterBySlug(cluster.slug);
        const localized = locale === "ko" ? fullCluster?.localizations?.ko : null;
        const haystack = [
          cluster.title,
          cluster.pastoralPrompt,
          cluster.starterPrompt,
          cluster.themes.join(" "),
          cluster.emotions.join(" "),
          cluster.primary.code,
          localized?.title,
          localized?.pastoralPrompt,
          localized?.starterPrompt,
          localized?.searchHints.join(" "),
          localized?.themes.join(" "),
          localized?.emotions.join(" "),
        ]
          .filter((value): value is string => !!value)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
    : topicFiltered;

  return {
    topicStarts,
    activeTopic,
    query,
    clusters,
    visibleClusters,
  };
}

export const APP_SOURCES: SourceLink[] = [
  { label: "World English Bible text", url: "https://worldenglish.bible" },
  { label: "Open Bibles Korean Bible text (not NKRV)", url: "https://github.com/seven1m/open-bibles" },
  { label: "Bible Cross References", url: "https://crossreferences.org/project/" },
  { label: "CrossWire TSK", url: "https://www2.crosswire.org/sword/modules/ModInfo.jsp?beta=true&modName=TSK" },
  { label: "STEPBible Data", url: "https://github.com/STEPBible/STEPBible-Data" },
  { label: "OpenBible Geocoding", url: "https://www.openbible.info/geo/" },
  { label: "Sefaria Links API", url: "https://developers.sefaria.org/reference/get-links" },
];
