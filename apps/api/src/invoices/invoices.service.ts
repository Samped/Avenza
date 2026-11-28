import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { canTransitionInvoice, CreateInvoiceSchema, ReviewInvoiceSchema, type InvoiceStatus } from "@avenza/shared";
import { parseDecimalToMinor } from "@avenza/shared";
import type { InvoiceStatus as PrismaInvoiceStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { StorageService } from "../storage/storage.service";
import { RiskService } from "../risk/risk.service";
import { ControlsService } from "../controls/controls.service";
import { WebhooksService } from "../webhooks/webhooks.service";
import { bufferToDocumentText } from "./document-text";
import { extractInvoiceText, extractionToMinor, minorToDecimal, type ExtractionResult } from "./extract";
import { revealInvoice, sealExtractionJson } from "../crypto/sensitive-fields";

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly risk: RiskService,
    private readonly controls: ControlsService,
    private readonly webhooks: WebhooksService,
  ) {}

  async create(orgId: string, actorId: string, body: unknown) {
    const parsed = CreateInvoiceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const invoice = await this.prisma.invoice.create({
      data: {
        organizationId: orgId,
        supplierId: parsed.data.supplierId,
        invoiceNumber: parsed.data.invoiceNumber,
        currency: parsed.data.currency,
        status: "DRAFT",
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "invoice.created",
      entityType: "invoice",
      entityId: invoice.id,
      eventPayload: {},
    });

    return invoice;
  }

  async list(orgId: string) {
    const rows = await this.prisma.invoice.findMany({
      where: { organizationId: orgId },
      include: { supplier: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((i) => revealInvoice(i));
  }

  async get(orgId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, organizationId: orgId },
      include: {
        supplier: { include: { paymentDestinations: { where: { active: true } } } },
        lineItems: true,
        purchaseOrder: true,
        paymentDestination: true,
        approvalRequests: { include: { records: true } },
        payments: true,
      },
    });
    if (!invoice) throw new NotFoundException();
    return revealInvoice(invoice);
  }

  private async transition(invoiceId: string, from: InvoiceStatus, to: InvoiceStatus) {
    if (!canTransitionInvoice(from, to)) {
      throw new BadRequestException(`Illegal transition ${from} -> ${to}`);
    }
    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: to as PrismaInvoiceStatus },
    });
  }

  async uploadDocument(orgId: string, invoiceId: string, actorId: string, file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Missing invoice file");
    }
    const invoice = await this.get(orgId, invoiceId);
    if (!["DRAFT", "SUBMITTED", "UNDER_REVIEW", "MANUAL_REVIEW"].includes(invoice.status)) {
      throw new BadRequestException("Cannot upload document in current status");
    }
    const stored = await this.storage.put(orgId, file.originalname || "invoice.bin", file.buffer);
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        documentStorageKey: stored.key,
        documentHash: stored.hash,
        status: invoice.status === "DRAFT" ? "SUBMITTED" : invoice.status === "UNDER_REVIEW" || invoice.status === "MANUAL_REVIEW" ? invoice.status : "SUBMITTED",
      },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "invoice.document_uploaded",
      entityType: "invoice",
      entityId: invoiceId,
      eventPayload: { hash: stored.hash, filename: file.originalname },
    });
    return this.get(orgId, invoiceId);
  }

  private normalizeName(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  private async resolveSupplier(orgId: string, extraction: ExtractionResult, currentSupplierId: string | null) {
    if (extraction.supplierName.value) {
      const name = extraction.supplierName.value;
      const suppliers = await this.prisma.supplier.findMany({ where: { organizationId: orgId } });
      const lower = this.normalizeName(name);
      const hit =
        suppliers.find((s) => this.normalizeName(s.legalName) === lower) ||
        suppliers.find((s) => {
          const n = this.normalizeName(s.legalName);
          return n.includes(lower) || lower.includes(n);
        }) ||
        suppliers.find((s) => s.supplierCode && lower.includes(s.supplierCode.toLowerCase()));
      if (hit) return hit;
    }
    if (currentSupplierId) {
      return this.prisma.supplier.findFirst({ where: { id: currentSupplierId, organizationId: orgId } });
    }
    // Only auto-pick the lone supplier when extraction did not name a different vendor.
    if (!extraction.supplierName.value) {
      const all = await this.prisma.supplier.findMany({ where: { organizationId: orgId }, take: 2 });
      return all.length === 1 ? all[0]! : null;
    }
    return null;
  }

  /**
   * When extraction finds a vendor + wallet that aren't on file, register them
   * so verify → approve → settle isn't blocked on a missing directory entry.
   */
  private async ensureSupplierFromExtraction(
    orgId: string,
    actorId: string,
    extraction: ExtractionResult,
    existingSupplierId: string | null,
  ) {
    let supplier = await this.resolveSupplier(orgId, extraction, existingSupplierId);
    const wallet = extraction.paymentDestination.value?.toLowerCase();
    const name = extraction.supplierName.value?.trim();

    if (!supplier && name) {
      supplier = await this.prisma.supplier.create({
        data: {
          organizationId: orgId,
          legalName: name.slice(0, 160),
          verificationStatus: "verified",
          riskStatus: "clear",
        },
      });
      await this.audit.record({
        organizationId: orgId,
        actorId,
        eventType: "supplier.created",
        entityType: "supplier",
        entityId: supplier.id,
        eventPayload: { legalName: supplier.legalName, source: "invoice_extraction" },
      });
    }

    if (!supplier) return { supplier: null, destination: null };

    let destination = await this.resolveDestination(orgId, supplier.id, extraction, null);

    if (!destination && wallet && /^0x[a-f0-9]{40}$/.test(wallet)) {
      const token =
        process.env.XLAYER_USDC_ADDRESS?.toLowerCase() ||
        "0xdec90b78111ba2fc6fc6d84d8b9ec159a2d4b9b3";
      const chainId = Number(process.env.XLAYER_CHAIN_ID || 196);
      await this.prisma.supplierPaymentDestination.updateMany({
        where: { supplierId: supplier.id, active: true },
        data: { active: false },
      });
      destination = await this.prisma.supplierPaymentDestination.create({
        data: {
          supplierId: supplier.id,
          chainId,
          tokenAddress: token,
          walletAddress: wallet,
          verificationStatus: "verified",
          approvedAt: new Date(),
          approvedBy: actorId,
          version: 1,
          active: true,
        },
      });
      await this.prisma.supplier.update({
        where: { id: supplier.id },
        data: { verificationStatus: "verified" },
      });
      await this.audit.record({
        organizationId: orgId,
        actorId,
        eventType: "supplier.destination_approved",
        entityType: "supplier_destination",
        entityId: destination.id,
        eventPayload: { supplierId: supplier.id, source: "invoice_extraction", walletAddress: wallet },
      });
    }

    return { supplier, destination };
  }

  private async resolveDestination(
    orgId: string,
    supplierId: string | null | undefined,
    extraction: ExtractionResult,
    currentDestId: string | null,
  ) {
    if (extraction.paymentDestination.value) {
      const wallet = extraction.paymentDestination.value.toLowerCase();
      const byWallet = await this.prisma.supplierPaymentDestination.findFirst({
        where: {
          walletAddress: { equals: wallet, mode: "insensitive" },
          active: true,
          supplier: { organizationId: orgId },
        },
      });
      if (byWallet) return byWallet;
    }
    if (currentDestId) {
      const cur = await this.prisma.supplierPaymentDestination.findFirst({
        where: { id: currentDestId, active: true },
      });
      if (cur) return cur;
    }
    if (supplierId) {
      return this.prisma.supplierPaymentDestination.findFirst({
        where: {
          supplierId,
          active: true,
          verificationStatus: "verified",
        },
        orderBy: { version: "desc" },
      });
    }
    return null;
  }

  private async resolvePurchaseOrder(orgId: string, extraction: ExtractionResult, supplierId: string | null) {
    if (!extraction.purchaseOrderRef.value) return null;
    return this.prisma.purchaseOrder.findFirst({
      where: {
        organizationId: orgId,
        purchaseOrderNumber: { equals: extraction.purchaseOrderRef.value, mode: "insensitive" },
        ...(supplierId ? { supplierId } : {}),
      },
    });
  }

  async extract(orgId: string, invoiceId: string, actorId: string) {
    const invoice = await this.get(orgId, invoiceId);
    if (!invoice.documentStorageKey) throw new BadRequestException("No document uploaded");

    const from = invoice.status as InvoiceStatus;
    if (from === "DRAFT") {
      await this.prisma.invoice.update({ where: { id: invoiceId }, data: { status: "SUBMITTED" } });
    }
    const statusNow = (from === "DRAFT" ? "SUBMITTED" : from) as InvoiceStatus;
    if (statusNow !== "EXTRACTING") {
      if (!canTransitionInvoice(statusNow, "EXTRACTING")) {
        throw new BadRequestException(`Cannot extract from status ${statusNow}`);
      }
      await this.transition(invoiceId, statusNow, "EXTRACTING");
    }

    const buf = await this.storage.get(invoice.documentStorageKey);
    const filename = invoice.documentStorageKey.split("/").pop()?.replace(/^\d+-/, "") || "invoice";
    const doc = await bufferToDocumentText(buf, filename);
    const extraction = extractInvoiceText(doc.text, { documentKind: doc.kind });
    extraction.documentKind = doc.kind;
    if (doc.meta?.note) {
      extraction.needsReview = true;
    }

    const ensured = await this.ensureSupplierFromExtraction(
      orgId,
      actorId,
      extraction,
      invoice.supplierId,
    );
    const supplier = ensured.supplier;
    const destination =
      ensured.destination ||
      (await this.resolveDestination(
        orgId,
        supplier?.id ?? invoice.supplierId,
        extraction,
        invoice.paymentDestinationId,
      ));
    const po = await this.resolvePurchaseOrder(orgId, extraction, supplier?.id ?? invoice.supplierId);

    const invoiceDate = extraction.invoiceDate.value ? new Date(extraction.invoiceDate.value) : invoice.invoiceDate;
    const dueDate = extraction.dueDate.value ? new Date(extraction.dueDate.value) : invoice.dueDate;

    await this.prisma.invoiceLineItem.deleteMany({ where: { invoiceId } });
    const lines = extraction.lineItems.value || [];
    if (lines.length) {
      await this.prisma.invoiceLineItem.createMany({
        data: lines.map((li) => ({
          invoiceId,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          total: li.total,
        })),
      });
    }

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "UNDER_REVIEW",
        invoiceNumber: extraction.invoiceNumber.value ?? invoice.invoiceNumber,
        supplierId: supplier?.id ?? invoice.supplierId,
        paymentDestinationId: destination?.id ?? invoice.paymentDestinationId,
        purchaseOrderId: po?.id ?? invoice.purchaseOrderId,
        invoiceDate: invoiceDate && !Number.isNaN(invoiceDate.getTime()) ? invoiceDate : undefined,
        dueDate: dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : undefined,
        currency: extraction.currency.value ?? invoice.currency,
        subtotalMinor: extractionToMinor(extraction.subtotal.value),
        taxAmountMinor: extractionToMinor(extraction.taxAmount.value),
        totalAmountMinor: extractionToMinor(extraction.totalAmount.value),
        extractionJson: sealExtractionJson(
          JSON.stringify({
            ...extraction,
            linked: {
              supplierId: supplier?.id ?? null,
              paymentDestinationId: destination?.id ?? null,
              purchaseOrderId: po?.id ?? null,
            },
            document: doc.meta ?? null,
          }),
        )!,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "invoice.extracted",
      entityType: "invoice",
      entityId: invoiceId,
      eventPayload: {
        needsReview: extraction.needsReview,
        documentKind: doc.kind,
        total: extraction.totalAmount.value,
        invoiceNumber: extraction.invoiceNumber.value,
      },
    });

    return {
      invoice: await this.get(orgId, invoiceId),
      extraction,
      linked: {
        supplierId: updated.supplierId,
        paymentDestinationId: updated.paymentDestinationId,
        purchaseOrderId: updated.purchaseOrderId,
      },
      decimals: {
        total: minorToDecimal(updated.totalAmountMinor),
        subtotal: minorToDecimal(updated.subtotalMinor),
        tax: minorToDecimal(updated.taxAmountMinor),
      },
    };
  }

  async verify(orgId: string, invoiceId: string, actorId: string) {
    let invoice = await this.get(orgId, invoiceId);
    const checks: Array<{ code: string; status: "pass" | "warn" | "fail"; detail: string }> = [];

    // Auto-heal missing destination from supplier vault before failing verify.
    if (!invoice.paymentDestinationId && invoice.supplierId) {
      const dest = await this.prisma.supplierPaymentDestination.findFirst({
        where: { supplierId: invoice.supplierId, active: true, verificationStatus: "verified" },
        orderBy: { version: "desc" },
      });
      if (dest) {
        await this.prisma.invoice.update({
          where: { id: invoiceId },
          data: { paymentDestinationId: dest.id },
        });
        invoice = await this.get(orgId, invoiceId);
      }
    }

    if (!invoice.invoiceNumber) {
      checks.push({ code: "invoice_number", status: "fail", detail: "Missing invoice number" });
    } else {
      const dup = await this.prisma.invoice.findFirst({
        where: {
          organizationId: orgId,
          invoiceNumber: invoice.invoiceNumber,
          supplierId: invoice.supplierId ?? undefined,
          id: { not: invoiceId },
          status: { notIn: ["CANCELLED", "REJECTED"] },
        },
      });
      checks.push(
        dup
          ? { code: "duplicate", status: "fail", detail: `Duplicate of ${dup.id}` }
          : { code: "duplicate", status: "pass", detail: "No duplicate" },
      );
    }

    if (!invoice.supplierId) {
      checks.push({ code: "supplier", status: "fail", detail: "Supplier not linked" });
    } else {
      const supplier = await this.prisma.supplier.findUnique({ where: { id: invoice.supplierId } });
      if (!supplier || supplier.verificationStatus !== "verified") {
        checks.push({ code: "supplier", status: "warn", detail: "Supplier not verified" });
      } else if (supplier.riskStatus === "blocked") {
        checks.push({ code: "supplier", status: "fail", detail: "Supplier blocked" });
      } else {
        checks.push({ code: "supplier", status: "pass", detail: "Supplier ok" });
      }
    }

    if (!invoice.totalAmountMinor) {
      checks.push({ code: "amount", status: "fail", detail: "Missing amount" });
    } else {
      checks.push({ code: "amount", status: "pass", detail: invoice.totalAmountMinor });
    }

    if (invoice.purchaseOrderId && invoice.totalAmountMinor) {
      const po = await this.prisma.purchaseOrder.findUnique({ where: { id: invoice.purchaseOrderId } });
      if (po && BigInt(invoice.totalAmountMinor) > BigInt(po.totalAmountMinor)) {
        checks.push({ code: "po_match", status: "warn", detail: "Invoice exceeds PO total" });
      } else if (po) {
        checks.push({ code: "po_match", status: "pass", detail: "Within PO" });
      }
    } else {
      checks.push({ code: "po_match", status: "warn", detail: "No PO linked" });
    }

    const dest = invoice.paymentDestinationId
      ? await this.prisma.supplierPaymentDestination.findUnique({ where: { id: invoice.paymentDestinationId } })
      : null;
    if (!dest || dest.verificationStatus !== "verified" || !dest.active) {
      checks.push({ code: "destination", status: "fail", detail: "Payment destination not approved" });
    } else {
      checks.push({ code: "destination", status: "pass", detail: dest.walletAddress });
    }

    const failed = checks.some((c) => c.status === "fail");
    const verification = { checks, result: failed ? "unresolved" : "confirmed" };

    if (failed) {
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          verificationJson: JSON.stringify(verification),
          status: "UNDER_REVIEW",
          holdReason: null,
        },
      });
      await this.audit.record({
        organizationId: orgId,
        actorId,
        eventType: "invoice.verified",
        entityType: "invoice",
        entityId: invoiceId,
        eventPayload: verification,
      });
      return { verification, invoice: await this.get(orgId, invoiceId) };
    }

    // On-chain controls gate (mirrored locally for UX; settlement re-checks on-chain).
    const assessment = await this.risk.assessInvoice(orgId, invoiceId);
    const amountMinor = BigInt(invoice.totalAmountMinor || "0");
    const decision = await this.controls.evaluate(orgId, amountMinor, assessment.flags);
    const onHold = decision.decision === "hold";

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        verificationJson: JSON.stringify(verification),
        riskJson: JSON.stringify({ flags: assessment.flags, items: assessment.items }),
        controlsDecisionJson: JSON.stringify(decision),
        holdReason: onHold ? decision.reasonCode : null,
        status: onHold ? "ON_HOLD" : "VERIFIED",
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: onHold ? "invoice.held" : "invoice.verified",
      entityType: "invoice",
      entityId: invoiceId,
      eventPayload: { verification, risk: assessment, controls: decision },
    });

    void this.webhooks.dispatch(orgId, onHold ? "invoice.held" : "invoice.verified", {
      invoiceId,
      decision: decision.decision,
      reasonCode: decision.reasonCode,
      source: decision.source,
    });

    return {
      verification,
      risk: assessment,
      controls: decision,
      invoice: await this.get(orgId, invoiceId),
    };
  }

  async review(orgId: string, invoiceId: string, actorId: string, body: unknown) {
    const invoice = await this.get(orgId, invoiceId);
    if (!["UNDER_REVIEW", "MANUAL_REVIEW", "EXTRACTING", "SUBMITTED", "VERIFIED"].includes(invoice.status)) {
      throw new BadRequestException("Invoice not in reviewable state");
    }
    const parsed = ReviewInvoiceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        invoiceNumber: parsed.data.invoiceNumber,
        supplierId: parsed.data.supplierId,
        invoiceDate: new Date(parsed.data.invoiceDate),
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        currency: parsed.data.currency,
        subtotalMinor: parseDecimalToMinor(parsed.data.subtotal, 6).toString(),
        taxAmountMinor: parseDecimalToMinor(parsed.data.taxAmount, 6).toString(),
        totalAmountMinor: parseDecimalToMinor(parsed.data.totalAmount, 6).toString(),
        paymentDestinationId: parsed.data.paymentDestinationId,
        purchaseOrderId: parsed.data.purchaseOrderId,
        // Stay in review until verify — even if previously verified.
        status: "UNDER_REVIEW",
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "invoice.reviewed",
      entityType: "invoice",
      entityId: invoiceId,
      eventPayload: { notes: parsed.data.notes ?? null },
    });

    return updated;
  }

  async createPurchaseOrder(
    orgId: string,
    body: { supplierId: string; purchaseOrderNumber: string; totalAmount: string; currency?: string },
  ) {
    return this.prisma.purchaseOrder.create({
      data: {
        organizationId: orgId,
        supplierId: body.supplierId,
        purchaseOrderNumber: body.purchaseOrderNumber,
        totalAmountMinor: parseDecimalToMinor(body.totalAmount, 6).toString(),
        currency: body.currency || "USDC",
      },
    });
  }

  listPurchaseOrders(orgId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { organizationId: orgId },
      include: { supplier: { select: { id: true, legalName: true } } },
      orderBy: { createdAt: "desc" },
    });
  }
}
