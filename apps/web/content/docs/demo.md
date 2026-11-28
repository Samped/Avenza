# Local demo runbook

## Prerequisites

Follow [getting-started.md](./getting-started.md) through seed + API + web.

```bash
# Recommended for local-only settlement without deployed contracts
grep ALLOW_SIMULATED_SETTLEMENT .env || echo 'ALLOW_SIMULATED_SETTLEMENT=true' >> .env
```

## Seed users

Set `DEMO_SEED_PASSWORD` in `.env`, then seed. Sign in with:

| Email | Role |
|-------|------|
| admin@avenza.demo | admin |
| approver@avenza.demo | approver |
| payer@avenza.demo | payer |

Password = your `DEMO_SEED_PASSWORD` (not stored in git).

## Scripted acceptance

```bash
./scripts/smoke-mvp.sh
```

## TapeOut check

```bash
./scripts/tapeout-verify.sh
```

## Manual console path

1. Sign in as admin.  
2. Confirm seeded supplier / destination.  
3. Create → extract/verify invoice (or use API).  
4. Submit approval; approve.  
5. Policies: confirm processor + circuit `#1`.  
6. Payments: authorize & execute.  
7. Treasury / audit: inspect mode and events.  

## On-chain mainnet

Contracts are deployed on X Layer mainnet (`196`). Addresses: [deployments.md](./deployments.md).

1. Confirm `.env` contract addresses + `RELAYER_PRIVATE_KEY`  
2. Obtain mainnet native USDC (`0xB6CEce…`)  
3. Deposit into `BusinessTreasury` (`0x96778c369D85aaCCBF6DE0BcD0671B048E16E5CA`)  
4. Set `ALLOW_SIMULATED_SETTLEMENT=false`  
5. Re-run smoke / console payment against live authorization  

Redeploy only if needed: `./scripts/deploy-xlayer.sh` 

## Security gate

Do not enable mainnet customer funds until [security.md](./security.md) checklist is complete.
