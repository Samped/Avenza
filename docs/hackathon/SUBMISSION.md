# AVENZA — TapeOut Accelerate submission draft

Copy into the official Google Form before **Dec 7, 2026 23:59 UTC**.

## Product / service

**AVENZA** is programmable accounts-payable for businesses: invoice intake → human/AI assist → approval workflow → **TapeOut policy circuits on X Layer** → Solidity re-checks → **BusinessTreasury** settles **native USDC**.

Off-chain UX for finance teams; on-chain truth for authorization compute and settlement.

## Target users & reach

- **Primary:** Finance / AP teams at SMBs and mid-market firms paying suppliers in USDC
- **Secondary:** Crypto-native treasuries that need policy + audit trails without custom Solidity per vendor
- **Reach:** Direct sales to finance ops; OKX / X Layer ecosystem; TapeOut builder community; partnerships with ERP (Odoo/ERPNext adapters already sketched)

## Revenue model

1. **SaaS seat fee** per organization (console, approvals, audit)
2. **Settlement fee** (bps) on successful USDC payouts
3. **Enterprise** policy packs / custom TapeOut circuits

Users pay because unauthorized or unreconciled payouts are expensive; AVENZA makes “policy passed on TapeOut + funds moved” one controlled path they can audit.

## Why they keep using it

- Versioned policies bound to circuit IDs
- Destination changes invalidate approvals
- Full audit trail + reconciliation
- Native USDC on X Layer (no bridged-USDC confusion)

## TapeOut / X Layer integration

| Asset | Address / ID |
|-------|----------------|
| TapeOut factory | `0x1f09daefa827f02cbb40967cc91b259763760761` |
| Processor (Cerebr, eval) | `0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF` |
| PaymentLimit circuit | `#1` (AND amountOk ∧ budgetOk) |
| Eval chain | X Layer mainnet `196` |
| Settlement chain | X Layer testnet `1952` |
| PaymentAuthorization | `0xE3F25b5e9Da3dFA72C0a12f05fd45cc0dD4243dD` |
| BusinessTreasury | `0x96778c369D85aaCCBF6DE0BcD0671B048E16E5CA` |
| PaymentPolicyRegistry | `0x0Af7a5DDE4f2B30772eE60F80EfD516A94C56A52` |
| Verify (TapeOut) | `./scripts/tapeout-verify.sh` |
| Verify (contracts) | Sourcify exact_match — https://repo.sourcify.dev/1952/ |
| Address book | [`docs/deployments.md`](../deployments.md) |

**How we use TapeOut:** Payment authorization calls on-chain `eval(circuitId, inputs)` against Cerebr on mainnet. `PaymentAuthorization` on testnet re-runs a compatible `eval` for the registered policy — opaque `circuitResult` alone is not enough.

**X Layer settlement:** Foundry stack live on testnet (`1952`); see deployments doc for the full registry.

## Access link

_Public demo URL:_ *(paste after deploy — see `docker-compose.demo.yml` / hosting notes in `docs/hackathon/public-demo.md`)*

Local: `http://localhost:3000` · API docs `http://localhost:3001/api/docs`

Hack status page: `/app/hack` (signed-in) and `/tapeout` (public TapeOut proof)

## Built during TapeOut Accelerate (changelog)

- Split account signup vs workspace creation
- Live TapeOut `eval` in payment policy path (`packages/chain/src/tapeout.ts`)
- On-chain TapeOut verification inside `PaymentAuthorization`
- MockTapeOut Foundry coverage + Anvil full-stack deploy
- Explorer links, settlement mode badge, ecosystem / FabX citation
- Submission + demo video script + Demo Day talk track

## Ecosystem

- Uses existing TapeOut processor (FAQ-allowed)
- FabX / TapeOut stats cited: https://fabx.tech/en/stats
- Policy receipt surface links processor + circuit for judges
