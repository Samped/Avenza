# Local demo runbook

## Prerequisites

Follow [getting-started.md](./getting-started.md) through seed + API + web.

```bash
# Recommended for local-only settlement without deployed contracts
grep ALLOW_SIMULATED_SETTLEMENT .env || echo 'ALLOW_SIMULATED_SETTLEMENT=true' >> .env
```

## Seed users

| Email | Password | Role |
|-------|----------|------|
| admin@avenza.demo | AvenzaDemo1! | admin |
| approver@avenza.demo | AvenzaDemo1! | approver |
| payer@avenza.demo | AvenzaDemo1! | payer |

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

## On-chain testnet

Contracts are deployed on X Layer testnet. Addresses: [deployments.md](./deployments.md).

1. Confirm `.env` contract addresses + `RELAYER_PRIVATE_KEY`  
2. Obtain testnet native USDC (`0xDec90b…`)  
3. Deposit into `BusinessTreasury` (`0x96778c369D85aaCCBF6DE0BcD0671B048E16E5CA`)  
4. Set `ALLOW_SIMULATED_SETTLEMENT=false`  
5. Re-run smoke / console payment against live authorization  

Redeploy only if needed: `./scripts/deploy-xlayer.sh` 

## Security gate

Do not enable mainnet customer funds until [security.md](./security.md) checklist is complete.
