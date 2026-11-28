# Deployments

Canonical on-chain addresses for AVENZA. **Production settlement is X Layer mainnet (`196`).** Prefer this document over scattered notes when integrating wallets, explorers, or the API.

## Production application hosts

| Surface | URL |
|---------|-----|
| Console | https://avenzafinance.site |
| API | https://avenza-api-7p71.onrender.com |
| API health | https://avenza-api-7p71.onrender.com/api/v1/health |
| Hosting runbook | [hosting-render-vercel.md](./hosting-render-vercel.md) |

## X Layer mainnet (chain ID `196`) — production

| Network | Value |
|---------|--------|
| Chain ID | `196` |
| RPC | `https://rpc.xlayer.tech` |
| Native gas | OKB |
| Native USDC | [`0xB6CEceAB302E2E4948951eE7843FC24E92933061`](https://www.oklink.com/xlayer/token/0xB6CEceAB302E2E4948951eE7843FC24E92933061) |
| Block explorer | [OKLink X Layer](https://www.oklink.com/xlayer) |
| Deployer | [`0xD9792Bf937D9673ab08c452fE55Ec4e26632Be54`](https://www.oklink.com/xlayer/address/0xD9792Bf937D9673ab08c452fE55Ec4e26632Be54) |
| Relayer | [`0x43C622c37AA6D9F4e0ADda249710c54E0eC09184`](https://www.oklink.com/xlayer/address/0x43C622c37AA6D9F4e0ADda249710c54E0eC09184) |
| TapeOut processor (Cerebr) | [`0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF`](https://www.oklink.com/xlayer/address/0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF) |
| PaymentLimit circuit | `#1` |

### Settlement contracts

| Contract | Address | Explorer |
|----------|---------|----------|
| EmergencyControl | `0xcc5661D1471e9e61B37Df5Ad5D2E1B2C5578c884` | [View](https://www.oklink.com/xlayer/address/0xcc5661D1471e9e61B37Df5Ad5D2E1B2C5578c884) |
| OrganizationRegistry | `0xD2445389196f2c502AB5ec6f49a90cc04BB71ff5` | [View](https://www.oklink.com/xlayer/address/0xD2445389196f2c502AB5ec6f49a90cc04BB71ff5) |
| VendorRegistry | `0x3dE7a4C348F7415087a9Cf58FBC57256bAF1eb4b` | [View](https://www.oklink.com/xlayer/address/0x3dE7a4C348F7415087a9Cf58FBC57256bAF1eb4b) |
| PaymentPolicyRegistry | `0x0Af7a5DDE4f2B30772eE60F80EfD516A94C56A52` | [View](https://www.oklink.com/xlayer/address/0x0Af7a5DDE4f2B30772eE60F80EfD516A94C56A52) |
| ControlsRegistry | `0xF10cDEB14604F6311195dA90B6076713f7f42f14` | [View](https://www.oklink.com/xlayer/address/0xF10cDEB14604F6311195dA90B6076713f7f42f14) |
| PaymentAuthorization | `0x96778c369D85aaCCBF6DE0BcD0671B048E16E5CA` | [View](https://www.oklink.com/xlayer/address/0x96778c369D85aaCCBF6DE0BcD0671B048E16E5CA) |
| PaymentRouter | `0xE3F25b5e9Da3dFA72C0a12f05fd45cc0dD4243dD` | [View](https://www.oklink.com/xlayer/address/0xE3F25b5e9Da3dFA72C0a12f05fd45cc0dD4243dD) |
| BusinessTreasury | `0x951adC47425FB4441A3D057d3e10Fa5D4eC27Ed1` | [View](https://www.oklink.com/xlayer/address/0x951adC47425FB4441A3D057d3e10Fa5D4eC27Ed1) |
| AuditRegistry | `0xEc114e0B3d39CaFEBE9d9aC25932A75958A7fbDC` | [View](https://www.oklink.com/xlayer/address/0xEc114e0B3d39CaFEBE9d9aC25932A75958A7fbDC) |

### Organization & policy

| Item | Value |
|------|--------|
| Organization ID (bytes32) | `0x603fd1000e3f9b350efdfbeaad5864a151b4bdac12228b5056569a9b2478f82a` |
| Active policy version | `1` |
| Settlement TapeOut processor | [`0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF`](https://www.oklink.com/xlayer/address/0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF) (Cerebr) |
| Settlement circuit ID | `1` |

Policy is bound to **mainnet Cerebr circuit `#1`** end-to-end (API eval + on-chain `PaymentAuthorization` re-eval).

### Environment mapping

```bash
XLAYER_CHAIN_ID=196
XLAYER_RPC_URL=https://rpc.xlayer.tech
USDC_TOKEN_ADDRESS=0xB6CEceAB302E2E4948951eE7843FC24E92933061
EMERGENCY_CONTROL_ADDRESS=0xcc5661D1471e9e61B37Df5Ad5D2E1B2C5578c884
ORGANIZATION_REGISTRY_ADDRESS=0xD2445389196f2c502AB5ec6f49a90cc04BB71ff5
VENDOR_REGISTRY_ADDRESS=0x3dE7a4C348F7415087a9Cf58FBC57256bAF1eb4b
PAYMENT_POLICY_REGISTRY_ADDRESS=0x0Af7a5DDE4f2B30772eE60F80EfD516A94C56A52
CONTROLS_REGISTRY_ADDRESS=0xF10cDEB14604F6311195dA90B6076713f7f42f14
PAYMENT_AUTHORIZATION_ADDRESS=0x96778c369D85aaCCBF6DE0BcD0671B048E16E5CA
PAYMENT_ROUTER_ADDRESS=0xE3F25b5e9Da3dFA72C0a12f05fd45cc0dD4243dD
TREASURY_ADDRESS=0x951adC47425FB4441A3D057d3e10Fa5D4eC27Ed1
AUDIT_REGISTRY_ADDRESS=0xEc114e0B3d39CaFEBE9d9aC25932A75958A7fbDC
ORGANIZATION_ONCHAIN_ID=0x603fd1000e3f9b350efdfbeaad5864a151b4bdac12228b5056569a9b2478f82a
SETTLEMENT_TAPEOUT_PROCESSOR_ADDRESS=0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF
TAPEOUT_PROCESSOR_ADDRESS=0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF
TAPEOUT_PAYMENT_LIMIT_CIRCUIT_ID=1
TAPEOUT_EVAL_CHAIN_ID=196
ALLOW_TAPEOUT_LOCAL_FALLBACK=false
REQUIRED_CONFIRMATIONS=3
NEXT_PUBLIC_XLAYER_CHAIN_ID=196
NEXT_PUBLIC_USDC_TOKEN_ADDRESS=0xB6CEceAB302E2E4948951eE7843FC24E92933061
NEXT_PUBLIC_EXPLORER_TX_BASE=https://www.oklink.com/xlayer/tx
NEXT_PUBLIC_EXPLORER_ADDRESS_BASE=https://www.oklink.com/xlayer/address/
```

Set `DEPLOYER_PRIVATE_KEY` / `RELAYER_PRIVATE_KEY` locally (never commit). Relayer must differ from deployer and hold OKB for gas. Fund **native** USDC into `BusinessTreasury` per org.

Machine-readable snapshot: [`hackathon/deployed-mainnet.json`](./hackathon/deployed-mainnet.json). Ops: [mainnet-go-live.md](./mainnet-go-live.md).

---

## TapeOut evaluation (X Layer mainnet)

| Asset | Address / ID |
|-------|----------------|
| TapeOut factory | `0x1f09daefa827f02cbb40967cc91b259763760761` |
| Processor (Cerebr) | [`0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF`](https://www.oklink.com/xlayer/address/0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF) |
| PaymentLimit circuit | `#1` (AND of amount / budget flags) |
| Eval RPC | `https://rpc.xlayer.tech` |

Verify with `./scripts/tapeout-verify.sh`.

---

## X Layer testnet (chain ID `1952`) — legacy / optional

Testnet remains available for isolated experiments. **Do not mix testnet contract addresses with mainnet `XLAYER_CHAIN_ID=196`.** Same deployer CREATE nonces can yield familiar-looking addresses on both chains that map to **different** bytecode roles — always use the tables for the chain you are on.

| Network | Value |
|---------|--------|
| Chain ID | `1952` |
| RPC | `https://testrpc.xlayer.tech/terigon` |
| Native USDC | `0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3` |
| Explorer | [OKLink X Layer Testnet](https://www.oklink.com/x-layer-testnet) |
| Snapshot | [`hackathon/deployed-testnet.json`](./hackathon/deployed-testnet.json) |

Redeploy testnet with `XLAYER_CHAIN_ID=1952 ./scripts/deploy-xlayer.sh` (deploys a local `MockTapeOutProcessor` for on-chain re-eval).

---

## Source verification

| Provider | Status |
|----------|--------|
| Sourcify (mainnet `196`) | Run `./scripts/verify-xlayer.sh` after deploy |
| OKLink explorer UI | Partial — via-IR contracts may not reproduce on OKLink’s compiler; Sourcify remains authoritative |

---

## Tooling

```bash
CONFIRM_MAINNET_DEPLOY=yes ./scripts/deploy-xlayer.sh   # mainnet (loads .env)
./scripts/verify-xlayer.sh                              # Sourcify (default) or VERIFIER=oklink
./scripts/mainnet-preflight.sh
cd contracts && forge test
```

Compiler profile: Solidity `0.8.24`, optimizer `200` runs, `via_ir` enabled.
