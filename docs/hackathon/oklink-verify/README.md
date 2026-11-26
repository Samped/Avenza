# Verify on OKLink without an API key

You are not missing a button. OKLink no longer offers a simple public “create explorer API key” page for most people (Explorer API was discontinued; remaining Trust APIs need KYC).

**Already done:** all contracts are verified on Sourcify (`exact_match`). That is enough for the hackathon.

## Optional — show source on OKLink explorer

Use the web form (no API key):

https://www.oklink.com/x-layer-testnet/verify-contract-preliminary

For each entry in `manifest.json`:

1. Paste the contract `address`
2. Prefer **Standard JSON Input** → upload `*.standard-json.json`
3. Contract name = `contractName` (e.g. `PaymentAuthorization`)
4. Compiler **0.8.24**, optimization **Yes**, runs **200**, enable **via IR** if shown
5. If Standard JSON fails, use **Single file** with `*.flattened.sol`

Constructor args are in the Sourcify/forge deploy logs; for single-file verification the form often asks for ABI-encoded constructor arguments.
