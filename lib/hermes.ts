import { cache } from "react";
import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { buildHermesContract, type HermesEvidenceContract } from "@/lib/hermes-contract";
import type { ReflectionResponse } from "@/lib/reflection";

const execFile = promisify(execFileCallback);

export type HermesProviderField = "apiKey" | "baseUrl";

export type HermesProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  ready: boolean;
  transport: "chat-completions" | "agent-oneshot" | null;
  agentCommand: string | null;
  missing: HermesProviderField[];
  sources: {
    apiKey: string | null;
    baseUrl: string | null;
    model: string;
  };
};

export type ReflectionGenerationResult = {
  response: ReflectionResponse;
  provider: "deterministic" | "hermes" | "hermes-agent" | "hermes-fallback";
  model: string;
  note: string;
};

type GeneratedShape = Omit<ReflectionResponse, "evidence" | "generationMode" | "generationModel" | "generationNote"> & {
  reflectionQuestions: string[];
};

type Candidate = {
  value: string;
  source: string;
};

type HermesAgentRuntimeCredentials = {
  apiKey: string;
  baseUrl: string;
  source: string;
};

const HERMES_AGENT_CREDENTIAL_SCRIPT = `
import json
import sys
root = sys.argv[1]
if root and root not in sys.path:
    sys.path.insert(0, root)
from urllib.parse import urlparse
from hermes_cli.auth import resolve_codex_runtime_credentials, resolve_nous_runtime_credentials
errors = []
creds = None
for name, resolver in (("nous", resolve_nous_runtime_credentials), ("openai-codex", resolve_codex_runtime_credentials)):
    try:
        candidate = resolver()
        base_url = candidate.get("base_url", "")
        parsed = urlparse(base_url)
        is_chatgpt_codex_backend = parsed.netloc == "chatgpt.com" and parsed.path.rstrip("/") == "/backend-api/codex"
        if candidate.get("api_key") and base_url and not is_chatgpt_codex_backend:
            creds = candidate
            break
        if is_chatgpt_codex_backend:
            errors.append(f"{name}:not-openai-compatible")
    except Exception as exc:
        errors.append(f"{name}:{type(exc).__name__}")
if not creds:
    raise RuntimeError(";".join(errors) or "no hermes-agent runtime credentials")
print(json.dumps({
    "apiKey": creds["api_key"],
    "baseUrl": creds["base_url"],
    "source": f"hermes-agent:{creds.get('provider', 'runtime')}:{creds.get('auth_path', creds.get('source', 'runtime'))}",
}))
`.trim();

function firstConfigured(candidates: Candidate[]) {
  return candidates.find((candidate) => candidate.value.trim());
}

async function fileExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function resolveHermesAgentPaths() {
  const home = homedir();
  return {
    root: process.env.HERMES_AGENT_ROOT ?? join(home, ".hermes", "hermes-agent"),
    pythonCandidates: [
      process.env.HERMES_AGENT_PYTHON,
      join(home, ".hermes", "hermes-agent", "venv", "bin", "python"),
      "python3",
    ].filter((value): value is string => !!value),
    configPath: process.env.HERMES_CONFIG_PATH ?? join(home, ".hermes", "config.yaml"),
    hermesCandidates: [
      process.env.HERMES_AGENT_CLI,
      join(home, ".hermes", "hermes-agent", "venv", "bin", "hermes"),
      "hermes",
    ].filter((value): value is string => !!value),
  };
}

async function readHermesAgentDefaultModel(configPath: string) {
  try {
    const raw = await readFile(configPath, "utf8");
    const match = raw.match(/(^|\n)model:\s*\n(?:[ \t].*\n)*?[ \t]+default:\s*([^\n#]+)/m);
    const value = match?.[2]?.trim();
    return value || null;
  } catch {
    return null;
  }
}

async function resolveHermesAgentRuntimeCredentials(): Promise<HermesAgentRuntimeCredentials | null> {
  if (process.env.HERMES_AGENT_REUSE === "0") {
    return null;
  }

  const { root, pythonCandidates } = resolveHermesAgentPaths();
  const rootExists = await fileExists(root);
  if (!rootExists) {
    return null;
  }

  for (const pythonPath of pythonCandidates) {
    try {
      const { stdout } = await execFile(pythonPath, ["-c", HERMES_AGENT_CREDENTIAL_SCRIPT, root], {
        timeout: 20_000,
        env: process.env,
      });
      const parsed = JSON.parse(stdout) as Partial<HermesAgentRuntimeCredentials>;
      if (!parsed.apiKey || !parsed.baseUrl) {
        continue;
      }
      return {
        apiKey: parsed.apiKey,
        baseUrl: parsed.baseUrl,
        source: parsed.source || "hermes-agent:nous-runtime",
      };
    } catch {
      continue;
    }
  }

  return null;
}

async function resolveHermesAgentOneshotCommand() {
  if (process.env.HERMES_AGENT_ONESHOT === "0") {
    return null;
  }

  const { root, hermesCandidates } = resolveHermesAgentPaths();
  if (!(await fileExists(root))) {
    return null;
  }

  for (const command of hermesCandidates) {
    if (command.includes("/")) {
      if (await fileExists(command)) return command;
      continue;
    }
    return command;
  }

  return null;
}

export async function runHermesAgentOneshot(prompt: string, timeoutMs = 75_000) {
  const command = await resolveHermesAgentOneshotCommand();
  if (!command) return null;
  const { stdout } = await execFile(command, ["--ignore-rules", "-z", prompt], {
    timeout: timeoutMs,
    cwd: process.cwd(),
    env: {
      ...process.env,
      HERMES_ACCEPT_HOOKS: "1",
    },
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

function describeMissingConfig(config: HermesProviderConfig) {
  if (!config.missing.length) {
    return "Hermes provider not configured; using deterministic reflection builder.";
  }

  const labels = config.missing.map((field) => (field === "apiKey" ? "API key" : "base URL"));
  return `Hermes provider missing ${labels.join(" and ")}; using deterministic reflection builder.`;
}

function deterministicResult(
  reflection: ReflectionResponse,
  note: string,
  provider: ReflectionGenerationResult["provider"] = "deterministic",
): ReflectionGenerationResult {
  return {
    response: reflection,
    provider,
    model: provider === "deterministic" ? "deterministic-reflection-builder" : "hermes-fallback",
    note,
  };
}

function validateGeneratedShape(value: unknown): GeneratedShape | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const keys = [
    "concernSummary",
    "whyTheseTexts",
    "primaryStory",
    "datePlaceAudience",
    "originalAudience",
    "linkedScriptures",
    "jesusAndPaul",
    "personalConnection",
    "reflectionQuestions",
  ] as const;

  for (const key of keys) {
    if (!(key in candidate)) return null;
  }

  if (!Array.isArray(candidate.reflectionQuestions)) return null;
  if (!candidate.reflectionQuestions.every((item) => typeof item === "string")) return null;

  for (const key of keys.slice(0, 8)) {
    if (typeof candidate[key] !== "string") return null;
  }

  return candidate as unknown as GeneratedShape;
}

function addAllowedReference(allowed: Set<string>, reference: { code: string; chapter: number; startVerse: number; endVerse: number }) {
  for (let verse = reference.startVerse; verse <= reference.endVerse; verse += 1) {
    allowed.add(`${reference.code} ${reference.chapter}:${verse}`);
  }
}

function buildAllowedReferenceSet(contract: HermesEvidenceContract) {
  const allowed = new Set<string>();
  addAllowedReference(allowed, contract.retrieval.primaryReference);
  for (const reference of contract.retrieval.supportingReferences) addAllowedReference(allowed, reference);
  for (const candidate of contract.retrieval.passageCandidates) addAllowedReference(allowed, candidate.reference);
  for (const linked of contract.linkedTexts) addAllowedReference(allowed, linked.reference);
  for (const suggestion of contract.graphSuggestions) addAllowedReference(allowed, suggestion.target);
  for (const edge of contract.crossReferenceHighlights ?? []) {
    addAllowedReference(allowed, edge.from);
    addAllowedReference(allowed, edge.to);
  }
  return allowed;
}

function extractReferenceKeys(text: string) {
  const matches = text.matchAll(/\b([1-3]?[A-Z]{2,3})\s+(\d+):(\d+)(?:-(\d+))?\b/g);
  const refs: string[] = [];
  for (const match of matches) {
    const [, code, chapterRaw, startRaw, endRaw] = match;
    const chapter = Number(chapterRaw);
    const start = Number(startRaw);
    const end = endRaw ? Number(endRaw) : start;
    for (let verse = start; verse <= end; verse += 1) refs.push(`${code} ${chapter}:${verse}`);
  }
  return refs;
}

function hasUnsupportedReference(candidate: GeneratedShape, contract: HermesEvidenceContract) {
  const allowed = buildAllowedReferenceSet(contract);
  return Object.entries(candidate).some(([key, value]) => {
    if (key === "reflectionQuestions") {
      return (value as string[]).some((question) => extractReferenceKeys(question).some((reference) => !allowed.has(reference)));
    }
    return extractReferenceKeys(value as string).some((reference) => !allowed.has(reference));
  });
}

function generatedStrings(candidate: GeneratedShape): string[] {
  return [
    candidate.concernSummary,
    candidate.whyTheseTexts,
    candidate.primaryStory,
    candidate.datePlaceAudience,
    candidate.originalAudience,
    candidate.linkedScriptures,
    candidate.jesusAndPaul,
    candidate.personalConnection,
    ...candidate.reflectionQuestions,
  ];
}

function hasUnsupportedEvidenceId(candidate: GeneratedShape, contract: HermesEvidenceContract) {
  const allowed = new Set(contract.allowedEvidenceIds ?? []);
  if (!allowed.size) return false;
  const text = generatedStrings(candidate).join("\n");
  const ids = text.match(/(?:primary|crossref:v1:[A-Za-z0-9:_>.-]+)/g) ?? [];
  return ids.some((id) => !allowed.has(id));
}

function hasUnsupportedQuote(candidate: GeneratedShape, contract: HermesEvidenceContract) {
  const evidenceText = JSON.stringify(contract);
  const quotes = generatedStrings(candidate)
    .join("\n")
    .matchAll(/[\"“”']([^\"“”']{24,})[\"“”']/g);
  for (const quote of quotes) {
    if (!evidenceText.includes(quote[1])) return true;
  }
  return false;
}

function hasUnsupportedBackgroundClaim(candidate: GeneratedShape, contract: HermesEvidenceContract) {
  const evidenceText = JSON.stringify(contract).toLowerCase();
  const generatedText = generatedStrings(candidate).join("\n").toLowerCase();
  const sourceBoundTerms = [
    "archaeology",
    "archaeological",
    "josephus",
    "talmud",
    "qumran",
    "dead sea",
    "greek",
    "hebrew",
    "manuscript",
    "고고학",
    "요세푸스",
    "탈무드",
    "쿰란",
    "사해",
    "헬라어",
    "히브리어",
    "사본",
  ];
  return sourceBoundTerms.some((term) => generatedText.includes(term) && !evidenceText.includes(term));
}

function extractJson(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

const getHermesProviderConfig = cache(async (): Promise<HermesProviderConfig> => {
  const envApiKey = firstConfigured([
    { value: process.env.HERMES_API_KEY ?? "", source: "HERMES_API_KEY" },
    { value: process.env.OPENAI_API_KEY ?? "", source: "OPENAI_API_KEY" },
  ]);
  const envBaseUrl = firstConfigured([
    { value: process.env.HERMES_BASE_URL ?? "", source: "HERMES_BASE_URL" },
    { value: process.env.HERMES_API_BASE ?? "", source: "HERMES_API_BASE" },
    { value: process.env.OPENAI_BASE_URL ?? "", source: "OPENAI_BASE_URL" },
    { value: process.env.OPENAI_API_BASE ?? "", source: "OPENAI_API_BASE" },
  ]);
  const envModel = firstConfigured([
    { value: process.env.HERMES_MODEL ?? "", source: "HERMES_MODEL" },
    { value: process.env.HERMES_DEFAULT_MODEL ?? "", source: "HERMES_DEFAULT_MODEL" },
    { value: process.env.OPENAI_MODEL ?? "", source: "OPENAI_MODEL" },
    { value: process.env.OPENAI_CHAT_MODEL ?? "", source: "OPENAI_CHAT_MODEL" },
  ]);

  const agentCredentials = !envApiKey || !envBaseUrl ? await resolveHermesAgentRuntimeCredentials() : null;
  const { configPath } = resolveHermesAgentPaths();
  const agentModel = envModel ? null : await readHermesAgentDefaultModel(configPath);

  const apiKey = envApiKey?.value ?? agentCredentials?.apiKey ?? "";
  const baseUrl = envBaseUrl?.value ?? agentCredentials?.baseUrl ?? "";
  const model = envModel?.value ?? agentModel ?? "hermes-default";

  const missing: HermesProviderField[] = [];
  if (!apiKey) {
    missing.push("apiKey");
  }
  if (!baseUrl) {
    missing.push("baseUrl");
  }

  const chatReady = !missing.length;
  const agentCommand = await resolveHermesAgentOneshotCommand();
  const preferChatCompletions = process.env.HERMES_CHAT_COMPLETIONS_FIRST === "1";
  const transport = agentCommand && !preferChatCompletions ? "agent-oneshot" : chatReady ? "chat-completions" : agentCommand ? "agent-oneshot" : null;

  return {
    apiKey,
    baseUrl,
    model,
    ready: chatReady || !!agentCommand,
    transport,
    agentCommand,
    missing,
    sources: {
      apiKey: envApiKey?.source ?? agentCredentials?.source ?? null,
      baseUrl: envBaseUrl?.source ?? agentCredentials?.source ?? null,
      model: envModel?.source ?? (agentModel ? "hermes-agent-config:model.default" : agentCommand ? "hermes-agent:oneshot-default" : "fallback:hermes-default"),
    },
  };
});

export async function resolveHermesProviderConfig() {
  return getHermesProviderConfig();
}

export async function generateReflectionWithHermes(
  contractArgs: HermesEvidenceContract,
  deterministicReflection: ReflectionResponse,
): Promise<ReflectionGenerationResult> {
  if (process.env.HERMES_REFLECTION !== "1") {
    return deterministicResult(
      deterministicReflection,
      "Hermes reflection generation is disabled for synchronous web requests; deterministic explanation builder used.",
    );
  }

  const config = await resolveHermesProviderConfig();
  const contract = buildHermesContract(contractArgs);
  const system = [
    "You are Hermes operating in evidence-locked mode.",
    "Return only valid JSON.",
    "Do not add citations, facts, or interpretations not present in the provided evidence contract.",
    "Keep disputed items tentative.",
  ].join(" ");

  if (!config.ready) {
    return deterministicResult(deterministicReflection, describeMissingConfig(config));
  }

  if (config.transport === "agent-oneshot") {
    return deterministicResult(
      deterministicReflection,
      "Hermes agent is reserved for RAG query planning on synchronous web requests; deterministic explanation builder used to avoid proxy timeouts.",
      "hermes-fallback",
    );
  }

  const user = JSON.stringify(contract);


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
      return deterministicResult(
        deterministicReflection,
        `Hermes request failed with status ${response.status}; using deterministic fallback.`,
        "hermes-fallback",
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content ?? "";
    const parsed = validateGeneratedShape(extractJson(content));

    if (!parsed) {
      return deterministicResult(
        deterministicReflection,
        "Hermes returned invalid JSON; using deterministic fallback.",
        "hermes-fallback",
      );
    }

    if (hasUnsupportedReference(parsed, contractArgs)) {
      return deterministicResult(
        deterministicReflection,
        "Hermes cited a scripture reference outside the evidence contract; using deterministic fallback.",
        "hermes-fallback",
      );
    }

    if (hasUnsupportedEvidenceId(parsed, contractArgs)) {
      return deterministicResult(
        deterministicReflection,
        "Hermes cited an evidence ID outside the allowed evidence set; using deterministic fallback.",
        "hermes-fallback",
      );
    }

    if (hasUnsupportedQuote(parsed, contractArgs)) {
      return deterministicResult(
        deterministicReflection,
        "Hermes quoted text not present in the evidence contract; using deterministic fallback.",
        "hermes-fallback",
      );
    }

    if (hasUnsupportedBackgroundClaim(parsed, contractArgs)) {
      return deterministicResult(
        deterministicReflection,
        "Hermes made a source-bound background claim absent from the evidence contract; using deterministic fallback.",
        "hermes-fallback",
      );
    }

    return {
      provider: "hermes",
      model: config.model,
      note: `Hermes generated the final explanation from the evidence-locked contract (${config.sources.model}).`,
      response: {
        ...deterministicReflection,
        ...parsed,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Hermes error";
    return deterministicResult(
      deterministicReflection,
      `Hermes threw an error (${message}); using deterministic fallback.`,
      "hermes-fallback",
    );
  }
}
