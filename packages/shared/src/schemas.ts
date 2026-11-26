import { z } from "zod";
import { OrgRoles, InvoiceStatuses, PaymentStatuses } from "./states";

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(128),
  fullName: z.string().min(1).max(200),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const CreateOrganizationSchema = z.object({
  legalName: z.string().min(1).max(300),
  registrationNumber: z.string().max(100).optional(),
  country: z.string().length(2).optional(),
  businessEmail: z.string().email().optional(),
});

export const InviteMemberSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(200).optional(),
  role: z.enum(OrgRoles),
});

export const CreateSupplierSchema = z.object({
  legalName: z.string().min(1).max(300),
  supplierCode: z.string().min(1).max(64).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(40).optional(),
  payeeType: z.enum(["supplier", "client", "business"]).default("supplier"),
});

export const AddPaymentDestinationSchema = z.object({
  chainId: z.number().int().positive(),
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

export const CreateInvoiceSchema = z.object({
  supplierId: z.string().uuid().optional(),
  invoiceNumber: z.string().max(128).optional(),
  currency: z.string().default("USDC"),
  purchaseOrderNumber: z.string().max(128).optional(),
});

export const ReviewInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1).max(128),
  supplierId: z.string().uuid(),
  invoiceDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  currency: z.string().min(1).max(16),
  subtotal: z.string(),
  taxAmount: z.string().default("0"),
  totalAmount: z.string(),
  paymentDestinationId: z.string().uuid().optional(),
  purchaseOrderId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

export const CreateApprovalPolicySchema = z.object({
  name: z.string().min(1).max(120),
  rules: z.array(
    z.object({
      minAmount: z.string(),
      maxAmount: z.string().nullable(),
      requiredApprovals: z.number().int().min(1).max(10),
      requireNewSupplierExtra: z.boolean().optional(),
    }),
  ),
});

export const CreatePaymentPolicySchema = z.object({
  policyName: z.string().min(1).max(120),
  dailySpendLimitMinor: z.string(),
  perPaymentLimitMinor: z.string(),
  processorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  circuitId: z.string().optional(),
});

export const PublishControlsSchema = z.object({
  name: z.string().min(1).max(120).default("AP Controls"),
  autoApproveMaxUsdc: z.number().nonnegative(),
  singleApproverMaxUsdc: z.number().nonnegative(),
  dualControlAboveUsdc: z.number().nonnegative(),
  minConfidenceBps: z.number().int().min(0).max(10_000).default(7500),
  holdOnNewVendor: z.boolean().default(true),
  holdOnDestinationChange: z.boolean().default(true),
  holdOnDuplicate: z.boolean().default(true),
  requirePurchaseOrder: z.boolean().default(false),
  requirePoMatch: z.boolean().default(false),
  holdOnUnknownDestination: z.boolean().default(true),
  blockAutoApproveUntilAllowlisted: z.boolean().default(true),
});

export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(120),
  scopes: z.array(z.string().min(1)).min(1).max(20),
  expiresAt: z.string().datetime().optional(),
});

export const CreateWebhookEndpointSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string().min(1)).min(1).max(30),
  description: z.string().max(200).optional(),
});

export const CreatePaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(128),
});

const amountMinorSchema = z
  .string()
  .regex(/^\d+$/, "amountMinor must be an integer string (USDC 6 decimals)");

export const CreateDirectPaymentSchema = z
  .object({
    supplierId: z.string().uuid().optional(),
    destinationId: z.string().uuid().optional(),
    destinationAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "destinationAddress must be a 0x wallet")
      .optional(),
    amountMinor: amountMinorSchema,
    currency: z.string().default("USDC"),
    memo: z.string().max(500).optional(),
    idempotencyKey: z.string().min(8).max(128),
  })
  .refine((v) => Boolean(v.supplierId || v.destinationAddress), {
    message: "Provide a destination address or a client",
    path: ["destinationAddress"],
  });

export const CreatePaymentBatchSchema = z.object({
  memo: z.string().max(500).optional(),
  currency: z.string().default("USDC"),
  idempotencyKey: z.string().min(8).max(128),
  lines: z
    .array(
      z.object({
        supplierId: z.string().uuid(),
        destinationId: z.string().uuid().optional(),
        amountMinor: amountMinorSchema,
        memo: z.string().max(500).optional(),
      }),
    )
    .min(2)
    .max(100),
});

export const ApproveSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().max(1000).optional(),
});

export const InvoiceStatusSchema = z.enum(InvoiceStatuses);
export const PaymentStatusSchema = z.enum(PaymentStatuses);
