# Acceptance checklist

A business can complete the following on **X Layer mainnet** (or local with mainnet addresses + funded wallets):

1. Create an account (register)  
2. Create an organization / workspace (authenticated)  
3. Invite an authorized finance user  
4. Register a payee / supplier  
5. Add and **verify** a payment destination  
6. Upload an invoice  
7. Extract invoice information  
8. Review and verify the invoice  
9. Configure dual-control approval policy as required  
10. Submit the payment for approval  
11. Obtain required approvals  
12. Bind payment policy to TapeOut processor (Cerebr) + circuit `#1`  
13. Evaluate policy via live TapeOut `eval` (local fallback forbidden in production)  
14. Receive an authorization decision  
15. Execute a **native USDC** payment on chain 196  
16. Reach `PAYMENT_CONFIRMED` after required confirmations (≥3 on mainnet)  
17. Associate the transaction with the invoice  
18. Reconcile the payment  
19. View complete audit history (off-chain + optional on-chain commitments)  

## Negative cases

Covered in Foundry tests and API guards:

- Unauthorized role rejected by RBAC  
- Unverified payee / destination blocked  
- Destination or amount change invalidates approvals (commitment mismatch)  
- Invoice cannot be paid twice (idempotency / replay)  
- Policy rejection blocks settlement  
- TapeOut fail blocks on-chain authorize  
- Expired authorization cannot be reused  
- Insufficient treasury balance prevents payment  
- Failed transaction is never reported complete without confirmations  
- Simulated settlement path removed — settle is on-chain or blocked  

## Production hosts

| Surface | URL |
|---------|-----|
| Console | https://avenzafinance.site |
| API health | https://avenza-api-7p71.onrender.com/api/v1/health |
| Addresses | [deployments.md](./deployments.md) |
