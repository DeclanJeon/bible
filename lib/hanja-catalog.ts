import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BibleReference } from "@/lib/bible";
import { resolveAppLocale, type AppLocale } from "@/lib/content";

const ROOT = process.cwd();

export type HanjaSourceKind =
  | "article"
  | "video"
  | "channel"
  | "book"
  | "paper"
  | "search"
  | "blog"
  | "reference";

export type HanjaSourceStance = "supportive" | "critical" | "unclear";
export type HanjaSourceCatalogRole = "curated" | "lead";
export type HanjaEntryType = "curated" | "generated";

export type HanjaSource = {
  id: string;
  title: string;
  url: string;
  kind: HanjaSourceKind;
  language: "ko" | "en" | "zh";
  stance: HanjaSourceStance;
  catalogRole: HanjaSourceCatalogRole;
  publisher?: string | null;
  section: string;
  subsection?: string | null;
  topicTags: string[];
  notes?: string | null;
  importLine: number;
};

export type LocalizedHanjaText = {
  ko?: string;
  en?: string;
};

export type HanjaMeaningEvidence = {
  sourceId: string;
  text: string;
  claimType?: string;
  confidence?: "high" | "medium" | "low";
  stance?: HanjaSourceStance;
};

export type HanjaStudyEntry = {
  slug: string;
  character: string;
  reading: string;
  title: LocalizedHanjaText;
  thesis: LocalizedHanjaText;
  explanation: LocalizedHanjaText;
  meaningSummary?: LocalizedHanjaText;
  meaningEvidence?: HanjaMeaningEvidence[];
  mainPassages: BibleReference[];
  relatedPassages: BibleReference[];
  supportiveSourceIds: string[];
  criticalSourceIds: string[];
  sourceIds?: string[];
  relatedEntrySlugs: string[];
  keywords: string[];
  entryType?: HanjaEntryType;
  sourceCount?: number;
  supportiveCount?: number;
  criticalCount?: number;
  leadCount?: number;
  titleMentionCount?: number;
  leadSourceIds?: string[];
  sampleContexts?: string[];
};

export type HanjaCatalogListEntry = Pick<
  HanjaStudyEntry,
  | "slug"
  | "character"
  | "reading"
  | "title"
  | "thesis"
  | "explanation"
  | "meaningSummary"
  | "mainPassages"
  | "relatedPassages"
  | "supportiveSourceIds"
  | "criticalSourceIds"
  | "keywords"
  | "entryType"
  | "sourceCount"
>;

export type HanjaSourceCatalog = {
  version: number;
  sourceNote: {
    path: string;
    importedAt: string;
    linkCount: number;
  };
  sources: HanjaSource[];
};

export type HanjaEntryCatalog = {
  version: number;
  entries: HanjaStudyEntry[];
};

export type HanjaPublishedCatalog = {
  version: number;
  generatedAt: string;
  stats?: {
    sourceCount?: number;
    harvestedDocumentCount?: number;
    characterCount?: number;
  };
  characters: HanjaStudyEntry[];
};

type HanjaPublishedCatalogSummary = {
  characterCount: number;
  publishedSlugs: Set<string>;
};

async function loadJson<T>(relativePath: string): Promise<T> {
  const filePath = path.join(ROOT, relativePath);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function localizeText(text: LocalizedHanjaText, locale?: string) {
  const appLocale = resolveAppLocale(locale);
  return text[appLocale] ?? text.ko ?? text.en ?? "";
}

export const loadHanjaSourceCatalog = cache(async () => {
  return await loadJson<HanjaSourceCatalog>(path.join("data", "hanja", "sources.json"));
});

export const loadHanjaEntryCatalog = cache(async () => {
  const catalog = await loadJson<HanjaEntryCatalog>(path.join("data", "hanja", "entries.json"));
  await validateHanjaEntryCatalog(catalog.entries);
  return catalog;
});

export const loadHanjaPublishedCatalog = cache(async () => {
  try {
    const catalog = await loadJson<HanjaPublishedCatalog>(path.join("data", "hanja", "published-characters.json"));
    await validateHanjaEntryCatalog(catalog.characters);
    return catalog;
  } catch {
    return {
      version: 1,
      generatedAt: "",
      stats: { sourceCount: 0, harvestedDocumentCount: 0, characterCount: 0 },
      characters: [],
    } satisfies HanjaPublishedCatalog;
  }
});
export const loadHanjaPublishedCatalogSummary = cache(async (): Promise<HanjaPublishedCatalogSummary> => {
  try {
    const raw = await readFile(path.join(ROOT, "data", "hanja", "published-characters.json"), "utf8");
    const publishedSlugs = new Set(Array.from(raw.matchAll(/"slug"\s*:\s*"([^"]+)"/g), (match) => match[1]));
    const characterCountMatch = raw.match(/"characterCount"\s*:\s*(\d+)/);
    return {
      characterCount: Number(characterCountMatch?.[1] ?? publishedSlugs.size),
      publishedSlugs,
    };
  } catch {
    return {
      characterCount: 0,
      publishedSlugs: new Set(),
    };
  }
});


export const loadHanjaSourceIndex = cache(async () => {
  const catalog = await loadHanjaSourceCatalog();
  return new Map(catalog.sources.map((source) => [source.id, source] as const));
});

export const loadHanjaCatalogSummary = cache(async () => {
  const [curatedCatalog, publishedSummary] = await Promise.all([loadHanjaEntryCatalog(), loadHanjaPublishedCatalogSummary()]);
  let curatedOnlyCount = 0;

  for (const entry of curatedCatalog.entries) {
    if (!publishedSummary.publishedSlugs.has(entry.slug)) curatedOnlyCount += 1;
  }

  const entryCount = publishedSummary.characterCount + curatedOnlyCount;
  return {
    entryCount,
    hasEntries: entryCount > 0,
  };
});


function normalizeEntryType(entry: HanjaStudyEntry, entryType: HanjaEntryType): HanjaStudyEntry {
  return {
    ...entry,
    entryType: entry.entryType ?? entryType,
  };
}

function mergeHanjaEntries(curated: HanjaStudyEntry, published?: HanjaStudyEntry): HanjaStudyEntry {
  if (!published) {
    return curated;
  }

  const supportiveSourceIds = [...new Set([...(published.supportiveSourceIds ?? []), ...(curated.supportiveSourceIds ?? [])])];
  const criticalSourceIds = [...new Set([...(published.criticalSourceIds ?? []), ...(curated.criticalSourceIds ?? [])])];
  const leadSourceIds = [...new Set([...(published.leadSourceIds ?? []), ...(curated.leadSourceIds ?? [])])];
  const sourceIds = [...new Set([
    ...(published.sourceIds ?? [...(published.supportiveSourceIds ?? []), ...(published.criticalSourceIds ?? []), ...(published.leadSourceIds ?? [])]),
    ...(curated.sourceIds ?? [...(curated.supportiveSourceIds ?? []), ...(curated.criticalSourceIds ?? []), ...(curated.leadSourceIds ?? [])]),
  ])];

  return {
    ...published,
    ...curated,
    title: curated.title ?? published.title,
    thesis: curated.thesis ?? published.thesis,
    explanation: curated.explanation ?? published.explanation,
    meaningSummary: curated.meaningSummary ?? published.meaningSummary,
    meaningEvidence: curated.meaningEvidence?.length ? curated.meaningEvidence : published.meaningEvidence,
    mainPassages: curated.mainPassages?.length ? curated.mainPassages : published.mainPassages,
    relatedPassages: curated.relatedPassages?.length ? curated.relatedPassages : published.relatedPassages,
    supportiveSourceIds,
    criticalSourceIds,
    sourceIds,
    relatedEntrySlugs: [...new Set([...(published.relatedEntrySlugs ?? []), ...(curated.relatedEntrySlugs ?? [])])],
    keywords: [...new Set([...(curated.keywords ?? []), ...(published.keywords ?? [])])],
    sourceCount: sourceIds.length,
    supportiveCount: supportiveSourceIds.length,
    criticalCount: criticalSourceIds.length,
    leadCount: leadSourceIds.length,
    leadSourceIds,
    entryType: "curated",
  };
}

function sortHanjaEntries(entries: HanjaStudyEntry[]) {
  return entries.sort((left, right) => {
    const leftCurated = left.entryType === "curated" ? 0 : 1;
    const rightCurated = right.entryType === "curated" ? 0 : 1;
    if (leftCurated !== rightCurated) return leftCurated - rightCurated;
    const leftCoverage = left.sourceCount ?? left.supportiveSourceIds.length + left.criticalSourceIds.length;
    const rightCoverage = right.sourceCount ?? right.supportiveSourceIds.length + right.criticalSourceIds.length;
    if (leftCoverage !== rightCoverage) return rightCoverage - leftCoverage;
    return left.slug.localeCompare(right.slug);
  });
}

function projectHanjaCatalogListEntry(entry: HanjaStudyEntry): HanjaCatalogListEntry {
  return {
    slug: entry.slug,
    character: entry.character,
    reading: entry.reading,
    title: entry.title,
    thesis: entry.thesis,
    explanation: entry.explanation,
    meaningSummary: entry.meaningSummary,
    mainPassages: entry.mainPassages,
    relatedPassages: entry.relatedPassages,
    supportiveSourceIds: entry.supportiveSourceIds,
    criticalSourceIds: entry.criticalSourceIds,
    keywords: entry.keywords,
    entryType: entry.entryType,
    sourceCount: entry.sourceCount,
  };
}

async function loadRuntimePublishedCatalog() {
  try {
    return await loadJson<HanjaPublishedCatalog>(path.join("data", "hanja", "published-characters.json"));
  } catch {
    return {
      version: 1,
      generatedAt: "",
      stats: { sourceCount: 0, harvestedDocumentCount: 0, characterCount: 0 },
      characters: [],
    } satisfies HanjaPublishedCatalog;
  }
}

export const loadMergedHanjaEntries = cache(async () => {
  const [curatedCatalog, publishedCatalog] = await Promise.all([loadHanjaEntryCatalog(), loadHanjaPublishedCatalog()]);
  const curatedEntries = curatedCatalog.entries.map((entry) => normalizeEntryType(entry, "curated"));
  const publishedEntries = publishedCatalog.characters.map((entry) => normalizeEntryType(entry, entry.entryType ?? "generated"));
  const bySlug = new Map<string, HanjaStudyEntry>(publishedEntries.map((entry) => [entry.slug, entry] as const));

  for (const entry of curatedEntries) {
    bySlug.set(entry.slug, mergeHanjaEntries(entry, bySlug.get(entry.slug)));
  }

  return sortHanjaEntries([...bySlug.values()]);
});

export const loadHanjaCatalogListEntries = cache(async () => {
  const [curatedCatalog, publishedCatalog] = await Promise.all([loadHanjaEntryCatalog(), loadRuntimePublishedCatalog()]);
  const curatedEntries = curatedCatalog.entries.map((entry) => normalizeEntryType(entry, "curated"));
  const publishedEntries = publishedCatalog.characters.map((entry) => normalizeEntryType(entry, entry.entryType ?? "generated"));
  const bySlug = new Map<string, HanjaStudyEntry>(publishedEntries.map((entry) => [entry.slug, entry] as const));

  for (const entry of curatedEntries) {
    bySlug.set(entry.slug, mergeHanjaEntries(entry, bySlug.get(entry.slug)));
  }

  return sortHanjaEntries([...bySlug.values()]).map(projectHanjaCatalogListEntry);
});

export const loadMergedHanjaEntryIndex = cache(async () => {
  const entries = await loadMergedHanjaEntries();
  return new Map(entries.map((entry) => [entry.slug, entry] as const));
});

export const hasHanjaCatalogEntries = cache(async () => {
  const summary = await loadHanjaCatalogSummary();
  return summary.hasEntries;
});

export const getHanjaCatalogEntryCount = cache(async () => {
  const summary = await loadHanjaCatalogSummary();
  return summary.entryCount;
});

async function validateHanjaEntryCatalog(entries: HanjaStudyEntry[]) {
  const sourceCatalog = await loadHanjaSourceCatalog();
  const sourceIds = new Set(sourceCatalog.sources.map((source) => source.id));

  for (const entry of entries) {
    for (const sourceId of new Set([
      ...(entry.sourceIds ?? []),
      ...entry.supportiveSourceIds,
      ...entry.criticalSourceIds,
      ...(entry.leadSourceIds ?? []),
    ])) {
      if (!sourceIds.has(sourceId)) {
        throw new Error(`Unknown Hanja source id referenced by ${entry.slug}: ${sourceId}`);
      }
    }
  }
}

export async function getHanjaSources(options: {
  stance?: HanjaSourceStance;
  catalogRole?: HanjaSourceCatalogRole;
  kind?: HanjaSourceKind;
  tag?: string;
} = {}) {
  const catalog = await loadHanjaSourceCatalog();
  return catalog.sources.filter((source) => {
    if (options.stance && source.stance !== options.stance) return false;
    if (options.catalogRole && source.catalogRole !== options.catalogRole) return false;
    if (options.kind && source.kind !== options.kind) return false;
    if (options.tag && !source.topicTags.includes(options.tag)) return false;
    return true;
  });
}

export async function getHanjaSourceById(sourceId: string) {
  const byId = await loadHanjaSourceIndex();
  return byId.get(sourceId) ?? null;
}

export async function getHanjaEntries() {
  return await loadMergedHanjaEntries();
}

export async function getHanjaCatalogListEntries() {
  return await loadHanjaCatalogListEntries();
}

export async function getHanjaEntryBySlug(slug: string) {
  const bySlug = await loadMergedHanjaEntryIndex();
  return bySlug.get(slug) ?? null;
}

export async function getHanjaPublishedCharacterCount() {
  const summary = await loadHanjaPublishedCatalogSummary();
  return summary.characterCount;
}

export async function getHanjaEntryView(slug: string, locale?: AppLocale | string) {
  const entry = await getHanjaEntryBySlug(slug);
  if (!entry) return null;

  const [bySlug, byId] = await Promise.all([
    loadMergedHanjaEntryIndex(),
    loadHanjaSourceIndex(),
  ]);

  const resolveSources = (sourceIds: string[]) =>
    sourceIds.map((sourceId) => {
      const source = byId.get(sourceId);
      if (!source) {
        throw new Error(`Unknown Hanja source id referenced by ${entry.slug}: ${sourceId}`);
      }
      return source;
    });

  const resolvedMeaningEvidence = (entry.meaningEvidence ?? []).map((item) => {
    const source = byId.get(item.sourceId);
    if (!source) {
      throw new Error(`Unknown Hanja source id referenced by ${entry.slug}: ${item.sourceId}`);
    }
    return {
      ...item,
      source,
    };
  });

  return {
    ...entry,
    locale: resolveAppLocale(locale),
    resolvedTitle: localizeText(entry.title, locale),
    resolvedThesis: localizeText(entry.thesis, locale),
    resolvedExplanation: localizeText(entry.explanation, locale),
    resolvedMeaningSummary: localizeText(entry.meaningSummary ?? {}, locale),
    supportiveSources: resolveSources(entry.supportiveSourceIds),
    criticalSources: resolveSources(entry.criticalSourceIds),
    relatedEntries: entry.relatedEntrySlugs.map((relatedSlug) => bySlug.get(relatedSlug)).filter((value): value is HanjaStudyEntry => Boolean(value)),
    meaningEvidence: resolvedMeaningEvidence,
  };
}
