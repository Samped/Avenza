# AVENZA — Product & Technical Blueprint

**Programmable B2B payments and financial operations infrastructure**

| | |
|---|---|
| Category | FinTech · B2B Payments · Smart Contracts · Stablecoin Settlement |
| Chain | X Layer mainnet 196 (testnet 1952 optional) |
| Asset | Native USDC only (not bridged) |
| Policy | TapeOut circuits + Solidity enforcement |
| Status | Blueprint v1.0 — aligned with the running console |

> Full thesis: accounts payable as a control layer between ERP and settlement. AI assists extraction; humans verify; TapeOut evaluates; contracts authorize; USDC moves; audit closes the loop.

## Central proposition

A business must define **who** it pays, **how much**, **under what conditions**, and how payment is **executed and verified**.

## Core modules (implemented)

1. **Invoice intelligence** — upload, extract, field review (AI never authorizes).
2. **Supplier registry** — destinations versioned; changes require re-approval.
3. **Verification** — duplicate / destination / supplier checks before money moves.
4. **Approval workflows** — amount-tier policies; commitments invalidate on material change.
5. **Payment policies** — TapeOut PaymentLimit eval + on-chain re-check.
6. **Treasury** — per-org funding wallet → BusinessTreasury vault deposit.
7. **Settlement** — PaymentAuthorization → native USDC on X Layer.
8. **Reconciliation & audit** — hash-chained off-chain events; confirmations before COMPLETED.
9. **ERP adapters** — Odoo / ERPNext connect + write-back hooks.

## Payment lifecycle (MVP acceptance)

Create org → invite finance users → register supplier + destination → upload/extract/verify invoice → approval tiers → TapeOut eval → authorize → settle USDC → confirm → reconcile → audit.

Negative paths enforced: expired approvals, unverified vendor/destination, policy fail, double-pay guards, failed txs never marked COMPLETED, simulated receipts only for `sim-tx` hashes.

## Architecture principles

Separation of concerns · chain abstraction · human accountability · least privilege · idempotency · auditability · data minimization (documents off-chain) · fail-safe settlement.

## Stack

Next.js · NestJS · Prisma/PostgreSQL · Foundry/Solidity · viem · Redis · X Layer · TapeOut · Odoo/ERPNext adapters.

## References

- [Architecture](./architecture.md) · [Contracts](./contracts.md) · [Deployments](./deployments.md) · [MVP acceptance](./mvp-acceptance.md) · [Security](./security.md) · [Product guide](./product-guide.md)
- Circle native USDC on X Layer · TapeOut TAP-02 · Foundry / OpenZeppelin

**Document note:** AVENZA is a provisional product name. This blueprint describes intended and shipped behavior; production custody should use HSM/KMS before mainnet funds.
