import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import {
  AVENZA_TAPEOUT,
  evalApprovalThreshold,
  evalPaymentLimit,
  evalPaymentLimitOnTapeOut,
  evalTreasuryControl,
  evalVendorEligibility,
  packPolicyResult,
} from "@avenza/chain";
import { CreatePaymentPolicySchema, sha256Hex } from "@avenza/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { TreasuryService } from "../treasury/treasury.service";
import { OnchainSyncService } from "../chain/onchain-sync.service";

@Injectable()
export class PoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly treasury: TreasuryService,
    private readonly onchain: OnchainSyncService,
  ) {}

  async create(orgId: string, actorId: string, body: unknown) {
    const parsed = CreatePaymentPolicySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const latest = await this.prisma.paymentPolicy.findFirst({
      where: { organizationId: orgId, policyName: parsed.data.policyName },
      orderBy: { version: "desc" },
    });
    const version = (latest?.version ?? 0) + 1;
    if (latest) {
      await this.prisma.paymentPolicy.update({
        where: { id: latest.id },
        data: { status: "disabled" },
      });
    }

    const policyHash = sha256Hex(
      JSON.stringify({
        ...parsed.data,
        version,
      }),
    );

    const policy = await this.prisma.paymentPolicy.create({
      data: {
        organizationId: orgId,
        policyName: parsed.data.policyName,
        version,
        processorAddress:
          parsed.data.processorAddress ||
          process.env.TAPEOUT_PROCESSOR_ADDRESS ||
          AVENZA_TAPEOUT.processor,
        circuitId:
          parsed.data.circuitId ||
          process.env.TAPEOUT_PAYMENT_LIMIT_CIRCUIT_ID ||
          AVENZA_TAPEOUT.paymentLimitCircuitId.toString(),
        policyHash,
        dailySpendLimitMinor: parsed.data.dailySpendLimitMinor,
        perPaymentLimitMinor: parsed.data.perPaymentLimitMinor,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "payment_policy.created",
      entityType: "payment_policy",
      entityId: policy.id,
      eventPayload: { version, policyHash },
    });

    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (org?.onChainOrgId && policy.processorAddress) {
      void this.onchain.syncPaymentPolicy({
        onChainOrgId: org.onChainOrgId,
        policyName: policy.policyName,
        processor: policy.processorAddress as `0x${string}`,
        circuitId: BigInt(policy.circuitId || "1"),
        configHash: policyHash,
      });
    }

    return policy;
  }

  list(orgId: string) {
    return this.prisma.paymentPolicy.findMany({
      where: { organizationId: orgId },
      orderBy: [{ policyName: "asc" }, { version: "desc" }],
    });
  }

  async get(orgId: string, id: string) {
    const policy = await this.prisma.paymentPolicy.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!policy) throw new NotFoundException();
    return policy;
  }

  async evaluateForPayment(orgId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, organizationId: orgId },
      include: {
        supplier: { include: { paymentDestinations: { where: { active: true } } } },
        approvals: true,
        invoice: {
          include: {
            paymentDestination: true,
            approvalRequests: { include: { records: true }, orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    });
    if (!payment) throw new NotFoundException();

    const policy = await this.prisma.paymentPolicy.findFirst({
      where: { organizationId: orgId, status: "active" },
      orderBy: { version: "desc" },
    });
    if (!policy) throw new BadRequestException("No active payment policy");

    const amount = BigInt(payment.amountMinor);
    const invoiceApproval = payment.invoice?.approvalRequests[0];
    const payoutApproves = payment.approvals.filter((r) => r.decision === "approve").length;
    const requiredApprovals =
      payment.kind === "invoice"
        ? (invoiceApproval?.requiredApprovals ?? 1)
        : payment.requiredApprovals;
    const approvalCount =
      payment.kind === "invoice"
        ? (invoiceApproval?.records.filter((r) => r.decision === "approve").length ?? 0)
        : payoutApproves;

    const dest =
      payment.invoice?.paymentDestination ||
      payment.supplier.paymentDestinations.find(
        (d) => d.walletAddress.toLowerCase() === payment.destinationAddress.toLowerCase(),
      );

    const limitLocal = evalPaymentLimit({
      requestedAmount: amount,
      organizationLimit: BigInt(policy.perPaymentLimitMinor),
      dailyRemaining: BigInt(policy.dailySpendLimitMinor),
    });
    const approvals = evalApprovalThreshold({
      requiredApprovals,
      recordedApprovals: approvalCount,
      paymentAmount: amount,
      requiredTierSatisfied: true,
    });
    const vendor = evalVendorEligibility({
      vendorAuthorized: payment.supplier.verificationStatus === "verified",
      destinationApproved: dest?.verificationStatus === "verified",
      vendorRiskBlocked: payment.supplier.riskStatus === "blocked",
    });

    // Prefer live BusinessTreasury available balance; fall back to policy daily limit.
    let availableBudget = BigInt(policy.dailySpendLimitMinor);
    try {
      const summary = await this.treasury.getSummary(orgId);
      const vaultAvail = BigInt(summary.balances.vaultAvailableUsdcMinor || "0");
      if (vaultAvail > 0n) availableBudget = vaultAvail;
    } catch {
      // RPC optional — keep policy daily limit as soft budget
    }

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const spentRows = await this.prisma.payment.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: startOfDay },
        status: {
          in: ["AUTHORIZED", "PAYMENT_SUBMITTED", "PAYMENT_CONFIRMED", "RECONCILIATION_PENDING", "COMPLETED"],
        },
      },
      select: { amountMinor: true },
    });
    const dailySpent = spentRows.reduce((sum, row) => sum + BigInt(row.amountMinor), 0n);

    const treasury = evalTreasuryControl({
      availableBudget,
      requestedPayment: amount,
      reservedAmount: 0n,
      dailySpendLimit: BigInt(policy.dailySpendLimitMinor),
      dailySpent,
    });

    // API policy gate uses Cerebr TapeOut on the eval chain (mainnet by default).
    // Settlement re-evals on-chain against the policy processor registered on X Layer testnet
    // (SETTLEMENT_TAPEOUT_PROCESSOR_ADDRESS / PaymentPolicyRegistry) — never local/sim fallback.
    const processor = (process.env.TAPEOUT_PROCESSOR_ADDRESS ||
      AVENZA_TAPEOUT.processor) as `0x${string}`;
    const circuitId = BigInt(
      process.env.TAPEOUT_PAYMENT_LIMIT_CIRCUIT_ID ||
        policy.circuitId ||
        AVENZA_TAPEOUT.paymentLimitCircuitId,
    );

    // Production / mainnet: default to requiring live TapeOut unless explicitly allowed.
    const requireOnchain =
      process.env.ALLOW_TAPEOUT_LOCAL_FALLBACK === "false" ||
      process.env.NODE_ENV === "production" ||
      Number(process.env.XLAYER_CHAIN_ID || 0) === 196;
    let tapeOut;
    try {
      tapeOut = await evalPaymentLimitOnTapeOut({
        amountOk: limitLocal.withinLimit,
        budgetOk: limitLocal.budgetSatisfied,
        processor,
        circuitId,
        chainId: Number(process.env.TAPEOUT_EVAL_CHAIN_ID || AVENZA_TAPEOUT.chainId),
        allowLocalFallback: !requireOnchain,
      });
    } catch (err) {
      throw new BadRequestException(
        `TapeOut eval failed on X Layer: ${(err as Error).message}`,
      );
    }
    if (requireOnchain && tapeOut.mode !== "onchain") {
      throw new BadRequestException("TapeOut onchain eval required (local fallback disabled)");
    }

    const limit = {
      ...limitLocal,
      policyPass: tapeOut.pass && limitLocal.policyPass,
      tapeOut,
    };

    const policyPass =
      limit.policyPass && approvals.thresholdSatisfied && vendor.policyPass && treasury.paymentEligible;

    const output = {
      limit,
      approvals,
      vendor,
      treasury,
      policyPass,
      packedResult: packPolicyResult([
        limit.policyPass,
        approvals.thresholdSatisfied,
        vendor.policyPass,
        treasury.paymentEligible,
      ]),
      tapeOut: {
        processor: tapeOut.processor,
        circuitId: tapeOut.circuitId,
        inputs: tapeOut.inputs,
        rawOutput: tapeOut.rawOutput,
        pass: tapeOut.pass,
        mode: tapeOut.mode,
        chainId: tapeOut.chainId,
      },
    };

    const inputCommitment = createHash("sha256")
      .update(
        JSON.stringify({
          paymentId,
          amount: payment.amountMinor,
          policyVersion: policy.version,
        }),
      )
      .digest("hex");

    const evaluation = await this.prisma.policyEvaluation.create({
      data: {
        paymentId,
        policyId: policy.id,
        policyVersion: policy.version,
        inputCommitment,
        outputData: JSON.stringify(output),
        evaluationStatus: policyPass ? "passed" : "failed",
        evaluatedAt: new Date(),
      },
    });

    return { evaluation, output, policy };
  }
}
