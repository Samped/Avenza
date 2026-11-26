#!/usr/bin/env bash
# Verify AVENZA contracts on X Layer (Sourcify by default; OKLink if OKLINK_API_KEY set).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

cd "$ROOT/contracts"

CHAIN_ID="${XLAYER_CHAIN_ID:-1952}"
DEPLOYER="${DEPLOYER_ADDRESS:-}"
if [[ -z "$DEPLOYER" && -n "${DEPLOYER_PRIVATE_KEY:-}" ]]; then
  DEPLOYER=$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")
fi

: "${EMERGENCY_CONTROL_ADDRESS:?}"
: "${ORGANIZATION_REGISTRY_ADDRESS:?}"
: "${VENDOR_REGISTRY_ADDRESS:?}"
: "${PAYMENT_POLICY_REGISTRY_ADDRESS:?}"
: "${PAYMENT_ROUTER_ADDRESS:?}"
: "${PAYMENT_AUTHORIZATION_ADDRESS:?}"
: "${TREASURY_ADDRESS:?}"
: "${AUDIT_REGISTRY_ADDRESS:?}"
: "${USDC_TOKEN_ADDRESS:?}"
: "${DEPLOYER:?Set DEPLOYER_ADDRESS or DEPLOYER_PRIVATE_KEY}"

MAX_PAYMENT="${MAX_PAYMENT_AMOUNT:-50000000000000}"
RELAYER="${RELAYER_ADDRESS:-$DEPLOYER}"

VERIFIER="${VERIFIER:-sourcify}"
EXTRA=()
if [[ "$VERIFIER" == "oklink" ]]; then
  : "${OKLINK_API_KEY:?Set OKLINK_API_KEY for OKLink verification}"
  if [[ "$CHAIN_ID" == "196" ]]; then
    VURL="https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER"
  else
    VURL="https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER_TESTNET"
  fi
  EXTRA=(--verifier oklink --verifier-url "$VURL" --verifier-api-key "$OKLINK_API_KEY")
else
  EXTRA=(--verifier sourcify)
fi

verify() {
  local addr="$1" path="$2" args="$3" name="$4"
  echo "===== $name @ $addr ====="
  if [[ -n "$args" ]]; then
    forge verify-contract "$addr" "$path" --chain "$CHAIN_ID" --constructor-args "$args" --watch "${EXTRA[@]}"
  else
    forge verify-contract "$addr" "$path" --chain "$CHAIN_ID" --watch "${EXTRA[@]}"
  fi
}

ARGS_OWNER=$(cast abi-encode "constructor(address)" "$DEPLOYER")
ARGS_VENDOR=$(cast abi-encode "constructor(address,address)" "$DEPLOYER" "$ORGANIZATION_REGISTRY_ADDRESS")
ARGS_AUTH=$(cast abi-encode "constructor(address,address,address,address,address,uint256)" \
  "$DEPLOYER" "$ORGANIZATION_REGISTRY_ADDRESS" "$PAYMENT_POLICY_REGISTRY_ADDRESS" \
  "$EMERGENCY_CONTROL_ADDRESS" "$RELAYER" "$MAX_PAYMENT")
ARGS_TREASURY=$(cast abi-encode "constructor(address,address,address,address,address,uint256,address)" \
  "$DEPLOYER" "$PAYMENT_AUTHORIZATION_ADDRESS" "$PAYMENT_ROUTER_ADDRESS" \
  "$EMERGENCY_CONTROL_ADDRESS" "$USDC_TOKEN_ADDRESS" "$CHAIN_ID" "$RELAYER")

verify "$EMERGENCY_CONTROL_ADDRESS" "src/EmergencyControl.sol:EmergencyControl" "$ARGS_OWNER" "EmergencyControl"
verify "$ORGANIZATION_REGISTRY_ADDRESS" "src/OrganizationRegistry.sol:OrganizationRegistry" "$ARGS_OWNER" "OrganizationRegistry"
verify "$VENDOR_REGISTRY_ADDRESS" "src/VendorRegistry.sol:VendorRegistry" "$ARGS_VENDOR" "VendorRegistry"
verify "$PAYMENT_POLICY_REGISTRY_ADDRESS" "src/PaymentPolicyRegistry.sol:PaymentPolicyRegistry" "$ARGS_OWNER" "PaymentPolicyRegistry"
verify "$PAYMENT_ROUTER_ADDRESS" "src/PaymentRouter.sol:PaymentRouter" "$ARGS_OWNER" "PaymentRouter"
verify "$PAYMENT_AUTHORIZATION_ADDRESS" "src/PaymentAuthorization.sol:PaymentAuthorization" "$ARGS_AUTH" "PaymentAuthorization"
verify "$TREASURY_ADDRESS" "src/BusinessTreasury.sol:BusinessTreasury" "$ARGS_TREASURY" "BusinessTreasury"
verify "$AUDIT_REGISTRY_ADDRESS" "src/AuditRegistry.sol:AuditRegistry" "$ARGS_OWNER" "AuditRegistry"

if [[ -n "${SETTLEMENT_TAPEOUT_PROCESSOR_ADDRESS:-}" ]]; then
  verify "$SETTLEMENT_TAPEOUT_PROCESSOR_ADDRESS" \
    "src/mocks/MockTapeOutProcessor.sol:MockTapeOutProcessor" "" "MockTapeOutProcessor"
fi

echo "All requested verifications submitted (verifier=$VERIFIER)."
