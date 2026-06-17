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
  missing: HermesProviderField[];
  sources: {
    apiKey: string | null;
    baseUrl: string | null;
    model: string;
  };
};

export type ReflectionGenerationResult = {
  response: ReflectionResponse;
  provider: "deterministic" | "hermes" | "hermes-fallback";
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
from hermes_cli.auth import resolve_nous_runtime_credentials
creds = resolve_nous_runtime_credentials()
print(json.dumps({
    "apiKey": creds["api_key"],
    "baseUrl": creds["base_url"],
    "source": f"hermes-agent:{creds.get('provider', 'nous')}:{creds.get('auth_path', creds.get('source', 'runtime'))}",
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

  return {
    apiKey,
    baseUrl,
    model,
    ready: !missing.length,
    missing,
    sources: {
      apiKey: envApiKey?.source ?? agentCredentials?.source ?? null,
      baseUrl: envBaseUrl?.source ?? agentCredentials?.source ?? null,
      model: envModel?.source ?? (agentModel ? "hermes-agent-config:model.default" : "fallback:hermes-default"),
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
  const config = await resolveHermesProviderConfig();
  if (!config.ready) {
    return deterministicResult(deterministicReflection, describeMissingConfig(config));
  }

  const contract = buildHermesContract(contractArgs);
  const system = [
    "You are Hermes operating in evidence-locked mode.",
    "Return only valid JSON.",
    "Do not add citations, facts, or interpretations not present in the provided evidence contract.",
    "Keep disputed items tentative.",
  ].join(" ");

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
