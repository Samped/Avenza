import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canTransitionInvoice, paymentCommitment, roleHasPermission } from "@avenza/shared";

describe("negative controls", () => {
  it("unauthorized role cannot execute payments", () => {
    assert.equal(roleHasPermission("auditor", "payments:execute"), false);
    assert.equal(roleHasPermission("member", "approvals:decide"), false);
  });

  it("commitment changes when destination changes", () => {
    const base = {
      organizationId: "org",
      referenceId: "inv",
      amountMinor: "1000000",
      currency: "USDC",
      supplierId: "sup",
      destinationAddress: "0x1111111111111111111111111111111111111111",
      tokenAddress: "0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3",
      chainId: 196,
      policyVersion: 1,
    };
    const a = paymentCommitment(base);
    const b = paymentCommitment({
      ...base,
      destinationAddress: "0x2222222222222222222222222222222222222222",
    });
    assert.notEqual(a, b);
  });

  it("cannot jump from rejected to completed", () => {
    assert.equal(canTransitionInvoice("REJECTED", "COMPLETED"), false);
    assert.equal(canTransitionInvoice("POLICY_REJECTED", "PAYMENT_SUBMITTED"), false);
  });
});
