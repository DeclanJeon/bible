import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const CHANNELS_PATH = path.join(ROOT, "data", "external", "youtube", "channels.json");
const VIDEOS_PATH = path.join(ROOT, "data", "external", "youtube", "videos.json");
const cache = new Map<string, YoutubeCatalog>();

export type YoutubeChannelRecord = {
  channelId: string;
  channelTitle: string;
  channelHandle?: string;
  sourceUrl: string;
  videosUrl: string;
  active: boolean;
  notes?: string;
  discoveredAt: string;
  refreshedAt?: string;
};

export type YoutubePassageRef = {
  label: string;
  code: string;
  chapter?: number;
  startVerse?: number;
  endVerse?: number;
};

export type YoutubeVideoRecord = {
  videoId: string;
  channelId: string;
  channelTitle: string;
  channelHandle?: string;
  title: string;
  url: string;
  publishedAt?: string;
  durationSeconds?: number;
  description?: string;
  transcriptStatus: "ok" | "missing" | "error";
  transcriptPath?: string;
  summary?: string;
  mentionedPassages: string[];
  keywords: string[];
  topics: string[];
  resourceKind?: "teaching" | "music" | "mixed";
  sourceKind: "channel";
  provenance: {
    catalog: "yt-dlp";
    transcript?: "y2md";
    summary?: "deterministic" | "ai";
    passageExtraction?: "deterministic" | "deterministic+ai";
  };
  crawledAt: string;
  refreshedAt?: string;
};

export type YoutubeCatalog = {
  version: string;
  generatedAt: string;
  channels: YoutubeChannelRecord[];
  videos: YoutubeVideoRecord[];
  byExactReference: Record<string, YoutubeVideoRecord[]>;
  byBookCode: Record<string, YoutubeVideoRecord[]>;
  byKeyword: Record<string, YoutubeVideoRecord[]>;
};

type CatalogPayload<T> = {
  version?: string | number;
  generatedAt?: string;
  channels?: T[];
  videos?: T[];
};

function normalizeKeyword(value: string) {
  return value.trim().toLowerCase();
}

function normalizeReferenceLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function parsePassageLabel(label: string): YoutubePassageRef | null {
  const normalized = normalizeReferenceLabel(label);
  const match = normalized.match(/^([1-3]?[A-Z]{2,3})\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
  if (!match) return null;

  const [, code, chapterText, startVerseText, endVerseText] = match;
  const chapter = Number(chapterText);
  const startVerse = startVerseText ? Number(startVerseText) : undefined;
  const endVerse = endVerseText ? Number(endVerseText) : startVerse;

  return {
    label: normalized,
    code,
    chapter: Number.isFinite(chapter) ? chapter : undefined,
    startVerse: startVerse && Number.isFinite(startVerse) ? startVerse : undefined,
    endVerse: endVerse && Number.isFinite(endVerse) ? endVerse : undefined,
  };
}

function sortVideos(videos: YoutubeVideoRecord[]) {
  return videos.slice().sort((a, b) => {
    const aMentions = a.mentionedPassages.length;
    const bMentions = b.mentionedPassages.length;
    if (aMentions !== bMentions) return bMentions - aMentions;
    const aPublished = a.publishedAt ?? "";
    const bPublished = b.publishedAt ?? "";
    if (aPublished !== bPublished) return aPublished < bPublished ? 1 : -1;
    return a.videoId.localeCompare(b.videoId);
  });
}

function addIndexEntry<T>(index: Record<string, T[]>, key: string, value: T) {
  if (!index[key]) {
    index[key] = [];
  }
  index[key].push(value);
}

async function readCatalogSection<T>(filePath: string, key: "channels" | "videos"): Promise<{ version: string; generatedAt: string; items: T[] }> {
  try {
    const raw = await readFile(filePath, "utf8");
    const payload = JSON.parse(raw) as CatalogPayload<T> | T[];
    if (Array.isArray(payload)) {
      return {
        version: "1",
        generatedAt: "",
        items: payload,
      };
    }

    const items = Array.isArray(payload[key]) ? payload[key]! : [];
    return {
      version: String(payload.version ?? "1"),
      generatedAt: payload.generatedAt ?? "",
      items,
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return {
        version: "1",
        generatedAt: "",
        items: [],
      };
    }
    throw error;
  }
}

export async function loadYoutubeCatalog(): Promise<YoutubeCatalog> {
  const cached = cache.get("main");
  if (cached) return cached;

  const [channelsSection, videosSection] = await Promise.all([
    readCatalogSection<YoutubeChannelRecord>(CHANNELS_PATH, "channels"),
    readCatalogSection<YoutubeVideoRecord>(VIDEOS_PATH, "videos"),
  ]);

  const byExactReference: Record<string, YoutubeVideoRecord[]> = {};
  const byBookCode: Record<string, YoutubeVideoRecord[]> = {};
  const byKeyword: Record<string, YoutubeVideoRecord[]> = {};

  for (const video of videosSection.items) {
    const normalizedPassages = video.mentionedPassages.map(normalizeReferenceLabel);
    const normalizedKeywords = [...video.keywords, ...video.topics].map(normalizeKeyword);

    for (const passage of normalizedPassages) {
      addIndexEntry(byExactReference, passage, video);
      const parsed = parsePassageLabel(passage);
      if (parsed?.code) {
        addIndexEntry(byBookCode, parsed.code, video);
      }
    }

    for (const keyword of normalizedKeywords) {
      if (keyword) {
        addIndexEntry(byKeyword, keyword, video);
      }
    }
  }

  for (const index of [byExactReference, byBookCode, byKeyword]) {
    for (const key of Object.keys(index)) {
      index[key] = sortVideos(index[key]);
    }
  }

  const catalog: YoutubeCatalog = {
    version: videosSection.generatedAt || channelsSection.generatedAt ? String(videosSection.version || channelsSection.version) : String(channelsSection.version || videosSection.version),
    generatedAt: videosSection.generatedAt || channelsSection.generatedAt,
    channels: channelsSection.items,
    videos: sortVideos(videosSection.items),
    byExactReference,
    byBookCode,
    byKeyword,
  };

  cache.set("main", catalog);
  return catalog;
}

export async function findYoutubeVideosByExactReference(reference: string): Promise<YoutubeVideoRecord[]> {
  const catalog = await loadYoutubeCatalog();
  return catalog.byExactReference[normalizeReferenceLabel(reference)] ?? [];
}

export async function findYoutubeVideosByBookCode(bookCode: string): Promise<YoutubeVideoRecord[]> {
  const catalog = await loadYoutubeCatalog();
  return catalog.byBookCode[bookCode.trim().toUpperCase()] ?? [];
}

export async function findYoutubeVideosByKeyword(keyword: string): Promise<YoutubeVideoRecord[]> {
  const catalog = await loadYoutubeCatalog();
  return catalog.byKeyword[normalizeKeyword(keyword)] ?? [];
}

export function extractYoutubePassageRefs(video: YoutubeVideoRecord): YoutubePassageRef[] {
  return video.mentionedPassages
    .map(parsePassageLabel)
    .filter((value): value is YoutubePassageRef => value !== null);
}
