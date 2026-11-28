# AVENZA

**Programmable B2B payments and financial operations infrastructure.**

AVENZA helps organizations verify invoices, enforce approval and spend policy, authorize payments with **TapeOut circuits on X Layer**, and settle **native USDC** from an organization-funded treasury — with a full audit trail.

| Layer | Role |
|-------|------|
| **Console** | Next.js workspace for finance teams |
| **API** | NestJS orchestration, RBAC, idempotency |
| **TapeOut** | On-chain deterministic policy evaluation (`eval`) |
| **Contracts** | Independent Solidity authorization + `BusinessTreasury` |
| **Settlement** | Native USDC on **X Layer mainnet `196`** (testnet `1952` optional) |

---

## Why AVENZA

Traditional AP tools stop at workflow. Crypto settlement tools often skip policy, approvals, and audit. AVENZA joins both:

1. Humans (and optional AI assist) review invoices — **AI never authorizes money**.
2. Versioned **payment policies** bind to a TapeOut processor + circuit ID.
3. On authorization, the API calls TapeOut `eval` on X Layer; Solidity **re-runs** that eval when a processor is registered.
4. Only then may the relayer execute against `BusinessTreasury`, which holds **org-deposited** native USDC.

**Trust rule:** circuit evaluation alone is not payment. Approvals, vendor eligibility, replay protection, pause controls, and treasury balance still apply.

---

## Repository layout

```
Avenza/
├── apps/
│   ├── api/          # NestJS REST API + Prisma (Postgres)
│   ├── web/          # Next.js console (App Router)
│   └── worker/       # BullMQ workers (invoice / payment queues)
├── packages/
│   ├── shared/       # Money helpers, invoice state machine, RBAC, Zod schemas
│   └── chain/        # X Layer networks, ABIs, TapeOut client, policy evaluators
├── contracts/        # Foundry smart contracts + tests + deploy scripts
├── circuits/         # Local TAP-02 NAND reference (offline / vectors)
├── docs/             # Architecture, API, contracts, TapeOut, security
└── scripts/          # Smoke tests, TapeOut verify, deploy helpers
```

| Path | Purpose |
|------|---------|
| [`apps/api`](apps/api) | Auth, orgs, suppliers, invoices, approvals, policies, payments, treasury metadata, reconciliation, ERP stubs, audit |
| [`apps/web`](apps/web) | Landing, register / login, create workspace, console modules |
| [`apps/worker`](apps/worker) | Async queue stubs for invoice pipeline & payment monitoring |
| [`packages/shared`](packages/shared) | Shared domain types and permission matrix |
| [`packages/chain`](packages/chain) | Chain config, viem clients, TapeOut `eval`, packing helpers |
| [`contracts`](contracts) | `PaymentAuthorization`, `BusinessTreasury`, registries, emergency controls |
| [`circuits`](circuits) | Local NAND netlist evaluator aligned with TapeOut-style gates |

---

## Product walkthrough

### Public surface

| Route | Description |
|-------|-------------|
| `/` | Brand landing — X Layer / USDC / TapeOut orbit |
| `/register` | Create **account** only (email, password, name) |
| `/login` | Sign in → console or workspace setup |
| `/workspace/new` | Create **organization** (requires authenticated session) |

Flow: **Create account → Create workspace → Console**. Workspace creation is not available without sign-in.

### Console (`/app`)

| Module | What it does |
|--------|----------------|
| **Overview** | KPIs, funding wallet / deposit, settlement charts, queue, shortcuts |
| **Invoices** | Upload / extract / verify AP invoices |
| **Approvals** | Dual-control decisions and approval tiers |
| **Payees** | Counterparties + payment destinations (verify before settle) |
| **Payments** | Invoice settle, direct pay, group pay + ledger |
| **Controls** | Spend bands / hold rules + TapeOut-bound payment policies |
| **Settings** | Workspace, Partner API keys, ERP, people, audit |
| **Docs** | In-console documentation (`/app/docs`) — same catalog as `/docs` |

### Seed demo users

Set `DEMO_SEED_PASSWORD` in your local `.env` (≥10 chars), then `npm run db:seed`.

| Email | Role |
|-------|------|
| `admin@avenza.demo` | admin |
| `approver@avenza.demo` | approver |
| `payer@avenza.demo` | payer |

Passwords match `DEMO_SEED_PASSWORD` (never commit that value).

---

## End-to-end payment path

```text
Invoice DRAFT → SUBMITTED → EXTRACTING → UNDER_REVIEW → VERIFIED
    → AWAITING_APPROVAL → APPROVED
    → POLICY_EVALUATION → AUTHORIZED
    → PAYMENT_SUBMITTED → PAYMENT_CONFIRMED → RECONCILIATION_PENDING → COMPLETED
```

1. **Supplier + destination** verified and approved.
2. **Invoice** verified and approved under the org’s approval rules.
3. **Payment** created (idempotency key required).
4. **Authorize** runs local policy checks **and** TapeOut `eval(circuitId, inputs)` on X Layer.
5. **Execute** calls `PaymentAuthorization.authorize` then `BusinessTreasury.executeAuthorizedPayment` when contracts + relayer are configured. Without contracts/relayer, settlement stays **blocked**.
6. **Status** waits for required confirmations, then reconciliation / complete. After a failed settle, **retry execute on the same payment** — do not create a new one.

Illegal invoice transitions are rejected via `@avenza/shared` `INVOICE_TRANSITIONS`.

---

## Quick start

**Requirements:** Node.js ≥ 22, npm, Postgres (or embedded), Redis, Foundry (for contracts).

```bash
git clone <repo-url> && cd Avenza
cp .env.example .env
npm install

# Database — pick one:
npm run db:up                    # embedded Postgres on :54329 (matches .env.example)
# OR: docker compose up -d postgres redis

docker compose up -d redis       # if not already running

npm run db:generate
npm run db:push
npm run db:seed

npm run build -w @avenza/shared && npm run build -w @avenza/chain

# Terminals (or `npm run dev` for api + web + worker)
npm run dev:api                  # API  :3001
npm run dev:web                  # Web  :3000
npm run dev:worker               # optional
```

Set `JWT_SECRET`, `ENCRYPTION_KEY` (64 hex), and `AVENZA_FIELD_ENCRYPTION_KEY` for crypto. Settlement is **on-chain only** when contracts + `RELAYER_PRIVATE_KEY` are set; otherwise payments stay blocked until you point at [deployments](docs/deployments.md).

| Service | URL |
|---------|-----|
| Web console | http://localhost:3000/app |
| In-app docs | http://localhost:3000/app/docs |
| Public docs | http://localhost:3000/docs |
| API (Swagger) | http://localhost:3001/api/docs |
| Health | http://localhost:3001/api/v1/health |

Smoke acceptance:

```bash
./scripts/smoke-mvp.sh
```

Verify TapeOut on X Layer (free view call):

```bash
./scripts/tapeout-verify.sh
```

---

## TapeOut + X Layer

| Item | Default |
|------|---------|
| Factory | `0x1f09daefa827f02cbb40967cc91b259763760761` |
| Processor (Cerebr) | `0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF` |
| PaymentLimit circuit | `#1` — AND(`amountOk`, `budgetOk`) |
| Eval chain | Mainnet `196` (`TAPEOUT_EVAL_CHAIN_ID`) |
| Settlement chain | **Mainnet `196`** (same Cerebr processor as eval) |

- API: `packages/chain` → `evalPaymentLimitOnTapeOut`
- Contract: `PaymentAuthorization` calls `ITapeOutProcessor.eval` when `policy.processor != address(0)`
- Set `ALLOW_TAPEOUT_LOCAL_FALLBACK=false` to require live RPC eval

Details: [docs/tapeout-xlayer.md](docs/tapeout-xlayer.md)

---

## Smart contracts

| Contract | Role |
|----------|------|
| `OrganizationRegistry` | On-chain org records |
| `VendorRegistry` | Vendor / destination eligibility |
| `PaymentPolicyRegistry` | Policy version → processor + circuitId + config hash |
| `PaymentAuthorization` | Relayer auth after TapeOut + business checks |
| `BusinessTreasury` | Org USDC vault; execute only with fresh auth |
| `PaymentRouter` | Token allowlist / adapter gating |
| `EmergencyControl` | Pause |
| `AuditRegistry` | On-chain audit commitments |

### X Layer mainnet deployment (`196`)

| Contract | Address |
|----------|---------|
| PaymentAuthorization | [`0x96778c369D85aaCCBF6DE0BcD0671B048E16E5CA`](https://www.oklink.com/xlayer/address/0x96778c369D85aaCCBF6DE0BcD0671B048E16E5CA) |
| BusinessTreasury | [`0x951adC47425FB4441A3D057d3e10Fa5D4eC27Ed1`](https://www.oklink.com/xlayer/address/0x951adC47425FB4441A3D057d3e10Fa5D4eC27Ed1) |
| PaymentPolicyRegistry | [`0x0Af7a5DDE4f2B30772eE60F80EfD516A94C56A52`](https://www.oklink.com/xlayer/address/0x0Af7a5DDE4f2B30772eE60F80EfD516A94C56A52) |
| ControlsRegistry | [`0xF10cDEB14604F6311195dA90B6076713f7f42f14`](https://www.oklink.com/xlayer/address/0xF10cDEB14604F6311195dA90B6076713f7f42f14) |
| PaymentRouter | [`0xE3F25b5e9Da3dFA72C0a12f05fd45cc0dD4243dD`](https://www.oklink.com/xlayer/address/0xE3F25b5e9Da3dFA72C0a12f05fd45cc0dD4243dD) |
| OrganizationRegistry | [`0xD2445389196f2c502AB5ec6f49a90cc04BB71ff5`](https://www.oklink.com/xlayer/address/0xD2445389196f2c502AB5ec6f49a90cc04BB71ff5) |
| VendorRegistry | [`0x3dE7a4C348F7415087a9Cf58FBC57256bAF1eb4b`](https://www.oklink.com/xlayer/address/0x3dE7a4C348F7415087a9Cf58FBC57256bAF1eb4b) |
| EmergencyControl | [`0xcc5661D1471e9e61B37Df5Ad5D2E1B2C5578c884`](https://www.oklink.com/xlayer/address/0xcc5661D1471e9e61B37Df5Ad5D2E1B2C5578c884) |
| AuditRegistry | [`0xEc114e0B3d39CaFEBE9d9aC25932A75958A7fbDC`](https://www.oklink.com/xlayer/address/0xEc114e0B3d39CaFEBE9d9aC25932A75958A7fbDC) |

Native USDC (mainnet): `0xB6CEceAB302E2E4948951eE7843FC24E92933061`  
TapeOut: Cerebr `0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF` circuit `#1`  
Full registry and env mapping: **[docs/deployments.md](docs/deployments.md)** · manifest: [`docs/hackathon/deployed-mainnet.json`](docs/hackathon/deployed-mainnet.json)

```bash
cd contracts && forge test
CONFIRM_MAINNET_DEPLOY=yes ./scripts/deploy-xlayer.sh
./scripts/verify-xlayer.sh
./scripts/mainnet-preflight.sh
```

Local Anvil full stack: `contracts/script/DeployLocal.s.sol`


## Roles & permissions

| Role | Capabilities (summary) |
|------|-------------------------|
| **admin** | Full org, members, suppliers, invoices, approvals, policies, payments, treasury, ERP, audit |
| **approver** | Decide approvals; read invoices / audit |
| **payer** | Write/review invoices; execute payments; read suppliers / audit |
| **auditor** | Read invoices, suppliers, payments, audit |
| **member** | Read invoices / suppliers |

Defined in [`packages/shared/src/states.ts`](packages/shared/src/states.ts). Enforced by `OrgGuard` + `@Permissions(...)`.

---

## Documentation

Browse in the console at **`/app/docs`**, publicly at **`/docs`**, or in the repo:

| Doc | Contents |
|-----|----------|
| [docs/README.md](docs/README.md) | Documentation index |
| [docs/getting-started.md](docs/getting-started.md) | Install, env, run, seed, troubleshooting |
| [docs/product-guide.md](docs/product-guide.md) | Console modules and operator workflows |
| [docs/architecture.md](docs/architecture.md) | Trust model, data flow, components |
| [docs/api.md](docs/api.md) | REST API overview |
| [docs/contracts.md](docs/contracts.md) | Solidity design and deploy |
| [docs/deployments.md](docs/deployments.md) | Live X Layer addresses and verification |
| [docs/tapeout-xlayer.md](docs/tapeout-xlayer.md) | TapeOut + X Layer integration |
| [docs/security.md](docs/security.md) | Security controls and pre-mainnet checklist |
| [docs/mainnet-go-live.md](docs/mainnet-go-live.md) | Production cutover for chain 196 |
| [docs/hosting-render-vercel.md](docs/hosting-render-vercel.md) | Host API on Render + web on Vercel |
| [docs/mvp-acceptance.md](docs/mvp-acceptance.md) | Acceptance criteria |
| [docs/demo.md](docs/demo.md) | Local demo runbook |

---

## Configuration

Copy [`.env.example`](.env.example) → `.env`. Important groups:

- **App / DB / Redis / JWT / encryption** (`ENCRYPTION_KEY` + `AVENZA_FIELD_ENCRYPTION_KEY`)
- **X Layer** — `XLAYER_CHAIN_ID`, `XLAYER_RPC_URL`, `USDC_TOKEN_ADDRESS`
- **Settlement** — contract addresses, `RELAYER_PRIVATE_KEY` (on-chain only; no simulated settle)
- **TapeOut** — processor, circuit ID, eval chain, local fallback flag
- **Web** — `NEXT_PUBLIC_API_URL`

Full reference: [docs/getting-started.md](docs/getting-started.md)

---

## Testing

```bash
npm test                          # shared + api + chain (as configured)
npm run circuits:test             # circuits + chain + shared node tests
cd contracts && forge test        # Solidity
./scripts/tapeout-verify.sh       # live TapeOut eth_call on X Layer
./scripts/smoke-mvp.sh            # API smoke journey
```

---

## License

MIT
