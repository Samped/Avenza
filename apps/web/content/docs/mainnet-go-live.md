# Mainnet go-live runbook (X Layer 196)

**Do not accept third-party USDC until every gate below is checked.**

Native USDC (mainnet): `0xB6CEceAB302E2E4948951eE7843FC24E92933061`  
TapeOut Cerebr: `0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF` (circuit `#1`)

---

## 0. Code gates (already patched in repo)

- [x] Invoice cannot create a second payment after `PAYMENT_FAILED` — retry `/execute` on the same id
- [x] `fundingWalletKeyEnc` stripped from org API responses
- [x] `ENCRYPTION_KEY` / `JWT_SECRET` / field key required in production
- [x] `PaymentAuthorization` checks `VendorRegistry.isEligible` when wired; `consume` is treasury-only
- [x] Address-only payees are `pending` until verified
- [x] Partner API cannot decide approvals / forge admin SoD; settle needs `payments:settle`
- [x] Console no longer one-click approves dual-control payouts
- [x] Rate limit, `INTERNAL_WEBHOOK_TOKEN`, TapeOut fallback off on prod/mainnet

---

## 1. Secrets & env (wire-prod-env)

Generate **new** secrets (never reuse testnet/dev values):

```bash
openssl rand -hex 32   # JWT_SECRET / SESSION_SECRET / INTERNAL_WEBHOOK_TOKEN
openssl rand -hex 32   # ENCRYPTION_KEY (64 hex chars)
openssl rand -base64 48  # AVENZA_FIELD_ENCRYPTION_KEY
```

Production `.env` (API + root):

```bash
NODE_ENV=production
XLAYER_CHAIN_ID=196
XLAYER_RPC_URL=https://rpc.xlayer.tech
USDC_TOKEN_ADDRESS=0xB6CEceAB302E2E4948951eE7843FC24E92933061
ALLOW_TAPEOUT_LOCAL_FALLBACK=false
REQUIRED_CONFIRMATIONS=3
TAPEOUT_EVAL_CHAIN_ID=196
TAPEOUT_RPC_URL=https://rpc.xlayer.tech
TAPEOUT_PROCESSOR_ADDRESS=0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF
# + all contract addresses from deploy log
# + JWT_SECRET, ENCRYPTION_KEY, AVENZA_FIELD_ENCRYPTION_KEY, INTERNAL_WEBHOOK_TOKEN
# + dedicated RELAYER_PRIVATE_KEY (not deployer)
```

Web:

```bash
NEXT_PUBLIC_API_URL=https://<api-host>/api/v1
NEXT_PUBLIC_EXPLORER_ADDRESS_BASE=https://www.oklink.com/xlayer/address/
```

Migrate field ciphertext after setting the field key:

```bash
npm run encrypt:fields -w @avenza/api
```

**Custody key rotation:** changing `ENCRYPTION_KEY` invalidates funding wallet ciphertext. Re-key each org wallet under maintenance (new wallet + user re-fund) or run a dedicated rewrap tool before cutover.

---

## 2. Deploy contracts (deploy-mainnet-196)

```bash
export CONFIRM_MAINNET_DEPLOY=yes
export XLAYER_CHAIN_ID=196
export XLAYER_RPC_URL=https://rpc.xlayer.tech
export USDC_TOKEN_ADDRESS=0xB6CEceAB302E2E4948951eE7843FC24E92933061
export DEPLOYER_PRIVATE_KEY=0x…   # funded OKB; offline / hardware preferred
export RELAYER_PRIVATE_KEY=0x…    # separate hot wallet
./scripts/deploy-xlayer.sh
./scripts/verify-xlayer.sh
```

Copy logged addresses into `.env`. Transfer **Ownable** on EmergencyControl + registries + Auth/Treasury to a **multisig**. Document pause: `EmergencyControl.pause()`.

---

## 3. Re-onboard orgs (re-onboard-orgs)

Testnet org / vendor / policy state does **not** carry over.

1. Create org in production API (new funding wallet).
2. Ensure on-chain org register + policy with Cerebr processor (non-zero) + controls publish.
3. Register & **verify** payees (console verify — pending wallets cannot settle).
4. Sync vendors via settlement path (`syncVendor` on execute).
5. Fund funding wallet with tiny USDC + OKB gas; deposit into vault.

---

## 4. Smoke + pause (smoke-and-pause)

1. Create invoice / approved payable for **1 USDC** (or smallest unit you accept).
2. Dual-control approve in console (if requiredApprovals > 0).
3. Authorize → execute → wait `REQUIRED_CONFIRMATIONS` → reconcile.
4. Confirm explorer links on OKLink mainnet.
5. Force a failed execute (empty vault), confirm retry `/execute` on **same** payment id works after funding.
6. Call `EmergencyControl.pause()` from multisig; confirm authorize/deposit blocked; unpause.

---

## 5. Compliance reminder

Funding wallets are **custodial** (API holds encrypted private keys). Confirm legal posture for custody / money transmission before third-party funds.
