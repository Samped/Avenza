#!/usr/bin/env bash
# Push production secrets to Fly from a local untracked env file.
# Usage: ./scripts/fly-set-secrets.sh [.env.mainnet]
# Never commit the secrets file.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-$ROOT/.env.mainnet}"
APP="${FLY_APP:-avenza-api}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy apps/api/.env.mainnet.example and fill values." >&2
  exit 1
fi

if ! command -v flyctl >/dev/null 2>&1 && ! command -v fly >/dev/null 2>&1; then
  echo "Install flyctl first: https://fly.io/docs/hands-on/install-flyctl/" >&2
  exit 1
fi
FLY="$(command -v flyctl || command -v fly)"

KEYS=(
  DATABASE_URL REDIS_URL JWT_SECRET SESSION_SECRET ENCRYPTION_KEY AVENZA_FIELD_ENCRYPTION_KEY
  INTERNAL_WEBHOOK_TOKEN RELAYER_PRIVATE_KEY REGISTRY_OWNER_PRIVATE_KEY
  PLATFORM_FEE_BPS PLATFORM_FEE_FLAT_MINOR GAS_RECOVERY_USDC_MINOR PLATFORM_FEE_RECIPIENT
  EMERGENCY_CONTROL_ADDRESS ORGANIZATION_REGISTRY_ADDRESS VENDOR_REGISTRY_ADDRESS
  PAYMENT_POLICY_REGISTRY_ADDRESS CONTROLS_REGISTRY_ADDRESS PAYMENT_AUTHORIZATION_ADDRESS
  PAYMENT_ROUTER_ADDRESS TREASURY_ADDRESS AUDIT_REGISTRY_ADDRESS ORGANIZATION_ONCHAIN_ID
  APP_URL API_URL CORS_ORIGINS
)

ARGS=()
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line// }" ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  for want in "${KEYS[@]}"; do
    if [[ "$key" == "$want" && -n "$val" ]]; then
      ARGS+=("${key}=${val}")
    fi
  done
done < "$ENV_FILE"

if [[ ${#ARGS[@]} -eq 0 ]]; then
  echo "No secrets found in $ENV_FILE" >&2
  exit 1
fi

echo "Setting ${#ARGS[@]} secrets on Fly app $APP ..."
"$FLY" secrets set -a "$APP" "${ARGS[@]}"
echo "Done. Redeploy if machines were already running: fly deploy --dockerfile Dockerfile.api"
