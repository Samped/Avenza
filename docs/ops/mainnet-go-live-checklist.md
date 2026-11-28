# Ops checklist — mainnet production

Companion to [mainnet-go-live.md](../mainnet-go-live.md). Tick before inviting external capital.

## Hosts

- [ ] Console https://avenzafinance.site serves over HTTPS
- [ ] API https://avenza-api-7p71.onrender.com/api/v1/health → `chainId: 196`
- [ ] `APP_URL` + `CORS_ORIGINS` include console origins
- [ ] `NEXT_PUBLIC_API_URL` points at production API `/api/v1`

## Secrets & keys

- [ ] Fresh production `JWT_SECRET`, `ENCRYPTION_KEY`, `AVENZA_FIELD_ENCRYPTION_KEY`
- [ ] `RELAYER_PRIVATE_KEY` ≠ deployer; funded with OKB
- [ ] `PLATFORM_FEE_RECIPIENT` set
- [ ] No private keys on Vercel

## Chain

- [ ] Addresses match [deployments.md](../deployments.md)
- [ ] `./scripts/tapeout-verify.sh` passes
- [ ] `./scripts/mainnet-preflight.sh` passes
- [ ] Relayer OKB balance monitored
- [ ] Native USDC only in vaults

## Smoke

- [ ] Register / login
- [ ] Verify payee
- [ ] 1 USDC authorize → settle → confirmations ≥ 3
- [ ] Pause drill documented

## Backlog

- [ ] Multisig ownership
- [ ] KMS for relayer
- [ ] DB backups
- [ ] Always-on API plan
