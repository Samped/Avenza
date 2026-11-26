/** Payment / invoice lifecycle states from the AVENZA blueprint. */

export const InvoiceStatuses = [
  "DRAFT",
  "SUBMITTED",
  "EXTRACTING",
  "UNDER_REVIEW",
  "REJECTED",
  "VERIFIED",
  "ON_HOLD",
  "AWAITING_APPROVAL",
  "APPROVED",
  "POLICY_EVALUATION",
  "POLICY_REJECTED",
  "AUTHORIZED",
  "PAYMENT_SUBMITTED",
  "PAYMENT_FAILED",
  "PAYMENT_CONFIRMED",
  "RECONCILIATION_PENDING",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "DISPUTED",
  "REFUND_PENDING",
  "REFUNDED",
  "MANUAL_REVIEW",
] as const;

export type InvoiceStatus = (typeof InvoiceStatuses)[number];

export const PaymentStatuses = [
  "DRAFT",
  "AWAITING_APPROVAL",
  "APPROVED",
  "POLICY_EVALUATION",
  "POLICY_REJECTED",
  "AUTHORIZED",
  "PAYMENT_SUBMITTED",
  "PAYMENT_FAILED",
  "PAYMENT_CONFIRMED",
  "RECONCILIATION_PENDING",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type PaymentStatus = (typeof PaymentStatuses)[number];

/** Allowed invoice transitions (fail-safe: missing edge = illegal). */
export const INVOICE_TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["EXTRACTING", "CANCELLED"],
  EXTRACTING: ["UNDER_REVIEW", "MANUAL_REVIEW", "REJECTED", "EXTRACTING"],
  UNDER_REVIEW: ["VERIFIED", "REJECTED", "MANUAL_REVIEW", "EXTRACTING"],
  REJECTED: [],
  VERIFIED: ["AWAITING_APPROVAL", "ON_HOLD", "APPROVED", "UNDER_REVIEW", "CANCELLED"],
  ON_HOLD: ["AWAITING_APPROVAL", "APPROVED", "UNDER_REVIEW", "CANCELLED", "MANUAL_REVIEW"],
  AWAITING_APPROVAL: ["APPROVED", "REJECTED", "EXPIRED", "CANCELLED", "ON_HOLD"],
  APPROVED: ["POLICY_EVALUATION", "CANCELLED", "ON_HOLD"],
  POLICY_EVALUATION: ["AUTHORIZED", "POLICY_REJECTED"],
  POLICY_REJECTED: ["UNDER_REVIEW", "CANCELLED"],
  AUTHORIZED: ["PAYMENT_SUBMITTED", "EXPIRED", "CANCELLED"],
  PAYMENT_SUBMITTED: ["PAYMENT_CONFIRMED", "PAYMENT_FAILED"],
  PAYMENT_FAILED: ["AUTHORIZED", "MANUAL_REVIEW", "CANCELLED"],
  PAYMENT_CONFIRMED: ["RECONCILIATION_PENDING"],
  RECONCILIATION_PENDING: ["COMPLETED", "DISPUTED"],
  COMPLETED: ["DISPUTED", "REFUND_PENDING"],
  CANCELLED: [],
  EXPIRED: ["CANCELLED"],
  DISPUTED: ["MANUAL_REVIEW", "REFUND_PENDING", "COMPLETED"],
  REFUND_PENDING: ["REFUNDED", "MANUAL_REVIEW"],
  REFUNDED: [],
  MANUAL_REVIEW: ["UNDER_REVIEW", "VERIFIED", "REJECTED", "CANCELLED", "EXTRACTING"],
};

export function canTransitionInvoice(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return (INVOICE_TRANSITIONS[from] ?? []).includes(to);
}

export const OrgRoles = ["admin", "approver", "payer", "auditor", "member"] as const;
export type OrgRole = (typeof OrgRoles)[number];

export const ROLE_PERMISSIONS: Record<OrgRole, readonly string[]> = {
  admin: [
    "org:manage",
    "members:manage",
    "suppliers:manage",
    "suppliers:read",
    "invoices:read",
    "invoices:write",
    "invoices:review",
    "approvals:decide",
    "policies:manage",
    "payments:execute",
    "payments:read",
    "treasury:read",
    "treasury:manage",
    "audit:read",
    "erp:manage",
    "api_keys:manage",
    "webhooks:manage",
  ],
  approver: ["invoices:read", "approvals:decide", "audit:read", "treasury:read", "payments:read"],
  payer: [
    "invoices:write",
    "invoices:review",
    "payments:execute",
    "payments:read",
    "suppliers:read",
    "audit:read",
    "treasury:read",
    "treasury:manage",
  ],
  auditor: ["invoices:read", "suppliers:read", "audit:read", "payments:read", "treasury:read"],
  member: ["invoices:read", "suppliers:read"],
};

export function roleHasPermission(role: OrgRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
