# Architecture

## Overview

AVENZA is a monorepo financial-operations stack. The **web console** talks to a **NestJS API**. The API persists workflow state in **Postgres**, optionally enqueues **BullMQ** jobs, evaluates policy with **TapeOut** on **X Layer**, and settles through **Foundry-deployed contracts** holding **native USDC**.

```text
┌─────────────┐     JWT + x-organization-id      ┌──────────────────┐
│  Next.js    │ ───────────────────────────────► │  NestJS API      │
│  console    │                                  │  + Prisma        │
└─────────────┘                                  └────────┬─────────┘
                                                          │
                    ┌─────────────────────────────────────┼──────────────────────────┐
                    ▼                                     ▼                          ▼
             ┌────────────┐                      ┌──────────────┐            ┌──────────────┐
             │ Postgres   │                      │ TapeOut eval │            │ X Layer txs  │
             │ (workflow) │                      │ (view call)  │            │ Auth+Treasury│
             └────────────┘                      └──────────────┘            └──────────────┘
```

## Trust boundaries

1. **AI / heuristic extraction** assists humans; it never authorizes payments.  
2. **Backend** orchestrates workflow, RBAC, idempotency, and policy input preparation.  
3. **TapeOut** evaluates deterministic NAND circuits (`eval`) — publicly re-runnable.  
4. **Solidity** independently re-checks org status, approvals, vendor eligibility, policy version, spend constraints, pause state, and replay protection; when a processor is registered it **re-runs** TapeOut `eval`.  
5. **BusinessTreasury** holds organization-deposited native USDC; the relayer cannot move funds without a fresh, unconsumed authorization.

## Component map

| Component | Responsibility |
|-----------|----------------|
| `apps/web` | UX, JWT storage, org context header |
| `apps/api` | Domain services, guards, settlement orchestration |
| `apps/worker` | Reserved queues: `invoice-pipeline`, `payment-monitor` |
| `packages/shared` | State machine, RBAC, Zod DTOs, money/commitment helpers |
| `packages/chain` | Networks, ABIs, viem clients, TapeOut client, local policy math |
| `contracts` | Authorization + treasury + registries |
| `circuits` | Offline TAP-02-style NAND reference |

## Request identity

1. `Authorization: Bearer <jwt>` from `/auth/login` or `/auth/register`.  
2. `x-organization-id: <uuid>` selects the active org (also accepted as path `:orgId`).  
3. `OrgGuard` loads membership, attaches `role`, and checks `@Permissions`.

## Invoice / payment state machine

Canonical transitions live in `@avenza/shared` `INVOICE_TRANSITIONS`. Missing edges are illegal.

High-level payment phases:

| Phase | Meaning |
|-------|---------|
| Draft → verified | Data quality / human review |
| Awaiting approval → approved | Dual-control / policy tiers |
| Policy evaluation → authorized | TapeOut + local gates |
| Payment submitted → confirmed | Chain inclusion / confirmations |
| Reconciliation → completed | Books match chain |

**Submitted ≠ confirmed ≠ completed.**

## Data privacy

| Off-chain | On-chain |
|-----------|----------|
| Invoice PDFs, emails, bank metadata | Org / payment / invoice **commitments** |
| Full audit payloads in Postgres | Optional `AuditRegistry` identifiers |
| User credentials (hashed) | Treasury balances, auth events |

## Idempotency

Payment creation requires an `idempotencyKey` scoped per organization to prevent double create under retries.

## Settlement modes

| Mode | When |
|------|------|
| `onchain` | `PAYMENT_AUTHORIZATION_ADDRESS`, `TREASURY_ADDRESS`, and `RELAYER_PRIVATE_KEY` set |
| `blocked` | Contracts or relayer missing — payments cannot settle |
| `blocked` | Neither path available — execute fails closed |

Simulation never silently pretends to be a mainnet success without the explicit flag.

## Related docs

- [TapeOut & X Layer](./tapeout-xlayer.md)  
- [Smart contracts](./contracts.md)  
- [API](./api.md)  
- [Security](./security.md)  
