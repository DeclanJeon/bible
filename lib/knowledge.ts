import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { formatBibleReference, getPassage, loadBookMetadata, type BibleReference } from "@/lib/bible";
import { localizeCrossReferenceSupportType, resolveAppLocale } from "@/lib/content";

export type CrossReferenceSupportType = "consensus-link" | "vote-supported" | "phrase-anchor";

export type CrossReferenceSuggestion = {
  target: BibleReference;
  targetLabel: string;
  displayReference: string;
  title: string;
  excerpt: string;
  score: number;
  supportType: CrossReferenceSupportType;
  supportLabel: string;
  supportLine: string;
  sources: string[];
};

type OpenBibleStore = {
  source: { name: string; url: string; license: string; retrievedAt: string };
  stats: { anchors: number; edges: number; skipped: number };
  byVerse: Record<string, Array<{ to: BibleReference; toLabel: string; votes: number; source: string }>>;
};

type PhraseStore = {
  source: { name: string; url: string; license: string; retrievedAt: string };
  stats: { anchors: number; edges: number; skipped: number };
  byVerse: Record<string, Array<{ anchorPhrase: string; to: BibleReference; toLabel: string; source: string }>>;
};

const ROOT = process.cwd();

function verseKey(reference: BibleReference, verse: number) {
  return `${reference.code} ${reference.chapter}:${verse}`;
}

function overlaps(source: BibleReference, target: BibleReference) {
  return (
    source.code === target.code &&
    source.chapter === target.chapter &&
    !(target.endVerse < source.startVerse || target.startVerse > source.endVerse)
  );
}

function classifySupportType(votes: number, phraseAnchors: Set<string>) {
  if (votes > 0 && phraseAnchors.size > 0) {
    return "consensus-link" satisfies CrossReferenceSupportType;
  }

  if (votes > 0) {
    return "vote-supported" satisfies CrossReferenceSupportType;
  }

  return "phrase-anchor" satisfies CrossReferenceSupportType;
}


async function loadJson<T>(relativePath: string): Promise<T | null> {
  const filePath = path.join(ROOT, relativePath);
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const loadOpenBibleStore = cache(async () =>
  loadJson<OpenBibleStore>(path.join("data", "knowledge", "openbible-crossrefs.json")),
);

export const loadPhraseStore = cache(async () =>
  loadJson<PhraseStore>(path.join("data", "knowledge", "crossreferences-kjv.json")),
);

export async function getPassageCrossReferences(reference: BibleReference, limit = 6, locale?: string) {
  const appLocale = resolveAppLocale(locale);
  const [openBibleStore, phraseStore, books] = await Promise.all([
    loadOpenBibleStore(),
    loadPhraseStore(),
    loadBookMetadata(appLocale),
  ]);

  const aggregated = new Map<
    string,
    {
      target: BibleReference;
      votes: number;
      openBibleAnchors: Set<string>;
      phraseAnchors: Set<string>;
      sources: Set<string>;
    }
  >();

  for (let verse = reference.startVerse; verse <= reference.endVerse; verse += 1) {
    const key = verseKey(reference, verse);

    for (const link of openBibleStore?.byVerse[key] ?? []) {
      if (overlaps(reference, link.to)) continue;
      const bucket = aggregated.get(link.toLabel) ?? {
        target: link.to,
        votes: 0,
        openBibleAnchors: new Set<string>(),
        phraseAnchors: new Set<string>(),
        sources: new Set<string>(),
      };
      bucket.votes += link.votes;
      bucket.openBibleAnchors.add(key);
      bucket.sources.add("OpenBible Cross References");
      aggregated.set(link.toLabel, bucket);
    }

    for (const link of phraseStore?.byVerse[key] ?? []) {
      if (overlaps(reference, link.to)) continue;
      const bucket = aggregated.get(link.toLabel) ?? {
        target: link.to,
        votes: 0,
        openBibleAnchors: new Set<string>(),
        phraseAnchors: new Set<string>(),
        sources: new Set<string>(),
      };
      bucket.phraseAnchors.add(link.anchorPhrase);
      bucket.sources.add("Bible Cross References KJV");
      aggregated.set(link.toLabel, bucket);
    }
  }

  const ranked = [...aggregated.entries()]
    .map(([targetLabel, entry]) => ({
      targetLabel,
      entry,
      score: entry.votes + entry.phraseAnchors.size * 12,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return Promise.all(
    ranked.map(async ({ targetLabel, entry, score }) => {
      const passage = await getPassage(entry.target, appLocale);
      const title = passage.book?.name ?? books[entry.target.code]?.name ?? entry.target.code;
      const excerpt = passage.verses.map((verse) => `${verse.verse}. ${verse.text}`).join(" ");
      const parts: string[] = [];
      if (entry.votes > 0) {
        parts.push(appLocale === "ko" ? `OpenBible 투표 ${entry.votes}` : `${entry.votes} OpenBible votes`);
      }
      if (entry.phraseAnchors.size > 0) {
        const phrases = [...entry.phraseAnchors].slice(0, 3).join(", ");
        parts.push(appLocale === "ko" ? `KJV 앵커: ${phrases}` : `KJV anchors: ${phrases}`);
      }
      const supportType = classifySupportType(entry.votes, entry.phraseAnchors);
      return {
        target: entry.target,
        targetLabel: appLocale === "ko" ? formatBibleReference(entry.target, title) : targetLabel,
        displayReference: formatBibleReference(entry.target, title),
        title,
        excerpt: excerpt.length > 200 ? `${excerpt.slice(0, 200)}…` : excerpt,
        score,
        supportType,
        supportLabel: localizeCrossReferenceSupportType(supportType, appLocale),
        supportLine: parts.join(" · "),
        sources: [...entry.sources],
      } satisfies CrossReferenceSuggestion;
    }),
  );
}
