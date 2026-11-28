-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('admin', 'approver', 'payer', 'auditor', 'member');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('active', 'invited', 'disabled');

-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('active', 'suspended', 'closed');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('pending', 'verified', 'rejected', 'needs_review');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('clear', 'watch', 'blocked');

-- CreateEnum
CREATE TYPE "PayeeType" AS ENUM ('supplier', 'client', 'business');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('invoice', 'direct', 'batch_line');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'SETTLING', 'COMPLETED', 'PARTIAL_FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'EXTRACTING', 'UNDER_REVIEW', 'REJECTED', 'VERIFIED', 'ON_HOLD', 'AWAITING_APPROVAL', 'APPROVED', 'POLICY_EVALUATION', 'POLICY_REJECTED', 'AUTHORIZED', 'PAYMENT_SUBMITTED', 'PAYMENT_FAILED', 'PAYMENT_CONFIRMED', 'RECONCILIATION_PENDING', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'DISPUTED', 'REFUND_PENDING', 'REFUNDED', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'POLICY_EVALUATION', 'POLICY_REJECTED', 'AUTHORIZED', 'PAYMENT_SUBMITTED', 'PAYMENT_FAILED', 'PAYMENT_CONFIRMED', 'RECONCILIATION_PENDING', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApprovalDecisionType" AS ENUM ('approve', 'reject');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('pending', 'passed', 'failed', 'error');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "country" TEXT,
    "businessEmail" TEXT,
    "status" "OrgStatus" NOT NULL DEFAULT 'active',
    "onChainOrgId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "accountStatus" TEXT NOT NULL DEFAULT 'active',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "status" "MemberStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "supplierCode" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "payeeType" "PayeeType" NOT NULL DEFAULT 'supplier',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'pending',
    "riskStatus" "RiskStatus" NOT NULL DEFAULT 'clear',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPaymentDestination" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'pending',
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPaymentDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseOrderNumber" TEXT NOT NULL,
    "totalAmountMinor" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'USDC',
    "subtotalMinor" TEXT,
    "taxAmountMinor" TEXT,
    "totalAmountMinor" TEXT,
    "documentStorageKey" TEXT,
    "documentHash" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "purchaseOrderId" TEXT,
    "paymentDestinationId" TEXT,
    "extractionJson" TEXT,
    "verificationJson" TEXT,
    "riskJson" TEXT,
    "controlsDecisionJson" TEXT,
    "holdReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "unitPrice" TEXT NOT NULL,
    "tax" TEXT NOT NULL DEFAULT '0',
    "total" TEXT NOT NULL,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalPolicyVersion" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "rulesJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "submittedById" TEXT,
    "requiredApprovals" INTEGER NOT NULL,
    "currentApprovals" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentCommitment" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRecord" (
    "id" TEXT NOT NULL,
    "approvalRequestId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "decision" "ApprovalDecisionType" NOT NULL,
    "paymentCommitment" TEXT NOT NULL,
    "note" TEXT,
    "signatureReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "policyName" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "processorAddress" TEXT,
    "circuitId" TEXT,
    "policyHash" TEXT NOT NULL,
    "dailySpendLimitMinor" TEXT NOT NULL,
    "perPaymentLimitMinor" TEXT NOT NULL,
    "status" "PolicyStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memo" TEXT,
    "status" "BatchStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'USDC',
    "totalAmountMinor" TEXT NOT NULL,
    "lineCount" INTEGER NOT NULL,
    "requiredApprovals" INTEGER NOT NULL DEFAULT 1,
    "currentApprovals" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "paymentCommitment" TEXT,
    "controlsVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "batchId" TEXT,
    "kind" "PaymentKind" NOT NULL DEFAULT 'invoice',
    "supplierId" TEXT NOT NULL,
    "amountMinor" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "memo" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'DRAFT',
    "requiredApprovals" INTEGER NOT NULL DEFAULT 0,
    "currentApprovals" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "paymentCommitment" TEXT,
    "authorizationId" TEXT,
    "authorizationTxHash" TEXT,
    "transactionHash" TEXT,
    "platformFeeMinor" TEXT,
    "gasRecoveryMinor" TEXT,
    "feeTxHash" TEXT,
    "feeRecipient" TEXT,
    "policyVersion" INTEGER,
    "controlsVersion" INTEGER,
    "riskFlagsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentApprovalRecord" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "batchId" TEXT,
    "approverId" TEXT NOT NULL,
    "decision" "ApprovalDecisionType" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentApprovalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyEvaluation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "policyVersion" INTEGER NOT NULL,
    "inputCommitment" TEXT NOT NULL,
    "outputData" TEXT NOT NULL,
    "evaluationStatus" "EvaluationStatus" NOT NULL DEFAULT 'pending',
    "evaluatedAt" TIMESTAMP(3),

    CONSTRAINT "PolicyEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "vaultAddress" TEXT,
    "onChainOrgId" TEXT,
    "fundingWalletAddress" TEXT,
    "fundingWalletKeyEnc" TEXT,
    "chainId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreasuryConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "eventPayload" TEXT NOT NULL,
    "previousHash" TEXT NOT NULL,
    "currentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "summaryJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "credentialsEnc" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErpConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlsPublication" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "rulesJson" TEXT NOT NULL,
    "configHash" TEXT NOT NULL,
    "onChainTxHash" TEXT,
    "onChainVersion" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ControlsPublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopesJson" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "secret" TEXT NOT NULL,
    "eventsJson" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "Supplier_organizationId_legalName_idx" ON "Supplier"("organizationId", "legalName");

-- CreateIndex
CREATE INDEX "Supplier_organizationId_payeeType_idx" ON "Supplier"("organizationId", "payeeType");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_organizationId_supplierCode_key" ON "Supplier"("organizationId", "supplierCode");

-- CreateIndex
CREATE INDEX "SupplierPaymentDestination_supplierId_active_idx" ON "SupplierPaymentDestination"("supplierId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_organizationId_purchaseOrderNumber_key" ON "PurchaseOrder"("organizationId", "purchaseOrderNumber");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_status_idx" ON "Invoice"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_invoiceNumber_idx" ON "Invoice"("organizationId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalPolicyVersion_policyId_version_key" ON "ApprovalPolicyVersion"("policyId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRecord_approvalRequestId_approverId_key" ON "ApprovalRecord"("approvalRequestId", "approverId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentPolicy_organizationId_policyName_version_key" ON "PaymentPolicy"("organizationId", "policyName", "version");

-- CreateIndex
CREATE INDEX "PaymentBatch_organizationId_status_idx" ON "PaymentBatch"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentBatch_organizationId_idempotencyKey_key" ON "PaymentBatch"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_batchId_idx" ON "Payment"("batchId");

-- CreateIndex
CREATE INDEX "Payment_kind_status_idx" ON "Payment"("kind", "status");

-- CreateIndex
CREATE INDEX "Payment_transactionHash_idx" ON "Payment"("transactionHash");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_organizationId_idempotencyKey_key" ON "Payment"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentApprovalRecord_paymentId_idx" ON "PaymentApprovalRecord"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentApprovalRecord_batchId_idx" ON "PaymentApprovalRecord"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentApprovalRecord_paymentId_approverId_key" ON "PaymentApprovalRecord"("paymentId", "approverId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentApprovalRecord_batchId_approverId_key" ON "PaymentApprovalRecord"("batchId", "approverId");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryConfig_organizationId_key" ON "TreasuryConfig"("organizationId");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ErpConnection_organizationId_provider_key" ON "ErpConnection"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "ControlsPublication_organizationId_active_idx" ON "ControlsPublication"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ControlsPublication_organizationId_version_key" ON "ControlsPublication"("organizationId", "version");

-- CreateIndex
CREATE INDEX "ApiKey_organizationId_idx" ON "ApiKey"("organizationId");

-- CreateIndex
CREATE INDEX "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_organizationId_active_idx" ON "WebhookEndpoint"("organizationId", "active");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_nextAttemptAt_idx" ON "WebhookDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_endpointId_createdAt_idx" ON "WebhookDelivery"("endpointId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_organizationId_key_key" ON "IdempotencyRecord"("organizationId", "key");

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPaymentDestination" ADD CONSTRAINT "SupplierPaymentDestination_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paymentDestinationId_fkey" FOREIGN KEY ("paymentDestinationId") REFERENCES "SupplierPaymentDestination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalPolicy" ADD CONSTRAINT "ApprovalPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalPolicyVersion" ADD CONSTRAINT "ApprovalPolicyVersion_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "ApprovalPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "ApprovalPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRecord" ADD CONSTRAINT "ApprovalRecord_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRecord" ADD CONSTRAINT "ApprovalRecord_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPolicy" ADD CONSTRAINT "PaymentPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentBatch" ADD CONSTRAINT "PaymentBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PaymentBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentApprovalRecord" ADD CONSTRAINT "PaymentApprovalRecord_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentApprovalRecord" ADD CONSTRAINT "PaymentApprovalRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PaymentBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentApprovalRecord" ADD CONSTRAINT "PaymentApprovalRecord_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyEvaluation" ADD CONSTRAINT "PolicyEvaluation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyEvaluation" ADD CONSTRAINT "PolicyEvaluation_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "PaymentPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryConfig" ADD CONSTRAINT "TreasuryConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationRun" ADD CONSTRAINT "ReconciliationRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpConnection" ADD CONSTRAINT "ErpConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlsPublication" ADD CONSTRAINT "ControlsPublication_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

