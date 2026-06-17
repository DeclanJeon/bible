#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
REMOTE=${PONSLINK_SSH:-ponslink}
REMOTE_DIR=${PONSLINK_DIR:-/home/declan/bible}

rsync -a --delete \
  --exclude .git \
  --exclude node_modules \
  --exclude .next \
  --exclude .data \
  --exclude dist \
  --exclude build \
  --exclude coverage \
  --exclude .cache \
  --exclude target \
  --exclude .venv \
  --exclude vendor \
  "$ROOT_DIR/" "$REMOTE:$REMOTE_DIR/"

ssh "$REMOTE" "set -euo pipefail
cd '$REMOTE_DIR'
npm ci
npm run build
set -a
if [ -f \"\$HOME/.config/bible.env\" ]; then
  . \"\$HOME/.config/bible.env\"
fi
set +a
pm2 startOrReload ecosystem.config.cjs --update-env
"
