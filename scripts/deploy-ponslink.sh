#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
REMOTE=${PONSLINK_SSH:-ponslink}
REMOTE_DIR=${PONSLINK_DIR:-/home/declan/bible}
SHADOW_DIR=${PONSLINK_SHADOW_DIR:-${REMOTE_DIR}.shadow}
BACKUP_DIR=${PONSLINK_BACKUP_DIR:-${REMOTE_DIR}.prev}
SHADOW_PORT=${PONSLINK_SHADOW_PORT:-3110}

ssh "$REMOTE" "set -euo pipefail
rm -rf '$SHADOW_DIR'
mkdir -p '$SHADOW_DIR'
"

rsync -a \
  --exclude .git \
  --exclude node_modules \
  --exclude .next \
  --exclude .data \
  --exclude v2 \
  --exclude v2.tar \
  --exclude .omx \
  --exclude .omx-artifacts \
  --exclude dist \
  --exclude build \
  --exclude coverage \
  --exclude .cache \
  --exclude target \
  --exclude .venv \
  --exclude vendor \
  --exclude '*.sqlite' \
  --exclude '*.sqlite-shm' \
  --exclude '*.sqlite-wal' \
  "$ROOT_DIR/" "$REMOTE:$SHADOW_DIR/"

ssh "$REMOTE" \
  LIVE_DIR="$REMOTE_DIR" \
  SHADOW_DIR="$SHADOW_DIR" \
  BACKUP_DIR="$BACKUP_DIR" \
  SHADOW_PORT="$SHADOW_PORT" \
  PM2_STRATEGY="${PONSLINK_PM2_STRATEGY:-reload}" \
  'bash -s' <<'EOF'
set -euo pipefail

LIVE_PORT=3100
SHADOW_LOG="$SHADOW_DIR/.shadow-start.log"
SHADOW_PID_FILE="$SHADOW_DIR/.shadow-start.pid"

cleanup_shadow() {
  if [ -f "$SHADOW_PID_FILE" ]; then
    SHADOW_PID=$(cat "$SHADOW_PID_FILE" 2>/dev/null || true)
    if [ -n "${SHADOW_PID:-}" ] && kill -0 "$SHADOW_PID" 2>/dev/null; then
      kill "$SHADOW_PID" 2>/dev/null || true
      wait "$SHADOW_PID" 2>/dev/null || true
    fi
    rm -f "$SHADOW_PID_FILE"
  fi
}

rollback_live() {
  set +e
  cleanup_shadow
  if [ -d "$BACKUP_DIR" ]; then
    rm -rf "$LIVE_DIR.failed"
    if [ -d "$LIVE_DIR" ]; then
      mv "$LIVE_DIR" "$LIVE_DIR.failed"
    fi
    mv "$BACKUP_DIR" "$LIVE_DIR"
    cd "$LIVE_DIR"
    set -a
    if [ -f "$HOME/.config/bible.env" ]; then
      . "$HOME/.config/bible.env"
    fi
    set +a
    pm2 startOrReload ecosystem.config.cjs --update-env || true
  fi
}

start_live_pm2() {
  case "$PM2_STRATEGY" in
    reload)
      pm2 startOrReload ecosystem.config.cjs --update-env
      ;;
    recreate)
      pm2 delete bible >/dev/null 2>&1 || true
      pm2 start ecosystem.config.cjs --only bible --update-env
      ;;
    *)
      echo "Unsupported PONSLINK_PM2_STRATEGY: $PM2_STRATEGY" >&2
      return 1
      ;;
  esac
}

trap rollback_live ERR
trap cleanup_shadow EXIT

cd "$SHADOW_DIR"
npm ci
npm run build:crossref-db
npm run build:bible-db
npm run build:passage-index-db
npm run build

set -a
if [ -f "$HOME/.config/bible.env" ]; then
  . "$HOME/.config/bible.env"
fi
set +a

PORT="$SHADOW_PORT" nohup npm run start >"$SHADOW_LOG" 2>&1 &
echo $! > "$SHADOW_PID_FILE"

wait_for_http() {
  local base_url=$1
  local attempts=${2:-60}
  for _ in $(seq 1 "$attempts"); do
    if BASE_URL="$base_url" node - <<'JS'
const baseUrl = process.env.BASE_URL;
try {
  const res = await fetch(`${baseUrl}/api/runtime`);
  if (!res.ok) process.exit(1);
  process.exit(0);
} catch {
  process.exit(1);
}
JS
    then
      return 0
    fi
    sleep 1
  done
  return 1
}

validate_surface_bundle() {
  local base_url=$1
  BASE_URL="$base_url" node - <<'JS'
const baseUrl = process.env.BASE_URL;
const urls = [
  `${baseUrl}/api/runtime`,
  `${baseUrl}/ko`,
  `${baseUrl}/ko/bible?book=GEN&chapter=1`,
  `${baseUrl}/ko/hanja/ui-righteousness`,
  `${baseUrl}/ko/api/crossrefs/MAT-11-28-30`,
];
for (const url of urls) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Validation failed for ${url}: ${res.status}`);
  }
}
console.log(`Validated ${urls.length} URLs at ${baseUrl}`);
JS
}

validate_pm2_shape() {
  node - <<'JS'
const { execSync } = require("node:child_process");
const path = require("node:path");
const ecosystem = require(path.resolve("ecosystem.config.cjs"));
const app = ecosystem.apps?.find((entry) => entry.name === "bible");
if (!app) {
  throw new Error("ecosystem.config.cjs is missing the bible app");
}
const entries = JSON.parse(execSync("pm2 jlist", { encoding: "utf8" })).filter((entry) => entry.name === app.name);
const expectedInstances = typeof app.instances === "number" ? app.instances : null;
const expectedMode = app.exec_mode === "cluster" ? "cluster_mode" : app.exec_mode === "fork" ? "fork_mode" : null;
const expectedScript = path.resolve(process.cwd(), app.script);
const issues = [];
if (!entries.length) {
  issues.push(`PM2 app ${app.name} is missing after reload`);
}
if (expectedInstances !== null && entries.length !== expectedInstances) {
  issues.push(`expected ${expectedInstances} PM2 entries for ${app.name}, found ${entries.length}`);
}
for (const entry of entries) {
  const actualMode = entry.pm2_env?.exec_mode ?? "unknown";
  const actualScript = entry.pm2_env?.pm_exec_path ?? "unknown";
  if (expectedMode && actualMode !== expectedMode) {
    issues.push(`pm_id ${entry.pm_id} is ${actualMode}, expected ${expectedMode}`);
  }
  if (actualScript !== expectedScript) {
    issues.push(`pm_id ${entry.pm_id} uses ${actualScript}, expected ${expectedScript}`);
  }
}
if (issues.length > 0) {
  throw new Error(`PM2 runtime shape mismatch: ${issues.join("; ")}`);
}
console.log(`Validated PM2 runtime shape for ${app.name}: ${entries.length} entries, mode ${expectedMode}, script ${expectedScript}`);
JS
}

wait_for_http "http://127.0.0.1:${SHADOW_PORT}"
validate_surface_bundle "http://127.0.0.1:${SHADOW_PORT}"
cleanup_shadow

rm -rf "$BACKUP_DIR"
if [ -d "$LIVE_DIR" ]; then
  mv "$LIVE_DIR" "$BACKUP_DIR"
fi
mv "$SHADOW_DIR" "$LIVE_DIR"

cd "$LIVE_DIR"
set -a
if [ -f "$HOME/.config/bible.env" ]; then
  . "$HOME/.config/bible.env"
fi
set +a
start_live_pm2
wait_for_http "http://127.0.0.1:${LIVE_PORT}"
validate_surface_bundle "http://127.0.0.1:${LIVE_PORT}"
validate_pm2_shape

trap - ERR
trap - EXIT
rm -rf "$BACKUP_DIR"
EOF