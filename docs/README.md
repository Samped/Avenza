# AVENZA documentation

Enterprise reference for operators, security reviewers, integrators, and contributors.

| Surface | URL |
|---------|-----|
| Production console | https://avenzafinance.site |
| Production API | https://avenza-api-7p71.onrender.com |
| In-app docs | `/app/docs` (signed in) · `/docs` (public) |
| Repo docs | this folder (synced to `apps/web/content/docs`) |

**Production settlement:** X Layer mainnet (`196`), native USDC, TapeOut Cerebr circuit `#1`.  
**Live addresses:** [deployments.md](./deployments.md)

## Start here

1. [Getting started](./getting-started.md) — local install  
2. [Hosting (Render + Vercel)](./hosting-render-vercel.md) — production topology  
3. [Mainnet go-live](./mainnet-go-live.md) — cutover & ops gates  
4. [Product guide](./product-guide.md) — console modules  
5. [Architecture](./architecture.md) — trust boundaries  
6. [Security](./security.md) — threat model & controls  

## Technical references

| Document | Audience |
|----------|----------|
| [API](./api.md) | Backend / Partner API integrators |
| [Smart contracts](./contracts.md) | Protocol / Foundry engineers |
| [Deployments](./deployments.md) | Live X Layer address book |
| [TapeOut & X Layer](./tapeout-xlayer.md) | On-chain policy evaluation |
| [Concept](./concept.md) | Product thesis |
| [MVP acceptance](./mvp-acceptance.md) | QA / release gate |
| [Demo runbook](./demo.md) | Controlled demo paths |
| [Development](./development.md) | Contributors |

## Design principles

1. **Separation of duties** — extract ≠ approve ≠ authorize ≠ settle.  
2. **On-chain policy truth** — TapeOut `eval` is deterministic and publicly re-runnable.  
3. **Independent Solidity enforcement** — the relayer cannot invent an authorization.  
4. **Native USDC only** — bridged USDC is rejected by allowlist checks.  
5. **Off-chain confidentiality** — AES-GCM for custody keys, fields, documents; chain sees commitments, amounts, and destinations (public by design).  
6. **Fail closed** — production/mainnet boot refuses missing secrets, wrong USDC, or TapeOut local fallback.

## Operator tooling

```bash
./scripts/tapeout-verify.sh          # Cerebr circuit #1 live eval
./scripts/mainnet-preflight.sh       # env + chain gates
cd contracts && forge test           # settlement invariants
curl -s https://avenza-api-7p71.onrender.com/api/v1/health
```
