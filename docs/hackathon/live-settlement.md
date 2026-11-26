# Live X Layer settlement

Settlement stack is **deployed on X Layer testnet (`1952`)**. Full address book: [`../deployments.md`](../deployments.md).

## Deployed contracts (testnet)

| Contract | Address |
|----------|---------|
| PaymentAuthorization | `0xE3F25b5e9Da3dFA72C0a12f05fd45cc0dD4243dD` |
| BusinessTreasury | `0x96778c369D85aaCCBF6DE0BcD0671B048E16E5CA` |
| PaymentPolicyRegistry | `0x0Af7a5DDE4f2B30772eE60F80EfD516A94C56A52` |
| PaymentRouter | `0xF10cDEB14604F6311195dA90B6076713f7f42f14` |
| OrganizationRegistry | `0xD2445389196f2c502AB5ec6f49a90cc04BB71ff5` |
| VendorRegistry | `0x3dE7a4C348F7415087a9Cf58FBC57256bAF1eb4b` |
| EmergencyControl | `0xcc5661D1471e9e61B37Df5Ad5D2E1B2C5578c884` |
| AuditRegistry | `0x79Be215ec0478D616fC2704370c3590f323ef599` |

- Organization ID: `0x603fd1000e3f9b350efdfbeaad5864a151b4bdac12228b5056569a9b2478f82a`  
- Native USDC: `0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3`  
- Artifact: [`deployed-testnet.json`](./deployed-testnet.json)

## Already proven

```bash
./scripts/tapeout-verify.sh
cd contracts && forge test
./scripts/verify-xlayer.sh   # Sourcify exact_match
```

## Enable live treasury execution

1. Confirm addresses in `.env` / `apps/api/.env` (see [deployments.md](../deployments.md)).  
2. Set `RELAYER_PRIVATE_KEY` (demo may reuse deployer).  
3. Obtain **testnet native USDC** and `deposit` into `BusinessTreasury` for the org.  
4. Set `ALLOW_SIMULATED_SETTLEMENT=false`.  
5. Keep API TapeOut eval on mainnet: `TAPEOUT_EVAL_CHAIN_ID=196`, Cerebr `0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF`.  
6. Run `./scripts/smoke-mvp.sh` or authorize a payment in the console.

## Explorer

- Testnet contracts: https://www.oklink.com/x-layer-testnet  
- Mainnet Cerebr: https://www.oklink.com/xlayer/address/0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF  

## Without USDC yet

Keep `ALLOW_SIMULATED_SETTLEMENT=true` for treasury movement while still showing:

1. Live TapeOut `eval` (Payments / Hack status)  
2. Foundry proof that authorize reverts when TapeOut fails  
3. Verified contract addresses on Sourcify / explorer  
