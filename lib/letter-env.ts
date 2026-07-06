import { existsSync, readFileSync } from "node:fs";

const DEFAULT_EMAIL_ENV_PATH = "/home/declan/Documents/Develop/Project/pons_p2p/ponslink-api-infra/.env";
const ALLOWED_PREFIXES = [
  "SMTP_",
  "PONSLINK_ADMIN_EMAILS",
  "LETTERS_RECIPIENT_EMAILS",
  "ADMIN_DEBUG_TOKEN",
  "LETTERS_EMAIL_ENCRYPTION_KEY",
  "PONSLINK_ADMIN_TOKEN",
  "PONSLINK_SECRET_ENCRYPTION_KEY",
];
const KEY_ALIASES: Record<string, string> = {
  PONSLINK_ADMIN_TOKEN: "ADMIN_DEBUG_TOKEN",
  PONSLINK_SECRET_ENCRYPTION_KEY: "LETTERS_EMAIL_ENCRYPTION_KEY",
};
let loaded = false;

function parseEnvLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
    return null;
  }
  const index = trimmed.indexOf("=");
  const key = trimmed.slice(0, index).trim();
  let value = trimmed.slice(index + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

export function loadLettersEmailEnv() {
  if (loaded) {
    return;
  }
  loaded = true;
  const envPath = process.env.LETTERS_EMAIL_ENV_FILE || DEFAULT_EMAIL_ENV_PATH;
  if (!existsSync(envPath)) {
    return;
  }
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }
    if (!ALLOWED_PREFIXES.some((prefix) => parsed.key === prefix || parsed.key.startsWith(prefix))) {
      continue;
    }
    const targetKey = KEY_ALIASES[parsed.key] ?? parsed.key;
    process.env[targetKey] ??= parsed.value;
  }
}
