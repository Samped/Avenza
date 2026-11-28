# Mainnet go-live — X Layer 196

Enterprise cutover and ongoing production gates for AVENZA.

| Item | Value |
|------|--------|
| Chain | X Layer **196** |
| Native USDC | `0xB6CEceAB302E2E4948951eE7843FC24E92933061` |
| TapeOut Cerebr | `0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF` |
| Circuit | `#1` — AND(`amountOk`, `budgetOk`) |
| Explorer | https://www.oklink.com/xlayer |
| Console | https://avenzafinance.site |
| API | https://avenza-api-7p71.onrender.com |

**Settlement contracts are deployed.** Canonical book: [deployments.md](./deployments.md) · manifest: `docs/hackathon/deployed-mainnet.json` (`status: deployed`).  
Hosting: [hosting-render-vercel.md](./hosting-render-vercel.md) · Secrets template: `apps/api/.env.mainnet.example`  
Preflight: `./scripts/mainnet-preflight.sh`

---

## 0. Code gates (enforced)

- [x] No second payment after `PAYMENT_FAILED` — retry `/execute` on same id  
- [x] `fundingWalletKeyEnc` stripped from org API responses  
- [x] Production secrets required; TapeOut local fallback forbidden on mainnet  
- [x] Boot refuses wrong USDC, test RPC, missing contracts/relayer, confirmations &lt; 3  
- [x] `VendorRegistry` eligibility when wired  
- [x] Partner API SoD (`payments:settle` separate; cannot decide approvals)  
- [x] Dual-control respected in console  
- [x] Swagger off unless `ENABLE_SWAGGER=true`  
- [x] `db:seed` blocked on mainnet production unless `ALLOW_MAINNET_SEED=yes`  
- [x] Deploy requires distinct deployer vs relayer on 196  
- [x] Mainnet contracts live + policy bound to Cerebr `#1`  

---

## 1. Custody model

| Wallet | Role | Fund with |
|--------|------|-----------|
| **Deployer** | Contract Ownable / registry owner (cold preferred) | OKB for deploy / ownership txs |
| **Relayer** | Hot gas payer for authorize + settle | OKB only — never customer USDC |
| **Platform fee recipient** | `collectFee` destination | — |
| **Org funding wallet** | Custodial deposit into `BusinessTreasury` | Native USDC (+ dust OKB if needed) |
| **Ops multisig** | Target owner of `EmergencyControl` + Ownable | — |

Confirm legal posture for **custodial** funding wallets before accepting third-party USDC.

---

## 2. Contracts (already live)

Redeploy only if intentionally replacing the stack:

```bash
export CONFIRM_MAINNET_DEPLOY=yes
export XLAYER_CHAIN_ID=196
export XLAYER_RPC_URL=https://rpc.xlayer.tech
export USDC_TOKEN_ADDRESS=0xB6CEceAB302E2E4948951eE7843FC24E92933061
export SETTLEMENT_TAPEOUT_PROCESSOR_ADDRESS=0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF
# distinct DEPLOYER_PRIVATE_KEY + RELAYER_PRIVATE_KEY
./scripts/deploy-xlayer.sh
./scripts/verify-xlayer.sh
```

Post-deploy: transfer Ownable → multisig; document pause via `EmergencyControl.pause()`.

---

## 3. Application plane

| Piece | Target |
|-------|--------|
| API + Postgres + Redis | Render (`render.yaml`) |
| Console | Vercel · Root `apps/web` · domain `avenzafinance.site` |
| CORS | `APP_URL` + `CORS_ORIGINS` = console HTTPS origins |

```bash
./scripts/mainnet-preflight.sh
curl -s https://avenza-api-7p71.onrender.com/api/v1/health
./scripts/tapeout-verify.sh
```

**Never** `db:seed` on production.

---

## 4. Customer onboarding

1. Register admin → create workspace (new funding wallet).  
2. Sync on-chain org + policy (Cerebr processor, circuit `#1`) + controls.  
3. Register & **verify** payees before settle.  
4. Fund funding wallet with **native** USDC → deposit to vault.  
5. Keep relayer OKB topped up.

---

## 5. Smoke + incident drill (mandatory before volume)

1. Payable for **1 USDC** (or agreed minimum).  
2. Dual-control approve if required.  
3. Authorize → execute → ≥3 confirmations → reconcile.  
4. Confirm OKLink mainnet links in console.  
5. Pause drill: `EmergencyControl.pause()` blocks deposit/settle; unpause after.

---

## 6. Remaining enterprise backlog

- [ ] Independent smart-contract review  
- [ ] Relayer key in HSM/KMS + rotation runbook  
- [ ] Ownable / EmergencyControl → production multisig  
- [ ] Durable object storage for invoice documents  
- [ ] Always-on API compute (leave free tier)  
- [ ] Postgres backups + PITR  
- [ ] Jurisdiction review (custody / money transmission)  

---

## Disclosure

Settlement amounts and destinations are **public on X Layer**. Confidentiality is off-chain (AES-256-GCM). Platform fee + gas recovery debit the org vault in USDC; the relayer still pays OKB gas. Disclose fees in customer terms.
