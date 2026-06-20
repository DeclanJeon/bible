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

export type HanjaStudyEntry = {
  slug: string;
  character: string;
  reading: string;
  title: LocalizedHanjaText;
  thesis: LocalizedHanjaText;
  explanation: LocalizedHanjaText;
  mainPassages: BibleReference[];
  relatedPassages: BibleReference[];
  supportiveSourceIds: string[];
  criticalSourceIds: string[];
  relatedEntrySlugs: string[];
  keywords: string[];
};

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

export const hasHanjaCatalogEntries = cache(async () => {
  try {
    const catalog = await loadJson<HanjaEntryCatalog>(path.join("data", "hanja", "entries.json"));
    return Array.isArray(catalog.entries) && catalog.entries.length > 0;
  } catch {
    return false;
  }
});

export const getHanjaCatalogEntryCount = cache(async () => {
  try {
    const catalog = await loadJson<HanjaEntryCatalog>(path.join("data", "hanja", "entries.json"));
    return Array.isArray(catalog.entries) ? catalog.entries.length : 0;
  } catch {
    return 0;
  }
});

async function validateHanjaEntryCatalog(entries: HanjaStudyEntry[]) {
  const sourceCatalog = await loadHanjaSourceCatalog();
  const sourceIds = new Set(sourceCatalog.sources.map((source) => source.id));

  for (const entry of entries) {
    for (const sourceId of [...entry.supportiveSourceIds, ...entry.criticalSourceIds]) {
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
  const catalog = await loadHanjaSourceCatalog();
  return catalog.sources.find((source) => source.id === sourceId) ?? null;
}

export async function getHanjaEntries() {
  const catalog = await loadHanjaEntryCatalog();
  return catalog.entries;
}

export async function getHanjaEntryBySlug(slug: string) {
  const entries = await getHanjaEntries();
  return entries.find((entry) => entry.slug === slug) ?? null;
}

export async function getHanjaEntryView(slug: string, locale?: AppLocale | string) {
  const entry = await getHanjaEntryBySlug(slug);
  if (!entry) return null;

  const sources = await loadHanjaSourceCatalog();
  const byId = new Map(sources.sources.map((source) => [source.id, source]));

  const resolveSources = (sourceIds: string[]) =>
    sourceIds.map((sourceId) => {
      const source = byId.get(sourceId);
      if (!source) {
        throw new Error(`Unknown Hanja source id referenced by ${entry.slug}: ${sourceId}`);
      }
      return source;
    });

  return {
    ...entry,
    locale: resolveAppLocale(locale),
    resolvedTitle: localizeText(entry.title, locale),
    resolvedThesis: localizeText(entry.thesis, locale),
    resolvedExplanation: localizeText(entry.explanation, locale),
    supportiveSources: resolveSources(entry.supportiveSourceIds),
    criticalSources: resolveSources(entry.criticalSourceIds),
  };
}
