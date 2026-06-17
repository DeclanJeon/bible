import { createEmbedding, cosineSimilarity as cosineEmbeddingSimilarity, getEmbeddingProviderConfig } from "@/lib/embeddings";
import { loadVerses } from "@/lib/bible";
import { STORY_CLUSTERS, type StoryCluster } from "@/lib/app-data";
import { localizeStoryCluster, resolveAppLocale } from "@/lib/content";

export type RetrievalReason = {
  matchedHints: string[];
  matchedThemes: string[];
  matchedEmotions: string[];
  passageKeywords: string[];
  semanticTerms: string[];
};

export type RetrievalResult = {
  cluster: StoryCluster;
  score: number;
  semanticScore: number;
  embeddingScore: number;
  retrievalMode: "tfidf" | "embeddings" | "embedding-fallback";
  embeddingModel: string | null;
  reasons: RetrievalReason;
  rationale: string;
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "that",
  "with",
  "have",
  "this",
  "from",
  "your",
  "about",
  "feel",
  "feels",
  "again",
  "into",
  "keep",
  "very",
  "just",
  "what",
  "when",
  "where",
  "them",
  "they",
  "dont",
  "cant",
  "wont",
  "after",
  "before",
  "know",
  "still",
  "front",
  "not",
  "how",
  "does",
  "doing",
]);

const ENABLE_RUNTIME_CLUSTER_EMBEDDINGS = process.env.ENABLE_RUNTIME_CLUSTER_EMBEDDINGS === "1";

function tokenize(input: string) {
  return (input.toLowerCase().match(/[a-z]+|[가-힣]+/g) ?? []).filter((token) => {
    if (/^[a-z]+$/.test(token)) {
      return token.length > 2 && !STOP_WORDS.has(token);
    }

    return token.length > 1;
  });
}
const QUERY_EXPANSIONS = [
  {
    match: /(기다|지치|침묵|조용|응답|delay|wait|silence|tired|unheard)/i,
    terms: "어느 때까지 잠잠 구원 도우소서 영혼 낙망 소망 wait hope silence help",
  },
  {
    match: /(회복|실패|수치|죄책|죄|restore|failure|shame|guilt|repent)/i,
    terms: "죄악 사하소서 깨끗 정한 마음 회개 긍휼 restore mercy repentance",
  },
  {
    match: /(두려|부르심|책임|감당|calling|afraid|fear|responsibility)/i,
    terms: "두려워 말라 강하고 담대 함께 보내리라 courage presence",
  },
  {
    match: /(슬픔|상실|애도|눈물|죽음|grief|loss|mourning|tears|death)/i,
    terms: "눈물 슬픔 애통 사망 위로 소망 comfort resurrection",
  },
  {
    match: /(지혜|인도|결정|혼란|길|wisdom|guidance|decision|confused|path)/i,
    terms: "지혜 길 가르치소서 명철 인도 wisdom path teach",
  },
  {
    match: /(용서|배신|원망|분노|forgive|betray|resent|anger|revenge)/i,
    terms: "용서 원수 선 악 긍휼 자비 갚지 mercy enemy forgive",
  },
];

function expandQuery(input: string) {
  const additions = QUERY_EXPANSIONS
    .filter((entry) => entry.match.test(input))
    .map((entry) => entry.terms);

  return additions.length ? `${input} ${additions.join(" ")}` : input;
}


function buildTermFrequency(tokens: string[]) {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function cosineTfIdfSimilarity(
  promptTf: Map<string, number>,
  corpusTf: Map<string, number>,
  idf: Map<string, number>,
) {
  const terms = new Set([...promptTf.keys(), ...corpusTf.keys()]);
  let dot = 0;
  let promptNorm = 0;
  let corpusNorm = 0;

  for (const term of terms) {
    const weight = idf.get(term) ?? 0;
    const promptWeight = (promptTf.get(term) ?? 0) * weight;
    const corpusWeight = (corpusTf.get(term) ?? 0) * weight;
    dot += promptWeight * corpusWeight;
    promptNorm += promptWeight * promptWeight;
    corpusNorm += corpusWeight * corpusWeight;
  }

  if (!promptNorm || !corpusNorm) {
    return 0;
  }

  return dot / (Math.sqrt(promptNorm) * Math.sqrt(corpusNorm));
}

type CorporaResult = {
  corpora: Array<{ cluster: StoryCluster; corpus: string; tokens: string[]; tf: Map<string, number> }>;
  idf: Map<string, number>;
};

const corporaCache = new Map<string, CorporaResult>();

async function loadClusterCorpora(locale?: string): Promise<CorporaResult> {
  const appLocale = resolveAppLocale(locale);
  const cached = corporaCache.get(appLocale);
  if (cached) return cached;

  const verses = await loadVerses(appLocale);
  const corpora = await Promise.all(
    STORY_CLUSTERS.map(async (baseCluster) => {
      const cluster = localizeStoryCluster(baseCluster, appLocale);
      const passageCorpus = verses
        .filter((verse) => verse.code === cluster.primary.code)
        .map((verse) => verse.text.toLowerCase())
        .join(" ");
      const descriptorCorpus = [
        cluster.title,
        cluster.pastoralPrompt,
        cluster.starterPrompt,
        cluster.searchHints.join(" "),
        cluster.themes.join(" "),
        cluster.emotions.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      const corpus = `${descriptorCorpus} ${passageCorpus}`.trim();
      const tokens = tokenize(corpus);
      const tf = buildTermFrequency(tokens);

      return { cluster, corpus, tokens, tf };
    }),
  );

  const documentFrequency = new Map<string, number>();
  for (const entry of corpora) {
    for (const term of new Set(entry.tokens)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  const totalDocs = corpora.length;
  for (const [term, df] of documentFrequency.entries()) {
    idf.set(term, Math.log((1 + totalDocs) / (1 + df)) + 1);
  }

  const result = { corpora, idf };
  corporaCache.set(appLocale, result);
  return result;
}


type EmbeddingsResult = {
  model: string | null;
  vectors: Map<string, number[]> | null;
};

const embeddingsCache = new Map<string, EmbeddingsResult>();

async function loadClusterEmbeddings(locale?: string): Promise<EmbeddingsResult> {
  const appLocale = resolveAppLocale(locale);
  const cached = embeddingsCache.get(appLocale);
  if (cached) return cached;

  if (!ENABLE_RUNTIME_CLUSTER_EMBEDDINGS) {
    return { model: null, vectors: null as Map<string, number[]> | null };
  }

  const config = await getEmbeddingProviderConfig();
  if (!config.ready) {
    return { model: null, vectors: null as Map<string, number[]> | null };
  }

  const { corpora } = await loadClusterCorpora(locale);
  const pairs: Array<readonly [string, number[] | null]> = [];
  for (const { cluster, corpus } of corpora) {
    pairs.push([cluster.slug, await createEmbedding(corpus)] as const);
  }

  const vectors = new Map<string, number[]>();
  for (const [slug, embedding] of pairs) {
    if (embedding) {
      vectors.set(slug, embedding);
    }
  }

  const result = {
    model: vectors.size ? config.model : null,
    vectors: vectors.size ? vectors : null,
  };
  embeddingsCache.set(appLocale, result);
  return result;
}


export async function retrieveClusterForPrompt(prompt: string, locale?: string): Promise<RetrievalResult> {
  const appLocale = resolveAppLocale(locale);
  const normalizedPrompt = prompt.trim() || (appLocale === "ko" ? "성경 본문을 문맥과 연결 본문으로 공부" : "study scripture with context and cross references");
  const expandedPrompt = expandQuery(normalizedPrompt);
  const promptTokens = tokenize(expandedPrompt);
  const promptTf = buildTermFrequency(promptTokens);
  const [{ corpora, idf }, clusterEmbeddings] = await Promise.all([
    loadClusterCorpora(appLocale),
    loadClusterEmbeddings(appLocale),
  ]);
  const promptEmbedding = clusterEmbeddings.vectors ? await createEmbedding(normalizedPrompt) : null;

  const embeddingEnabled = !!promptEmbedding && !!clusterEmbeddings.vectors && !!clusterEmbeddings.model;

  const scored = corpora.map(({ cluster, corpus, tf }) => {
    const lowerPrompt = expandedPrompt.toLowerCase();
    const matchedHints = cluster.searchHints.filter((hint) => lowerPrompt.includes(hint.toLowerCase()));
    const matchedThemes = cluster.themes.filter((theme) => lowerPrompt.includes(theme.toLowerCase()));
    const matchedEmotions = cluster.emotions.filter((emotion) => lowerPrompt.includes(emotion.toLowerCase()));
    const passageKeywords = [...new Set(promptTokens.filter((token) => corpus.includes(token)))].slice(0, 6);

    const semanticTerms = [...new Set(promptTokens.filter((token) => tf.has(token)))]
      .sort((a, b) => (idf.get(b) ?? 0) - (idf.get(a) ?? 0))
      .slice(0, 5);

    const semanticScore = cosineTfIdfSimilarity(promptTf, tf, idf);
    const embeddingScore =
      embeddingEnabled && clusterEmbeddings.vectors?.has(cluster.slug)
        ? cosineEmbeddingSimilarity(promptEmbedding, clusterEmbeddings.vectors.get(cluster.slug) ?? [])
        : 0;

    const score =
      matchedHints.length * 3 +
      matchedThemes.length * 2 +
      matchedEmotions.length * 2 +
      passageKeywords.length * 1.25 +
      semanticScore * 8 +
      embeddingScore * 14;

    const rationaleParts =
      appLocale === "ko"
        ? [
            matchedHints.length ? `일치한 힌트: ${matchedHints.join(", ")}` : null,
            matchedThemes.length ? `주제: ${matchedThemes.join(", ")}` : null,
            matchedEmotions.length ? `감정: ${matchedEmotions.join(", ")}` : null,
            passageKeywords.length ? `본문 키워드: ${passageKeywords.join(", ")}` : null,
            semanticTerms.length ? `의미상 핵심어: ${semanticTerms.join(", ")}` : null,
            semanticScore ? `의미 점수: ${semanticScore.toFixed(3)}` : null,
            embeddingScore ? `임베딩 점수: ${embeddingScore.toFixed(3)}` : null,
            embeddingEnabled ? `임베딩 모델: ${clusterEmbeddings.model}` : null,
          ].filter(Boolean)
        : [
            matchedHints.length ? `matched hints: ${matchedHints.join(", ")}` : null,
            matchedThemes.length ? `themes: ${matchedThemes.join(", ")}` : null,
            matchedEmotions.length ? `emotions: ${matchedEmotions.join(", ")}` : null,
            passageKeywords.length ? `passage keywords: ${passageKeywords.join(", ")}` : null,
            semanticTerms.length ? `semantic terms: ${semanticTerms.join(", ")}` : null,
            semanticScore ? `semantic score: ${semanticScore.toFixed(3)}` : null,
            embeddingScore ? `embedding score: ${embeddingScore.toFixed(3)}` : null,
            embeddingEnabled ? `embedding model: ${clusterEmbeddings.model}` : null,
          ].filter(Boolean);

    return {
      cluster,
      score,
      semanticScore,
      embeddingScore,
      retrievalMode: embeddingEnabled ? "embeddings" : clusterEmbeddings.model ? "embedding-fallback" : "tfidf",
      embeddingModel: clusterEmbeddings.model,
      reasons: {
        matchedHints,
        matchedThemes,
        matchedEmotions,
        passageKeywords,
        semanticTerms,
      },
      rationale: rationaleParts.join(" · ") || (appLocale === "ko" ? "66권 성경 코퍼스 기본 매칭" : "66-book corpus baseline match"),
    } satisfies RetrievalResult;
  });

  scored.sort((a, b) => b.score - a.score);
  return (
    scored[0] ?? {
      cluster: localizeStoryCluster(STORY_CLUSTERS[0], appLocale),
      score: 0,
      semanticScore: 0,
      embeddingScore: 0,
      retrievalMode: "tfidf",
      embeddingModel: null,
      reasons: {
        matchedHints: [],
        matchedThemes: [],
        matchedEmotions: [],
        passageKeywords: [],
        semanticTerms: [],
      },
      rationale: appLocale === "ko" ? "66권 성경 코퍼스 기본 매칭" : "66-book corpus baseline match",
    }
  );
}
