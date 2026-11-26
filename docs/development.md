# Development

## Workspaces

```bash
npm run build -w @avenza/shared
npm run build -w @avenza/chain
npm run build -w @avenza/api
npm run build -w @avenza/web
npm run build -w @avenza/worker
```

Root `npm run build` builds all of the above in order.

## Dev servers

| Script | Package |
|--------|---------|
| `npm run dev:api` | Nest / tsx watch (see package scripts) |
| `npm run dev:web` | Next.js |
| `npm run dev:worker` | BullMQ worker |

After changing `@avenza/shared` or `@avenza/chain`, rebuild those packages before restarting the API.

## Database

```bash
npm run db:generate   # Prisma client
npm run db:push       # push schema (dev)
npm run db:migrate    # migrations when enabled
npm run db:seed       # demo org + users + TapeOut-bound policy
```

Schema: [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma)

## Contracts

```bash
cd contracts
forge build
forge test
forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

## Tests

```bash
npm test
npm run circuits:test
cd contracts && forge test
./scripts/tapeout-verify.sh
```

## Code map (API)

| Module | Path |
|--------|------|
| Auth | `apps/api/src/auth` |
| Organizations | `apps/api/src/organizations` |
| Suppliers | `apps/api/src/suppliers` |
| Invoices | `apps/api/src/invoices` |
| Approvals | `apps/api/src/approvals` |
| Policies | `apps/api/src/policies` |
| Payments / settlement | `apps/api/src/payments` |
| Reconciliation | `apps/api/src/reconciliation` |
| ERP | `apps/api/src/erp` |
| Audit | `apps/api/src/audit` |
| Storage | `apps/api/src/storage` |

## Code map (web)

App Router under `apps/web/src/app`. Shared UI: `components/` (`AppShell`, `AuthFrame`, `AvenzaLogo`, `OrbitLogos`, `BrandLogos`). API client: `lib/api.ts`.

## Conventions

- Prefer Zod schemas in `@avenza/shared` for request bodies.  
- Org-scoped routes always go through `JwtAuthGuard` + `OrgGuard`.  
- Money amounts are **integer minor units** (USDC 6 decimals).  
- Never treat bridged USDC as native.  
