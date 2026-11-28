# Host AVENZA on Render + Vercel

Production layout:

| Piece | Host |
|-------|------|
| Console (`apps/web`) | **Vercel** |
| API (`apps/api`) | **Render** web service |
| Worker (`apps/worker`) | **Render** background worker |
| Postgres | Render Postgres (`avenza-db`) |
| Redis | Render Key Value (`avenza-redis`) |
| Settlement | X Layer mainnet `196` (already deployed) |

Blueprint file: [`render.yaml`](../render.yaml) · Vercel config: [`apps/web/vercel.json`](../apps/web/vercel.json)

---

## 1. Render (API + worker + data)

1. Push this repo to GitHub (if not already).
2. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint** → select the repo → apply `render.yaml`.
3. When prompted, fill **sync: false** secrets (generate fresh — never reuse local/dev):

```bash
openssl rand -hex 32   # JWT_SECRET, SESSION_SECRET, INTERNAL_WEBHOOK_TOKEN, ENCRYPTION_KEY
openssl rand -base64 48  # AVENZA_FIELD_ENCRYPTION_KEY
```

Also set:

| Key | Value |
|-----|--------|
| `RELAYER_PRIVATE_KEY` | Funded mainnet OKB hot wallet (≠ deployer) |
| `REGISTRY_OWNER_PRIVATE_KEY` | Owner/multisig signer (or deployer for first bring-up) |
| `PLATFORM_FEE_RECIPIENT` | `0x…` fee destination |
| `APP_URL` | `https://<your-vercel-domain>` (set after Vercel deploy) |
| `CORS_ORIGINS` | Same Vercel origin (comma-separate www if needed) |
| `API_URL` | `https://avenza-api.onrender.com` (exact Render URL) |

Public chain/contract env vars are pre-filled in the blueprint.

4. Wait for `avenza-api` health: `GET https://<api-host>/api/v1/health` → `chainId: 196`.
5. Confirm worker is running (Render logs). Queues need Redis.

API container runs `prisma migrate deploy` on boot via [`scripts/render-api-start.sh`](../scripts/render-api-start.sh).

---

## 2. Vercel (web console)

1. [Vercel](https://vercel.com) → **Add New Project** → import the same GitHub repo.
2. Settings:
   - **Root Directory:** `apps/web`
   - Framework: Next.js (from `vercel.json`)
   - Node: **22.x**
3. Environment variables (Production) — see [`apps/web/.env.vercel.example`](../apps/web/.env.vercel.example):

```bash
NEXT_PUBLIC_API_URL=https://<avenza-api-host>/api/v1
NEXT_PUBLIC_XLAYER_CHAIN_ID=196
NEXT_PUBLIC_USDC_TOKEN_ADDRESS=0xB6CEceAB302E2E4948951eE7843FC24E92933061
NEXT_PUBLIC_EXPLORER_TX_BASE=https://www.oklink.com/xlayer/tx
NEXT_PUBLIC_EXPLORER_ADDRESS_BASE=https://www.oklink.com/xlayer/address/
NEXT_PUBLIC_TAPEOUT_PROCESSOR=0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF
NEXT_PUBLIC_TAPEOUT_CIRCUIT_ID=1
```

4. Deploy. Copy the Vercel URL.
5. Back on Render → set `APP_URL` + `CORS_ORIGINS` to that HTTPS origin → **Manual Deploy** API so CORS picks it up.

---

## 3. Cross-check

```bash
curl -s https://<api-host>/api/v1/health
# expect chainId 196, database ok, rpc ok
```

- Console login / register against production API.
- Do **not** run `db:seed` on production.
- Fund relayer with OKB; deposit **native** USDC into `BusinessTreasury`.
- Smoke: 1 USDC authorize → settle → OKLink mainnet links.

Full ops checklist: [mainnet-go-live.md](./mainnet-go-live.md) · addresses: [deployments.md](./deployments.md)

---

## 4. Local Docker smoke (optional)

```bash
docker build -f Dockerfile.api -t avenza-api .
docker build -f Dockerfile.worker -t avenza-worker .
```

---

## Notes

- Render free/starter web services may cold-start; use a paid plan if you need always-on settlement.
- `RELAYER_PRIVATE_KEY` only on Render — never in Vercel.
- Document uploads use `DOCUMENT_ROOT` inside the API container (ephemeral). For durable files, point storage at an object store later.
