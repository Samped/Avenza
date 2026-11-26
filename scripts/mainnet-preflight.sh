#!/usr/bin/env bash
# Enterprise preflight for X Layer mainnet (196) + native USDC + live TapeOut.
# Does not broadcast txs. Exit 0 only when env/gates look ready.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

echo "=== AVENZA mainnet preflight ==="

[[ "${XLAYER_CHAIN_ID:-}" == "196" ]] || fail "XLAYER_CHAIN_ID must be 196"
[[ "${USDC_TOKEN_ADDRESS,,}" == "0xb6ceceab302e2e4948951ee7843fc24e92933061" ]] \
  || fail "USDC_TOKEN_ADDRESS must be native mainnet USDC"
[[ "${ALLOW_TAPEOUT_LOCAL_FALLBACK:-}" == "false" ]] || fail "ALLOW_TAPEOUT_LOCAL_FALLBACK must be false"
[[ "${REQUIRED_CONFIRMATIONS:-0}" -ge 3 ]] || fail "REQUIRED_CONFIRMATIONS must be >= 3"
[[ -n "${JWT_SECRET:-}" && -n "${ENCRYPTION_KEY:-}" && -n "${AVENZA_FIELD_ENCRYPTION_KEY:-}" ]] \
  || fail "JWT_SECRET, ENCRYPTION_KEY, AVENZA_FIELD_ENCRYPTION_KEY required"
[[ "${#ENCRYPTION_KEY}" -eq 64 || "${#ENCRYPTION_KEY}" -eq 66 ]] || fail "ENCRYPTION_KEY should be 64 hex chars"
[[ -n "${INTERNAL_WEBHOOK_TOKEN:-}" ]] || fail "INTERNAL_WEBHOOK_TOKEN required"
[[ -n "${RELAYER_PRIVATE_KEY:-}" ]] || fail "RELAYER_PRIVATE_KEY required"
[[ -n "${DEPLOYER_PRIVATE_KEY:-}" ]] || echo "WARN: DEPLOYER_PRIVATE_KEY unset (only needed for contract deploy)"
if [[ -n "${DEPLOYER_PRIVATE_KEY:-}" && -n "${RELAYER_PRIVATE_KEY:-}" ]]; then
  _dep="${DEPLOYER_PRIVATE_KEY#0x}"; _rel="${RELAYER_PRIVATE_KEY#0x}"
  [[ "${_dep,,}" != "${_rel,,}" ]] || fail "Relayer must differ from deployer"
fi

for a in \
  PAYMENT_AUTHORIZATION_ADDRESS TREASURY_ADDRESS PAYMENT_POLICY_REGISTRY_ADDRESS \
  ORGANIZATION_REGISTRY_ADDRESS VENDOR_REGISTRY_ADDRESS EMERGENCY_CONTROL_ADDRESS
do
  [[ -n "${!a:-}" ]] || fail "$a missing — deploy contracts first"
done

PROC="${SETTLEMENT_TAPEOUT_PROCESSOR_ADDRESS:-${TAPEOUT_PROCESSOR_ADDRESS:-}}"
[[ -n "$PROC" ]] || fail "TapeOut processor address missing"
ok "Native USDC + TapeOut processor configured"

RPC="${TAPEOUT_RPC_URL:-${XLAYER_RPC_URL:-https://rpc.xlayer.tech}}"
echo "Checking TapeOut eval via $RPC ..."
if [[ -x "$ROOT/scripts/tapeout-verify.sh" ]] || [[ -f "$ROOT/scripts/tapeout-verify.sh" ]]; then
  TAPEOUT_RPC_URL="$RPC" "$ROOT/scripts/tapeout-verify.sh" || fail "tapeout-verify.sh failed"
  ok "Live TapeOut circuit eval"
else
  echo "WARN: tapeout-verify.sh not runnable"
fi

ok "Preflight passed — follow docs/mainnet-go-live.md for deploy + 1 USDC smoke + pause drill"
echo "Remember: custody of funding wallets has legal implications before third-party funds."
