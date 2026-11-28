#!/usr/bin/env bash
# Render web service entrypoint: env preflight → migrate → serve Nest API.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> AVENZA API start (NODE_ENV=${NODE_ENV:-} chain=${XLAYER_CHAIN_ID:-})"

required=(
  JWT_SECRET
  SESSION_SECRET
  ENCRYPTION_KEY
  AVENZA_FIELD_ENCRYPTION_KEY
  INTERNAL_WEBHOOK_TOKEN
  RELAYER_PRIVATE_KEY
  PLATFORM_FEE_RECIPIENT
  DATABASE_URL
  USDC_TOKEN_ADDRESS
  PAYMENT_AUTHORIZATION_ADDRESS
  TREASURY_ADDRESS
)

missing=()
for k in "${required[@]}"; do
  if [[ -z "${!k:-}" ]]; then
    missing+=("$k")
  fi
done

if ((${#missing[@]} > 0)); then
  echo "ERROR: missing required environment variables on this Render service:" >&2
  for k in "${missing[@]}"; do
    echo "  - $k" >&2
  done
  echo "Fix: Dashboard → avenza-api → Environment → add each key → Save → Manual Deploy" >&2
  exit 1
fi

# Length checks without printing secrets
ek="${ENCRYPTION_KEY#0x}"
if [[ ${#ek} -ne 64 ]]; then
  echo "ERROR: ENCRYPTION_KEY must be 64 hex chars (got ${#ek})" >&2
  exit 1
fi

npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
exec node apps/api/dist/main.js
