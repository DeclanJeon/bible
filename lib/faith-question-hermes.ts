import { resolveHermesProviderConfig } from "@/lib/hermes";
import { getBookMetadata } from "@/lib/book-metadata";
import type { AppLocale, FaithResource } from "@/lib/faith-resources";
import type { BibleReference } from "@/lib/bible";

export type FaithQuestionEvidencePassage = {
  key: string;
  label: string;
  reference: BibleReference;
  text: string;
  reason: string;
};

export type FaithQuestionEvidenceMatch = {
  title: string;
  shortAnswer: string;
  matchedTerms: string[];
};

export type FaithQuestionEvidence = {
  locale: AppLocale;
  query: string;
  intentSummary: string;
  bible: {
    state: string;
    confidence: string;
    retrievalMode: string;
    passages: FaithQuestionEvidencePassage[];
    explanation: {
      userConcernSummary: string;
      connectionToUser: string;
      whyThisPassage: string;
      limits?: string;
    } | null;
  };
  resources: FaithResource[];
  matches: FaithQuestionEvidenceMatch[];
  policy: {
    externalBodyFetched: false;
    externalBodyStored: false;
    citeOnlyProvidedEvidence: true;
    doNotInventBibleReferences: true;
    doNotSummarizeUnprovidedExternalBodies: true;
  };
};

export type FaithQuestionGeneration = {
  summary: string;
  biblicalDirection: string;
  caveat: string;
  passageReasons: Array<{ passageKey: string; reason: string }>;
  resourceReasons: Array<{ resourceId: string; reason: string }>;
  nextQuestions: string[];
};

export type FaithQuestionGenerationResult = {
  generated: FaithQuestionGeneration | null;
  provider: "hermes" | "hermes-fallback" | "deterministic";
  model: string;
  note: string;
};

type ChatPayload = {
  choices?: Array<{ message?: { content?: string } }>;
};

function extractJson(content: string) {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : "";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateGeneratedShape(value: unknown): FaithQuestionGeneration | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<FaithQuestionGeneration>;
  if (
    typeof candidate.summary !== "string" ||
    typeof candidate.biblicalDirection !== "string" ||
    typeof candidate.caveat !== "string" ||
    !Array.isArray(candidate.passageReasons) ||
    !Array.isArray(candidate.resourceReasons) ||
    !isStringArray(candidate.nextQuestions)
  ) {
    return null;
  }

  const passageReasons = candidate.passageReasons.every(
    (item) =>
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      typeof (item as { passageKey?: unknown }).passageKey === "string" &&
      typeof (item as { reason?: unknown }).reason === "string",
  );
  const resourceReasons = candidate.resourceReasons.every(
    (item) =>
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      typeof (item as { resourceId?: unknown }).resourceId === "string" &&
      typeof (item as { reason?: unknown }).reason === "string",
  );
  if (!passageReasons || !resourceReasons) return null;

  return {
    summary: candidate.summary.trim(),
    biblicalDirection: candidate.biblicalDirection.trim(),
    caveat: candidate.caveat.trim(),
    passageReasons: candidate.passageReasons.map((item) => ({
      passageKey: item.passageKey.trim(),
      reason: item.reason.trim(),
    })),
    resourceReasons: candidate.resourceReasons.map((item) => ({
      resourceId: item.resourceId.trim(),
      reason: item.reason.trim(),
    })),
    nextQuestions: candidate.nextQuestions.map((item) => item.trim()).filter(Boolean).slice(0, 5),
  };
}
const REFERENCE_CODE_ALIASES: Record<string, string[]> = {
  EZE: ["EZE", "EZK"],
  MAR: ["MAR", "MRK"],
  PHI: ["PHI", "PHP"],
  JAM: ["JAM", "JAS"],
};

const CANONICAL_REFERENCE_CODES = [
  "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO", "ECC", "SNG", "ISA", "JER", "LAM", "EZE", "EZK", "DAN", "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL", "MAT", "MAR", "MRK", "LUK", "JOH", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHI", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAM", "JAS", "1PE", "2PE", "1JO", "2JO", "3JO", "JUD", "REV",
] as const;

const ENGLISH_BOOK_NAMES = [
  "genesis", "exodus", "leviticus", "numbers", "deuteronomy", "joshua", "judges", "ruth", "samuel", "kings", "chronicles", "ezra", "nehemiah", "esther", "job", "psalm", "psalms", "proverbs", "ecclesiastes", "song", "isaiah", "jeremiah", "lamentations", "ezekiel", "daniel", "hosea", "joel", "amos", "obadiah", "jonah", "micah", "nahum", "habakkuk", "zephaniah", "haggai", "zechariah", "malachi", "matthew", "mark", "luke", "john", "acts", "romans", "corinthians", "galatians", "ephesians", "philippians", "colossians", "thessalonians", "timothy", "titus", "philemon", "hebrews", "james", "peter", "jude", "revelation",
] as const;

const KOREAN_BOOK_NAMES = [
  "창세기", "출애굽기", "레위기", "민수기", "신명기", "여호수아", "사사기", "룻기", "사무엘상", "사무엘하", "열왕기상", "열왕기하", "역대상", "역대하", "에스라", "느헤미야", "에스더", "욥기", "시편", "잠언", "전도서", "아가", "이사야", "예레미야", "예레미야애가", "에스겔", "다니엘", "호세아", "요엘", "아모스", "오바댜", "요나", "미가", "나훔", "하박국", "스바냐", "학개", "스가랴", "말라기", "마태복음", "마가복음", "누가복음", "요한복음", "사도행전", "로마서", "고린도전서", "고린도후서", "갈라디아서", "에베소서", "빌립보서", "골로새서", "데살로니가전서", "데살로니가후서", "디모데전서", "디모데후서", "디도서", "빌레몬서", "히브리서", "야고보서", "베드로전서", "베드로후서", "유다서", "요한계시록",
] as const;

function referenceCodeAliases(code: string) {
  return [code, ...(REFERENCE_CODE_ALIASES[code] ?? [])];
}

function normalizeGeneratedText(value: string) {
  return value.toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
}

function generatedText(generated: FaithQuestionGeneration) {
  return [
    generated.summary,
    generated.biblicalDirection,
    generated.caveat,
    ...generated.passageReasons.map((item) => item.reason),
    ...generated.resourceReasons.map((item) => item.reason),
    ...generated.nextQuestions,
  ].join(" ");
}

function allowedReferenceFragments(evidence: FaithQuestionEvidence) {
  return evidence.bible.passages.flatMap((passage) => {
    const { reference } = passage;
    const verse = `${reference.chapter}:${reference.startVerse}`;
    const verseRange = reference.startVerse === reference.endVerse ? verse : `${verse}-${reference.endVerse}`;
    const localizedTitle = getBookMetadata(reference.code, evidence.locale)?.title ?? "";
    const labelBook = passage.label.replace(/\s+\d+\s*:\s*\d+(?:\s*[-–—]\s*\d+)?$/, "");
    return [
      passage.label,
      passage.label.replace(/[–—]/g, "-"),
      localizedTitle ? `${localizedTitle} ${verse}` : "",
      localizedTitle ? `${localizedTitle} ${verseRange}` : "",
      labelBook ? `${labelBook} ${verse}` : "",
      labelBook ? `${labelBook} ${verseRange}` : "",
      ...referenceCodeAliases(reference.code).flatMap((code) => [
        `${code} ${verse}`,
        `${code} ${verseRange}`,
        `${code.toLowerCase()} ${verse}`,
        `${code.toLowerCase()} ${verseRange}`,
      ]),
    ].filter(Boolean).map(normalizeGeneratedText);
  });
}

function unsupportedUrls(text: string, evidence: FaithQuestionEvidence) {
  const urls = text.match(/https?:\/\/[^\s)"']+/g) ?? [];
  if (!urls.length) return false;
  const allowed = new Set(evidence.resources.map((resource) => resource.href.replace(/\/$/, "")));
  return urls.some((url) => !allowed.has(url.replace(/\/$/, "")));
}

function unsupportedBibleReferences(text: string, evidence: FaithQuestionEvidence) {
  const normalized = normalizeGeneratedText(text);
  const allowed = new Set(allowedReferenceFragments(evidence));
  const codePattern = CANONICAL_REFERENCE_CODES.join("|");
  const englishPattern = ENGLISH_BOOK_NAMES.join("|");
  const koreanPattern = KOREAN_BOOK_NAMES.join("|");
  const referencePattern = new RegExp(`(?:(?:${codePattern})\\s*\\d+\\s*:\\s*\\d+(?:\\s*-\\s*\\d+)?|(?:[1-3]\\s*)?(?:${englishPattern})\\s*\\d+\\s*:\\s*\\d+(?:\\s*-\\s*\\d+)?|(?:${koreanPattern})\\s*\\d+\\s*:\\s*\\d+(?:\\s*-\\s*\\d+)?)`, "giu");
  const matches = normalized.match(referencePattern) ?? [];
  return matches.some((match) => !allowed.has(normalizeGeneratedText(match)));
}

function hasUnsupportedGeneratedText(generated: FaithQuestionGeneration, evidence: FaithQuestionEvidence) {
  const text = generatedText(generated);
  return unsupportedUrls(text, evidence) || unsupportedBibleReferences(text, evidence);
}


function validateEvidenceUse(generated: FaithQuestionGeneration, evidence: FaithQuestionEvidence) {
  const passageKeys = new Set(evidence.bible.passages.map((passage) => passage.key));
  const resourceIds = new Set(evidence.resources.map((resource) => resource.id));
  return (
    generated.passageReasons.every((item) => passageKeys.has(item.passageKey)) &&
    generated.resourceReasons.every((item) => resourceIds.has(item.resourceId)) &&
    !hasUnsupportedGeneratedText(generated, evidence)
  );
}

function fallback(note: string, provider: FaithQuestionGenerationResult["provider"] = "deterministic", model = "none"): FaithQuestionGenerationResult {
  return { generated: null, provider, model, note };
}

export async function generateFaithQuestionWithHermes(evidence: FaithQuestionEvidence): Promise<FaithQuestionGenerationResult> {
  if (process.env.HERMES_FAITH_QUESTIONS === "0") {
    return fallback("Hermes faith-question generation disabled by HERMES_FAITH_QUESTIONS=0.");
  }

  const config = await resolveHermesProviderConfig();
  if (!config.ready || config.transport !== "chat-completions") {
    return fallback("OpenAI-compatible Hermes chat completions are unavailable; deterministic faith answer used.", "hermes-fallback", config.model);
  }

  const system = [
    "You are a Christian faith-question reading assistant operating in evidence-locked mode.",
    "Return only valid JSON matching the requested schema.",
    "Use only the provided Scripture evidence and provided external-resource metadata.",
    "Do not claim to have read external article bodies. Do not summarize GotQuestions article bodies unless the summary is provided in metadata.",
    "Do not add Bible references, quotations, facts, or external links that are not in the evidence bundle.",
    "Keep the answer concise and pastoral, and distinguish Scripture from external links.",
  ].join(" ");
  const user = JSON.stringify({
    evidence,
    outputSchema: {
      summary: "short direct answer in the user's locale, grounded only in evidence",
      biblicalDirection: "how the supplied Bible passages guide the question",
      caveat: "brief note that AI is a reading guide and final grounding is Scripture/source links",
      passageReasons: [{ passageKey: "one supplied passage key", reason: "why this passage matters" }],
      resourceReasons: [{ resourceId: "one supplied resource id", reason: "why this source link is relevant" }],
      nextQuestions: ["2-5 next questions in the user's locale"],
    },
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
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
      return fallback(`Hermes faith-question request failed with status ${response.status}; deterministic answer used.`, "hermes-fallback", config.model);
    }

    const payload = (await response.json()) as ChatPayload;
    const content = payload.choices?.[0]?.message?.content ?? "";
    const parsed = validateGeneratedShape(JSON.parse(extractJson(content)));
    if (!parsed) {
      return fallback("Hermes returned invalid faith-question JSON; deterministic answer used.", "hermes-fallback", config.model);
    }
    if (!validateEvidenceUse(parsed, evidence)) {
      return fallback("Hermes referenced unsupported faith-question evidence; deterministic answer used.", "hermes-fallback", config.model);
    }

    return {
      generated: parsed,
      provider: "hermes",
      model: config.model,
      note: "Hermes generated an evidence-locked faith-question answer from supplied Bible RAG and resource metadata.",
    };
  } catch {
    return fallback("Hermes faith-question generation failed; deterministic answer used.", "hermes-fallback", config.model);
  }
}
