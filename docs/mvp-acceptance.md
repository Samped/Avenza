# MVP acceptance checklist

A business can:

1. Create an account (register)  
2. Create an organization / workspace (authenticated)  
3. Add an authorized finance user (member invite)  
4. Register a supplier  
5. Add an approved supplier payment destination  
6. Upload an invoice  
7. Extract invoice information  
8. Review and verify the invoice  
9. Configure an approval policy  
10. Submit the payment for approval  
11. Obtain the required approvals  
12. Configure a payment policy bound to TapeOut processor + circuit  
13. Evaluate the payment policy (live TapeOut `eval` when RPC available; local fallback only if enabled)  
14. Receive an authorization decision  
15. Execute a USDC payment (testnet / mainnet contracts **or** gated simulation)  
16. Confirm the transaction (confirmations)  
17. Associate the transaction with the invoice  
18. Reconcile the payment  
19. View the complete audit history  

## Negative cases

Covered in Foundry tests and API guards:

- Unauthorized role rejected by RBAC  
- Unapproved supplier destination fails verify / vendor gate  
- Destination change invalidates approvals (commitment mismatch)  
- Invoice cannot be paid twice (idempotency / replay)  
- Policy rejection blocks settlement  
- TapeOut fail blocks on-chain authorize  
- Expired authorization cannot be reused (contract)  
- Insufficient treasury balance prevents payment (contract)  
- Failed transaction is not reported as completed without confirmations  
- Simulated settlement requires explicit env flag  
