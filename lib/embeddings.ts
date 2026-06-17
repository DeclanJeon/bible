import { cache } from "react";
import { resolveHermesProviderConfig } from "@/lib/hermes";

export type EmbeddingProviderField = "apiKey" | "baseUrl";

export type EmbeddingProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  ready: boolean;
  missing: EmbeddingProviderField[];
  note: string | null;
  sources: {
    apiKey: string | null;
    baseUrl: string | null;
    model: string;
  };
};

type Candidate = {
  value: string;
  source: string;
};

type CatalogModel = {
  id: string;
  canonicalSlug: string | null;
};

type EmbeddingRequestResult = {
  embedding: number[] | null;
  error: string | null;
};

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const PREFERRED_EMBEDDING_MODELS = [
  "baai/bge-m3",
  "intfloat/multilingual-e5-large",
  "openai/text-embedding-3-small",
  "openai/text-embedding-3-large",
  "sentence-transformers/all-minilm-l6-v2",
  "sentence-transformers/all-mpnet-base-v2",
] as const;

function firstConfigured(candidates: Candidate[]) {
  return candidates.find((candidate) => candidate.value.trim());
}

function describeMissingConfig(missing: EmbeddingProviderField[]) {
  if (!missing.length) {
    return null;
  }

  const labels = missing.map((field) => (field === "apiKey" ? "API key" : "base URL"));
  return `Embeddings provider missing ${labels.join(" and ")}.`;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/$/, "");
}

function extractErrorMessage(status: number, body: string) {
  if (!body.trim()) {
    return `Embeddings request failed with status ${status}.`;
  }

  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string };
      message?: string;
    };
    const message = parsed.error?.message ?? parsed.message;
    if (message) {
      return `Embeddings request failed with status ${status}: ${message}`;
    }
  } catch {
    // Fall through to the raw body snippet.
  }

  const compact = body.replace(/\s+/g, " ").trim().slice(0, 240);
  return `Embeddings request failed with status ${status}: ${compact}`;
}

function looksLikeEmbeddingModel(model: unknown) {
  if (!model || typeof model !== "object") {
    return false;
  }

  const candidate = model as {
    id?: unknown;
    name?: unknown;
    type?: unknown;
    architecture?: {
      modality?: unknown;
      output_modalities?: unknown;
    };
  };

  const outputs = Array.isArray(candidate.architecture?.output_modalities)
    ? candidate.architecture.output_modalities.map((value) => String(value).toLowerCase())
    : [];
  if (outputs.includes("embeddings")) {
    return true;
  }

  const haystack = [
    candidate.id,
    candidate.name,
    candidate.type,
    candidate.architecture?.modality,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

  return /\bembed(?:ding)?s?\b|\bbge\b|\be5\b|\bgte\b|\bnomic\b/.test(haystack);
}

function selectPreferredCatalogModel(models: CatalogModel[]) {
  for (const preferred of PREFERRED_EMBEDDING_MODELS) {
    const match = models.find((model) => model.id === preferred || model.canonicalSlug === preferred);
    if (match) {
      return match;
    }
  }

  return models[0] ?? null;
}

async function discoverCatalogEmbeddingModel(apiKey: string, baseUrl: string): Promise<Candidate | null> {
  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/models`, {
      headers: {
        authorization: `Bearer ${apiKey}`,
      },
    });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      data?: Array<{
        id?: unknown;
        canonical_slug?: unknown;
      }>;
    };

    const candidates = (payload.data ?? [])
      .filter((model) => looksLikeEmbeddingModel(model))
      .map((model) => ({
        id: String(model.id ?? "").trim(),
        canonicalSlug: typeof model.canonical_slug === "string" ? model.canonical_slug.trim() : null,
      }))
      .filter((model) => model.id);

    const selected = selectPreferredCatalogModel(candidates);
    if (!selected) {
      return null;
    }

    return {
      value: selected.id,
      source: `provider-catalog:${selected.id}`,
    };
  } catch {
    return null;
  }
}

async function requestEmbedding(config: Pick<EmbeddingProviderConfig, "apiKey" | "baseUrl" | "model">, input: string) {
  try {
    const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/embeddings`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        input,
      }),
    });

    const body = await response.text();
    if (!response.ok) {
      return {
        embedding: null,
        error: extractErrorMessage(response.status, body),
      } satisfies EmbeddingRequestResult;
    }

    const payload = JSON.parse(body) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const embedding = payload.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || !embedding.every((value) => typeof value === "number")) {
      return {
        embedding: null,
        error: `Embeddings model ${config.model} returned an invalid vector payload.`,
      } satisfies EmbeddingRequestResult;
    }

    return {
      embedding,
      error: null,
    } satisfies EmbeddingRequestResult;
  } catch (error) {
    return {
      embedding: null,
      error: error instanceof Error ? error.message : "Embeddings request failed.",
    } satisfies EmbeddingRequestResult;
  }
}

export const getEmbeddingProviderConfig = cache(async (): Promise<EmbeddingProviderConfig> => {
  const envApiKey = firstConfigured([
    { value: process.env.EMBEDDINGS_API_KEY ?? "", source: "EMBEDDINGS_API_KEY" },
    { value: process.env.OPENAI_API_KEY ?? "", source: "OPENAI_API_KEY" },
    { value: process.env.HERMES_API_KEY ?? "", source: "HERMES_API_KEY" },
  ]);
  const envBaseUrl = firstConfigured([
    { value: process.env.EMBEDDINGS_BASE_URL ?? "", source: "EMBEDDINGS_BASE_URL" },
    { value: process.env.EMBEDDINGS_API_BASE ?? "", source: "EMBEDDINGS_API_BASE" },
    { value: process.env.OPENAI_BASE_URL ?? "", source: "OPENAI_BASE_URL" },
    { value: process.env.OPENAI_API_BASE ?? "", source: "OPENAI_API_BASE" },
    { value: process.env.HERMES_BASE_URL ?? "", source: "HERMES_BASE_URL" },
    { value: process.env.HERMES_API_BASE ?? "", source: "HERMES_API_BASE" },
  ]);
  const envModel = firstConfigured([
    { value: process.env.EMBEDDINGS_MODEL ?? "", source: "EMBEDDINGS_MODEL" },
    { value: process.env.OPENAI_EMBEDDINGS_MODEL ?? "", source: "OPENAI_EMBEDDINGS_MODEL" },
    { value: process.env.HERMES_EMBEDDINGS_MODEL ?? "", source: "HERMES_EMBEDDINGS_MODEL" },
  ]);

  const hermes = !envApiKey || !envBaseUrl ? await resolveHermesProviderConfig() : null;
  const apiKey = envApiKey?.value ?? hermes?.apiKey ?? "";
  const baseUrl = envBaseUrl?.value ?? hermes?.baseUrl ?? "";

  const missing: EmbeddingProviderField[] = [];
  if (!apiKey) {
    missing.push("apiKey");
  }
  if (!baseUrl) {
    missing.push("baseUrl");
  }

  const catalogModel = !envModel && !missing.length ? await discoverCatalogEmbeddingModel(apiKey, baseUrl) : null;
  const model = envModel?.value ?? catalogModel?.value ?? DEFAULT_EMBEDDING_MODEL;
  const note = describeMissingConfig(missing);

  if (note) {
    return {
      apiKey,
      baseUrl,
      model,
      ready: false,
      missing,
      note,
      sources: {
        apiKey: envApiKey?.source ?? hermes?.sources.apiKey ?? null,
        baseUrl: envBaseUrl?.source ?? hermes?.sources.baseUrl ?? null,
        model: envModel?.source ?? catalogModel?.source ?? `fallback:${DEFAULT_EMBEDDING_MODEL}`,
      },
    };
  }

  const probe = await requestEmbedding({ apiKey, baseUrl, model }, "grace and peace");
  return {
    apiKey,
    baseUrl,
    model,
    ready: !!probe.embedding,
    missing,
    note: probe.error,
    sources: {
      apiKey: envApiKey?.source ?? hermes?.sources.apiKey ?? null,
      baseUrl: envBaseUrl?.source ?? hermes?.sources.baseUrl ?? null,
      model: envModel?.source ?? catalogModel?.source ?? `fallback:${DEFAULT_EMBEDDING_MODEL}`,
    },
  };
});

export async function resolveEmbeddingProviderConfig() {
  return getEmbeddingProviderConfig();
}

export async function createEmbedding(input: string): Promise<number[] | null> {
  const config = await getEmbeddingProviderConfig();
  if (!config.ready) {
    return null;
  }

  const result = await requestEmbedding(config, input);
  return result.embedding;
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (!a.length || !b.length || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    aNorm += a[index] * a[index];
    bNorm += b[index] * b[index];
  }

  if (!aNorm || !bNorm) {
    return 0;
  }

  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}
