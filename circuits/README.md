# AVENZA TapeOut Circuits

AVENZA binds payment policy gates to **live TapeOut circuits on X Layer**.

## Live binding (hack / production default)

| Role | Value |
|------|--------|
| Factory | `0x1f09daefa827f02cbb40967cc91b259763760761` |
| Processor (Cerebr) | `0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF` |
| PaymentLimit circuit | `#1` — AND(amountOk, budgetOk) |
| Chain for eval | X Layer mainnet `196` |
| Explorer | https://www.oklink.com/xlayer/address/0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF |

FAQ of TapeOut Accelerate allows using existing processors. Cerebr’s public AND neuron matches PaymentLimit.

Verify anytime (free view call):

```bash
cast call 0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF \
  "eval(uint256,bytes)(bytes)" 1 0x03 \
  --rpc-url https://rpc.xlayer.tech
# → 0x01 (pass)
```

## Flow

1. Backend computes boolean policy inputs (amount within limit, budget remaining, …).
2. `evalPaymentLimitOnTapeOut` calls on-chain `eval(circuitId, inputs)`.
3. Result is stored on the payment evaluation and passed into `PaymentAuthorization` as `circuitInputs`.
4. When the on-chain policy registry points at a processor, Solidity **re-runs** `eval` and requires LSB=1 before authorizing treasury movement.

Local NAND helpers in `src/tap02.ts` remain as reference vectors / offline fallback (`ALLOW_TAPEOUT_LOCAL_FALLBACK`).

## Optional: tape out AVENZA-owned circuits

If you prefer a dedicated processor (not Cerebr):

1. `createCPU` via factory on X Layer
2. Mint NAND transistors; `tapeout` the AND netlist `0x0000000300000200000004000004` (nIn=2, nOut=1)
3. Set `TAPEOUT_PROCESSOR_ADDRESS` + `TAPEOUT_PAYMENT_LIMIT_CIRCUIT_ID`
4. Register the same processor/circuit on `PaymentPolicyRegistry`

See `scripts/tapeout-verify.sh` and `docs/hackathon/`.
