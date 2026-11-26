#!/usr/bin/env bash
# Verify AVENZA PaymentLimit TapeOut binding on X Layer (free eth_call).
set -euo pipefail

PROCESSOR="${TAPEOUT_PROCESSOR_ADDRESS:-0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF}"
CIRCUIT="${TAPEOUT_PAYMENT_LIMIT_CIRCUIT_ID:-1}"
RPC="${TAPEOUT_RPC_URL:-https://rpc.xlayer.tech}"

echo "Processor: $PROCESSOR"
echo "Circuit:   #$CIRCUIT"
echo "RPC:       $RPC"

pass=$(cast call "$PROCESSOR" "eval(uint256,bytes)(bytes)" "$CIRCUIT" 0x03 --rpc-url "$RPC")
fail=$(cast call "$PROCESSOR" "eval(uint256,bytes)(bytes)" "$CIRCUIT" 0x01 --rpc-url "$RPC")

echo "eval(1, 0x03) => $pass  (expect 0x01)"
echo "eval(1, 0x01) => $fail  (expect 0x00)"

[[ "$pass" == "0x01" ]] || { echo "FAIL: AND(true,true) did not pass"; exit 1; }
[[ "$fail" == "0x00" ]] || { echo "FAIL: AND(true,false) did not fail"; exit 1; }
echo "OK — TapeOut PaymentLimit circuit verified on X Layer"
