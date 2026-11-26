# AVENZA documentation

Professional reference for operators, integrators, and contributors.

**In the product:** signed-in console → **Docs** (`/app/docs`).  
**Public:** `/docs` on the web app.  
**Repo:** files in this folder (synced into `apps/web/content/docs` for the UI).

## Start here

1. [Getting started](./getting-started.md) — install, environment, run locally  
2. [Product guide](./product-guide.md) — what each console screen does  
3. [Architecture](./architecture.md) — trust boundaries and data flow  
4. [Concept / blueprint](./concept.md) — product thesis and programmable AP architecture  

## Technical references

| Document | Audience |
|----------|----------|
| [API](./api.md) | Backend / frontend integrators |
| [Smart contracts](./contracts.md) | Protocol / Foundry engineers |
| [Deployments](./deployments.md) | Live X Layer addresses & verification |
| [TapeOut & X Layer](./tapeout-xlayer.md) | On-chain policy & settlement |
| [Security](./security.md) | Security & compliance review |
| [Mainnet go-live](./mainnet-go-live.md) | Production cutover (chain 196) |
| [MVP acceptance](./mvp-acceptance.md) | QA / release gate |
| [Demo runbook](./demo.md) | Local end-to-end demo |
| [Development](./development.md) | Contributors: workspaces, tests, code map |

## Design principles

1. **Separation of duties** — extraction ≠ approval ≠ authorization ≠ settlement.  
2. **On-chain truth for policy gates** — TapeOut `eval` is deterministic and publicly re-runnable.  
3. **Independent Solidity enforcement** — the relayer cannot invent an authorization.  
4. **Native USDC only** — bridged USDC is rejected by allowlist checks.  
5. **Off-chain privacy** — invoice PDFs and PII stay in private storage; chain sees commitments and identifiers.

## Support paths in-repo

- Smoke: `./scripts/smoke-mvp.sh`  
- TapeOut verify: `./scripts/tapeout-verify.sh`  
- Contract tests: `cd contracts && forge test`  
- OpenAPI UI: `http://localhost:3001/api/docs` when the API is running  
- In-app docs: `http://localhost:3000/app/docs`  
