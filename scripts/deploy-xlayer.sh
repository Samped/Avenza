#!/usr/bin/env bash
# Deploy AVENZA contracts to X Layer (testnet 1952 or mainnet 196).
# Requires: forge, funded DEPLOYER_PRIVATE_KEY, native USDC address for the chain.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Load untracked .env if present (does not override vars already in the shell).
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

cd "$ROOT/contracts"

: "${DEPLOYER_PRIVATE_KEY:?Set DEPLOYER_PRIVATE_KEY in .env (hex, with or without 0x)}"
: "${XLAYER_CHAIN_ID:?Set XLAYER_CHAIN_ID=1952|196}"
: "${USDC_TOKEN_ADDRESS:?Set USDC_TOKEN_ADDRESS}"
: "${XLAYER_RPC_URL:?Set XLAYER_RPC_URL}"

# Relayer defaults to deployer for demos / first testnet run.
export RELAYER_PRIVATE_KEY="${RELAYER_PRIVATE_KEY:-$DEPLOYER_PRIVATE_KEY}"
export DEPLOYER_PRIVATE_KEY XLAYER_CHAIN_ID USDC_TOKEN_ADDRESS
export TAPEOUT_CIRCUIT_ID="${TAPEOUT_CIRCUIT_ID:-1}"
# Only pass processor override when explicitly set (empty string breaks envOr address parsing).
if [[ -n "${TAPEOUT_PROCESSOR_ADDRESS:-}" ]]; then
  export TAPEOUT_PROCESSOR_ADDRESS
fi

if [[ "$XLAYER_CHAIN_ID" == "196" ]]; then
  OUT_JSON="${DEPLOY_OUT:-$ROOT/docs/hackathon/deployed-mainnet.json}"
  # Mainnet safety rails
  if [[ "${USDC_TOKEN_ADDRESS,,}" != "0xb6ceceab302e2e4948951ee7843fc24e92933061" ]]; then
    echo "ERROR: Mainnet USDC must be 0xB6CEceAB302E2E4948951eE7843FC24E92933061" >&2
    exit 1
  fi
  if [[ "${CONFIRM_MAINNET_DEPLOY:-}" != "yes" ]]; then
    echo "Refusing mainnet deploy without CONFIRM_MAINNET_DEPLOY=yes" >&2
    exit 1
  fi
else
  OUT_JSON="${DEPLOY_OUT:-$ROOT/docs/hackathon/deployed-testnet.json}"
fi

echo "Deploying to chain $XLAYER_CHAIN_ID via $XLAYER_RPC_URL"
forge script script/Deploy.s.sol \
  --rpc-url "$XLAYER_RPC_URL" \
  --broadcast \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  -vvvv

LATEST="$(ls -t broadcast/Deploy.s.sol/"$XLAYER_CHAIN_ID"/run-latest.json 2>/dev/null | head -1 || true)"
if [[ -n "$LATEST" ]]; then
  echo ""
  echo "Broadcast log: $LATEST"
  mkdir -p "$(dirname "$OUT_JSON")"
  cp "$LATEST" "$OUT_JSON"
  echo "Copied broadcast → $OUT_JSON"
fi

echo ""
echo "Next:"
echo "  1. Copy logged addresses into .env / apps/api/.env"
echo "  2. Set RELAYER_PRIVATE_KEY (dedicated hot wallet), ALLOW_TAPEOUT_LOCAL_FALLBACK=false"
echo "  3. Transfer Ownable / EmergencyControl to multisig"
echo "  4. Verify: ./scripts/verify-xlayer.sh"
echo "  5. Deposit native USDC into BusinessTreasury for the org"
echo "  6. Follow docs/mainnet-go-live.md smoke + pause drill"
if [[ "$XLAYER_CHAIN_ID" == "196" ]]; then
  echo "  7. Explorer: https://www.oklink.com/xlayer/tx/<hash>"
else
  echo "  7. Explorer: https://www.oklink.com/xlayer-test/tx/<hash>"
fi
