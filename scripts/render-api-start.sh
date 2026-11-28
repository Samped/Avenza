#!/usr/bin/env bash
# Render web service entrypoint: migrate then serve Nest API.
set -euo pipefail
cd "$(dirname "$0")/.."

npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
exec node apps/api/dist/main.js
