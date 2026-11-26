/**
 * Local deterministic policy evaluators mirroring TapeOut circuit intent.
 * On-chain TapeOut `eval()` is the source of truth once circuits are taped out;
 * these functions provide reference vectors and offline simulation.
 */

export type PaymentLimitInput = {
  requestedAmount: bigint;
  organizationLimit: bigint;
  dailyRemaining: bigint;
};

export type PaymentLimitOutput = {
  withinLimit: boolean;
  budgetSatisfied: boolean;
  policyPass: boolean;
};

export function evalPaymentLimit(input: PaymentLimitInput): PaymentLimitOutput {
  const withinLimit = input.requestedAmount > 0n && input.requestedAmount <= input.organizationLimit;
  const budgetSatisfied = input.requestedAmount <= input.dailyRemaining;
  return { withinLimit, budgetSatisfied, policyPass: withinLimit && budgetSatisfied };
}

export type ApprovalThresholdInput = {
  requiredApprovals: number;
  recordedApprovals: number;
  paymentAmount: bigint;
  requiredTierSatisfied: boolean;
};

export type ApprovalThresholdOutput = {
  thresholdSatisfied: boolean;
  additionalApprovalRequired: boolean;
  rejected: boolean;
};

export function evalApprovalThreshold(input: ApprovalThresholdInput): ApprovalThresholdOutput {
  const thresholdSatisfied =
    input.recordedApprovals >= input.requiredApprovals && input.requiredTierSatisfied;
  const additionalApprovalRequired = !thresholdSatisfied && input.recordedApprovals < input.requiredApprovals;
  return {
    thresholdSatisfied,
    additionalApprovalRequired,
    rejected: !thresholdSatisfied && !additionalApprovalRequired,
  };
}

export type VendorEligibilityInput = {
  vendorAuthorized: boolean;
  destinationApproved: boolean;
  vendorRiskBlocked: boolean;
};

export type VendorEligibilityOutput = {
  vendorEligible: boolean;
  destinationEligible: boolean;
  policyPass: boolean;
};

export function evalVendorEligibility(input: VendorEligibilityInput): VendorEligibilityOutput {
  const vendorEligible = input.vendorAuthorized && !input.vendorRiskBlocked;
  const destinationEligible = input.destinationApproved;
  return {
    vendorEligible,
    destinationEligible,
    policyPass: vendorEligible && destinationEligible,
  };
}

export type TreasuryControlInput = {
  availableBudget: bigint;
  requestedPayment: bigint;
  reservedAmount: bigint;
  dailySpendLimit: bigint;
  dailySpent: bigint;
};

export type TreasuryControlOutput = {
  sufficientBudget: boolean;
  spendingLimitSatisfied: boolean;
  paymentEligible: boolean;
};

export function evalTreasuryControl(input: TreasuryControlInput): TreasuryControlOutput {
  const free = input.availableBudget - input.reservedAmount;
  const sufficientBudget = input.requestedPayment > 0n && input.requestedPayment <= free;
  const spendingLimitSatisfied = input.dailySpent + input.requestedPayment <= input.dailySpendLimit;
  return {
    sufficientBudget,
    spendingLimitSatisfied,
    paymentEligible: sufficientBudget && spendingLimitSatisfied,
  };
}

/** Pack boolean flags into a bytes32-compatible hex for contract comparison. */
export function packPolicyResult(flags: boolean[]): `0x${string}` {
  let bits = 0n;
  flags.forEach((f, i) => {
    if (f) bits |= 1n << BigInt(i);
  });
  return `0x${bits.toString(16).padStart(64, "0")}`;
}
