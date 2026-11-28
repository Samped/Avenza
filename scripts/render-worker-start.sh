#!/usr/bin/env bash
# Render background worker entrypoint.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -d apps/worker/dist ]]; then
  exec node apps/worker/dist/main.js
fi
exec npx tsx apps/worker/src/main.ts
