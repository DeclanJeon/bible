const PASSTHROUGH_ENV_KEYS = [
  "ADMIN_DEBUG_TOKEN",
  "NEXT_PUBLIC_SITE_URL",
  "SITE_URL",
  "LETTERS_DATA_FILE",
  "LETTERS_EMAIL_ENCRYPTION_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "AUTH_SECRET",
  "AUTH_URL",
  "AUTH_TRUST_HOST",
  "NEXTAUTH_URL",
  "LETTERS_EMAIL_ENV_FILE",
  "LETTERS_RECIPIENT_EMAILS",
  "PONSLINK_ADMIN_EMAILS",
  "LETTERS_ENABLE_CODEX_IMAGEN",
  "LETTERS_CODEX_IMAGEN_HOST",
  "LETTERS_CODEX_IMAGEN_BIN",
  "LETTERS_CODEX_IMAGEN_MODEL",
  "LETTERS_CODEX_IMAGEN_TIMEOUT_SECONDS",
  "LETTERS_CARD_PROMPT_DIR",
  "LETTERS_CARD_OUTPUT_DIR",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
];

function passthroughEnv() {
  return Object.fromEntries(PASSTHROUGH_ENV_KEYS.map((key) => [key, process.env[key]]).filter(([, value]) => value !== undefined));
}

module.exports = {
  apps: [
    {
      name: "bible",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: 2,
      exec_mode: "cluster",
      env: {
        ...passthroughEnv(),
        NODE_ENV: "production",
        PORT: 3100,
        NODE_OPTIONS: "--max-old-space-size=2048",
      },
      max_memory_restart: "1800M",
      listen_timeout: 10000,
      kill_timeout: 5000,
      wait_ready: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};
