# Demo runbook

Controlled paths for local development and production smoke on X Layer mainnet.

## Local (seeded)

Follow [getting-started.md](./getting-started.md) through seed + API + web.

| Email | Role |
|-------|------|
| `admin@avenza.demo` | admin |
| `approver@avenza.demo` | approver |
| `payer@avenza.demo` | payer |

Password = `DEMO_SEED_PASSWORD` from `.env` (never commit).

```bash
./scripts/smoke-mvp.sh
./scripts/tapeout-verify.sh
```

### Console path

1. Sign in as admin.  
2. Confirm seeded payee / destination.  
3. Create → extract/verify invoice.  
4. Submit approval; approve as approver.  
5. **Controls / Policies:** processor Cerebr + circuit `#1`.  
6. **Payments:** authorize & execute (requires contracts + funded relayer/vault for live chain).  
7. Inspect audit + OKLink links when on-chain.

## Production smoke (avenzafinance.site)

Prerequisites: [hosting-render-vercel.md](./hosting-render-vercel.md), [deployments.md](./deployments.md).

1. Open https://avenzafinance.site → Create account (or admin login).  
2. Create workspace; verify payee.  
3. Confirm API health: `curl -s https://avenza-api-7p71.onrender.com/api/v1/health` → `chainId: 196`.  
4. Fund relayer with OKB; deposit **native** USDC into `BusinessTreasury` (`0x951adC47425FB4441A3D057d3e10Fa5D4eC27Ed1`).  
5. Run a **1 USDC** payable through approve → authorize → settle.  
6. Confirm ≥3 confirmations and OKLink mainnet tx links.  

**Do not** run `db:seed` against production.

## Security gate

Do not invite external businesses with real funds until [security.md](./security.md) remaining enterprise items are accepted by stakeholders.
