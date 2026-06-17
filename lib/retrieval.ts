import { loadVerses, type BibleReference, type BibleVerse } from "@/lib/bible";
import { createEmbedding, cosineSimilarity as cosineEmbeddingSimilarity, getEmbeddingProviderConfig } from "@/lib/embeddings";
import { STORY_CLUSTERS, type StoryCluster } from "@/lib/app-data";
import { localizeStoryCluster, resolveAppLocale } from "@/lib/content";

export type RetrievalReason = {
  matchedHints: string[];
  matchedThemes: string[];
  matchedEmotions: string[];
  passageKeywords: string[];
  semanticTerms: string[];
};

export type RetrievalConfidence = "high" | "medium" | "low";

export type RetrievalResult = {
  cluster: StoryCluster;
  score: number;
  laneScore: number;
  passageScore: number;
  semanticScore: number;
  embeddingScore: number;
  retrievalMode: "tfidf" | "embeddings" | "embedding-fallback";
  embeddingModel: string | null;
  reasons: RetrievalReason;
  rationale: string;
  confidence: RetrievalConfidence;
  primaryReference: BibleReference;
  primaryExcerpt: string;
  supportingReferences: BibleReference[];
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
  {
    match: /(천국|하늘나라|하늘|영생|낙원|부활|들림|강림|살아있는|살아 남|산 자|죽은 자|heaven|kingdom|eternal life|paradise|resurrection|alive|rapture)/i,
    terms: "천국 하늘 하늘나라 영생 낙원 부활 변화 강림 살아 남은 자 산 자 죽은 자 공중 주와 함께 올라간 자 들어가지 못 eternal life resurrection alive heaven kingdom paradise",
  },
] as const;

const DOCTRINAL_ROUTING_RULES = [
  {
    match: /(살아있는|살아 남|산 자).*(천국|하늘나라|하늘)|((천국|하늘나라|하늘).*(살아있는|살아 남|산 자))/i,
    primaryReference: { code: "1TH", chapter: 4, startVerse: 15, endVerse: 17 } satisfies BibleReference,
    supportingReferences: [
      { code: "1CO", chapter: 15, startVerse: 51, endVerse: 52 },
      { code: "JOH", chapter: 11, startVerse: 25, endVerse: 26 },
      { code: "JOH", chapter: 3, startVerse: 13, endVerse: 13 },
      { code: "MAT", chapter: 7, startVerse: 21, endVerse: 21 },
    ] satisfies BibleReference[],
    rationaleKo:
      "질문이 ‘살아 있는 사람’과 ‘천국/하늘’을 직접 함께 묻기 때문에, 주 강림 때 살아 남은 자와 죽은 자의 순서를 직접 다루는 데살로니가전서 4:15-17을 우선 본문으로 선택했습니다.",
    rationaleEn:
      "Because the prompt directly combines living persons with heaven, the primary passage is 1 Thessalonians 4:15-17, which directly addresses the order of the living and the dead at the Lord's coming.",
  },
] as const;

const PASSAGE_CONCEPTS = [
  {
    key: "heaven",
    prompt: /(천국|하늘나라|하늘|영생|낙원|heaven|kingdom|eternal life|paradise)/i,
    verse: /(천국|하늘나라|하늘|영생|낙원|하늘에|공중|주와 함께)/i,
  },
  {
    key: "alive",
    prompt: /(살아있는|살아 남|살아서|산 자|alive|living)/i,
    verse: /(살아|남은 자|산 자|살아서|잠잘 것이 아니|변화하리|죽지 아니하리)/i,
  },
  {
    key: "resurrection",
    prompt: /(부활|죽은 자|죽지|변화|들림|강림|resurrection|dead|changed|rapture)/i,
    verse: /(부활|죽은 자|다시 살고|변화하리|끌어올려|강림|일어나고)/i,
  },
  {
    key: "entry",
    prompt: /(못가|들어가|올라가|들어갈|go|enter|ascend)/i,
    verse: /(들어가지 못|들어가리라|올라간 자|영접하게|끌어올려)/i,
  },
] as const;

function expandQuery(input: string) {
  const additions = QUERY_EXPANSIONS.filter((entry) => entry.match.test(input)).map((entry) => entry.terms);
  return additions.length ? `${input} ${additions.join(" ")}` : input;
}

function buildTermFrequency(tokens: string[]) {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function cosineTfIdfSimilarity(promptTf: Map<string, number>, corpusTf: Map<string, number>, idf: Map<string, number>) {
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

type ClusterCorpusEntry = {
  cluster: StoryCluster;
  corpus: string;
  tokens: string[];
  tf: Map<string, number>;
};

type CorporaResult = {
  corpora: ClusterCorpusEntry[];
  idf: Map<string, number>;
};

const corporaCache = new Map<string, CorporaResult>();

async function loadClusterCorpora(locale?: string): Promise<CorporaResult> {
  const appLocale = resolveAppLocale(locale);
  const cached = corporaCache.get(appLocale);
  if (cached) return cached;

  const verses = await loadVerses(appLocale);
  const versesByBook = new Map<string, BibleVerse[]>();
  for (const verse of verses) {
    const list = versesByBook.get(verse.code);
    if (list) list.push(verse);
    else versesByBook.set(verse.code, [verse]);
  }

  const corpora = STORY_CLUSTERS.map((baseCluster) => {
    const cluster = localizeStoryCluster(baseCluster, appLocale);
    const bookVerses = versesByBook.get(cluster.primary.code) ?? [];
    const passageCorpus = bookVerses.map((verse) => verse.text.toLowerCase()).join(" ");
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
  });

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
    return { model: null, vectors: null };
  }

  const config = await getEmbeddingProviderConfig();
  if (!config.ready) {
    return { model: null, vectors: null };
  }

  const { corpora } = await loadClusterCorpora(locale);
  const pairs: Array<readonly [string, number[] | null]> = [];
  for (const { cluster, corpus } of corpora) {
    pairs.push([cluster.slug, await createEmbedding(corpus)] as const);
  }

  const vectors = new Map<string, number[]>();
  for (const [slug, embedding] of pairs) {
    if (embedding) vectors.set(slug, embedding);
  }

  const result = {
    model: vectors.size ? config.model : null,
    vectors: vectors.size ? vectors : null,
  };
  embeddingsCache.set(appLocale, result);
  return result;
}

type PassageCandidate = {
  reference: BibleReference;
  excerpt: string;
  score: number;
  matchedTerms: string[];
  matchedConcepts: string[];
};

function formatPassageReference(reference: BibleReference) {
  const tail =
    reference.startVerse === reference.endVerse
      ? `${reference.chapter}:${reference.startVerse}`
      : `${reference.chapter}:${reference.startVerse}-${reference.endVerse}`;
  return `${reference.code} ${tail}`;
}

function scoreVerse(verse: BibleVerse, promptTokens: string[], expandedPrompt: string) {
  const lowerText = verse.text.toLowerCase();
  const matchedTerms = [...new Set(promptTokens.filter((token) => lowerText.includes(token)))];
  const matchedConcepts = PASSAGE_CONCEPTS.filter((rule) => rule.prompt.test(expandedPrompt) && rule.verse.test(verse.text)).map((rule) => rule.key);

  let score = matchedTerms.length * 2 + matchedConcepts.length * 3;
  if (matchedTerms.length >= 2) score += 2;
  if (matchedConcepts.includes("heaven") && matchedConcepts.includes("alive")) score += 4;
  if (matchedConcepts.includes("alive") && matchedConcepts.includes("resurrection")) score += 3;
  if (matchedConcepts.includes("entry")) score += 2;

  return { score, matchedTerms, matchedConcepts };
}

function buildGlobalPassageCandidate(verses: BibleVerse[], promptTokens: string[], expandedPrompt: string): PassageCandidate | null {
  if (!verses.length) return null;

  const scored = verses.map((verse, index) => ({ index, verse, ...scoreVerse(verse, promptTokens, expandedPrompt) }));
  const best = scored.sort((left, right) => right.score - left.score)[0];
  if (!best || best.score <= 0) return null;

  let start = best.index;
  let end = best.index;
  while (
    start > 0 &&
    scored[start - 1].verse.code === best.verse.code &&
    scored[start - 1].verse.chapter === best.verse.chapter &&
    scored[start - 1].score > 0 &&
    scored[start - 1].verse.verse === scored[start].verse.verse - 1
  ) {
    start -= 1;
  }
  while (
    end < scored.length - 1 &&
    scored[end + 1].verse.code === best.verse.code &&
    scored[end + 1].verse.chapter === best.verse.chapter &&
    scored[end + 1].score > 0 &&
    scored[end + 1].verse.verse === scored[end].verse.verse + 1
  ) {
    end += 1;
  }

  const selected = scored.slice(start, end + 1).map((entry) => entry.verse);
  const totalScore = scored.slice(start, end + 1).reduce((sum, entry) => sum + entry.score, 0);
  const matchedTerms = [...new Set(scored.slice(start, end + 1).flatMap((entry) => entry.matchedTerms))];
  const matchedConcepts = [...new Set(scored.slice(start, end + 1).flatMap((entry) => entry.matchedConcepts))];

  return {
    reference: {
      code: best.verse.code,
      chapter: best.verse.chapter,
      startVerse: selected[0].verse,
      endVerse: selected[selected.length - 1].verse,
    },
    excerpt: selected.map((verse) => `${verse.verse}. ${verse.text}`).join(" "),
    score: totalScore,
    matchedTerms,
    matchedConcepts,
  };
}

function confidenceFor(score: number, passageScore: number, matchedConcepts: number): RetrievalConfidence {
  if (passageScore >= 12 || score >= 28 || matchedConcepts >= 2) return "high";
  if (passageScore >= 5 || score >= 14) return "medium";
  return "low";
}

function buildRuleBasedRetrieval(prompt: string, locale?: string): RetrievalResult | null {
  const appLocale = resolveAppLocale(locale);
  const matchedRule = DOCTRINAL_ROUTING_RULES.find((rule) => rule.match.test(prompt));
  if (!matchedRule) return null;

  const cluster = localizeStoryCluster(
    STORY_CLUSTERS.find((entry) => entry.primary.code === matchedRule.primaryReference.code) ?? STORY_CLUSTERS[0],
    appLocale,
  );

  return {
    cluster,
    score: 72,
    laneScore: 12,
    passageScore: 10,
    semanticScore: 0.75,
    embeddingScore: 0,
    retrievalMode: "tfidf",
    embeddingModel: null,
    reasons: {
      matchedHints: [],
      matchedThemes: ["resurrection", "heaven"],
      matchedEmotions: [],
      passageKeywords: appLocale === "ko" ? ["살아", "남은 자", "공중", "주와 함께"] : ["alive", "remain", "caught up", "with the Lord"],
      semanticTerms: appLocale === "ko" ? ["살아", "천국", "하늘", "죽은 자"] : ["alive", "heaven", "dead"],
    },
    rationale: appLocale === "ko" ? matchedRule.rationaleKo : matchedRule.rationaleEn,
    confidence: "high",
    primaryReference: matchedRule.primaryReference,
    primaryExcerpt: "",
    supportingReferences: matchedRule.supportingReferences,
  };
}

export async function retrieveClusterForPrompt(prompt: string, locale?: string): Promise<RetrievalResult> {
  const appLocale = resolveAppLocale(locale);
  const normalizedPrompt = prompt.trim() || (appLocale === "ko" ? "성경 본문을 문맥과 연결 본문으로 공부" : "study scripture with context and cross references");
  const ruleBased = buildRuleBasedRetrieval(normalizedPrompt, appLocale);
  if (ruleBased) return ruleBased;

  const expandedPrompt = expandQuery(normalizedPrompt);
  const promptTokens = tokenize(expandedPrompt);
  const promptTf = buildTermFrequency(promptTokens);
  const [allVerses, { corpora, idf }, clusterEmbeddings] = await Promise.all([
    loadVerses(appLocale),
    loadClusterCorpora(appLocale),
    loadClusterEmbeddings(appLocale),
  ]);
  const promptEmbedding = clusterEmbeddings.vectors ? await createEmbedding(normalizedPrompt) : null;
  const embeddingEnabled = !!promptEmbedding && !!clusterEmbeddings.vectors && !!clusterEmbeddings.model;
  const bestPassage = buildGlobalPassageCandidate(allVerses, promptTokens, expandedPrompt);

  const scored = corpora.map(({ cluster, corpus, tf }) => {
    const lowerPrompt = expandedPrompt.toLowerCase();
    const matchedHints = cluster.searchHints.filter((hint) => lowerPrompt.includes(hint.toLowerCase()));
    const matchedThemes = cluster.themes.filter((theme) => lowerPrompt.includes(theme.toLowerCase()));
    const matchedEmotions = cluster.emotions.filter((emotion) => lowerPrompt.includes(emotion.toLowerCase()));
    const semanticTerms = [...new Set(promptTokens.filter((token) => tf.has(token)))]
      .sort((a, b) => (idf.get(b) ?? 0) - (idf.get(a) ?? 0))
      .slice(0, 5);

    const semanticScore = cosineTfIdfSimilarity(promptTf, tf, idf);
    const embeddingScore =
      embeddingEnabled && clusterEmbeddings.vectors?.has(cluster.slug)
        ? cosineEmbeddingSimilarity(promptEmbedding, clusterEmbeddings.vectors.get(cluster.slug) ?? [])
        : 0;

    const passageMatch = bestPassage && bestPassage.reference.code === cluster.primary.code ? bestPassage : null;
    const passageKeywords = passageMatch?.matchedTerms.slice(0, 6) ?? [...new Set(promptTokens.filter((token) => corpus.includes(token)))].slice(0, 6);
    const laneScore = matchedHints.length * 3 + matchedThemes.length * 2 + matchedEmotions.length * 2 + semanticScore * 6 + embeddingScore * 10;
    const passageScore = passageMatch?.score ?? 0;
    const score = laneScore + passageScore * 6;
    const confidence = confidenceFor(score, passageScore, passageMatch?.matchedConcepts.length ?? 0);

    const rationaleParts =
      appLocale === "ko"
        ? [
            passageMatch ? `대표 본문: ${formatPassageReference(passageMatch.reference)}` : null,
            passageKeywords.length ? `맞은 본문어: ${passageKeywords.join(", ")}` : null,
            passageMatch?.matchedConcepts.length ? `질문 개념: ${passageMatch.matchedConcepts.join(", ")}` : null,
            semanticTerms.length ? `의미상 핵심어: ${semanticTerms.join(", ")}` : null,
            passageScore ? `본문 점수: ${passageScore.toFixed(2)}` : null,
            semanticScore ? `의미 점수: ${semanticScore.toFixed(3)}` : null,
            embeddingScore ? `임베딩 점수: ${embeddingScore.toFixed(3)}` : null,
          ].filter(Boolean)
        : [
            passageMatch ? `primary passage: ${formatPassageReference(passageMatch.reference)}` : null,
            passageKeywords.length ? `matched passage terms: ${passageKeywords.join(", ")}` : null,
            passageMatch?.matchedConcepts.length ? `query concepts: ${passageMatch.matchedConcepts.join(", ")}` : null,
            semanticTerms.length ? `semantic terms: ${semanticTerms.join(", ")}` : null,
            passageScore ? `passage score: ${passageScore.toFixed(2)}` : null,
            semanticScore ? `semantic score: ${semanticScore.toFixed(3)}` : null,
            embeddingScore ? `embedding score: ${embeddingScore.toFixed(3)}` : null,
          ].filter(Boolean);

    return {
      cluster,
      score,
      laneScore,
      passageScore,
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
      confidence,
      primaryReference: passageMatch?.reference ?? cluster.primary,
      primaryExcerpt: passageMatch?.excerpt ?? "",
      supportingReferences: [],
    } satisfies RetrievalResult;
  });

  scored.sort((a, b) => b.score - a.score);
  return (
    scored[0] ?? {
      cluster: localizeStoryCluster(STORY_CLUSTERS[0], appLocale),
      score: 0,
      laneScore: 0,
      passageScore: 0,
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
      confidence: "low",
      primaryReference: STORY_CLUSTERS[0].primary,
      primaryExcerpt: "",
      supportingReferences: [],
    }
  );
}
