# Getting started

From a clean checkout to a running AVENZA API + web console on your machine.

**Production:** https://avenzafinance.site · API https://avenza-api-7p71.onrender.com — see [hosting-render-vercel.md](./hosting-render-vercel.md).

## Prerequisites

| Tool | Notes |
|------|--------|
| **Node.js** | ≥ 22 (`node -v`) |
| **npm** | Workspaces (ships with Node) |
| **Postgres** | `npm run db:up` (embedded) **or** Docker Compose |
| **Redis** | Needed for the worker; recommended always |
| **Foundry** | Optional — only for contract deploy/tests |
| **Git** | Clone the repository |

## 1. Clone and install

```bash
cd Avenza
cp .env.example .env
npm install
```

For local development, set at least:

- `JWT_SECRET` / `SESSION_SECRET`
- `ENCRYPTION_KEY` (64 hex chars) — custody (funding wallet keys, ERP)
- `AVENZA_FIELD_ENCRYPTION_KEY` — business fields at rest (memos, extraction, contacts)

`.env.example` already points embedded Postgres at `127.0.0.1:54329` and X Layer **mainnet** `196`.

> Settlement is **on-chain only** when contracts + `RELAYER_PRIVATE_KEY` are set. The simulated settlement path has been removed. Without contracts, payments stay blocked (`settlementMode: blocked`) until you deploy or point at the mainnet addresses in [deployments.md](./deployments.md).

## 2. Database and Redis

### Option A — Embedded Postgres (default for local)

```bash
npm run db:up
```

Listens on **54329** (`EMBEDDED_PG_PORT`), matching `.env.example`.

### Option B — Docker Compose

```bash
docker compose up -d postgres redis
```

Then set `DATABASE_URL=postgresql://avenza:avenza@127.0.0.1:5432/avenza`.

### Redis

If you are not using Compose:

```bash
docker compose up -d redis
```

### Schema and seed

```bash
npm run db:generate
npm run db:push
# requires DEMO_SEED_PASSWORD in .env (≥10 chars)
npm run db:seed
```

Seed creates org **Avenza Demo Trading Ltd**, a verified payee, a TapeOut-bound payment policy, and demo users (password = `DEMO_SEED_PASSWORD`).

**Never run `db:seed` against a production database** — it wipes org data.

## 3. Build packages and start

```bash
npm run build -w @avenza/shared
npm run build -w @avenza/chain
```

| Terminal | Command | Port |
|----------|---------|------|
| API | `npm run dev:api` | 3001 |
| Web | `npm run dev:web` | 3000 |
| Worker | `npm run dev:worker` (optional) | — |

Or from the root: `npm run dev` (starts API + web + worker).

| Surface | URL |
|---------|-----|
| Console | http://localhost:3000/app |
| Sign in | http://localhost:3000/login |
| Public docs | http://localhost:3000/docs |
| In-app docs | http://localhost:3000/app/docs |
| Swagger | http://localhost:3001/api/docs |
| Health | http://localhost:3001/api/v1/health |

### Seed login

Set `DEMO_SEED_PASSWORD` in `.env` before `npm run db:seed`. Accounts:

| Email | Role |
|-------|------|
| `admin@avenza.demo` | admin |
| `approver@avenza.demo` | approver |
| `payer@avenza.demo` | payer |

## 4. Environment variables (cheat sheet)

### App / auth / crypto

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | `development` / `production` |
| `APP_URL` | Web origin (CORS) |
| `API_URL` / `API_PORT` | API bind |
| `NEXT_PUBLIC_API_URL` | Browser → API (`…/api/v1`) |
| `DATABASE_URL` | Postgres |
| `REDIS_URL` | BullMQ |
| `JWT_SECRET` | Access tokens (required in production) |
| `ENCRYPTION_KEY` | Custody secrets (required in production) |
| `AVENZA_FIELD_ENCRYPTION_KEY` | Field encryption (required in production) |
| `INTERNAL_WEBHOOK_TOKEN` | Worker → API (required in production) |
| `REQUIRED_CONFIRMATIONS` | Prefer `≥ 3` on mainnet |

### X Layer settlement

| Variable | Purpose |
|----------|---------|
| `XLAYER_CHAIN_ID` | `196` mainnet (default) or `1952` testnet |
| `XLAYER_RPC_URL` | JSON-RPC |
| `USDC_TOKEN_ADDRESS` | **Native** USDC only |
| `RELAYER_PRIVATE_KEY` | Authorize + execute |
| `PAYMENT_AUTHORIZATION_ADDRESS` / `TREASURY_ADDRESS` / other `*_ADDRESS` | Deployed suite |
| `ALLOW_TAPEOUT_LOCAL_FALLBACK` | `false` for live eval (forced off on prod / chain 196) |

Native USDC:

- Mainnet `196`: `0xB6CEceAB302E2E4948951eE7843FC24E92933061`
- Testnet `1952`: `0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3`

### TapeOut

| Variable | Purpose |
|----------|---------|
| `TAPEOUT_PROCESSOR_ADDRESS` | Default Cerebr on mainnet |
| `TAPEOUT_PAYMENT_LIMIT_CIRCUIT_ID` | Default `1` |
| `TAPEOUT_EVAL_CHAIN_ID` | Usually `196` |
| `TAPEOUT_RPC_URL` | Eval RPC |

## 5. Live mainnet settlement

1. Copy contract addresses from [deployments.md](./deployments.md) into `.env`.
2. Set a funded `RELAYER_PRIVATE_KEY` (OKB for gas).
3. Deposit native USDC via **Overview → Deposit** (funding wallet → vault).
4. Verify payees before settling; dual-control approvals when required.
5. Pay from **Payments** or invoice detail.

Mainnet cutover: [mainnet-go-live.md](./mainnet-go-live.md).

## 6. Verify

```bash
curl -s http://localhost:3001/api/v1/health
./scripts/tapeout-verify.sh
./scripts/smoke-mvp.sh
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| DB connection refused | `npm run db:up` or Docker Postgres; check `DATABASE_URL` port |
| Redis errors in worker | `docker compose up -d redis` |
| Web cannot reach API | Align `NEXT_PUBLIC_API_URL`; restart Next |
| TapeOut eval fails | Check `TAPEOUT_RPC_URL`; local-only: `ALLOW_TAPEOUT_LOCAL_FALLBACK=true` |
| Settlement blocked | Set contracts + relayer; fund vault |
| “Payee not verified” | Verify payee + destination under **Payees** before settle |
| Failed settle / don’t recreate payment | Retry `/execute` on the **same** payment id |

## Next steps

- [Hosting (Render + Vercel)](./hosting-render-vercel.md) — production topology  
- [Product guide](./product-guide.md) — operate the console  
- [Deployments](./deployments.md) — live X Layer addresses  
- [Security](./security.md) — encryption + mainnet gates  
- [Mainnet go-live](./mainnet-go-live.md) — production checklist  

