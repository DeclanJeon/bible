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

function deterministicQueryPlan(prompt: string, appLocale: AppLocale): RagQueryPlan {
  const identity = /(나는 누구|내가 누구|정체성|존재|가치|나는 뭘까|who am i|identity|worth|purpose)/i.test(prompt);
  if (identity) {
    return {
      expansionTerms: appLocale === "ko"
        ? ["하나님의 형상", "형상", "사람", "창조", "자녀", "지으심", "그리스도", "선한 일"]
        : ["image of God", "created", "child of God", "workmanship", "identity", "beloved"],
      expansionSummary: appLocale === "ko" ? "정체성과 존재 가치 질문" : "identity and personal worth question",
      expansionProvider: "deterministic",
      expansionModel: "deterministic-rag-query-planner",
      expansionNote: "Deterministic identity fallback query expansion.",
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

  if (process.env.NEXT_PHASE === "phase-production-build" || process.env.HERMES_RAG_QUERY === "0") {
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
      const content = await runHermesAgentOneshot(`${system}\n\nQuery request JSON:\n${user}`, 60_000);
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
