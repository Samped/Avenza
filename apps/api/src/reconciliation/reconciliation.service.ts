import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async run(orgId: string, actorId: string) {
    const run = await this.prisma.reconciliationRun.create({
      data: { organizationId: orgId, status: "running" },
    });

    const payments = await this.prisma.payment.findMany({
      where: { organizationId: orgId },
      include: { invoice: true },
    });

    const settled = payments.filter((p) =>
      ["PAYMENT_CONFIRMED", "COMPLETED", "RECONCILIATION_PENDING"].includes(p.status),
    );
    const unmatched = payments.filter(
      (p) => p.status === "PAYMENT_CONFIRMED" && !p.invoice,
    );
    const failed = payments.filter((p) => p.status === "PAYMENT_FAILED");
    const outstanding = await this.prisma.invoice.findMany({
      where: {
        organizationId: orgId,
        status: { notIn: ["COMPLETED", "CANCELLED", "REJECTED", "REFUNDED"] },
      },
    });

    // Mark confirmed payments as reconciliation pending then complete when matched
    for (const p of settled) {
      if (p.status === "PAYMENT_CONFIRMED" && p.transactionHash) {
        await this.prisma.payment.update({
          where: { id: p.id },
          data: { status: "RECONCILIATION_PENDING" },
        });
        if (p.invoiceId) {
          await this.prisma.invoice.update({
            where: { id: p.invoiceId },
            data: { status: "RECONCILIATION_PENDING" },
          });
        }
        await this.prisma.payment.update({
          where: { id: p.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
        if (p.invoiceId) {
          await this.prisma.invoice.update({
            where: { id: p.invoiceId },
            data: { status: "COMPLETED" },
          });
        }
      }
    }

    const summary = {
      settledCount: settled.length,
      outstandingCount: outstanding.length,
      unmatchedCount: unmatched.length,
      failedCount: failed.length,
      duplicateAttempts: payments.filter((p, i, arr) =>
        arr.some((o, j) => j !== i && o.invoiceId === p.invoiceId && o.status !== "CANCELLED"),
      ).length,
    };

    const completed = await this.prisma.reconciliationRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        summaryJson: JSON.stringify(summary),
        completedAt: new Date(),
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "reconciliation.completed",
      entityType: "reconciliation_run",
      entityId: run.id,
      eventPayload: summary,
    });

    return completed;
  }

  list(orgId: string) {
    return this.prisma.reconciliationRun.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    });
  }

  async get(orgId: string, id: string) {
    return this.prisma.reconciliationRun.findFirst({
      where: { id, organizationId: orgId },
    });
  }
}
