/** On-chain ControlsRegistry mirror — decisions match ControlsRegistry.sol */

export type ControlsRules = {
  autoApproveMaxUsdc: number;
  singleApproverMaxUsdc: number;
  dualControlAboveUsdc: number;
  minConfidenceBps: number;
  holdOnNewVendor: boolean;
  holdOnDestinationChange: boolean;
  holdOnDuplicate: boolean;
  requirePurchaseOrder: boolean;
  requirePoMatch: boolean;
  holdOnUnknownDestination: boolean;
  blockAutoApproveUntilAllowlisted: boolean;
};

/** Custara-compatible alias */
export type PolicyRules = ControlsRules;

export const DEFAULT_CONTROLS_RULES: ControlsRules = {
  autoApproveMaxUsdc: 5_000,
  singleApproverMaxUsdc: 50_000,
  dualControlAboveUsdc: 50_000,
  minConfidenceBps: 7500,
  holdOnNewVendor: true,
  holdOnDestinationChange: true,
  holdOnDuplicate: true,
  requirePurchaseOrder: false,
  requirePoMatch: false,
  holdOnUnknownDestination: true,
  blockAutoApproveUntilAllowlisted: true,
};

/** Strict preset — tight auto-approve, dual-control sooner, all holds on */
export const STRICT_CONTROLS_RULES: ControlsRules = {
  autoApproveMaxUsdc: 500,
  singleApproverMaxUsdc: 5_000,
  dualControlAboveUsdc: 5_000,
  minConfidenceBps: 8500,
  holdOnNewVendor: true,
  holdOnDestinationChange: true,
  holdOnDuplicate: true,
  requirePurchaseOrder: true,
  requirePoMatch: true,
  holdOnUnknownDestination: true,
  blockAutoApproveUntilAllowlisted: true,
};

export const DEFAULT_POLICY_RULES = DEFAULT_CONTROLS_RULES;
export const STRICT_POLICY_RULES = STRICT_CONTROLS_RULES;

export type RiskFlags = {
  isNewVendor: boolean;
  destinationChanged: boolean;
  isDuplicate: boolean;
  missingPo: boolean;
  poMismatch: boolean;
  unknownDestination: boolean;
  supplierBlocked: boolean;
  confidenceBps: number;
};

export type ControlsDecision = "auto_approve" | "single_approval" | "dual_control" | "hold";

export type ControlsEvaluation = {
  decision: ControlsDecision;
  requiredApprovals: number;
  reasonCode: string;
  nextStatus: "APPROVED" | "AWAITING_APPROVAL" | "ON_HOLD";
};

const DECISION_BY_CODE: ControlsDecision[] = [
  "auto_approve",
  "single_approval",
  "dual_control",
  "hold",
];

/** Pure mirror of ControlsRegistry.evaluate for UX / preflight (settlement re-checks on-chain). */
export function evaluateControls(input: {
  amountUsdc: number;
  flags: RiskFlags;
  rules: ControlsRules;
}): ControlsEvaluation {
  const { amountUsdc, flags, rules } = input;
  const hold = (reasonCode: string): ControlsEvaluation => ({
    decision: "hold",
    requiredApprovals: 1,
    reasonCode,
    nextStatus: "ON_HOLD",
  });

  if (flags.supplierBlocked) return hold("supplier_blocked");
  if (rules.holdOnDuplicate && flags.isDuplicate) return hold("duplicate");
  if (rules.holdOnUnknownDestination && flags.unknownDestination) return hold("unknown_destination");
  if (rules.blockAutoApproveUntilAllowlisted && flags.unknownDestination) {
    return hold("not_allowlisted");
  }
  if (rules.requirePurchaseOrder && flags.missingPo) return hold("missing_po");
  if (rules.requirePoMatch && flags.poMismatch) return hold("po_mismatch");
  if (rules.holdOnNewVendor && flags.isNewVendor) return hold("new_vendor");
  if (rules.holdOnDestinationChange && flags.destinationChanged) {
    return hold("destination_change");
  }
  if (flags.confidenceBps < rules.minConfidenceBps) return hold("low_confidence");

  if (
    amountUsdc <= rules.autoApproveMaxUsdc &&
    !flags.isNewVendor &&
    !flags.destinationChanged &&
    !flags.unknownDestination
  ) {
    return {
      decision: "auto_approve",
      requiredApprovals: 0,
      reasonCode: "auto_approve",
      nextStatus: "APPROVED",
    };
  }
  if (amountUsdc <= rules.singleApproverMaxUsdc) {
    return {
      decision: "single_approval",
      requiredApprovals: 1,
      reasonCode: "single_approval",
      nextStatus: "AWAITING_APPROVAL",
    };
  }
  return {
    decision: "dual_control",
    requiredApprovals: 2,
    reasonCode: "dual_control",
    nextStatus: "AWAITING_APPROVAL",
  };
}

export function decisionFromOnChain(code: number): ControlsDecision {
  return DECISION_BY_CODE[code] ?? "hold";
}

/** Convert major USDC units to 6-decimal minor for the contract. */
export function usdcMajorToMinor(major: number): bigint {
  return BigInt(Math.round(major * 1e6));
}
