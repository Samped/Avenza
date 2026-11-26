import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ApproveSchema, paymentCommitment } from "@avenza/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ControlsService } from "../controls/controls.service";
import { RiskService } from "../risk/risk.service";
import { WebhooksService } from "../webhooks/webhooks.service";

type Rule = {
  minAmount: string;
  maxAmount: string | null;
  requiredApprovals: number;
  requireNewSupplierExtra?: boolean;
};

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly controls: ControlsService,
    private readonly risk: RiskService,
    private readonly webhooks: WebhooksService,
  ) {}

  async createPolicy(orgId: string, actorId: string, name: string, rules: Rule[]) {
    const policy = await this.prisma.approvalPolicy.create({
      data: {
        organizationId: orgId,
        name,
        versions: {
          create: { version: 1, rulesJson: JSON.stringify(rules) },
        },
      },
      include: { versions: true },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "approval_policy.created",
      entityType: "approval_policy",
      entityId: policy.id,
      eventPayload: { name },
    });
    return policy;
  }

  listPolicies(orgId: string) {
    return this.prisma.approvalPolicy.findMany({
      where: { organizationId: orgId },
      include: { versions: { orderBy: { version: "desc" } } },
    });
  }

  private pickRequired(rules: Rule[], amountMinor: bigint, isNewSupplier: boolean): number {
    const rule = rules.find((r) => {
      const min = BigInt(r.minAmount);
      const max = r.maxAmount == null ? null : BigInt(r.maxAmount);
      return amountMinor >= min && (max == null || amountMinor <= max);
    });
    let required = rule?.requiredApprovals ?? 1;
    if (isNewSupplier && rule?.requireNewSupplierExtra) required += 1;
    return required;
  }

  async submitForApproval(orgId: string, invoiceId: string, actorId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: orgId },
      include: { supplier: true, paymentDestination: true },
    });
    if (!invoice) throw new NotFoundException();
    if (invoice.status === "ON_HOLD") {
      throw new BadRequestException(
        "Invoice is ON_HOLD by on-chain controls — release hold before approval",
      );
    }
    if (invoice.status !== "VERIFIED") {
      throw new BadRequestException("Invoice must be VERIFIED before approval");
    }
    if (!invoice.totalAmountMinor || !invoice.supplierId || !invoice.paymentDestination) {
      throw new BadRequestException("Invoice missing payment fields");
    }

    let policy = await this.prisma.approvalPolicy.findFirst({
      where: { organizationId: orgId, active: true },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!policy?.versions[0]) {
      // Bootstrap from published on-chain controls if AP policy missing.
      await this.controls.publish(orgId, actorId, {
        name: "AP Controls",
        autoApproveMaxUsdc: 5000,
        singleApproverMaxUsdc: 50000,
        dualControlAboveUsdc: 50000,
      });
      policy = await this.prisma.approvalPolicy.findFirst({
        where: { organizationId: orgId, active: true },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      });
    }
    if (!policy?.versions[0]) throw new BadRequestException("No approval / controls policy configured");

    const paymentPolicy = await this.prisma.paymentPolicy.findFirst({
      where: { organizationId: orgId, status: "active" },
      orderBy: { version: "desc" },
    });
    if (!paymentPolicy) throw new BadRequestException("No payment policy");

    const assessment = await this.risk.assessInvoice(orgId, invoiceId);
    const controlsEval = await this.controls.evaluate(
      orgId,
      BigInt(invoice.totalAmountMinor),
      assessment.flags,
    );
    if (controlsEval.decision === "hold") {
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: "ON_HOLD",
          holdReason: controlsEval.reasonCode,
          riskJson: JSON.stringify({ flags: assessment.flags, items: assessment.items }),
          controlsDecisionJson: JSON.stringify(controlsEval),
        },
      });
      throw new BadRequestException(`On-chain controls hold: ${controlsEval.reasonCode}`);
    }

    let required = controlsEval.requiredApprovals;
    // Fallback band rules if stored as legacy Rule[] (no autoApproveMaxUsdc).
    try {
      const parsed = JSON.parse(policy.versions[0].rulesJson) as Rule[] | Record<string, unknown>;
      if (Array.isArray(parsed)) {
        const isNewSupplier = invoice.supplier?.verificationStatus !== "verified";
        required = Math.max(
          required,
          this.pickRequired(parsed, BigInt(invoice.totalAmountMinor), isNewSupplier),
        );
      }
    } catch {
      /* controls eval wins */
    }

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

    const request = await this.prisma.$transaction(async (tx) => {
      const req = await tx.approvalRequest.create({
        data: {
          invoiceId,
          organizationId: orgId,
          policyVersionId: policy.versions[0]!.id,
          submittedById: actorId.startsWith("api-key:") ? null : actorId,
          requiredApprovals: required,
          currentApprovals: required === 0 ? 0 : 0,
          status: required === 0 ? "approved" : "pending",
          paymentCommitment: commitment,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: required === 0 ? "APPROVED" : "AWAITING_APPROVAL",
          riskJson: JSON.stringify({ flags: assessment.flags, items: assessment.items }),
          controlsDecisionJson: JSON.stringify(controlsEval),
        },
      });
      return req;
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: required === 0 ? "approval.auto_approved" : "approval.requested",
      entityType: "approval_request",
      entityId: request.id,
      eventPayload: {
        invoiceId,
        required,
        commitment,
        controls: controlsEval,
        source: controlsEval.source,
      },
    });

    void this.webhooks.dispatch(
      orgId,
      required === 0 ? "approval.auto_approved" : "approval.requested",
      { invoiceId, approvalRequestId: request.id, required, decision: controlsEval.decision },
    );

    return request;
  }

  listPending(orgId: string) {
    return this.prisma.approvalRequest.findMany({
      where: { organizationId: orgId, status: "pending" },
      include: {
        invoice: { include: { supplier: true } },
        records: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async decide(orgId: string, requestId: string, actorId: string, body: unknown) {
    const parsed = ApproveSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const request = await this.prisma.approvalRequest.findFirst({
      where: { id: requestId, organizationId: orgId },
      include: {
        invoice: { include: { paymentDestination: true } },
        records: true,
      },
    });
    if (!request) throw new NotFoundException();
    if (request.status !== "pending") throw new BadRequestException("Request closed");
    if (request.expiresAt < new Date()) {
      await this.prisma.approvalRequest.update({
        where: { id: requestId },
        data: { status: "expired" },
      });
      await this.prisma.invoice.update({
        where: { id: request.invoiceId },
        data: { status: "EXPIRED" },
      });
      throw new BadRequestException("Approval expired");
    }

    // Recompute commitment — material changes invalidate
    const invoice = request.invoice;
    if (!invoice.totalAmountMinor || !invoice.supplierId || !invoice.paymentDestination) {
      throw new BadRequestException("Invoice incomplete");
    }
    const paymentPolicy = await this.prisma.paymentPolicy.findFirst({
      where: { organizationId: orgId, status: "active" },
      orderBy: { version: "desc" },
    });
    const liveCommitment = paymentCommitment({
      organizationId: orgId,
      referenceId: invoice.id,
      amountMinor: invoice.totalAmountMinor,
      currency: invoice.currency,
      supplierId: invoice.supplierId,
      destinationAddress: invoice.paymentDestination.walletAddress,
      tokenAddress: invoice.paymentDestination.tokenAddress,
      chainId: invoice.paymentDestination.chainId,
      policyVersion: paymentPolicy?.version ?? 1,
    });
    if (liveCommitment !== request.paymentCommitment) {
      await this.prisma.approvalRequest.update({
        where: { id: requestId },
        data: { status: "invalidated" },
      });
      throw new BadRequestException("Payment details changed; approvals invalidated");
    }

    if (request.records.some((r) => r.approverId === actorId)) {
      throw new ForbiddenException("Already decided");
    }

    // Dual-control SoD: submitter cannot approve their own request
    if (
      request.requiredApprovals >= 2 &&
      request.submittedById &&
      request.submittedById === actorId
    ) {
      throw new ForbiddenException(
        "Separation of duties: submitter cannot approve under dual-control",
      );
    }

    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: actorId } },
    });
    if (!member || !["admin", "approver"].includes(member.role)) {
      throw new ForbiddenException("Not an approver");
    }

    const record = await this.prisma.approvalRecord.create({
      data: {
        approvalRequestId: requestId,
        approverId: actorId,
        decision: parsed.data.decision,
        paymentCommitment: request.paymentCommitment,
        note: parsed.data.note,
        signatureReference: `local:${actorId}:${Date.now()}`,
      },
    });

    if (parsed.data.decision === "reject") {
      await this.prisma.approvalRequest.update({
        where: { id: requestId },
        data: { status: "rejected" },
      });
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: "REJECTED" },
      });
    } else {
      const approvals = request.currentApprovals + 1;
      const done = approvals >= request.requiredApprovals;
      await this.prisma.approvalRequest.update({
        where: { id: requestId },
        data: {
          currentApprovals: approvals,
          status: done ? "approved" : "pending",
        },
      });
      if (done) {
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: "APPROVED" },
        });
        void this.webhooks.dispatch(orgId, "invoice.approved", {
          invoiceId: invoice.id,
          approvalRequestId: requestId,
        });
      }
    }

    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: `approval.${parsed.data.decision}`,
      entityType: "approval_request",
      entityId: requestId,
      eventPayload: { note: parsed.data.note ?? null },
    });

    return record;
  }
}
