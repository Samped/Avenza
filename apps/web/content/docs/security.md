# Security

## Threat model (summary)

| Threat | Mitigation |
|--------|------------|
| Unauthorized payment | RBAC + approvals + TapeOut + Solidity re-check + treasury consume |
| Relayer abuse | Relayer can only execute **pre-authorized** payments; cannot set arbitrary destination/amount without matching auth |
| Replay | `paymentSeen` / executed payment maps on-chain; idempotency keys off-chain |
| Stale approval | Destination/amount/policy commitment mismatch invalidates approvals |
| Bridged USDC confusion | `assertNativeUsdc` + router allowlist |
| Silent “fake success” | Simulated settlement removed; settle is on-chain or blocked |
| Opaque circuit trust | When processor registered, contract calls TapeOut `eval` itself |
| Pause / incident | `EmergencyControl` gates treasury & auth |

## AuthN / AuthZ

- Passwords hashed with bcrypt (cost 12 in seed/register path).  
- JWT bearer tokens; org membership required for org routes.  
- Permission matrix in `@avenza/shared` `ROLE_PERMISSIONS`.  
- Approver role separation for approval decisions.

## Sensitive configuration

| Secret | Handling |
|--------|----------|
| `JWT_SECRET` / `SESSION_SECRET` | Strong random; never commit |
| `ENCRYPTION_KEY` | 32-byte hex; **custody** secrets (funding wallet keys, ERP credentials) via `secrets.ts` |
| `AVENZA_FIELD_ENCRYPTION_KEY` | Business field encryption at rest (memos, invoice extraction, registration/email, payee contacts) via `field-crypto.ts`. Required in production. |
| `RELAYER_PRIVATE_KEY` | Least privilege hot wallet; prefer KMS/HSM in production |
| Deployer keys | Offline / multisig for ownership transfers |
| S3 credentials | Scoped bucket for invoices only |

Keep `ENCRYPTION_KEY` and `AVENZA_FIELD_ENCRYPTION_KEY` as **separate** secrets so rotating one does not force re-wrapping the other.

## Before mainnet customer funds

See also [mainnet-go-live.md](./mainnet-go-live.md).

- [x] Double-pay after `PAYMENT_FAILED` blocked; execute retry on same payment id  
- [x] Org GET strips `fundingWalletKeyEnc`; production requires `ENCRYPTION_KEY`  
- [x] On-chain `VendorRegistry.isEligible` when registry wired; address-only payees pending  
- [x] Partner API cannot forge admin approvals; settle scope separated  
- [x] Prod rate limit + `INTERNAL_WEBHOOK_TOKEN` + TapeOut fallback off on mainnet/prod  
- [ ] Independent smart contract review  
- [ ] Relayer key in HSM/KMS; rotation + pause procedure documented  
- [ ] `EmergencyControl` / Ownable transferred to multisig  
- [ ] TapeOut processor bytecode + upgradeability assessed; circuit IDs pinned in `PaymentPolicyRegistry`  
- [ ] Native USDC address verified against Circle / X Layer docs for the target network  
- [x] Duplicate payment / replay / expired auth / vendor tests green (`forge test`)  
- [ ] Mainnet deploy (`CONFIRM_MAINNET_DEPLOY=yes`) + Sourcify verify  
- [ ] `ALLOW_TAPEOUT_LOCAL_FALLBACK=false` in production env  
- [ ] Jurisdiction-specific compliance review (custody / money transmission)  

## Runtime controls

- Idempotency keys on payment creation  
- Approval commitments invalidate on destination / amount / policy change  
- Authorization expires (24h on-chain)  
- Confirmations gate `PAYMENT_CONFIRMED`  
- Audit events for authorize / submit / fail paths include TapeOut metadata  

## Data handling

- Invoice binaries and PII stay off-chain (document root / S3).  
- **At-rest field encryption (AES-256-GCM):** payment/batch memos, `Invoice.extractionJson`, `Organization.registrationNumber` / `businessEmail`, `Supplier.contactEmail` / `contactPhone`. API decrypts for authorized org members. Invoice numbers, amounts, and wallet addresses stay plaintext for search/ops.  
- On-chain USDC settlement and TapeOut policy eval remain **public** (not confidential transfers).  
- Migrate existing plaintext with `npm run encrypt:fields -w @avenza/api` (idempotent).  
- Do not log raw private keys or full card/bank secrets.  
- Key rotation for field crypto requires re-encrypting stored ciphertext; plan a maintenance window.

## Reporting

Internal security issues: treat as high priority; freeze relayer and pause via `EmergencyControl` before investigating settlement anomalies.
