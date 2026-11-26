import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { createAdapter } from "./adapters";
import { decryptSecret, encryptSecret } from "../crypto/secrets";
import { decryptField } from "../crypto/field-crypto";
import { sealEmail, sealExtractionJson } from "../crypto/sensitive-fields";
import { parseDecimalToMinor } from "@avenza/shared";

@Injectable()
export class ErpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private decodeCreds(enc: string | null): Record<string, string> {
    if (!enc) return {};
    try {
      return JSON.parse(decryptSecret(enc)) as Record<string, string>;
    } catch {
      try {
        // Legacy field-crypto payloads
        return JSON.parse(decryptField(enc)) as Record<string, string>;
      } catch {
        try {
          return JSON.parse(enc) as Record<string, string>;
        } catch {
          return {};
        }
      }
    }
  }

  async connect(
    orgId: string,
    actorId: string,
    body: { provider: "odoo" | "erpnext"; baseUrl: string; credentials?: Record<string, string> },
  ) {
    if (!["odoo", "erpnext"].includes(body.provider)) {
      throw new BadRequestException("Unsupported provider");
    }
    if (!body.baseUrl?.trim()) throw new BadRequestException("baseUrl required");

    const adapter = createAdapter(body.provider, body.baseUrl, body.credentials || {});
    let test: { ok: boolean; detail?: string } = { ok: false, detail: "not tested" };
    try {
      test = await adapter.testConnection();
    } catch (e) {
      test = { ok: false, detail: (e as Error).message };
    }

    const credentialsEnc = body.credentials
      ? encryptSecret(JSON.stringify(body.credentials))
      : null;

    // Always persist — remote ERP may be unreachable from this environment;
    // status reflects live ping so the UI stays usable.
    const status = test.ok ? "active" : "degraded";

    const conn = await this.prisma.erpConnection.upsert({
      where: {
        organizationId_provider: { organizationId: orgId, provider: body.provider },
      },
      create: {
        organizationId: orgId,
        provider: body.provider,
        baseUrl: body.baseUrl,
        credentialsEnc,
        status,
      },
      update: {
        baseUrl: body.baseUrl,
        ...(credentialsEnc ? { credentialsEnc } : {}),
        status,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "erp.connected",
      entityType: "erp_connection",
      entityId: conn.id,
      eventPayload: { provider: body.provider },
    });

    const { credentialsEnc: _omit, ...safe } = conn;
    return { connection: safe, test };
  }

  list(orgId: string) {
    return this.prisma.erpConnection.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        provider: true,
        baseUrl: true,
        status: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async test(orgId: string, provider?: string) {
    const connections = await this.prisma.erpConnection.findMany({
      where: {
        organizationId: orgId,
        status: "active",
        ...(provider ? { provider } : {}),
      },
    });
    if (!connections.length) throw new BadRequestException("No active ERP connection");
    const results = [];
    for (const c of connections) {
      const creds = this.decodeCreds(c.credentialsEnc);
      const adapter = createAdapter(c.provider as "odoo" | "erpnext", c.baseUrl, creds);
      const test = await adapter.testConnection();
      results.push({ provider: c.provider, baseUrl: c.baseUrl, ...test });
    }
    return { results };
  }

  async pull(orgId: string, actorId: string, provider?: string) {
    const connections = await this.prisma.erpConnection.findMany({
      where: {
        organizationId: orgId,
        status: "active",
        ...(provider ? { provider } : {}),
      },
    });
    if (!connections.length) throw new BadRequestException("No active ERP connection");

    const summary: Array<Record<string, unknown>> = [];
    for (const c of connections) {
      const creds = this.decodeCreds(c.credentialsEnc);
      const adapter = createAdapter(c.provider as "odoo" | "erpnext", c.baseUrl, creds);
      const [suppliers, invoices, pos] = await Promise.all([
        adapter.importSuppliers(),
        adapter.importInvoices(),
        adapter.importPurchaseOrders(),
      ]);

      let suppliersUpserted = 0;
      for (const s of suppliers) {
        const existing = await this.prisma.supplier.findFirst({
          where: { organizationId: orgId, supplierCode: s.externalId },
        });
        if (existing) {
          await this.prisma.supplier.update({
            where: { id: existing.id },
            data: { legalName: s.legalName, contactEmail: sealEmail(s.email) ?? null },
          });
        } else {
          await this.prisma.supplier.create({
            data: {
              organizationId: orgId,
              legalName: s.legalName,
              supplierCode: s.externalId,
              contactEmail: sealEmail(s.email) ?? null,
            },
          });
        }
        suppliersUpserted += 1;
      }

      let invoicesCreated = 0;
      for (const inv of invoices) {
        const supplier = await this.prisma.supplier.findFirst({
          where: { organizationId: orgId, supplierCode: inv.supplierExternalId },
        });
        const exists = await this.prisma.invoice.findFirst({
          where: {
            organizationId: orgId,
            invoiceNumber: inv.invoiceNumber,
            ...(supplier ? { supplierId: supplier.id } : {}),
          },
        });
        if (exists) continue;
        await this.prisma.invoice.create({
          data: {
            organizationId: orgId,
            supplierId: supplier?.id,
            invoiceNumber: inv.invoiceNumber,
            currency: inv.currency || "USDC",
            totalAmountMinor: String(parseDecimalToMinor(inv.totalAmount)),
            invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate) : null,
            status: "DRAFT",
            extractionJson: sealExtractionJson(
              JSON.stringify({ source: "erp", externalId: inv.externalId }),
            )!,
          },
        });
        invoicesCreated += 1;
      }

      let posUpserted = 0;
      for (const po of pos) {
        const supplier = await this.prisma.supplier.findFirst({
          where: { organizationId: orgId, supplierCode: po.supplierExternalId },
        });
        if (!supplier) continue;
        const poMinor = String(parseDecimalToMinor(po.totalAmount));
        await this.prisma.purchaseOrder.upsert({
          where: {
            organizationId_purchaseOrderNumber: {
              organizationId: orgId,
              purchaseOrderNumber: po.purchaseOrderNumber,
            },
          },
          create: {
            organizationId: orgId,
            supplierId: supplier.id,
            purchaseOrderNumber: po.purchaseOrderNumber,
            currency: po.currency || "USDC",
            totalAmountMinor: poMinor,
          },
          update: {
            totalAmountMinor: poMinor,
            currency: po.currency || "USDC",
          },
        });
        posUpserted += 1;
      }

      await this.prisma.erpConnection.update({
        where: { id: c.id },
        data: { lastSyncAt: new Date() },
      });

      summary.push({
        provider: c.provider,
        suppliersUpserted,
        invoicesCreated,
        purchaseOrdersUpserted: posUpserted,
      });
    }

    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "erp.pulled",
      entityType: "erp_connection",
      entityId: connections[0]!.id,
      eventPayload: { summary },
    });

    return { summary };
  }

  async writeBackPayment(orgId: string, paymentId: string, actorId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, organizationId: orgId },
      include: { invoice: true },
    });
    if (!payment) throw new NotFoundException();
    if (payment.status !== "COMPLETED" && payment.status !== "PAYMENT_CONFIRMED") {
      throw new BadRequestException("Payment not settled");
    }

    const connections = await this.prisma.erpConnection.findMany({
      where: { organizationId: orgId, status: "active" },
    });

    const results = [];
    for (const c of connections) {
      const creds = this.decodeCreds(c.credentialsEnc);
      const adapter = createAdapter(c.provider as "odoo" | "erpnext", c.baseUrl, creds);
      const result = await adapter.writePaymentStatus({
        externalInvoiceId:
          payment.invoice?.invoiceNumber || payment.invoiceId || payment.id,
        amount: payment.amountMinor,
        currency: payment.currency,
        transactionHash: payment.transactionHash || "",
        paymentId: payment.id,
        settledAt: new Date().toISOString(),
      });
      results.push({ provider: c.provider, ...result });
    }

    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "erp.payment_writeback",
      entityType: "payment",
      entityId: paymentId,
      eventPayload: { results },
    });

    return results;
  }
}
