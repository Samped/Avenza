# Mainnet go-live runbook (X Layer 196) — enterprise

**Do not accept third-party USDC until every gate below is checked.**

| Item | Value |
|------|--------|
| Chain | X Layer **196** |
| Native USDC | `0xB6CEceAB302E2E4948951eE7843FC24E92933061` |
| TapeOut Cerebr | `0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF` |
| Circuit | `#1` — AND(`amountOk`, `budgetOk`) |
| Explorer | https://www.oklink.com/xlayer |

Template env: [`apps/api/.env.mainnet.example`](../apps/api/.env.mainnet.example)  
Preflight: `./scripts/mainnet-preflight.sh`

---

## 0. Code gates (enforced in repo)

- [x] No second payment after `PAYMENT_FAILED` — retry `/execute` on same id  
- [x] `fundingWalletKeyEnc` stripped from org API responses  
- [x] Production secrets required; TapeOut local fallback forbidden  
- [x] Mainnet boot refuses wrong USDC, test RPC, missing contracts/relayer, confirmations &lt; 3  
- [x] `VendorRegistry` eligibility when wired; treasury-only `consume`  
- [x] Pending payees cannot settle until verified  
- [x] Partner API SoD (`payments:settle` separate; cannot decide approvals)  
- [x] Dual-control respected in console  
- [x] Swagger off in production unless `ENABLE_SWAGGER=true`  
- [x] `db:seed` blocked on mainnet production unless `ALLOW_MAINNET_SEED=yes`  
- [x] Deploy script requires distinct deployer vs relayer on 196  

---

## 1. Wallets & custody (before any deploy)

1. **Deployer** — cold/hardware preferred; funds OKB for contract deploy only.  
2. **Relayer** — separate hot wallet; OKB for gas only; **never** the deployer key.  
3. **Ops multisig** — will own `EmergencyControl` + Ownable after deploy.  
4. Confirm legal posture for **custodial** funding wallets before third-party funds.

Generate app secrets (new — never reuse testnet):

```bash
openssl rand -hex 32   # JWT_SECRET / SESSION_SECRET / INTERNAL_WEBHOOK_TOKEN
openssl rand -hex 32   # ENCRYPTION_KEY (64 hex)
openssl rand -base64 48  # AVENZA_FIELD_ENCRYPTION_KEY
```

---

## 2. Deploy contracts

```bash
export CONFIRM_MAINNET_DEPLOY=yes
export XLAYER_CHAIN_ID=196
export XLAYER_RPC_URL=https://rpc.xlayer.tech
export USDC_TOKEN_ADDRESS=0xB6CEceAB302E2E4948951eE7843FC24E92933061
export TAPEOUT_PROCESSOR_ADDRESS=0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF
export DEPLOYER_PRIVATE_KEY=0x…   # cold
export RELAYER_PRIVATE_KEY=0x…    # hot, different
./scripts/deploy-xlayer.sh
./scripts/verify-xlayer.sh
```

Copy addresses into Fly secrets / production env. Transfer Ownable → multisig. Document pause: `EmergencyControl.pause()`.

---

## 3. Data plane & API host

| Piece | Recommendation |
|-------|----------------|
| Postgres | Neon (prod project) — **no** `db:seed` |
| Redis | Upstash |
| API | Fly `avenza-api` (`fly.toml` mainnet defaults) |
| Web | Vercel — `NEXT_PUBLIC_API_URL`, mainnet explorer base |

```bash
# Against production DATABASE_URL only
npm run db:generate
npm run db:push
# optional field migration after setting AVENZA_FIELD_ENCRYPTION_KEY
npm run encrypt:fields -w @avenza/api
./scripts/mainnet-preflight.sh
```

Fly secrets (example):

```bash
fly secrets set \
  DATABASE_URL=… REDIS_URL=… \
  JWT_SECRET=… SESSION_SECRET=… \
  ENCRYPTION_KEY=… AVENZA_FIELD_ENCRYPTION_KEY=… \
  INTERNAL_WEBHOOK_TOKEN=… \
  RELAYER_PRIVATE_KEY=… \
  APP_URL=https://YOUR_VERCEL_HOST \
  PAYMENT_AUTHORIZATION_ADDRESS=… TREASURY_ADDRESS=… \
  # …remaining contract addresses
```

---

## 4. Re-onboard orgs (testnet state does not carry over)

1. Register production admin; create workspace (new funding wallet).  
2. On-chain org + policy with **non-zero Cerebr processor** + controls.  
3. Register & **verify** payees.  
4. Fund funding wallet: tiny **native USDC** + OKB → deposit to vault.  

---

## 5. Smoke + pause (mandatory)

1. Payable for **1 USDC** (or minimum you accept).  
2. Dual-control approve if required.  
3. Authorize → execute → ≥3 confirmations → reconcile.  
4. Confirm OKLink mainnet links.  
5. Empty-vault failure → fund → **retry `/execute` on same payment id**.  
6. Multisig `pause()` → confirm blocked → `unpause()`.  

---

## 6. Enterprise ops checklist

- [ ] Relayer OKB top-up alerting  
- [ ] Vault USDC balance alerting  
- [ ] Log redaction (no raw keys / full memos in logs)  
- [ ] Incident runbook: pause → revoke partner keys → rotate JWT/relayer  
- [ ] Backup Postgres; encryption key escrow procedure  
- [ ] CORS locked to console HTTPS origin(s)  

---

## 7. Compliance reminder

Funding wallets are **custodial** (API holds encrypted keys). Confirm money-transmission / custody obligations before accepting third-party USDC.
