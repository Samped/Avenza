import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ApproveSchema,
  CreateDirectPaymentSchema,
  CreatePaymentBatchSchema,
  CreatePaymentSchema,
  paymentCommitment,
  sha256Hex,
  type RiskFlags,
} from "@avenza/shared";
import {
  AVENZA_TAPEOUT,
  XLAYER_TESTNET,
  explorerAddressUrl,
  explorerTxUrl,
} from "@avenza/chain";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { PoliciesService } from "../policies/policies.service";
import { OnchainSyncService } from "../chain/onchain-sync.service";
import { RiskService } from "../risk/risk.service";
import { ControlsService } from "../controls/controls.service";
import { WebhooksService } from "../webhooks/webhooks.service";
import { executeSettlement, getConfirmations, SettlementError } from "./settlement";
import { revealBatch, revealPayment, sealMemo } from "../crypto/sensitive-fields";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly policies: PoliciesService,
    private readonly onchain: OnchainSyncService,
    private readonly risk: RiskService,
    private readonly controls: ControlsService,
    private readonly webhooks: WebhooksService,
  ) {}

  async create(orgId: string, actorId: string, body: unknown) {
    const parsed = CreatePaymentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const existing = await this.prisma.payment.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: orgId,
          idempotencyKey: parsed.data.idempotencyKey,
        },
      },
    });
    if (existing) {
      const bodyHash = sha256Hex(JSON.stringify(parsed.data));
      const stored = await this.prisma.idempotencyRecord.findUnique({
        where: {
          organizationId_key: { organizationId: orgId, key: parsed.data.idempotencyKey },
        },
      });
      if (stored && stored.requestHash !== bodyHash) {
        throw new ConflictException("Idempotency key reused with different body");
      }
      return existing;
    }

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: parsed.data.invoiceId, organizationId: orgId },
      include: { paymentDestination: true, payments: true },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    if (invoice.status !== "APPROVED") {
      throw new BadRequestException(
        invoice.status === "PAYMENT_FAILED"
          ? "Invoice settle failed — retry /payments/:id/execute on the existing payment (do not create a new one)"
          : "Invoice must be APPROVED",
      );
    }
    // Block recreating a payment while any in-flight / failed / settled payment exists.
    // PAYMENT_FAILED must be retried via execute() on the same paymentId (on-chain paymentSeen).
    const blocking = [
      "COMPLETED",
      "PAYMENT_CONFIRMED",
      "PAYMENT_SUBMITTED",
      "AUTHORIZED",
      "PAYMENT_FAILED",
      "APPROVED",
      "AWAITING_APPROVAL",
    ];
    const active = invoice.payments.find((p) => blocking.includes(p.status));
    if (active) {
      throw new BadRequestException(
        active.status === "PAYMENT_FAILED"
          ? `Invoice has a failed payment (${active.id}) — retry execute on that payment; do not create a new one`
          : "Invoice already has an active/completed payment",
      );
    }
    if (!invoice.supplierId || !invoice.totalAmountMinor || !invoice.paymentDestination) {
      throw new BadRequestException("Invoice not ready for payment");
    }

    const paymentPolicy = await this.prisma.paymentPolicy.findFirst({
      where: { organizationId: orgId, status: "active" },
      orderBy: { version: "desc" },
    });
    if (!paymentPolicy) throw new BadRequestException("No payment policy");

    const commitment = paymentCommitment({
      organizationId: orgId,
      referenceId: invoice.id,
      amountMinor: invoice.totalAmountMinor,
      currency: invoice.currency,
      supplierId: invoice.supplierId,
      destinationAddress: invoice.paymentDestination.walletAddress,
      tokenAddress: invoice.paymentDestination.tokenAddress,
      chainId: invoice.paymentDestination.chainId,
      policyVersion: paymentPolicy.version,
    });

    const payment = await this.prisma.payment.create({
      data: {
        organizationId: orgId,
        invoiceId: invoice.id,
        supplierId: invoice.supplierId,
        amountMinor: invoice.totalAmountMinor,
        currency: invoice.currency,
        chainId: invoice.paymentDestination.chainId,
        tokenAddress: invoice.paymentDestination.tokenAddress,
        destinationAddress: invoice.paymentDestination.walletAddress,
        status: "APPROVED",
        idempotencyKey: parsed.data.idempotencyKey,
        paymentCommitment: commitment,
        policyVersion: paymentPolicy.version,
      },
    });

    await this.prisma.idempotencyRecord.create({
      data: {
        organizationId: orgId,
        key: parsed.data.idempotencyKey,
        requestHash: sha256Hex(JSON.stringify(parsed.data)),
        responseJson: JSON.stringify({ id: payment.id }),
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "payment.created",
      entityType: "payment",
      entityId: payment.id,
      eventPayload: { invoiceId: invoice.id, amountMinor: payment.amountMinor },
    });

    return payment;
  }

  async list(orgId: string) {
    const rows = await this.prisma.payment.findMany({
      where: { organizationId: orgId },
      include: { invoice: true, supplier: true, batch: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((p) => revealPayment(p));
  }

  async get(orgId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, organizationId: orgId },
      include: {
        invoice: { include: { paymentDestination: true } },
        supplier: { include: { paymentDestinations: { where: { active: true } } } },
        batch: true,
        approvals: true,
        evaluations: true,
      },
    });
    if (!payment) throw new NotFoundException();
    return revealPayment(payment);
  }

  private async touchInvoice(
    invoiceId: string | null | undefined,
    data: Record<string, unknown>,
  ) {
    if (!invoiceId) return;
    await this.prisma.invoice.update({ where: { id: invoiceId }, data });
  }

  async authorize(orgId: string, paymentId: string, actorId: string) {
    const payment = await this.get(orgId, paymentId);
    // Allow re-authorize after soft failure only when no on-chain auth was recorded.
    if (payment.status === "PAYMENT_FAILED" && payment.authorizationId) {
      throw new BadRequestException(
        "Payment already authorized on-chain — call /execute to retry settlement",
      );
    }
    if (
      !["APPROVED", "POLICY_EVALUATION", "POLICY_REJECTED", "PAYMENT_FAILED"].includes(
        payment.status,
      )
    ) {
      throw new BadRequestException("Payment not ready for authorization");
    }

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: "POLICY_EVALUATION" },
    });
    await this.touchInvoice(payment.invoiceId, { status: "POLICY_EVALUATION" });

    const { output, policy } = await this.policies.evaluateForPayment(orgId, paymentId);
    if (!output.policyPass) {
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: "POLICY_REJECTED" },
      });
      await this.touchInvoice(payment.invoiceId, { status: "POLICY_REJECTED" });
      await this.audit.record({
        organizationId: orgId,
        actorId,
        eventType: "payment.policy_rejected",
        entityType: "payment",
        entityId: paymentId,
        eventPayload: output,
      });
      throw new BadRequestException({ message: "Policy rejected", output });
    }

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "AUTHORIZED",
        policyVersion: policy.version,
      },
    });
    await this.touchInvoice(payment.invoiceId, { status: "AUTHORIZED" });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "payment.authorized",
      entityType: "payment",
      entityId: paymentId,
      eventPayload: {
        packedResult: output.packedResult,
        tapeOut: output.tapeOut,
        policyVersion: policy.version,
        processorAddress: policy.processorAddress,
        circuitId: policy.circuitId,
      },
    });

    return {
      payment: updated,
      evaluation: output,
      tapeOut: output.tapeOut,
      policy: {
        id: policy.id,
        version: policy.version,
        processorAddress: policy.processorAddress,
        circuitId: policy.circuitId,
      },
    };
  }

  async execute(orgId: string, paymentId: string, actorId: string) {
    const payment = await this.get(orgId, paymentId);

    // Prevent double execution
    if (payment.transactionHash) {
      throw new BadRequestException("Payment already submitted");
    }

    const retryAfterAuth =
      payment.status === "PAYMENT_FAILED" && Boolean(payment.authorizationId);
    const freshExecute = payment.status === "AUTHORIZED";
    if (!freshExecute && !retryAfterAuth) {
      throw new BadRequestException(
        payment.status === "PAYMENT_FAILED"
          ? "Failed payment has no on-chain authorization — re-authorize first, or contact support"
          : "Payment must be AUTHORIZED (or PAYMENT_FAILED with an authorization to retry)",
      );
    }

    // Re-authorize path: failed before on-chain auth was recorded
    if (payment.status === "PAYMENT_FAILED" && !payment.authorizationId) {
      throw new BadRequestException(
        "Payment failed before authorization — call /authorize again then /execute (same payment id)",
      );
    }

    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });

    let requiredApprovals = 0;
    let approvalCount = 0;

    if (payment.kind === "invoice") {
      if (!payment.invoiceId) {
        throw new BadRequestException("Invoice payment missing invoiceId");
      }
      const approval = await this.prisma.approvalRequest.findFirst({
        where: { invoiceId: payment.invoiceId, status: "approved" },
        include: { records: true },
        orderBy: { createdAt: "desc" },
      });
      if (!approval) {
        throw new BadRequestException("Approved approval request required before settlement");
      }
      if (approval.expiresAt && approval.expiresAt.getTime() < Date.now()) {
        throw new BadRequestException("Approval authorization has expired — resubmit for approval");
      }
      requiredApprovals = approval.requiredApprovals;
      approvalCount =
        approval.requiredApprovals === 0
          ? 0
          : approval.records.filter((r) => r.decision === "approve").length;
    } else if (payment.kind === "batch_line" && payment.batchId) {
      const batch = await this.prisma.paymentBatch.findFirst({
        where: { id: payment.batchId, organizationId: orgId },
        include: { approvals: true },
      });
      if (!batch || !["APPROVED", "SETTLING", "PARTIAL_FAILED"].includes(batch.status)) {
        throw new BadRequestException("Batch must be approved before settling lines");
      }
      requiredApprovals = batch.requiredApprovals;
      approvalCount =
        batch.requiredApprovals === 0
          ? 0
          : batch.approvals.filter((r) => r.decision === "approve").length;
    } else {
      // direct payout — execute only runs when status is AUTHORIZED
      requiredApprovals = payment.requiredApprovals;
      approvalCount =
        payment.requiredApprovals === 0
          ? 0
          : payment.approvals.filter((r) => r.decision === "approve").length;
      if (approvalCount < requiredApprovals) {
        throw new BadRequestException("Direct payout needs more approvals");
      }
    }

    const dest =
      payment.invoice?.paymentDestination ||
      payment.supplier.paymentDestinations.find(
        (d) => d.walletAddress.toLowerCase() === payment.destinationAddress.toLowerCase(),
      );
    const vendorEligible =
      payment.supplier.verificationStatus === "verified" &&
      payment.supplier.riskStatus !== "blocked" &&
      dest?.verificationStatus === "verified" &&
      dest.walletAddress.toLowerCase() === payment.destinationAddress.toLowerCase();
    if (!vendorEligible) {
      throw new BadRequestException(
        "Payee or payment destination is not verified / eligible for settlement",
      );
    }

    // Sync VendorRegistry so on-chain isEligible matches off-chain verification.
    await this.onchain.syncVendor({
      onChainOrgId: org.onChainOrgId || org.id,
      supplierId: payment.supplierId,
      destination: payment.destinationAddress as `0x${string}`,
      verified: true,
    });

    const evalRow = payment.evaluations[payment.evaluations.length - 1];
    const evalOutput = evalRow ? (JSON.parse(evalRow.outputData) as {
      packedResult?: `0x${string}`;
      tapeOut?: { inputs?: `0x${string}`; pass?: boolean };
      policyPass?: boolean;
    }) : undefined;
    if (!evalOutput?.policyPass) {
      throw new BadRequestException("Policy evaluation must pass before settlement");
    }
    const packed =
      evalOutput?.packedResult || (`0x${"f".repeat(64)}` as `0x${string}`);
    const circuitInputs =
      evalOutput?.tapeOut?.inputs || ("0x03" as `0x${string}`);

    const assessment = payment.invoiceId
      ? await this.risk.assessInvoice(orgId, payment.invoiceId)
      : await this.risk.assessPayee(orgId, payment.supplierId, payment.destinationAddress);
    const controlsEval = await this.controls.evaluate(
      orgId,
      BigInt(payment.amountMinor),
      assessment.flags,
    );
    if (controlsEval.decision === "hold") {
      await this.touchInvoice(payment.invoiceId, {
        status: "ON_HOLD",
        holdReason: controlsEval.reasonCode,
        riskJson: JSON.stringify({ flags: assessment.flags, items: assessment.items }),
        controlsDecisionJson: JSON.stringify(controlsEval),
      });
      throw new BadRequestException(
        `On-chain controls hold blocks settlement: ${controlsEval.reasonCode}`,
      );
    }
    if (approvalCount < Math.max(requiredApprovals, controlsEval.requiredApprovals)) {
      throw new BadRequestException(
        `Insufficient approvals for on-chain controls (need ${Math.max(requiredApprovals, controlsEval.requiredApprovals)})`,
      );
    }
    const riskFlags: RiskFlags = assessment.flags;

    try {
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: "PAYMENT_SUBMITTED",
          riskFlagsJson: JSON.stringify(riskFlags),
          controlsVersion: controlsEval.controlsVersion || null,
        },
      });
      await this.touchInvoice(payment.invoiceId, { status: "PAYMENT_SUBMITTED" });

      const result = await executeSettlement({
        organizationOnChainId: org.onChainOrgId || org.id,
        paymentId: payment.id,
        invoiceCommitment: payment.paymentCommitment || payment.id,
        policyVersion: payment.policyVersion || 1,
        controlsVersion: controlsEval.controlsVersion || 0,
        amountMinor: BigInt(payment.amountMinor),
        tokenAddress: payment.tokenAddress as `0x${string}`,
        destination: payment.destinationAddress as `0x${string}`,
        approvalCount,
        requiredApprovals: Math.max(requiredApprovals, controlsEval.requiredApprovals),
        circuitResult: packed,
        vendorEligible,
        vendorId: payment.supplierId,
        circuitInputs,
        risk: riskFlags,
        existingAuthorizationId: retryAfterAuth
          ? (payment.authorizationId as string)
          : undefined,
      });

      const updated = await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          authorizationId: result.authorizationId,
          authorizationTxHash: result.authorizationTxHash,
          transactionHash: result.transactionHash,
          policyVersion: result.policyVersion,
          controlsVersion: result.controlsVersion,
          status: "PAYMENT_SUBMITTED",
        },
      });

      await this.audit.record({
        organizationId: orgId,
        actorId,
        eventType: "payment.submitted",
        entityType: "payment",
        entityId: paymentId,
        eventPayload: {
          mode: "onchain",
          chainId: result.chainId,
          authorizationId: result.authorizationId,
          authorizationTxHash: result.authorizationTxHash,
          transactionHash: result.transactionHash,
          policyVersion: result.policyVersion,
        },
      });

      void this.onchain.commitAudit({
        onChainOrgId: org.onChainOrgId || org.id,
        recordKey: `${paymentId}:submitted:${Date.now()}`,
        invoiceCommitment: payment.paymentCommitment || payment.id,
        paymentId,
        policyVersion: result.policyVersion,
        authorizationRef: result.authorizationId,
        settlementRef: result.transactionHash,
        eventType: 2,
      });

      void this.webhooks.dispatch(orgId, "payment.submitted", {
        paymentId,
        authorizationTxHash: result.authorizationTxHash,
        transactionHash: result.transactionHash,
        controlsVersion: result.controlsVersion,
      });

      return {
        ...updated,
        settlement: {
          mode: "onchain" as const,
          chainId: result.chainId,
          policyVersion: result.policyVersion,
          authorizationId: result.authorizationId,
          authorizationTxHash: result.authorizationTxHash,
          transactionHash: result.transactionHash,
          explorer: {
            authorize: explorerTxUrl(result.chainId, result.authorizationTxHash),
            settle: explorerTxUrl(result.chainId, result.transactionHash),
          },
        },
      };
    } catch (e) {
      const partial =
        e instanceof SettlementError
          ? e.partial
          : undefined;
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: "PAYMENT_FAILED",
          ...(partial?.authorizationId
            ? { authorizationId: partial.authorizationId }
            : {}),
          ...(partial?.authorizationTxHash
            ? { authorizationTxHash: partial.authorizationTxHash }
            : {}),
          ...(partial?.policyVersion ? { policyVersion: partial.policyVersion } : {}),
        },
      });
      // Keep invoice PAYMENT_FAILED so operators retry execute on the same payment
      // (creating a new paymentId would bypass on-chain paymentSeen and double-pay).
      await this.touchInvoice(payment.invoiceId, { status: "PAYMENT_FAILED" });
      await this.audit.record({
        organizationId: orgId,
        actorId,
        eventType: "payment.failed",
        entityType: "payment",
        entityId: paymentId,
        eventPayload: {
          error: (e as Error).message,
          authorizationTxHash: partial?.authorizationTxHash,
          authorizationId: partial?.authorizationId,
        },
      });
      void this.webhooks.dispatch(orgId, "payment.failed", {
        paymentId,
        error: (e as Error).message,
        authorizationTxHash: partial?.authorizationTxHash,
      });
      throw new BadRequestException((e as Error).message);
    }
  }

  async refreshStatus(orgId: string, paymentId: string) {
    const payment = await this.get(orgId, paymentId);
    if (!payment.transactionHash || payment.status !== "PAYMENT_SUBMITTED") {
      return payment;
    }

    const required = Number(process.env.REQUIRED_CONFIRMATIONS || 1);
    const confs = await getConfirmations(payment.transactionHash as `0x${string}`);
    if (confs < required) {
      return { ...payment, confirmations: confs, required };
    }

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: "PAYMENT_CONFIRMED" },
    });
    await this.touchInvoice(payment.invoiceId, { status: "PAYMENT_CONFIRMED" });

    void this.webhooks.dispatch(orgId, "payment.confirmed", {
      paymentId,
      transactionHash: payment.transactionHash,
      confirmations: confs,
    });

    return { ...updated, confirmations: confs, required };
  }

  async markReconciled(orgId: string, paymentId: string, actorId: string) {
    const payment = await this.get(orgId, paymentId);
    if (payment.status !== "PAYMENT_CONFIRMED" && payment.status !== "RECONCILIATION_PENDING") {
      throw new BadRequestException("Payment not confirmed");
    }
    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await this.touchInvoice(payment.invoiceId, { status: "COMPLETED" });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "payment.completed",
      entityType: "payment",
      entityId: paymentId,
      eventPayload: { transactionHash: payment.transactionHash },
    });

    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (org) {
      void this.onchain.commitAudit({
        onChainOrgId: org.onChainOrgId || org.id,
        recordKey: `${paymentId}:completed`,
        invoiceCommitment: payment.paymentCommitment || payment.invoiceId || paymentId,
        paymentId,
        policyVersion: payment.policyVersion || 1,
        authorizationRef: payment.authorizationId || undefined,
        settlementRef: payment.transactionHash || undefined,
        eventType: 3,
      });
    }

    return updated;
  }

  private async resolvePayeeDestination(
    orgId: string,
    supplierId: string,
    destinationId?: string,
  ) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organizationId: orgId },
      include: { paymentDestinations: { where: { active: true } } },
    });
    if (!supplier) throw new NotFoundException("Payee not found");
    if (supplier.verificationStatus !== "verified") {
      throw new BadRequestException("Payee must be verified");
    }
    if (supplier.riskStatus === "blocked") {
      throw new BadRequestException("Payee is blocked");
    }
    const dest = destinationId
      ? supplier.paymentDestinations.find((d) => d.id === destinationId)
      : supplier.paymentDestinations.find((d) => d.verificationStatus === "verified");
    if (!dest || dest.verificationStatus !== "verified") {
      throw new BadRequestException("Verified payment destination required");
    }
    return { supplier, dest };
  }

  /** Resolve by wallet address and/or optional client; create ad-hoc payee when address-only. */
  private async resolveDirectDestination(
    orgId: string,
    actorId: string,
    opts: { supplierId?: string; destinationId?: string; destinationAddress?: string },
  ) {
    const wallet = opts.destinationAddress?.toLowerCase();
    const token =
      process.env.XLAYER_USDC_ADDRESS?.toLowerCase() ||
      "0xdec90b78111ba2fc6fc6d84d8b9ec159a2d4b9b3";
    const chainId = Number(process.env.XLAYER_CHAIN_ID || 1952);

    if (wallet) {
      const existingDest = await this.prisma.supplierPaymentDestination.findFirst({
        where: {
          walletAddress: { equals: wallet, mode: "insensitive" },
          active: true,
          supplier: { organizationId: orgId },
          ...(opts.supplierId ? { supplierId: opts.supplierId } : {}),
        },
        include: { supplier: { include: { paymentDestinations: { where: { active: true } } } } },
      });
      if (existingDest) {
        if (existingDest.supplier.riskStatus === "blocked") {
          throw new BadRequestException("Payee is blocked");
        }
        return { supplier: existingDest.supplier, dest: existingDest };
      }
    }

    if (opts.supplierId) {
      const { supplier, dest: primary } = await this.resolvePayeeDestination(
        orgId,
        opts.supplierId,
        opts.destinationId,
      );
      if (!wallet || wallet === primary.walletAddress.toLowerCase()) {
        return { supplier, dest: primary };
      }
      // New destination on existing payee stays pending until explicit verify.
      const dest = await this.prisma.supplierPaymentDestination.create({
        data: {
          supplierId: supplier.id,
          chainId,
          tokenAddress: token,
          walletAddress: wallet,
          verificationStatus: "pending",
          version: 1,
          active: true,
        },
      });
      return { supplier, dest };
    }

    if (!wallet) {
      throw new BadRequestException("Provide a destination address or a client");
    }

    const short = `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
    // Address-only payees are created as pending — must be verified before settlement.
    const supplier = await this.prisma.supplier.create({
      data: {
        organizationId: orgId,
        legalName: `Wallet ${short}`,
        payeeType: "client",
        verificationStatus: "pending",
        riskStatus: "clear",
        paymentDestinations: {
          create: {
            chainId,
            tokenAddress: token,
            walletAddress: wallet,
            verificationStatus: "pending",
            version: 1,
            active: true,
          },
        },
      },
      include: { paymentDestinations: { where: { active: true } } },
    });
    const dest = supplier.paymentDestinations[0];
    if (!dest) throw new BadRequestException("Failed to create destination");
    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "supplier.created",
      entityType: "supplier",
      entityId: supplier.id,
      eventPayload: {
        legalName: supplier.legalName,
        source: "direct_address",
        walletAddress: wallet,
        verificationStatus: "pending",
      },
    });
    return { supplier, dest };
  }

  async createDirect(orgId: string, actorId: string, body: unknown) {
    const parsed = CreateDirectPaymentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const existing = await this.prisma.payment.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: orgId,
          idempotencyKey: parsed.data.idempotencyKey,
        },
      },
    });
    if (existing) return existing;

    const paymentPolicy = await this.prisma.paymentPolicy.findFirst({
      where: { organizationId: orgId, status: "active" },
      orderBy: { version: "desc" },
    });
    if (!paymentPolicy) throw new BadRequestException("No payment policy");

    const { supplier, dest } = await this.resolveDirectDestination(orgId, actorId, {
      supplierId: parsed.data.supplierId,
      destinationId: parsed.data.destinationId,
      destinationAddress: parsed.data.destinationAddress,
    });

    const assessment = await this.risk.assessPayee(orgId, supplier.id, dest.walletAddress);
    const controlsEval = await this.controls.evaluate(
      orgId,
      BigInt(parsed.data.amountMinor),
      assessment.flags,
    );
    if (controlsEval.decision === "hold") {
      throw new BadRequestException(
        `On-chain controls hold blocks payout: ${controlsEval.reasonCode}`,
      );
    }

    const requiredApprovals = controlsEval.requiredApprovals;
    const status = requiredApprovals === 0 ? "APPROVED" : "AWAITING_APPROVAL";
    const referenceId = `direct:${parsed.data.idempotencyKey}`;
    const commitment = paymentCommitment({
      organizationId: orgId,
      referenceId,
      amountMinor: parsed.data.amountMinor,
      currency: parsed.data.currency,
      supplierId: supplier.id,
      destinationAddress: dest.walletAddress,
      tokenAddress: dest.tokenAddress,
      chainId: dest.chainId,
      policyVersion: paymentPolicy.version,
    });

    const payment = await this.prisma.payment.create({
      data: {
        organizationId: orgId,
        kind: "direct",
        supplierId: supplier.id,
        amountMinor: parsed.data.amountMinor,
        currency: parsed.data.currency,
        chainId: dest.chainId,
        tokenAddress: dest.tokenAddress,
        destinationAddress: dest.walletAddress,
        memo: sealMemo(parsed.data.memo) ?? null,
        status,
        requiredApprovals,
        currentApprovals: 0,
        idempotencyKey: parsed.data.idempotencyKey,
        paymentCommitment: commitment,
        policyVersion: paymentPolicy.version,
        controlsVersion: controlsEval.controlsVersion || null,
        riskFlagsJson: JSON.stringify(assessment.flags),
      },
      include: { supplier: true },
    });

    await this.prisma.idempotencyRecord.create({
      data: {
        organizationId: orgId,
        key: parsed.data.idempotencyKey,
        requestHash: sha256Hex(JSON.stringify(parsed.data)),
        responseJson: JSON.stringify({ id: payment.id }),
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "payment.direct_created",
      entityType: "payment",
      entityId: payment.id,
      eventPayload: {
        amountMinor: payment.amountMinor,
        payeeType: supplier.payeeType,
        requiredApprovals,
        controls: controlsEval,
      },
    });

    return revealPayment(payment);
  }

  async approvePayment(orgId: string, paymentId: string, actorId: string, body: unknown) {
    const parsed = ApproveSchema.safeParse(body ?? { decision: "approve" });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const payment = await this.get(orgId, paymentId);
    if (payment.kind !== "direct") {
      throw new BadRequestException("Only direct payouts use payment-level approval");
    }
    if (payment.status !== "AWAITING_APPROVAL") {
      throw new BadRequestException("Payment is not awaiting approval");
    }
    if (payment.approvals.some((a) => a.approverId === actorId)) {
      throw new ForbiddenException("Already decided");
    }

    if (parsed.data.decision === "reject") {
      await this.prisma.paymentApprovalRecord.create({
        data: {
          paymentId,
          approverId: actorId,
          decision: "reject",
          note: parsed.data.note,
        },
      });
      const updated = await this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: "CANCELLED" },
      });
      await this.audit.record({
        organizationId: orgId,
        actorId,
        eventType: "payment.direct_rejected",
        entityType: "payment",
        entityId: paymentId,
        eventPayload: { note: parsed.data.note },
      });
      return revealPayment(updated);
    }

    await this.prisma.paymentApprovalRecord.create({
      data: {
        paymentId,
        approverId: actorId,
        decision: "approve",
        note: parsed.data.note,
      },
    });
    const next = payment.currentApprovals + 1;
    const status = next >= payment.requiredApprovals ? "APPROVED" : "AWAITING_APPROVAL";
    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { currentApprovals: next, status },
      include: { supplier: true, approvals: true },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "payment.direct_approved",
      entityType: "payment",
      entityId: paymentId,
      eventPayload: { currentApprovals: next, requiredApprovals: payment.requiredApprovals },
    });
    return revealPayment(updated);
  }

  async createBatch(orgId: string, actorId: string, body: unknown) {
    const parsed = CreatePaymentBatchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const existing = await this.prisma.paymentBatch.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: orgId,
          idempotencyKey: parsed.data.idempotencyKey,
        },
      },
      include: { payments: { include: { supplier: true } }, approvals: true },
    });
    if (existing) return revealBatch(existing);

    const paymentPolicy = await this.prisma.paymentPolicy.findFirst({
      where: { organizationId: orgId, status: "active" },
      orderBy: { version: "desc" },
    });
    if (!paymentPolicy) throw new BadRequestException("No payment policy");

    let total = 0n;
    const resolved: Array<{
      supplierId: string;
      amountMinor: string;
      memo?: string;
      chainId: number;
      tokenAddress: string;
      destinationAddress: string;
      payeeType: string;
    }> = [];

    for (const line of parsed.data.lines) {
      const { supplier, dest } = await this.resolvePayeeDestination(
        orgId,
        line.supplierId,
        line.destinationId,
      );
      const assessment = await this.risk.assessPayee(orgId, supplier.id, dest.walletAddress);
      const lineControls = await this.controls.evaluate(
        orgId,
        BigInt(line.amountMinor),
        assessment.flags,
      );
      if (lineControls.decision === "hold") {
        throw new BadRequestException(
          `Line to ${supplier.legalName} held by controls: ${lineControls.reasonCode}`,
        );
      }
      total += BigInt(line.amountMinor);
      resolved.push({
        supplierId: supplier.id,
        amountMinor: line.amountMinor,
        memo: line.memo,
        chainId: dest.chainId,
        tokenAddress: dest.tokenAddress,
        destinationAddress: dest.walletAddress,
        payeeType: supplier.payeeType,
      });
    }

    // Dual-control / hold on batch total
    const batchFlags = {
      isNewVendor: false,
      destinationChanged: false,
      isDuplicate: false,
      missingPo: false,
      poMismatch: false,
      unknownDestination: false,
      supplierBlocked: false,
      confidenceBps: 9000,
    } satisfies RiskFlags;
    const controlsEval = await this.controls.evaluate(orgId, total, batchFlags);
    if (controlsEval.decision === "hold") {
      throw new BadRequestException(
        `On-chain controls hold blocks batch: ${controlsEval.reasonCode}`,
      );
    }

    const requiredApprovals = controlsEval.requiredApprovals;
    const batchStatus = requiredApprovals === 0 ? "APPROVED" : "AWAITING_APPROVAL";
    const commitment = sha256Hex(
      JSON.stringify({
        orgId,
        key: parsed.data.idempotencyKey,
        lines: resolved.map((r) => ({
          supplierId: r.supplierId,
          amountMinor: r.amountMinor,
          destination: r.destinationAddress.toLowerCase(),
        })),
      }),
    );

    const batch = await this.prisma.$transaction(async (tx) => {
      const b = await tx.paymentBatch.create({
        data: {
          organizationId: orgId,
          memo: sealMemo(parsed.data.memo) ?? null,
          status: batchStatus,
          currency: parsed.data.currency,
          totalAmountMinor: total.toString(),
          lineCount: resolved.length,
          requiredApprovals,
          currentApprovals: 0,
          idempotencyKey: parsed.data.idempotencyKey,
          paymentCommitment: commitment,
          controlsVersion: controlsEval.controlsVersion || null,
        },
      });

      for (let i = 0; i < resolved.length; i++) {
        const line = resolved[i]!;
        const lineCommitment = paymentCommitment({
          organizationId: orgId,
          referenceId: `batch:${b.id}:${i}`,
          amountMinor: line.amountMinor,
          currency: parsed.data.currency,
          supplierId: line.supplierId,
          destinationAddress: line.destinationAddress,
          tokenAddress: line.tokenAddress,
          chainId: line.chainId,
          policyVersion: paymentPolicy.version,
        });
        await tx.payment.create({
          data: {
            organizationId: orgId,
            batchId: b.id,
            kind: "batch_line",
            supplierId: line.supplierId,
            amountMinor: line.amountMinor,
            currency: parsed.data.currency,
            chainId: line.chainId,
            tokenAddress: line.tokenAddress,
            destinationAddress: line.destinationAddress,
            memo: sealMemo(line.memo) ?? null,
            status: batchStatus === "APPROVED" ? "APPROVED" : "AWAITING_APPROVAL",
            requiredApprovals: 0,
            currentApprovals: 0,
            idempotencyKey: `${parsed.data.idempotencyKey}:line:${i}`,
            paymentCommitment: lineCommitment,
            policyVersion: paymentPolicy.version,
            controlsVersion: controlsEval.controlsVersion || null,
          },
        });
      }

      return tx.paymentBatch.findUniqueOrThrow({
        where: { id: b.id },
        include: { payments: { include: { supplier: true } }, approvals: true },
      });
    });

    await this.prisma.idempotencyRecord.create({
      data: {
        organizationId: orgId,
        key: parsed.data.idempotencyKey,
        requestHash: sha256Hex(JSON.stringify(parsed.data)),
        responseJson: JSON.stringify({ id: batch.id }),
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "payment.batch_created",
      entityType: "payment_batch",
      entityId: batch.id,
      eventPayload: {
        totalAmountMinor: batch.totalAmountMinor,
        lineCount: batch.lineCount,
        requiredApprovals,
        controls: controlsEval,
      },
    });

    return revealBatch(batch);
  }

  async listBatches(orgId: string) {
    const rows = await this.prisma.paymentBatch.findMany({
      where: { organizationId: orgId },
      include: {
        payments: { include: { supplier: true } },
        approvals: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((b) => revealBatch(b));
  }

  async getBatch(orgId: string, batchId: string) {
    const batch = await this.prisma.paymentBatch.findFirst({
      where: { id: batchId, organizationId: orgId },
      include: {
        payments: { include: { supplier: true, evaluations: true } },
        approvals: true,
      },
    });
    if (!batch) throw new NotFoundException();
    return revealBatch(batch);
  }

  async approveBatch(orgId: string, batchId: string, actorId: string, body: unknown) {
    const parsed = ApproveSchema.safeParse(body ?? { decision: "approve" });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const batch = await this.getBatch(orgId, batchId);
    if (batch.status !== "AWAITING_APPROVAL") {
      throw new BadRequestException("Batch is not awaiting approval");
    }
    if (batch.approvals.some((a) => a.approverId === actorId)) {
      throw new ForbiddenException("Already decided");
    }

    if (parsed.data.decision === "reject") {
      await this.prisma.paymentApprovalRecord.create({
        data: { batchId, approverId: actorId, decision: "reject", note: parsed.data.note },
      });
      await this.prisma.payment.updateMany({
        where: { batchId },
        data: { status: "CANCELLED" },
      });
      const cancelled = await this.prisma.paymentBatch.update({
        where: { id: batchId },
        data: { status: "CANCELLED" },
        include: { payments: { include: { supplier: true } }, approvals: true },
      });
      return revealBatch(cancelled);
    }

    await this.prisma.paymentApprovalRecord.create({
      data: { batchId, approverId: actorId, decision: "approve", note: parsed.data.note },
    });
    const next = batch.currentApprovals + 1;
    const approved = next >= batch.requiredApprovals;
    if (approved) {
      await this.prisma.payment.updateMany({
        where: { batchId },
        data: { status: "APPROVED" },
      });
    }
    const updated = await this.prisma.paymentBatch.update({
      where: { id: batchId },
      data: {
        currentApprovals: next,
        status: approved ? "APPROVED" : "AWAITING_APPROVAL",
      },
      include: { payments: { include: { supplier: true } }, approvals: true },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "payment.batch_approved",
      entityType: "payment_batch",
      entityId: batchId,
      eventPayload: { currentApprovals: next, requiredApprovals: batch.requiredApprovals },
    });
    return revealBatch(updated);
  }

  async authorizeBatch(orgId: string, batchId: string, actorId: string) {
    const batch = await this.getBatch(orgId, batchId);
    if (!["APPROVED", "SETTLING", "PARTIAL_FAILED"].includes(batch.status)) {
      throw new BadRequestException("Batch must be approved before authorize");
    }
    const results = [];
    for (const line of batch.payments) {
      if (
        !["APPROVED", "POLICY_EVALUATION", "POLICY_REJECTED", "PAYMENT_FAILED"].includes(
          line.status,
        )
      ) {
        continue;
      }
      if (line.status === "PAYMENT_FAILED" && line.authorizationId) continue;
      results.push(await this.authorize(orgId, line.id, actorId));
    }
    return { batchId, authorized: results.length, results };
  }

  async settleBatch(orgId: string, batchId: string, actorId: string) {
    const batch = await this.getBatch(orgId, batchId);
    if (!["APPROVED", "SETTLING", "PARTIAL_FAILED"].includes(batch.status)) {
      throw new BadRequestException("Batch must be approved before settle");
    }

    await this.prisma.paymentBatch.update({
      where: { id: batchId },
      data: { status: "SETTLING" },
    });

    // Authorize any lines still only APPROVED (or soft-failed before on-chain auth)
    for (const line of batch.payments) {
      if (line.status === "APPROVED" || (line.status === "PAYMENT_FAILED" && !line.authorizationId)) {
        try {
          await this.authorize(orgId, line.id, actorId);
        } catch (e) {
          await this.prisma.payment.update({
            where: { id: line.id },
            data: { status: "POLICY_REJECTED" },
          });
          await this.audit.record({
            organizationId: orgId,
            actorId,
            eventType: "payment.batch_line_failed",
            entityType: "payment",
            entityId: line.id,
            eventPayload: { error: (e as Error).message, phase: "authorize" },
          });
        }
      }
    }

    const fresh = await this.getBatch(orgId, batchId);
    const settled = [];
    const failed = [];
    for (const line of fresh.payments) {
      const canExecute =
        line.status === "AUTHORIZED" ||
        (line.status === "PAYMENT_FAILED" && Boolean(line.authorizationId));
      if (!canExecute) {
        if (["PAYMENT_SUBMITTED", "PAYMENT_CONFIRMED", "COMPLETED"].includes(line.status)) {
          settled.push(line.id);
        } else if (line.status === "PAYMENT_FAILED" || line.status === "POLICY_REJECTED") {
          failed.push({ id: line.id, status: line.status });
        }
        continue;
      }
      try {
        const result = await this.execute(orgId, line.id, actorId);
        settled.push(result.id);
      } catch (e) {
        failed.push({ id: line.id, error: (e as Error).message });
      }
    }

    const finalStatus =
      failed.length === 0
        ? "COMPLETED"
        : settled.length === 0
          ? "PARTIAL_FAILED"
          : "PARTIAL_FAILED";

    const updated = await this.prisma.paymentBatch.update({
      where: { id: batchId },
      data: { status: finalStatus },
      include: { payments: { include: { supplier: true } }, approvals: true },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "payment.batch_settled",
      entityType: "payment_batch",
      entityId: batchId,
      eventPayload: { settled: settled.length, failed: failed.length, status: finalStatus },
    });

    void this.webhooks.dispatch(orgId, "payment.batch_settled", {
      batchId,
      settled: settled.length,
      failed,
      status: finalStatus,
    });

    return { batch: updated, settled, failed };
  }

  networkInfo() {
    const chainId = Number(process.env.XLAYER_CHAIN_ID || XLAYER_TESTNET.chainId);
    const processor =
      process.env.TAPEOUT_PROCESSOR_ADDRESS || AVENZA_TAPEOUT.processor;
    const circuitId =
      process.env.TAPEOUT_PAYMENT_LIMIT_CIRCUIT_ID ||
      AVENZA_TAPEOUT.paymentLimitCircuitId.toString();
    const configured =
      Boolean(process.env.PAYMENT_AUTHORIZATION_ADDRESS) &&
      Boolean(process.env.TREASURY_ADDRESS) &&
      Boolean(process.env.RELAYER_PRIVATE_KEY);
    return {
      chainId,
      usdc: process.env.USDC_TOKEN_ADDRESS || XLAYER_TESTNET.nativeUsdc,
      note: "Native USDC on X Layer — live authorize + treasury execute only",
      settlementMode: configured ? "onchain" : "blocked",
      tapeOut: {
        factory: process.env.TAPEOUT_FACTORY_ADDRESS || AVENZA_TAPEOUT.factory,
        processor,
        paymentLimitCircuitId: circuitId,
        explorerProcessor: explorerAddressUrl(
          Number(process.env.TAPEOUT_EVAL_CHAIN_ID || AVENZA_TAPEOUT.chainId),
          processor,
        ),
        fabx: AVENZA_TAPEOUT.fabxStats,
      },
      contracts: {
        paymentAuthorization: process.env.PAYMENT_AUTHORIZATION_ADDRESS || null,
        treasury: process.env.TREASURY_ADDRESS || null,
        paymentPolicyRegistry: process.env.PAYMENT_POLICY_REGISTRY_ADDRESS || null,
        controlsRegistry: process.env.CONTROLS_REGISTRY_ADDRESS || null,
        organizationRegistry: process.env.ORGANIZATION_REGISTRY_ADDRESS || null,
      },
      explorerTxBase:
        chainId === 196
          ? "https://www.oklink.com/xlayer/tx"
          : "https://www.oklink.com/xlayer-test/tx",
    };
  }
}
