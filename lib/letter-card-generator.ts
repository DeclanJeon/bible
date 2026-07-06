import { execFile } from "node:child_process";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { promisify } from "node:util";

import type { AppLocale } from "@/lib/content";
import type { GenerationStatus, LetterCard } from "@/lib/letters";

const execFileAsync = promisify(execFile);
const DEFAULT_PROMPT_DIR = join(process.cwd(), ".data", "letter-card-prompts");
const DEFAULT_OUTPUT_DIR = join(process.cwd(), ".data", "letter-card-images");
const DEFAULT_REMOTE_ROOT = "/tmp/bible-letters-codex-imagen";
const DEFAULT_TIMEOUT_SECONDS = 900;

const CODEX_IMAGEN_CLI =
  process.env.LETTERS_CODEX_IMAGEN_BIN ||
  process.env.CODEX_IMAGEN_CLI ||
  process.env.PROFILEFORGE_IMAGE_PROVIDER_BIN ||
  process.env.PROFILEFORGE_CODEX_IMAGEN_BIN ||
  "/home/declan/bin/codex-imagen";
const CODEX_IMAGEN_HOST =
  process.env.LETTERS_CODEX_IMAGEN_HOST ||
  process.env.CODEX_IMAGEN_HOST ||
  process.env.PROFILEFORGE_IMAGE_PROVIDER_HOST ||
  process.env.PROFILEFORGE_CODEX_IMAGEN_HOST ||
  "ponslink";
const CODEX_IMAGEN_MODEL = process.env.LETTERS_CODEX_IMAGEN_MODEL || process.env.CODEX_IMAGEN_MODEL || "gpt-5.5";
const ENABLE_REMOTE_IMAGEN = process.env.LETTERS_ENABLE_CODEX_IMAGEN === "1";
const CODEX_IMAGEN_TIMEOUT_SECONDS = Math.max(
  30,
  Number(process.env.LETTERS_CODEX_IMAGEN_TIMEOUT_SECONDS || process.env.CODEX_IMAGEN_TIMEOUT_SECONDS || DEFAULT_TIMEOUT_SECONDS),
);
const CODEX_IMAGEN_TIMEOUT_MS = CODEX_IMAGEN_TIMEOUT_SECONDS * 1000;

type GenerationResult = {
  status: GenerationStatus;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
};

type CodexImagenJsonImage = {
  path?: string;
  decodedPath?: string;
  sha256?: string;
  revised_prompt?: string | null;
};

type CodexImagenJsonResult = {
  model?: string;
  images?: CodexImagenJsonImage[];
};

function buildPrompt(card: LetterCard, body: string, locale: AppLocale) {
  const title = card.title;
  const verseText = card.scripture.text;
  const verseReference = card.scripture.reference;
  const theme = card.visualTheme;

  return `Create one finished square Instagram Bible verse card in ${locale === "ko" ? "Korean" : "English"}.

Important:
Do not generate a generic Christian image.
Do not choose a generic background first.
First interpret the verse and understand its spiritual meaning, emotional tone, and symbolic message.
Then create a scene that visually matches that meaning.

Use the following interpretation:

Core message: ${theme.coreMessage}
Spiritual theme: ${theme.spiritualTheme}
Emotional tone: ${theme.emotionalTone}
Visual metaphor: ${theme.visualMetaphor}
Environment: ${theme.environment}
Human figure: ${theme.includeHumanFigure ? "yes" : "no"}
Card title: ${title}

Visual style:
Premium Korean devotional card, painterly storybook illustration, cinematic lighting, elegant and reverent mood, soft atmospheric light, slightly textured brushwork, polished and beautiful.
Not photorealistic. Not cartoon. Not flat vector.

Composition:
- 1:1 square Instagram format
- large readable Korean verse text
- small thematic title at the top
- scripture reference below
- clean balanced layout
- background and imagery must support the verse meaning
- keep enough negative space for Korean typography

Text:
Title: "${title}"
Verse:
"${verseText}"
Reference:
"${verseReference}"

Context summary for emotional alignment only, not for full text rendering:
"${body.slice(0, 260)}"

Typography:
- elegant Korean serif or calligraphic typography
- high contrast against the background
- readable dark brown, sepia, ivory, or another appropriate contrast color
- subtle ornamental divider lines only if suitable

Restrictions:
- no watermark
- no logo
- no email
- no personal names unless explicitly approved
- no phone number
- no user id
- no token
- no visual element that turns the verse into a generic landscape unrelated to its meaning

Generate one final square devotional Bible verse card image.`;
}

function isLocalHost(host: string) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function shouldRunLocally() {
  return process.env.LETTERS_CODEX_IMAGEN_LOCAL === "1" || isLocalHost(CODEX_IMAGEN_HOST);
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

async function run(command: string, args: string[], timeout = CODEX_IMAGEN_TIMEOUT_MS) {
  const { stdout } = await execFileAsync(command, args, {
    env: process.env,
    timeout,
    maxBuffer: 1024 * 1024,
  });
  return stdout;
}

async function runRemoteShell(script: string, timeout = CODEX_IMAGEN_TIMEOUT_MS + 10_000) {
  if (shouldRunLocally()) {
    return run("bash", ["-lc", script], timeout);
  }

  return run("ssh", [CODEX_IMAGEN_HOST, `bash -lc ${shellQuote(script)}`], timeout);
}

async function copyLocalToRemote(localPath: string, remotePath: string) {
  if (shouldRunLocally()) {
    await mkdir(dirname(remotePath), { recursive: true });
    await copyFile(localPath, remotePath);
    return;
  }

  await run("scp", ["-q", "-o", "BatchMode=yes", "-o", "ConnectTimeout=30", localPath, `${CODEX_IMAGEN_HOST}:${remotePath}`]);
}

async function copyRemoteToLocal(remotePath: string, localPath: string) {
  if (shouldRunLocally()) {
    await mkdir(dirname(localPath), { recursive: true });
    await copyFile(remotePath, localPath);
    return;
  }

  await run("scp", ["-q", "-o", "BatchMode=yes", "-o", "ConnectTimeout=30", `${CODEX_IMAGEN_HOST}:${remotePath}`, localPath]);
}

function parseCodexImagenJson(stdout: string): CodexImagenJsonResult {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error("codex-imagen returned an empty response");
  }

  try {
    return JSON.parse(trimmed) as CodexImagenJsonResult;
  } catch (error) {
    throw new Error(`codex-imagen returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function buildCodexImagenCommand(promptPath: string, outputPath: string) {
  return [
    CODEX_IMAGEN_CLI,
    "--prompt-file",
    shellQuote(promptPath),
    "--output",
    shellQuote(outputPath),
    "--model",
    shellQuote(CODEX_IMAGEN_MODEL),
    "--timeout",
    String(CODEX_IMAGEN_TIMEOUT_SECONDS),
    "--json",
    "--quiet",
  ].join(" ");
}

export async function queueCardImageGeneration(card: LetterCard, context: { body: string; locale: AppLocale }): Promise<GenerationResult> {
  if (!ENABLE_REMOTE_IMAGEN) {
    return {
      status: "skipped",
      metadata: {
        reason: "LETTERS_ENABLE_CODEX_IMAGEN is not enabled",
        provider: "codex-imagen",
      },
    };
  }

  const promptDir = process.env.LETTERS_CARD_PROMPT_DIR || DEFAULT_PROMPT_DIR;
  const outputDir = process.env.LETTERS_CARD_OUTPUT_DIR || DEFAULT_OUTPUT_DIR;
  const outputName = `${card.id}.png`;
  const localPromptPath = join(promptDir, `${card.id}.prompt.txt`);
  const localOutputPath = join(outputDir, outputName);
  const remoteDir = `${DEFAULT_REMOTE_ROOT}/${card.id}`;
  const remotePromptPath = `${remoteDir}/prompt.txt`;
  const remoteOutputPath = `${remoteDir}/output${extname(outputName) || ".png"}`;

  await mkdir(dirname(localPromptPath), { recursive: true });
  await mkdir(dirname(localOutputPath), { recursive: true });
  await writeFile(localPromptPath, buildPrompt(card, context.body, context.locale), "utf8");

  try {
    await runRemoteShell(`mkdir -p ${shellQuote(remoteDir)}`);
    await copyLocalToRemote(localPromptPath, remotePromptPath);

    const stdout = await runRemoteShell(buildCodexImagenCommand(remotePromptPath, remoteOutputPath));
    const parsed = parseCodexImagenJson(stdout);
    const generated = parsed.images?.[0];
    const remoteImagePath = generated?.decodedPath || generated?.path || remoteOutputPath;

    await copyRemoteToLocal(remoteImagePath, localOutputPath);

    return {
      status: "ready",
      imageUrl: `/api/letters/card/${card.id}/image`,
      metadata: {
        provider: "codex-imagen",
        model: parsed.model || CODEX_IMAGEN_MODEL,
        remoteSha256: generated?.sha256,
        revisedPrompt: generated?.revised_prompt ?? null,
      },
    };
  } catch (error) {
    return {
      status: "failed",
      metadata: {
        provider: "codex-imagen",
        error: error instanceof Error ? error.message : "unknown error",
      },
    };
  } finally {
    await Promise.allSettled([
      rm(localPromptPath, { force: true }),
      runRemoteShell(`rm -rf ${shellQuote(remoteDir)}`, 15_000),
    ]);
  }
}
