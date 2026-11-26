# Deployments

Canonical on-chain addresses for AVENZA. Prefer this document over scattered notes when integrating wallets, explorers, or the API.

## X Layer testnet (chain ID `1952`)

| Network | Value |
|---------|--------|
| Chain ID | `1952` |
| RPC | `https://testrpc.xlayer.tech/terigon` |
| Native gas | OKB |
| Native USDC | [`0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3`](https://www.oklink.com/x-layer-testnet/token/0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3) |
| Block explorer | [OKLink X Layer Testnet](https://www.oklink.com/x-layer-testnet) |
| Deployer | [`0xD9792Bf937D9673ab08c452fE55Ec4e26632Be54`](https://www.oklink.com/x-layer-testnet/address/0xD9792Bf937D9673ab08c452fE55Ec4e26632Be54) |

### Settlement contracts

| Contract | Address | Explorer |
|----------|---------|----------|
| EmergencyControl | `0xcc5661D1471e9e61B37Df5Ad5D2E1B2C5578c884` | [View](https://www.oklink.com/x-layer-testnet/address/0xcc5661D1471e9e61B37Df5Ad5D2E1B2C5578c884) |
| OrganizationRegistry | `0xD2445389196f2c502AB5ec6f49a90cc04BB71ff5` | [View](https://www.oklink.com/x-layer-testnet/address/0xD2445389196f2c502AB5ec6f49a90cc04BB71ff5) |
| VendorRegistry | `0x3dE7a4C348F7415087a9Cf58FBC57256bAF1eb4b` | [View](https://www.oklink.com/x-layer-testnet/address/0x3dE7a4C348F7415087a9Cf58FBC57256bAF1eb4b) |
| PaymentPolicyRegistry | `0x0Af7a5DDE4f2B30772eE60F80EfD516A94C56A52` | [View](https://www.oklink.com/x-layer-testnet/address/0x0Af7a5DDE4f2B30772eE60F80EfD516A94C56A52) |
| PaymentAuthorization | `0xE3F25b5e9Da3dFA72C0a12f05fd45cc0dD4243dD` | [View](https://www.oklink.com/x-layer-testnet/address/0xE3F25b5e9Da3dFA72C0a12f05fd45cc0dD4243dD) |
| PaymentRouter | `0xF10cDEB14604F6311195dA90B6076713f7f42f14` | [View](https://www.oklink.com/x-layer-testnet/address/0xF10cDEB14604F6311195dA90B6076713f7f42f14) |
| BusinessTreasury | `0x96778c369D85aaCCBF6DE0BcD0671B048E16E5CA` | [View](https://www.oklink.com/x-layer-testnet/address/0x96778c369D85aaCCBF6DE0BcD0671B048E16E5CA) |
| AuditRegistry | `0x79Be215ec0478D616fC2704370c3590f323ef599` | [View](https://www.oklink.com/x-layer-testnet/address/0x79Be215ec0478D616fC2704370c3590f323ef599) |

### Organization & policy

| Item | Value |
|------|--------|
| Organization ID (bytes32) | `0x603fd1000e3f9b350efdfbeaad5864a151b4bdac12228b5056569a9b2478f82a` |
| Active policy version | `2` |
| Settlement TapeOut processor (testnet) | [`0xEc114e0B3d39CaFEBE9d9aC25932A75958A7fbDC`](https://www.oklink.com/x-layer-testnet/address/0xEc114e0B3d39CaFEBE9d9aC25932A75958A7fbDC) |
| Settlement circuit ID | `1` |

The settlement processor on testnet implements the same AND gate surface as Cerebr circuit `#1` so `PaymentAuthorization` can re-run `eval` on chain `1952`. Cross-chain calls to mainnet Cerebr are not possible from testnet.

### Environment mapping

```bash
XLAYER_CHAIN_ID=1952
XLAYER_RPC_URL=https://testrpc.xlayer.tech/terigon
USDC_TOKEN_ADDRESS=0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3
EMERGENCY_CONTROL_ADDRESS=0xcc5661D1471e9e61B37Df5Ad5D2E1B2C5578c884
ORGANIZATION_REGISTRY_ADDRESS=0xD2445389196f2c502AB5ec6f49a90cc04BB71ff5
VENDOR_REGISTRY_ADDRESS=0x3dE7a4C348F7415087a9Cf58FBC57256bAF1eb4b
PAYMENT_POLICY_REGISTRY_ADDRESS=0x0Af7a5DDE4f2B30772eE60F80EfD516A94C56A52
PAYMENT_AUTHORIZATION_ADDRESS=0xE3F25b5e9Da3dFA72C0a12f05fd45cc0dD4243dD
PAYMENT_ROUTER_ADDRESS=0xF10cDEB14604F6311195dA90B6076713f7f42f14
TREASURY_ADDRESS=0x96778c369D85aaCCBF6DE0BcD0671B048E16E5CA
AUDIT_REGISTRY_ADDRESS=0x79Be215ec0478D616fC2704370c3590f323ef599
ORGANIZATION_ONCHAIN_ID=0x603fd1000e3f9b350efdfbeaad5864a151b4bdac12228b5056569a9b2478f82a
SETTLEMENT_TAPEOUT_PROCESSOR_ADDRESS=0xEc114e0B3d39CaFEBE9d9aC25932A75958A7fbDC
```

Set `RELAYER_PRIVATE_KEY` locally (never commit). For live treasury execution, fund native USDC into `BusinessTreasury` and set `ALLOW_SIMULATED_SETTLEMENT=false`.

---

## X Layer mainnet (chain ID `196`) — settlement

Settlement contracts are **not** live until you run:

```bash
CONFIRM_MAINNET_DEPLOY=yes XLAYER_CHAIN_ID=196 \
  USDC_TOKEN_ADDRESS=0xB6CEceAB302E2E4948951eE7843FC24E92933061 \
  XLAYER_RPC_URL=https://rpc.xlayer.tech \
  ./scripts/deploy-xlayer.sh
```

Addresses land in `docs/hackathon/deployed-mainnet.json` and the forge broadcast log. Follow [mainnet-go-live.md](./mainnet-go-live.md).

| Network | Value |
|---------|--------|
| Chain ID | `196` |
| RPC | `https://rpc.xlayer.tech` |
| Native USDC | `0xB6CEceAB302E2E4948951eE7843FC24E92933061` |
| Block explorer | [OKLink X Layer](https://www.oklink.com/xlayer) |
| TapeOut processor (Cerebr) | `0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF` |

---

## TapeOut evaluation (X Layer mainnet, chain ID `196`)

API policy evaluation uses the public Cerebr processor on mainnet, independent of the settlement chain.

| Asset | Address / ID |
|-------|----------------|
| TapeOut factory | `0x1f09daefa827f02cbb40967cc91b259763760761` |
| Processor (Cerebr) | [`0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF`](https://www.oklink.com/xlayer/address/0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF) |
| PaymentLimit circuit | `#1` (AND of amount / budget flags) |
| Eval RPC | `https://rpc.xlayer.tech` |

```bash
TAPEOUT_FACTORY_ADDRESS=0x1f09daefa827f02cbb40967cc91b259763760761
TAPEOUT_PROCESSOR_ADDRESS=0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF
TAPEOUT_PAYMENT_LIMIT_CIRCUIT_ID=1
TAPEOUT_EVAL_CHAIN_ID=196
TAPEOUT_RPC_URL=https://rpc.xlayer.tech
```

Verify with `./scripts/tapeout-verify.sh`.

---

## Source verification

| Provider | Status |
|----------|--------|
| [Sourcify](https://repo.sourcify.dev/1952/) | `exact_match` for all settlement contracts above |
| OKLink explorer UI | Partial — via-IR contracts may not reproduce on OKLink’s compiler; Sourcify remains authoritative |

Machine-readable snapshot: [`hackathon/deployed-testnet.json`](./hackathon/deployed-testnet.json).

---

## Tooling

```bash
./scripts/deploy-xlayer.sh     # broadcast (loads .env)
./scripts/verify-xlayer.sh     # Sourcify (default) or VERIFIER=oklink
cd contracts && forge test
```

Compiler profile: Solidity `0.8.24`, optimizer `200` runs, `via_ir` enabled.
