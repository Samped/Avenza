import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evalPaymentLimit,
  evalApprovalThreshold,
  evalVendorEligibility,
  evalTreasuryControl,
  packPolicyResult,
} from "./policyEval";

describe("policyEval", () => {
  it("payment limit pass/fail", () => {
    const pass = evalPaymentLimit({
      requestedAmount: 100n,
      organizationLimit: 500n,
      dailyRemaining: 200n,
    });
    assert.equal(pass.policyPass, true);
    const fail = evalPaymentLimit({
      requestedAmount: 300n,
      organizationLimit: 500n,
      dailyRemaining: 200n,
    });
    assert.equal(fail.policyPass, false);
  });

  it("approval threshold", () => {
    const out = evalApprovalThreshold({
      requiredApprovals: 2,
      recordedApprovals: 2,
      paymentAmount: 1000n,
      requiredTierSatisfied: true,
    });
    assert.equal(out.thresholdSatisfied, true);
  });

  it("vendor eligibility blocks risk", () => {
    const out = evalVendorEligibility({
      vendorAuthorized: true,
      destinationApproved: true,
      vendorRiskBlocked: true,
    });
    assert.equal(out.policyPass, false);
  });

  it("treasury control respects reserve", () => {
    const out = evalTreasuryControl({
      availableBudget: 1000n,
      requestedPayment: 400n,
      reservedAmount: 700n,
      dailySpendLimit: 5000n,
      dailySpent: 0n,
    });
    assert.equal(out.paymentEligible, false);
  });

  it("packs flags", () => {
    assert.equal(packPolicyResult([true, false, true]), "0x" + "5".padStart(64, "0"));
  });
});
