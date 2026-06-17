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
  { match: /(기다|지치|침묵|조용|응답|delay|wait|silence|tired|unheard)/i, terms: "어느 때까지 잠잠 구원 도우소서 영혼 낙망 소망 wait hope silence help" },
  { match: /(회복|실패|수치|죄책|죄|restore|failure|shame|guilt|repent)/i, terms: "죄악 사하소서 깨끗 정한 마음 회개 긍휼 restore mercy repentance" },
  { match: /(두려|부르심|책임|감당|calling|afraid|fear|responsibility)/i, terms: "두려워 말라 강하고 담대 함께 보내리라 courage presence" },
  { match: /(슬픔|상실|애도|눈물|죽음|grief|loss|mourning|tears|death)/i, terms: "눈물 슬픔 애통 사망 위로 소망 comfort resurrection" },
  { match: /(지혜|인도|결정|혼란|길|wisdom|guidance|decision|confused|path)/i, terms: "지혜 길 가르치소서 명철 인도 wisdom path teach" },
  { match: /(용서|배신|원망|분노|forgive|betray|resent|anger|revenge)/i, terms: "용서 원수 선 악 긍휼 자비 갚지 mercy enemy forgive" },
  { match: /(천국|하늘나라|하늘|영생|낙원|부활|들림|강림|살아있는|살아 남|산 자|죽은 자|heaven|kingdom|eternal life|paradise|resurrection|alive|rapture)/i, terms: "천국 하늘 하늘나라 영생 낙원 부활 변화 강림 살아 남은 자 산 자 죽은 자 공중 주와 함께 올라간 자 들어가지 못 eternal life resurrection alive heaven kingdom paradise" },
] as const;

type RoutingRule = {
  match: RegExp;
  primaryReference: BibleReference;
  supportingReferences: BibleReference[];
  rationaleKo: string;
  rationaleEn: string;
  passageKeywordsKo: string[];
  semanticTermsKo: string[];
};

const DOCTRINAL_ROUTING_RULES: RoutingRule[] = [
  {
    match: /(살아있는|살아 남|산 자).*(천국|하늘나라|하늘)|((천국|하늘나라|하늘).*(살아있는|살아 남|산 자))/i,
    primaryReference: { code: "1TH", chapter: 4, startVerse: 15, endVerse: 17 },
    supportingReferences: [
      { code: "1CO", chapter: 15, startVerse: 51, endVerse: 52 },
      { code: "JOH", chapter: 11, startVerse: 25, endVerse: 26 },
      { code: "JOH", chapter: 3, startVerse: 13, endVerse: 13 },
      { code: "MAT", chapter: 7, startVerse: 21, endVerse: 21 },
    ],
    rationaleKo: "질문이 ‘살아 있는 사람’과 ‘천국/하늘’을 직접 함께 묻기 때문에, 주 강림 때 살아 남은 자와 죽은 자의 순서를 직접 다루는 데살로니가전서 4:15-17을 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt directly combines living persons with heaven, the primary passage is 1 Thessalonians 4:15-17, which directly addresses the order of the living and the dead at the Lord's coming.",
    passageKeywordsKo: ["살아", "남은 자", "공중", "주와 함께"],
    semanticTermsKo: ["살아", "천국", "하늘", "죽은 자"],
  },
  {
    match: /(죽으면|죽은 후|죽고 나면|바로).*(천국|하늘나라|낙원)|((천국|하늘나라|낙원).*(죽으면|죽은 후|바로))/i,
    primaryReference: { code: "LUK", chapter: 23, startVerse: 43, endVerse: 43 },
    supportingReferences: [
      { code: "PHI", chapter: 1, startVerse: 23, endVerse: 23 },
      { code: "2CO", chapter: 5, startVerse: 8, endVerse: 8 },
      { code: "REV", chapter: 6, startVerse: 9, endVerse: 11 },
    ],
    rationaleKo: "질문이 죽은 직후 곧바로 천국/낙원에 가는지를 묻고 있어서, 예수님이 강도에게 ‘오늘 네가 나와 함께 낙원에 있으리라’고 말씀하신 누가복음 23:43을 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt asks about immediately going to heaven after death, the primary passage is Luke 23:43 where Jesus says, 'Today you will be with me in Paradise.'",
    passageKeywordsKo: ["오늘", "낙원", "함께"],
    semanticTermsKo: ["죽으면", "천국", "낙원", "바로"],
  },
  {
    match: /(부활).*(살아있는|살아 남|산 자)|((살아있는|살아 남|산 자).*(부활))|((마지막 날|마지막날|변화).*(살아|남은 자|산 자))/i,
    primaryReference: { code: "1CO", chapter: 15, startVerse: 51, endVerse: 52 },
    supportingReferences: [
      { code: "1TH", chapter: 4, startVerse: 15, endVerse: 17 },
      { code: "PHI", chapter: 3, startVerse: 20, endVerse: 21 },
    ],
    rationaleKo: "질문이 부활 때 살아 있는 사람이 어떻게 되는지를 직접 묻고 있어서, ‘우리가 다 잠잘 것이 아니요 ... 우리도 변화하리라’고 말하는 고린도전서 15:51-52를 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt asks what happens to the living at the resurrection, the primary passage is 1 Corinthians 15:51-52, which directly states that the living will be changed.",
    passageKeywordsKo: ["잠잘", "변화하리", "다시 살고"],
    semanticTermsKo: ["부활", "살아있는", "변화", "죽은 자"],
  },
  {
    match: /(영원히 죽지|영생|예수 믿으면).*(죽지)|((죽지).*(영생|예수 믿으면))/i,
    primaryReference: { code: "JOH", chapter: 11, startVerse: 25, endVerse: 26 },
    supportingReferences: [
      { code: "JOH", chapter: 3, startVerse: 16, endVerse: 16 },
      { code: "JOH", chapter: 5, startVerse: 24, endVerse: 24 },
      { code: "1JO", chapter: 5, startVerse: 11, endVerse: 13 },
    ],
    rationaleKo: "질문이 예수님을 믿는 사람이 영원히 죽지 않는다는 약속을 묻고 있어서, ‘살아서 나를 믿는 자는 영원히 죽지 아니하리니’라고 직접 말하는 요한복음 11:25-26을 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt asks whether believers truly do not die eternally, the primary passage is John 11:25-26, where Jesus directly says the living believer will never die.",
    passageKeywordsKo: ["살아서", "믿는 자", "영원히 죽지"],
    semanticTermsKo: ["영생", "예수", "죽지", "믿으면"],
  },
  {
    match: /(죽어도|죽어).*(다시 살|살 수 있나)|((다시 살|부활).*(죽어도|죽어))/i,
    primaryReference: { code: "JOH", chapter: 11, startVerse: 25, endVerse: 26 },
    supportingReferences: [
      { code: "1CO", chapter: 15, startVerse: 51, endVerse: 52 },
      { code: "1TH", chapter: 4, startVerse: 14, endVerse: 17 },
      { code: "JOH", chapter: 5, startVerse: 24, endVerse: 29 },
    ],
    rationaleKo: "질문이 죽음 이후 다시 사는 소망을 직접 묻고 있어서, ‘나는 부활이요 생명이니 ... 죽어도 살겠고’라고 직접 말하는 요한복음 11:25-26을 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt asks whether one can live again after death, the primary passage is John 11:25-26 where Jesus directly says, 'whoever dies shall live.'",
    passageKeywordsKo: ["죽어도", "살겠고", "부활", "생명"],
    semanticTermsKo: ["죽어도", "다시 살", "부활", "생명"],
  },
  {
    match: /(천국).*(못 들어|들어갈 수 있나|누가 들어가|들어가나)|((구원받은|구원).*(천국|하늘나라))|((천국|하늘나라).*(누가|어떻게).*(들어가))/i,
    primaryReference: { code: "MAT", chapter: 7, startVerse: 21, endVerse: 21 },
    supportingReferences: [
      { code: "MAT", chapter: 25, startVerse: 34, endVerse: 34 },
      { code: "REV", chapter: 21, startVerse: 27, endVerse: 27 },
      { code: "HEB", chapter: 12, startVerse: 14, endVerse: 14 },
    ],
    rationaleKo: "질문이 천국에 실제로 들어가는 기준을 묻고 있어서, ‘천국에 다 들어갈 것이 아니요 ... 아버지의 뜻대로 행하는 자’라고 직접 말하는 마태복음 7:21을 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt asks who actually enters the kingdom, the primary passage is Matthew 7:21, which directly distinguishes profession from doing the Father's will.",
    passageKeywordsKo: ["천국에", "들어갈", "아버지의 뜻"],
    semanticTermsKo: ["천국", "구원", "들어갈", "못"],
  },
  {
    match: /(사랑하는 사람|사람이|가족).*(죽어서|죽었|죽음|슬퍼|잃고)|((죽어서|죽음|슬퍼|잃고).*(사랑하는 사람|사람이|가족))|((슬픈데|슬퍼).*(소망))/i,
    primaryReference: { code: "1TH", chapter: 4, startVerse: 13, endVerse: 18 },
    supportingReferences: [
      { code: "JOH", chapter: 11, startVerse: 25, endVerse: 26 },
      { code: "PSA", chapter: 34, startVerse: 18, endVerse: 18 },
      { code: "REV", chapter: 21, startVerse: 4, endVerse: 4 },
    ],
    rationaleKo: "질문이 사랑하는 사람의 죽음 앞에서 슬픔과 소망을 함께 묻고 있어서, ‘소망 없는 다른 이와 같이 슬퍼하지 않게 하려 함이라’고 직접 말하는 데살로니가전서 4:13-18을 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt combines grief and hope after a loved one's death, the primary passage is 1 Thessalonians 4:13-18, which directly addresses grief with resurrection hope.",
    passageKeywordsKo: ["슬퍼하지", "소망", "죽은 자"],
    semanticTermsKo: ["죽음", "슬퍼", "사랑하는", "소망"],
  },
  {
    match: /(침묵|응답이 없|응답이 없으|기도해도|잠잠|응답).*(하나님)|((하나님).*(침묵|기도해도|잠잠|응답))/i,
    primaryReference: { code: "PSA", chapter: 13, startVerse: 1, endVerse: 2 },
    supportingReferences: [
      { code: "HAB", chapter: 1, startVerse: 2, endVerse: 3 },
      { code: "LAM", chapter: 3, startVerse: 25, endVerse: 26 },
      { code: "PSA", chapter: 42, startVerse: 5, endVerse: 5 },
    ],
    rationaleKo: "질문이 하나님의 침묵과 지연된 응답을 묻고 있어서, ‘어느 때까지니이까’로 시작하는 시편 13:1-2를 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt asks about God's silence, the primary passage is Psalm 13:1-2, which directly voices, 'How long, O Lord?'",
    passageKeywordsKo: ["어느 때까지", "잊으시나이까", "근심"],
    semanticTermsKo: ["침묵", "기도", "하나님", "응답"],
  },
  {
    match: /(죄책감|내 죄|용서하셨|못 가겠어|정죄).*(하나님)|((하나님).*(죄책감|용서하셨|정죄))/i,
    primaryReference: { code: "1JO", chapter: 1, startVerse: 9, endVerse: 9 },
    supportingReferences: [
      { code: "ROM", chapter: 8, startVerse: 1, endVerse: 1 },
      { code: "PSA", chapter: 103, startVerse: 10, endVerse: 12 },
      { code: "PSA", chapter: 51, startVerse: 10, endVerse: 12 },
    ],
    rationaleKo: "질문이 죄책감과 실제 용서를 묻고 있어서, ‘우리 죄를 자백하면 ... 깨끗케 하실 것이요’라고 직접 말하는 요한일서 1:9를 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt asks whether God has truly forgiven sin, the primary passage is 1 John 1:9, which directly promises forgiveness and cleansing to the one who confesses.",
    passageKeywordsKo: ["죄를 자백", "용서", "깨끗케"],
    semanticTermsKo: ["죄책감", "용서", "죄", "정죄"],
  },
  {
    match: /(부르심|부르시는|두렵|두려워|미래|감당).*(모르겠|무섭|맞는지)|((모르겠|무섭|맞는지).*(부르심|부르시는|두렵|미래))/i,
    primaryReference: { code: "JOS", chapter: 1, startVerse: 9, endVerse: 9 },
    supportingReferences: [
      { code: "EXO", chapter: 3, startVerse: 11, endVerse: 12 },
      { code: "ISA", chapter: 41, startVerse: 10, endVerse: 10 },
      { code: "JDG", chapter: 6, startVerse: 14, endVerse: 16 },
    ],
    rationaleKo: "질문이 부르심 앞의 두려움과 미래를 묻고 있어서, ‘두려워 말라 ... 네 하나님 여호와가 함께 하느니라’고 직접 말하는 여호수아 1:9를 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt asks about fear and calling, the primary passage is Joshua 1:9, which directly joins courage with God's presence.",
    passageKeywordsKo: ["두려워 말라", "강하고 담대", "함께"],
    semanticTermsKo: ["두렵", "부르심", "미래", "감당"],
  },
  {
    match: /(지혜|결정|혼란|분별|인도).*(싶|필요)|((싶|필요).*(지혜|결정|혼란))/i,
    primaryReference: { code: "JAM", chapter: 1, startVerse: 5, endVerse: 5 },
    supportingReferences: [
      { code: "PRO", chapter: 3, startVerse: 5, endVerse: 6 },
      { code: "PSA", chapter: 25, startVerse: 4, endVerse: 5 },
      { code: "COL", chapter: 1, startVerse: 9, endVerse: 10 },
    ],
    rationaleKo: "질문이 지혜와 결정을 묻고 있어서, ‘너희 중에 누구든지 지혜가 부족하거든 ... 하나님께 구하라’고 직접 말하는 야고보서 1:5를 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt asks for wisdom in decision-making, the primary passage is James 1:5, which directly calls the person lacking wisdom to ask God.",
    passageKeywordsKo: ["지혜가 부족", "구하라"],
    semanticTermsKo: ["지혜", "결정", "혼란", "인도"],
  },
  {
    match: /(용서하기|용서하는|배신한|원수|분노|원망).*(힘들|어려)|((힘들|어려).*(용서|배신))/i,
    primaryReference: { code: "MAT", chapter: 18, startVerse: 21, endVerse: 22 },
    supportingReferences: [
      { code: "EPH", chapter: 4, startVerse: 31, endVerse: 32 },
      { code: "ROM", chapter: 12, startVerse: 19, endVerse: 21 },
      { code: "COL", chapter: 3, startVerse: 12, endVerse: 13 },
    ],
    rationaleKo: "질문이 배신한 사람을 용서하기 어려운 상황을 묻고 있어서, ‘일곱 번뿐 아니라 일흔 번씩 일곱 번이라도 할찌니라’고 직접 말하는 마태복음 18:21-22를 우선 본문으로 선택했습니다.",
    rationaleEn: "Because the prompt asks about the difficulty of forgiving betrayal, the primary passage is Matthew 18:21-22, where Jesus directly answers how often to forgive.",
    passageKeywordsKo: ["용서하여", "일흔 번씩 일곱 번"],
    semanticTermsKo: ["용서", "배신", "원수", "분노"],
  },
];

const PASSAGE_CONCEPTS = [
  { key: "heaven", prompt: /(천국|하늘나라|하늘|영생|낙원|heaven|kingdom|eternal life|paradise)/i, verse: /(천국|하늘나라|하늘|영생|낙원|하늘에|공중|주와 함께)/i },
  { key: "alive", prompt: /(살아있는|살아 남|살아서|산 자|alive|living)/i, verse: /(살아|남은 자|산 자|살아서|잠잘 것이 아니|변화하리|죽지 아니하리)/i },
  { key: "resurrection", prompt: /(부활|죽은 자|죽지|변화|들림|강림|resurrection|dead|changed|rapture)/i, verse: /(부활|죽은 자|다시 살고|변화하리|끌어올려|강림|일어나고)/i },
  { key: "entry", prompt: /(못가|들어가|올라가|들어갈|go|enter|ascend)/i, verse: /(들어가지 못|들어가리라|올라간 자|영접하게|끌어올려)/i },
] as const;

function expandQuery(input: string) {
  const additions = QUERY_EXPANSIONS.filter((entry) => entry.match.test(input)).map((entry) => entry.terms);
  return additions.length ? `${input} ${additions.join(" ")}` : input;
}

function buildTermFrequency(tokens: string[]) {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
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
  if (!promptNorm || !corpusNorm) return 0;
  return dot / (Math.sqrt(promptNorm) * Math.sqrt(corpusNorm));
}

type ClusterCorpusEntry = { cluster: StoryCluster; corpus: string; tokens: string[]; tf: Map<string, number> };
type CorporaResult = { corpora: ClusterCorpusEntry[]; idf: Map<string, number> };
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
    const descriptorCorpus = [cluster.title, cluster.pastoralPrompt, cluster.starterPrompt, cluster.searchHints.join(" "), cluster.themes.join(" "), cluster.emotions.join(" ")].join(" ").toLowerCase();
    const corpus = `${descriptorCorpus} ${passageCorpus}`.trim();
    const tokens = tokenize(corpus);
    const tf = buildTermFrequency(tokens);
    return { cluster, corpus, tokens, tf };
  });
  const documentFrequency = new Map<string, number>();
  for (const entry of corpora) for (const term of new Set(entry.tokens)) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  const idf = new Map<string, number>();
  const totalDocs = corpora.length;
  for (const [term, df] of documentFrequency.entries()) idf.set(term, Math.log((1 + totalDocs) / (1 + df)) + 1);
  const result = { corpora, idf };
  corporaCache.set(appLocale, result);
  return result;
}

type EmbeddingsResult = { model: string | null; vectors: Map<string, number[]> | null };
const embeddingsCache = new Map<string, EmbeddingsResult>();

async function loadClusterEmbeddings(locale?: string): Promise<EmbeddingsResult> {
  const appLocale = resolveAppLocale(locale);
  const cached = embeddingsCache.get(appLocale);
  if (cached) return cached;
  if (!ENABLE_RUNTIME_CLUSTER_EMBEDDINGS) return { model: null, vectors: null };
  const config = await getEmbeddingProviderConfig();
  if (!config.ready) return { model: null, vectors: null };
  const { corpora } = await loadClusterCorpora(locale);
  const pairs: Array<readonly [string, number[] | null]> = [];
  for (const { cluster, corpus } of corpora) pairs.push([cluster.slug, await createEmbedding(corpus)] as const);
  const vectors = new Map<string, number[]>();
  for (const [slug, embedding] of pairs) if (embedding) vectors.set(slug, embedding);
  const result = { model: vectors.size ? config.model : null, vectors: vectors.size ? vectors : null };
  embeddingsCache.set(appLocale, result);
  return result;
}

type PassageCandidate = { reference: BibleReference; excerpt: string; score: number; matchedTerms: string[]; matchedConcepts: string[] };

function formatPassageReference(reference: BibleReference) {
  const tail = reference.startVerse === reference.endVerse ? `${reference.chapter}:${reference.startVerse}` : `${reference.chapter}:${reference.startVerse}-${reference.endVerse}`;
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
  while (start > 0 && scored[start - 1].verse.code === best.verse.code && scored[start - 1].verse.chapter === best.verse.chapter && scored[start - 1].score > 0 && scored[start - 1].verse.verse === scored[start].verse.verse - 1) start -= 1;
  while (end < scored.length - 1 && scored[end + 1].verse.code === best.verse.code && scored[end + 1].verse.chapter === best.verse.chapter && scored[end + 1].score > 0 && scored[end + 1].verse.verse === scored[end].verse.verse + 1) end += 1;
  const selected = scored.slice(start, end + 1).map((entry) => entry.verse);
  const totalScore = scored.slice(start, end + 1).reduce((sum, entry) => sum + entry.score, 0);
  const matchedTerms = [...new Set(scored.slice(start, end + 1).flatMap((entry) => entry.matchedTerms))];
  const matchedConcepts = [...new Set(scored.slice(start, end + 1).flatMap((entry) => entry.matchedConcepts))];
  return {
    reference: { code: best.verse.code, chapter: best.verse.chapter, startVerse: selected[0].verse, endVerse: selected[selected.length - 1].verse },
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
  const cluster = localizeStoryCluster(STORY_CLUSTERS.find((entry) => entry.primary.code === matchedRule.primaryReference.code) ?? STORY_CLUSTERS[0], appLocale);
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
      matchedThemes: [],
      matchedEmotions: [],
      passageKeywords: [...matchedRule.passageKeywordsKo],
      semanticTerms: [...matchedRule.semanticTermsKo],
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
  const [allVerses, { corpora, idf }, clusterEmbeddings] = await Promise.all([loadVerses(appLocale), loadClusterCorpora(appLocale), loadClusterEmbeddings(appLocale)]);
  const promptEmbedding = clusterEmbeddings.vectors ? await createEmbedding(normalizedPrompt) : null;
  const embeddingEnabled = !!promptEmbedding && !!clusterEmbeddings.vectors && !!clusterEmbeddings.model;
  const bestPassage = buildGlobalPassageCandidate(allVerses, promptTokens, expandedPrompt);

  const scored = corpora.map(({ cluster, corpus, tf }) => {
    const lowerPrompt = expandedPrompt.toLowerCase();
    const matchedHints = cluster.searchHints.filter((hint) => lowerPrompt.includes(hint.toLowerCase()));
    const matchedThemes = cluster.themes.filter((theme) => lowerPrompt.includes(theme.toLowerCase()));
    const matchedEmotions = cluster.emotions.filter((emotion) => lowerPrompt.includes(emotion.toLowerCase()));
    const semanticTerms = [...new Set(promptTokens.filter((token) => tf.has(token)))].sort((a, b) => (idf.get(b) ?? 0) - (idf.get(a) ?? 0)).slice(0, 5);
    const semanticScore = cosineTfIdfSimilarity(promptTf, tf, idf);
    const embeddingScore = embeddingEnabled && clusterEmbeddings.vectors?.has(cluster.slug) ? cosineEmbeddingSimilarity(promptEmbedding, clusterEmbeddings.vectors.get(cluster.slug) ?? []) : 0;
    const passageMatch = bestPassage && bestPassage.reference.code === cluster.primary.code ? bestPassage : null;
    const passageKeywords = passageMatch?.matchedTerms.slice(0, 6) ?? [...new Set(promptTokens.filter((token) => corpus.includes(token)))].slice(0, 6);
    const laneScore = matchedHints.length * 3 + matchedThemes.length * 2 + matchedEmotions.length * 2 + semanticScore * 6 + embeddingScore * 10;
    const passageScore = passageMatch?.score ?? 0;
    const score = laneScore + passageScore * 6;
    const confidence = confidenceFor(score, passageScore, passageMatch?.matchedConcepts.length ?? 0);
    const rationaleParts = appLocale === "ko"
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
      reasons: { matchedHints, matchedThemes, matchedEmotions, passageKeywords, semanticTerms },
      rationale: rationaleParts.join(" · ") || (appLocale === "ko" ? "66권 성경 코퍼스 기본 매칭" : "66-book corpus baseline match"),
      confidence,
      primaryReference: passageMatch?.reference ?? cluster.primary,
      primaryExcerpt: passageMatch?.excerpt ?? "",
      supportingReferences: [],
    } satisfies RetrievalResult;
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0] ?? {
    cluster: localizeStoryCluster(STORY_CLUSTERS[0], appLocale),
    score: 0,
    laneScore: 0,
    passageScore: 0,
    semanticScore: 0,
    embeddingScore: 0,
    retrievalMode: "tfidf",
    embeddingModel: null,
    reasons: { matchedHints: [], matchedThemes: [], matchedEmotions: [], passageKeywords: [], semanticTerms: [] },
    rationale: appLocale === "ko" ? "66권 성경 코퍼스 기본 매칭" : "66-book corpus baseline match",
    confidence: "low",
    primaryReference: STORY_CLUSTERS[0].primary,
    primaryExcerpt: "",
    supportingReferences: [],
  };
}
