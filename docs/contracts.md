# Smart contracts

Foundry project: [`contracts/`](../contracts)

Solidity **0.8.24**, optimizer **200** runs, **`via_ir`** enabled.

**Live addresses:** [Deployments](./deployments.md) (X Layer mainnet `196`).

## Contract catalog

| Contract | File | Role |
|----------|------|------|
| `EmergencyControl` | `EmergencyControl.sol` | Global / org pause |
| `OrganizationRegistry` | `OrganizationRegistry.sol` | Register org; active checks |
| `VendorRegistry` | `VendorRegistry.sol` | Vendor records + verification |
| `PaymentPolicyRegistry` | `PaymentPolicyRegistry.sol` | Versioned policy → `processor`, `circuitId`, `configHash` |
| `PaymentAuthorization` | `PaymentAuthorization.sol` | Relayer-only authorize; TapeOut re-eval; replay / expiry |
| `BusinessTreasury` | `BusinessTreasury.sol` | Per-org USDC balances; execute after auth consume |
| `PaymentRouter` | `PaymentRouter.sol` | Token allowlist + adapter allowlist |
| `AuditRegistry` | `AuditRegistry.sol` | On-chain audit commitments |
| `ITapeOutProcessor` | `interfaces/ITapeOutProcessor.sol` | `eval(uint256,bytes) returns (bytes)` |
| `MockUSDC` / `MockTapeOutProcessor` | `mocks/` | Local tests, Anvil, and testnet settlement re-eval |

## X Layer testnet deployment

| Contract | Address |
|----------|---------|
| EmergencyControl | `0xcc5661D1471e9e61B37Df5Ad5D2E1B2C5578c884` |
| OrganizationRegistry | `0xD2445389196f2c502AB5ec6f49a90cc04BB71ff5` |
| VendorRegistry | `0x3dE7a4C348F7415087a9Cf58FBC57256bAF1eb4b` |
| PaymentPolicyRegistry | `0x0Af7a5DDE4f2B30772eE60F80EfD516A94C56A52` |
| PaymentAuthorization | `0xE3F25b5e9Da3dFA72C0a12f05fd45cc0dD4243dD` |
| PaymentRouter | `0xF10cDEB14604F6311195dA90B6076713f7f42f14` |
| BusinessTreasury | `0x96778c369D85aaCCBF6DE0BcD0671B048E16E5CA` |
| AuditRegistry | `0x79Be215ec0478D616fC2704370c3590f323ef599` |

- **Native USDC:** `0xB6CEceAB302E2E4948951eE7843FC24E92933061`  
- **Organization ID:** `0x603fd1000e3f9b350efdfbeaad5864a151b4bdac12228b5056569a9b2478f82a`  
- **Policy version:** `2` (settlement processor on testnet; see [deployments.md](./deployments.md))  
- **Verification:** Sourcify `exact_match` — https://repo.sourcify.dev/196/

## Authorization flow

```text
relayer → PaymentAuthorization.authorize(AuthRequest)
            ├─ emergency / org active
            ├─ approvals >= required
            ├─ vendorEligible
            ├─ policy version exists
            ├─ if policy.processor != 0:
            │     ITapeOutProcessor(processor).eval(circuitId, circuitInputs)
            │     require LSB of output == 1
            └─ store Authorization (unconsumed, 24h expiry)

relayer → BusinessTreasury.executeAuthorizedPayment(...)
            ├─ consume authorization (paymentId, amount, token, destination match)
            └─ transfer native USDC to destination
```

`AuthRequest` includes `circuitResult` (packed flags) and `circuitInputs` (LSB-packed TapeOut inputs). Opaque non-zero `circuitResult` alone is **not** sufficient when a processor is bound.

## BusinessTreasury

- `deposit(organizationId, amount)` — pulls native USDC into vault accounting  
- `available(organizationId)` — balance minus reserved  
- `executeAuthorizedPayment` — relayer only; one execution per `paymentId`  
- Token and `chainIdAllow` fixed at construction  

## Testing

```bash
cd contracts
forge test
```

Coverage includes authorize + pay, replay, insufficient approvals, pause, double execute, and TapeOut-fail blocks auth.

## Deploy

```bash
export DEPLOYER_PRIVATE_KEY=0x...   # funded OKB; never commit
export XLAYER_CHAIN_ID=196
export XLAYER_RPC_URL=https://testrpc.xlayer.tech/terigon
export USDC_TOKEN_ADDRESS=0xB6CEceAB302E2E4948951eE7843FC24E92933061
./scripts/deploy-xlayer.sh
```

- Production-shaped: [`script/Deploy.s.sol`](../contracts/script/Deploy.s.sol)  
- Helper: [`scripts/deploy-xlayer.sh`](../scripts/deploy-xlayer.sh)  
- Local Anvil: [`script/DeployLocal.s.sol`](../contracts/script/DeployLocal.s.sol)  

On testnet, deploy binds a settlement-compatible TapeOut processor for on-chain re-eval. API TapeOut eval continues to use mainnet Cerebr (`TAPEOUT_EVAL_CHAIN_ID=196`). See [tapeout-xlayer.md](./tapeout-xlayer.md).

## Integration with the API

[`apps/api/src/payments/settlement.ts`](../apps/api/src/payments/settlement.ts):

1. `simulateContract(authorize)` → capture `authorizationId`  
2. `writeContract(authorize)`  
3. `writeContract(executeAuthorizedPayment)` with that id  
4. Assert native USDC via `assertNativeUsdc`

## Security notes

See [security.md](./security.md). Before mainnet customer funds: audit, multisig ownership, KMS relayer, pinned processor bytecode, pause runbooks.
