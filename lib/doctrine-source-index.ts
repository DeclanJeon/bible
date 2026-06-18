import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const cache = new Map<string, DoctrineSourceIndex>();

export type DoctrineSourceRecord = {
  id: string;
  tradition: string;
  topic: string;
  category: string;
  title: string;
  titleEn: string;
  source: string;
  sourceEn: string;
  excerpt: string;
  excerptEn: string;
  year?: string;
  provenance: string;
};

export type DoctrineSourceIndex = {
  version: string;
  generatedAt: string;
  traditions: string[];
  topics: string[];
  sources: DoctrineSourceRecord[];
};

export async function loadDoctrineSourceIndex(): Promise<DoctrineSourceIndex> {
  const cached = cache.get("main");
  if (cached) return cached;

  const [indexRaw, sourcesRaw] = await Promise.all([
    readFile(
      path.join(ROOT, "data", "doctrine-sources", "index.json"),
      "utf8",
    ),
    readFile(
      path.join(ROOT, "data", "doctrine-sources", "sources.json"),
      "utf8",
    ),
  ]);

  const meta = JSON.parse(indexRaw) as {
    version: string;
    generatedAt: string;
    traditions: string[];
    topics: string[];
  };
  const sources = JSON.parse(sourcesRaw) as DoctrineSourceRecord[];

  const index: DoctrineSourceIndex = {
    version: meta.version,
    generatedAt: meta.generatedAt,
    traditions: meta.traditions,
    topics: meta.topics,
    sources,
  };

  cache.set("main", index);
  return index;
}

export async function getSourcesByTraditionAndTopic(
  tradition: string,
  topic: string,
): Promise<DoctrineSourceRecord[]> {
  const index = await loadDoctrineSourceIndex();
  return index.sources.filter(
    (s) => s.tradition === tradition && s.topic === topic,
  );
}

export async function getSourcesByTopic(
  topic: string,
): Promise<DoctrineSourceRecord[]> {
  const index = await loadDoctrineSourceIndex();
  return index.sources.filter((s) => s.topic === topic);
}

export async function getSourcesByTradition(
  tradition: string,
): Promise<DoctrineSourceRecord[]> {
  const index = await loadDoctrineSourceIndex();
  return index.sources.filter((s) => s.tradition === tradition);
}

export async function getSupportedTraditions(): Promise<string[]> {
  const index = await loadDoctrineSourceIndex();
  return index.traditions;
}

export async function getSupportedTopics(): Promise<string[]> {
  const index = await loadDoctrineSourceIndex();
  return index.topics;
}
