# TapeOut and X Layer integration

AVENZA uses **X Layer** for settlement and **TapeOut** for deterministic, publicly verifiable policy gates.

## Networks

| Network | Chain ID | Native gas | Native USDC |
|---------|----------|------------|-------------|
| X Layer mainnet | `196` | OKB | `0xB6CEceAB302E2E4948951eE7843FC24E92933061` |
| X Layer testnet | `1952` | OKB | `0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3` |

Defined in [`packages/chain/src/networks.ts`](../packages/chain/src/networks.ts). Bridged USDC is **rejected**.

Explorers (OKLink):

- Mainnet tx: `https://www.oklink.com/xlayer/tx/<hash>`  
- Testnet tx: `https://www.oklink.com/xlayer-test/tx/<hash>`

## What TapeOut is (in AVENZA’s usage)

TapeOut processors store NAND netlists as circuit NFTs. Anyone can run:

```solidity
function eval(uint256 circuitId, bytes calldata inputs) external view returns (bytes memory);
```

Inputs/outputs are **bit-packed, LSB first**. No gas for the caller on view evaluation.

AVENZA’s **PaymentLimit** gate is logical AND(`amountOk`, `budgetOk`).

## Default live binding

| Item | Value |
|------|--------|
| Factory | `0x1f09daefa827f02cbb40967cc91b259763760761` |
| Processor (Cerebr) | `0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF` |
| Circuit | `#1` (AND of two input bits) |
| Eval chain | `196` via `TAPEOUT_EVAL_CHAIN_ID` |

FAQ of TapeOut Accelerate allows using existing processors. Cerebr’s public AND neuron matches PaymentLimit.

### Verify anytime

```bash
./scripts/tapeout-verify.sh
```

Equivalent:

```bash
cast call 0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF \
  "eval(uint256,bytes)(bytes)" 1 0x03 \
  --rpc-url https://rpc.xlayer.tech
# → 0x01  (both bits set → AND true)

cast call 0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF \
  "eval(uint256,bytes)(bytes)" 1 0x01 \
  --rpc-url https://rpc.xlayer.tech
# → 0x00
```

## Runtime path

1. **Policy service** computes boolean inputs from invoice amount vs per-payment / daily limits.  
2. [`evalPaymentLimitOnTapeOut`](../packages/chain/src/tapeout.ts) packs bits and calls `eval` on the configured processor.  
3. Result stored on `PolicyEvaluation.outputData` (`tapeOut` object).  
4. **Authorize** requires `policyPass` (TapeOut pass ∧ other gates).  
5. **Execute** sends `circuitInputs` into `PaymentAuthorization`.  
6. If `PaymentPolicyRegistry` has `processor != address(0)`, the contract **re-runs** `eval` and requires LSB = 1.

Local NAND helpers in `circuits/` and `policyEval.ts` remain for offline vectors. Set:

```bash
ALLOW_TAPEOUT_LOCAL_FALLBACK=false
```

to fail closed when RPC eval is unavailable.

## Environment

```bash
TAPEOUT_FACTORY_ADDRESS=0x1f09daefa827f02cbb40967cc91b259763760761
TAPEOUT_PROCESSOR_ADDRESS=0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF
TAPEOUT_PAYMENT_LIMIT_CIRCUIT_ID=1
TAPEOUT_EVAL_CHAIN_ID=196
TAPEOUT_RPC_URL=https://rpc.xlayer.tech
ALLOW_TAPEOUT_LOCAL_FALLBACK=true   # set false in strict mode
```

Production settlement uses mainnet (`XLAYER_CHAIN_ID=196`) with the same Cerebr processor as TapeOut eval. Testnet settlement (`1952`) remains optional for isolated experiments and uses a local MockTapeOutProcessor.

**Live settlement addresses:** [deployments.md](./deployments.md).

## Console surfaces

- **Policies** — bind processor + circuit; show explorer link  
- **Payments** — last eval mode / inputs / output; explorer tx when on-chain  
- **Treasury** — processor, factory, circuit, settlement mode  

## Own processor (optional)

1. `createCPU` via TapeOut factory on X Layer.  
2. Mint NAND transistors; `tapeout` AND netlist `0x0000000300000200000004000004` (`nIn=2`, `nOut=1`).  
3. Set `TAPEOUT_PROCESSOR_ADDRESS` + circuit id.  
4. Register the same pair on `PaymentPolicyRegistry` (deploy script does this for the demo org).  

See [`circuits/README.md`](../circuits/README.md).

## Related

- [Deployments](./deployments.md)
- [Contracts](./contracts.md)  
- [Architecture](./architecture.md)  
- [Security](./security.md)  
