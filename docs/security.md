# Security

Enterprise threat model and control baseline for AVENZA on X Layer mainnet.

## Threat model

| Threat | Mitigation |
|--------|------------|
| Unauthorized payment | RBAC + dual-control approvals + TapeOut + Solidity re-check + treasury consume |
| Relayer abuse | Relayer executes only **pre-authorized** payments; cannot invent destination/amount |
| Replay | On-chain payment seen / executed maps; off-chain idempotency keys |
| Stale approval | Destination / amount / policy commitment mismatch invalidates approvals |
| Bridged USDC confusion | `assertNativeUsdc` + router allowlist (native only) |
| Fake success | Simulated settlement removed — settle is on-chain or blocked |
| Opaque circuit trust | `PaymentAuthorization` re-runs TapeOut `eval` on Cerebr when processor set |
| Incident / halt | `EmergencyControl` pauses treasury & authorization |
| Secret leakage | Split encryption keys; strip custody ciphertext from org GET; no keys on Vercel |
| CORS / CSRF-ish browser abuse | Explicit `CORS_ORIGINS`; JWT bearer; rate limits |

## Authentication & authorization

- Passwords: bcrypt (cost 12).  
- JWT bearer; org membership required for org-scoped routes.  
- Permission matrix: `@avenza/shared` `ROLE_PERMISSIONS`.  
- Partner API scopes enforce separation of duties (`payments:settle` ≠ approvals).  
- Production rate limit; Swagger disabled unless explicitly enabled.

## Cryptography & data

| Secret | Protects |
|--------|----------|
| `ENCRYPTION_KEY` | Funding wallet keys, ERP credentials, webhook secrets, document bytes (AES-256-GCM) |
| `AVENZA_FIELD_ENCRYPTION_KEY` | Memos, invoice extraction JSON, org/supplier contact fields |
| `JWT_SECRET` / `SESSION_SECRET` | Session integrity |
| `RELAYER_PRIVATE_KEY` | Settlement gas (hot wallet; OKB only) |
| `REGISTRY_OWNER_PRIVATE_KEY` | On-chain registry writes |

**On-chain is not encrypted.** Amounts, destinations, and TapeOut inputs are public. Integrity uses SHA-256 payment commitments + policy/TapeOut gates — not ciphertext.

Plaintext retained for ops/search: invoice numbers, amounts, wallet addresses.

Migrate legacy plaintext: `npm run encrypt:fields -w @avenza/api` (idempotent).

## Production checklist

### Done in product / deploy

- [x] Double-pay after `PAYMENT_FAILED` blocked; execute retry on same payment id  
- [x] Org GET strips `fundingWalletKeyEnc`; production requires `ENCRYPTION_KEY`  
- [x] On-chain vendor eligibility when registry wired  
- [x] Partner API cannot forge admin approvals  
- [x] Rate limit + `INTERNAL_WEBHOOK_TOKEN` + TapeOut fallback off on mainnet  
- [x] Duplicate / replay / expired auth / vendor tests (`forge test`)  
- [x] Mainnet deploy on chain 196; Cerebr `#1` bound  
- [x] Distinct deployer vs relayer keys  
- [x] Console + API hosted (Vercel + Render) with CORS pinned to production domain  

### Remaining for enterprise maturity

- [ ] Independent smart contract review  
- [ ] Relayer / registry keys in HSM or cloud KMS; rotation procedure  
- [ ] `EmergencyControl` + Ownable transferred to multisig  
- [ ] TapeOut processor upgradeability assessed; circuit IDs change-controlled  
- [ ] Durable encrypted document store (non-ephemeral disk)  
- [ ] Jurisdiction-specific custody / money-transmission review  
- [ ] Formal incident response + pause/unpause runbook sign-off  

## Runtime controls

- Idempotency on payment creation  
- Authorization expiry (24h on-chain)  
- Confirmations ≥ 3 before `PAYMENT_CONFIRMED` on mainnet  
- Audit events include TapeOut metadata on authorize / settle / fail  
- Health: `/api/v1/health` reports `chainId`, DB, Redis, RPC  

## Incident response (summary)

1. Pause via `EmergencyControl`.  
2. Freeze relayer hot wallet (drain OKB if compromised).  
3. Rotate `JWT_SECRET` / invalidate sessions if auth breach.  
4. Preserve logs + OKLink tx hashes; do not rotate encryption keys until ciphertext inventory is planned.  

## Reporting

Treat settlement anomalies as P0. Pause before deep investigation when funds are at risk.
