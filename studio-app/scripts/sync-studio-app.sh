#!/usr/bin/env bash
# Copies this Arc Studio app into the GitHub clone (verifypay-maria/studio-app/). Never copies secrets or local state.
# Usage (from /home/user/app):  bash scripts/sync-studio-app.sh
set -euo pipefail
SRC=/home/user/app
DST="$SRC/verifypay-maria/studio-app"
cd "$SRC"
rm -rf "$DST"
mkdir -p "$DST"
tar cf - \
  --exclude='node_modules' --exclude='dist' \
  --exclude='.env' --exclude='.env.*' \
  --exclude='server/data' --exclude='.circle' --exclude='recovery_file*' \
  --exclude='*.log' --exclude='*.tmp' \
  src scripts server index.html package.json bun.lock vite.config.ts tsconfig.json \
  tailwind.config.js postcss.config.js .oxlintrc.json .gitignore .bun-version README.md AGENTS.md \
  | tar xf - -C "$DST"
echo "synced $(find "$DST" -type f | wc -l) files into verifypay-maria/studio-app/"
