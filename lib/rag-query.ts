import { resolveHermesProviderConfig, runHermesAgentOneshot } from "@/lib/hermes";
import { resolveAppLocale, type AppLocale } from "@/lib/content";

export type RagQueryPlan = {
  expansionTerms: string[];
  expansionSummary: string | null;
  expansionProvider: "deterministic" | "hermes" | "hermes-agent" | "hermes-fallback";
  expansionModel: string;
  expansionNote: string;
};

type RagQueryShape = {
  intentSummary?: unknown;
  searchTerms?: unknown;
};

const MAX_TERMS = 18;

function cleanTerms(value: unknown) {
  if (!Array.isArray(value)) return [];
  const terms: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const term = item.trim();
    if (term.length < 2 || term.length > 40) continue;
    if (!terms.includes(term)) terms.push(term);
    if (terms.length >= MAX_TERMS) break;
  }
  return terms;
}

function extractJson(text: string): RagQueryShape | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as RagQueryShape;
  } catch {
    return null;
  }
}

type DeterministicIntentProfile = {
  match: RegExp;
  ko: { summary: string; terms: string[] };
  en: { summary: string; terms: string[] };
};

const DETERMINISTIC_INTENT_PROFILES: DeterministicIntentProfile[] = [
  {
    match: /((삶|사는|살아야|살\s?이유|왜\s?살).*(지치|지쳤|지쳐|지친|무기력|힘들|피곤))|((지치|지쳤|지쳐|지친|무기력|힘들|피곤).*(삶|살아야|살\s?이유|왜\s?살|모르겠))|(weary|tired|exhausted).*(reason to live|why live|purpose)/i,
    ko: {
      summary: "지침과 삶의 이유를 함께 묻는 절망/목적 질문",
      terms: ["수고", "무거운 짐", "쉬게 하리라", "피곤", "능력", "낙망", "소망", "인자", "지으심", "선한 일", "하나님의 형상", "생명"],
    },
    en: {
      summary: "weariness with purpose and reason-to-live concern",
      terms: ["weary", "burden", "rest", "faint", "strength", "hope", "steadfast love", "created", "workmanship", "image of God", "life"],
    },
  },
  {
    match: /(희망이\s?없|아무\s?희망|버티기\s?힘들|더는\s?못\s?버티|왜\s?버텨야|버텨야\s?하는지|왜\s?견뎌야|견뎌야\s?하는지|살\s?이유가\s?없|소망.*없|hopeless|no reason to live|can't go on|cant go on)/i,
    ko: {
      summary: "소망을 잃은 절망 질문",
      terms: ["소망", "낙망", "인자", "긍휼", "새롭다", "기다림", "생명", "부활", "평안"],
    },
    en: {
      summary: "despair and hope question",
      terms: ["hope", "despair", "steadfast love", "mercies", "wait", "life", "resurrection", "peace"],
    },
  },
  {
    match: /(왜\s?살아야|살아야\s?(하는|되는|될)?지|살\s?이유|사는\s?이유|삶.*(목적|의미)|무엇을 위해 살아|존재.*이유|reason to live|why.*live|purpose.*life|meaning.*life)/i,
    ko: {
      summary: "삶의 목적과 존재 이유 질문",
      terms: ["지으심", "선한 일", "하나님의 형상", "창조", "자녀", "생명", "소망", "영원", "목적"],
    },
    en: {
      summary: "life purpose and reason-to-live question",
      terms: ["created", "workmanship", "good works", "image of God", "child of God", "life", "hope", "purpose"],
    },
  },
  {
    match: /(힘들|지치|지쳤|지쳐|지친|피곤|번아웃|무기력|수고|부담|weary|burden|burnout|exhausted|tired)/i,
    ko: {
      summary: "지침과 무거운 부담 질문",
      terms: ["수고", "무거운 짐", "쉬게 하리라", "피곤", "능력", "위로", "부담", "견디게"],
    },
    en: {
      summary: "weariness and burden question",
      terms: ["weary", "burden", "rest", "faint", "strength", "comfort", "endurance"],
    },
  },
  {
    match: /(나는 누구|내가 누구|정체성|존재|가치|나는 뭘까|who am i|identity|worth|purpose)/i,
    ko: {
      summary: "정체성과 존재 가치 질문",
      terms: ["하나님의 형상", "형상", "사람", "창조", "자녀", "지으심", "그리스도", "선한 일"],
    },
    en: {
      summary: "identity and personal worth question",
      terms: ["image of God", "created", "child of God", "workmanship", "identity", "beloved"],
    },
  },
  {
    match: /(혼자|외로|이해하지 못|버려진|lonely|alone|abandoned)/i,
    ko: {
      summary: "외로움과 버려짐 질문",
      terms: ["혼자", "함께", "버리지", "이해", "감찰", "두려워 말라"],
    },
    en: {
      summary: "loneliness and abandonment question",
      terms: ["alone", "with you", "never leave", "known", "fear not"],
    },
  },
  {
    match: /(불안|염려|통제|미래|두려|anxiety|worry|future|control|afraid)/i,
    ko: {
      summary: "불안과 미래 통제 질문",
      terms: ["염려", "평안", "맡기", "믿음", "미래", "인도", "두려워 말라"],
    },
    en: {
      summary: "anxiety and future-control question",
      terms: ["anxiety", "peace", "cast cares", "trust", "future", "guide", "fear not"],
    },
  },
];

function deterministicQueryPlan(prompt: string, appLocale: AppLocale): RagQueryPlan {
  const localeKey = appLocale === "ko" ? "ko" : "en";
  const matches = DETERMINISTIC_INTENT_PROFILES.filter((profile) => profile.match.test(prompt));

  if (matches.length) {
    const localeProfiles = matches.map((profile) => profile[localeKey]);
    const expansionTerms = cleanTerms(localeProfiles.flatMap((profile) => profile.terms));
    const expansionSummary = localeProfiles.map((profile) => profile.summary).filter((summary, index, summaries) => summaries.indexOf(summary) === index).join(" + ");

    return {
      expansionTerms,
      expansionSummary,
      expansionProvider: "deterministic",
      expansionModel: "deterministic-rag-query-planner",
      expansionNote: `Deterministic intent middleware matched ${matches.length} profile${matches.length === 1 ? "" : "s"}.`,
    };
  }

  return {
    expansionTerms: [],
    expansionSummary: null,
    expansionProvider: "deterministic",
    expansionModel: "deterministic-rag-query-planner",
    expansionNote: "No deterministic RAG query expansion matched.",
  };
}

export async function buildRagQueryPlan(prompt: string, locale?: string): Promise<RagQueryPlan> {
  const appLocale = resolveAppLocale(locale);
  const fallback = deterministicQueryPlan(prompt, appLocale);

  if (process.env.NEXT_PHASE === "phase-production-build" || process.env.HERMES_RAG_QUERY !== "1") {
    return fallback;
  }

  const config = await resolveHermesProviderConfig();
  if (!config.ready) return fallback;

  const system = [
    "You are a Bible RAG query planner, not an answer writer.",
    "Return only valid JSON with keys intentSummary and searchTerms.",
    "Generate search terms likely to appear in Bible passages, not application labels.",
    "For Korean prompts, include Korean Bible words and short English concept terms.",
    "Do not cite or invent references; retrieval will find passages separately.",
  ].join(" ");
  const user = JSON.stringify({ locale: appLocale, prompt, maxSearchTerms: MAX_TERMS });

  const parsePlan = (content: string | null, provider: "hermes" | "hermes-agent", model: string, notePrefix: string): RagQueryPlan | null => {
    const parsed = extractJson(content ?? "");
    const expansionTerms = cleanTerms(parsed?.searchTerms);
    if (!expansionTerms.length) return null;
    const intentSummary = typeof parsed?.intentSummary === "string" ? parsed.intentSummary.trim().slice(0, 240) : null;
    return {
      expansionTerms,
      expansionSummary: intentSummary || fallback.expansionSummary,
      expansionProvider: provider,
      expansionModel: model,
      expansionNote: `${notePrefix} generated ${expansionTerms.length} Bible RAG search terms.`,
    };
  };

  if (config.transport === "agent-oneshot") {
    try {
      const content = await runHermesAgentOneshot(`${system}\n\nQuery request JSON:\n${user}`, 45_000);
      const plan = parsePlan(content, "hermes-agent", config.model, "Hermes agent");
      if (plan) return plan;
      return { ...fallback, expansionProvider: "hermes-fallback", expansionModel: "hermes-fallback", expansionNote: "Hermes agent RAG query planner returned no usable search terms." };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { ...fallback, expansionProvider: "hermes-fallback", expansionModel: "hermes-fallback", expansionNote: `Hermes agent RAG query planner threw (${message}).` };
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { ...fallback, expansionProvider: "hermes-fallback", expansionModel: "hermes-fallback", expansionNote: `Hermes RAG query planner failed with status ${response.status}.` };
    }

    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content ?? "";
    const plan = parsePlan(content, "hermes", config.model, "Hermes");
    if (!plan) {
      return { ...fallback, expansionProvider: "hermes-fallback", expansionModel: "hermes-fallback", expansionNote: "Hermes RAG query planner returned no usable search terms." };
    }

    return plan;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { ...fallback, expansionProvider: "hermes-fallback", expansionModel: "hermes-fallback", expansionNote: `Hermes RAG query planner threw (${message}).` };
  }
}
