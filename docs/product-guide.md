# Product guide

How to operate AVENZA as a finance / AP user in the current console.

## Accounts and workspaces

1. **Create account** (`/register`) — name, email, password.
2. **Create workspace** (`/workspace/new`) — organization legal name (requires session).
3. **Sign in** (`/login`) — opens `/app` when an org exists.
4. **Sign out** — header control clears JWT + org selection.

In-app documentation lives at **Docs** (`/app/docs`) in the sidebar (same content as public `/docs`).

---

## Console map

| Nav | Route | What it does |
|-----|-------|----------------|
| Overview | `/app` | Monochrome home: KPIs, funding wallet, settlement & aging charts, queue, recent invoices, shortcuts |
| Invoices | `/app/invoices` | Upload / extract / verify AP invoices |
| Approvals | `/app/approvals` | Dual-control decisions + approval tiers |
| Payees | `/app/suppliers` | Counterparties + payment destinations |
| Payments | `/app/payments` | Invoice settle, direct pay, group (batch) pay + ledger |
| Controls | `/app/policies` | Spend bands / hold rules + TapeOut-bound payment policies |
| Settings | `/app/settings` | Workspace, Partner API keys, ERP, people, audit |
| Docs | `/app/docs` | Product & technical reference inside the console |

Secondary tools (team, treasury detail, reconciliation, integrations) live under **Settings** tabs or deep links from Overview.

---

## Overview

- Greeting + attention count
- KPI strip: approvals, in review, ready to pay, open payable
- **Funding wallet** — copy address, explorer, deposit into vault
- Charts: payments by status, payables by age
- Queue + recent invoices + next due + shortcuts (**Pay client**, **Group pay**, **Upload**, **Fund**)

Deposit opens the fund modal: send **native USDC** (+ OKB for gas) to the funding wallet, then deposit into `BusinessTreasury`.

---

## Payees

1. Register a payee (legal name).
2. Add a destination: chain, native USDC token, wallet.
3. **Verify** payee + destination before settlement.

Address-only direct payouts create **pending** payees — they must be verified before settle. On-chain `VendorRegistry.isEligible` is checked when the registry is wired.

---

## Invoices

1. **New invoice** — upload document.
2. Extraction assists review (`EXTRACTION_MODE`); it never authorizes money.
3. Verify fields → submit for approval when ready.
4. Detail: `/app/invoices/[id]`.

Sensitive extraction JSON is encrypted at rest (field crypto).

---

## Approvals

1. Configure approval tiers if needed.
2. Approvers **approve** or **reject**.
3. Dual-control: when `requiredApprovals > 0`, the Payments UI will **not** auto-approve — use this queue first.

Partner API keys can submit for approval but **cannot** decide (console JWT only).

---

## Payments

Three compose modes:

| Mode | Flow |
|------|------|
| **Invoice** | Approved invoice → authorize (TapeOut) → execute |
| **Direct** | Verified payee/address → create → approve if required → authorize → execute |
| **Group** | Batch lines → approve if required → settle lines |

Rules that matter for real funds:

- Settlement needs contracts + relayer; otherwise mode is **blocked**.
- After a failed settle, **retry execute on the same payment** — do not create a new payment (prevents double-pay).
- Confirmations: `REQUIRED_CONFIRMATIONS` (prefer ≥ 3 on mainnet).
- **Fees:** each settle debits the org vault for vendor amount **plus** platform fee (bps + flat) and gas-recovery USDC (`PLATFORM_FEE_*` / `GAS_RECOVERY_USDC_MINOR`). Relayer still pays OKB gas; you recover cost + margin in USDC to `PLATFORM_FEE_RECIPIENT`.

---

## Controls

- Publish **controls** bands (auto / single / dual / hold).
- Publish **payment policies** bound to TapeOut processor + circuit id.
- Active policy is used on authorize; on-chain re-eval requires a non-zero processor.

---

## Settings

| Tab | Contents |
|-----|----------|
| Workspace | Org profile, network, treasury balances, fund |
| Developers | Partner API keys (`avz_live_*`) + scopes |
| Integrations | ERP connectors, webhooks |
| People | Members / roles |
| Activity | Audit events |

Partner scopes of note: `payments:initiate` (create/authorize), `payments:settle` (execute), `approvals:submit` (submit only).

---

## Operator checklist

1. Sign in as admin.  
2. Fund vault (Overview → Deposit).  
3. Verify payee + destination.  
4. Upload / verify invoice (or use direct/group pay).  
5. Obtain dual-control approval when required.  
6. Authorize & execute from Payments.  
7. Confirm explorer links + status.  
8. If settle fails after authorize: fund vault → retry **execute** on same payment.

---

## Roles

| Task | Typical role |
|------|----------------|
| Invite members, publish policies / controls | admin |
| Approve invoices / payouts | approver / admin |
| Register payees, initiate pay | payer / admin |
| Read-only investigation | auditor |
