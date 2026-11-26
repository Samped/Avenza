import { Injectable } from "@nestjs/common";
import type { RiskFlags } from "@avenza/shared";
import { PrismaService } from "../prisma/prisma.service";
import { openExtractionJson } from "../crypto/sensitive-fields";

export type RiskItem = {
  code: string;
  severity: "info" | "warn" | "hard";
  detail: string;
};

@Injectable()
export class RiskService {
  constructor(private readonly prisma: PrismaService) {}

  async assessInvoice(orgId: string, invoiceId: string): Promise<{
    flags: RiskFlags;
    items: RiskItem[];
    confidenceBps: number;
  }> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: orgId },
      include: {
        supplier: { include: { paymentDestinations: { where: { active: true } } } },
        paymentDestination: true,
        purchaseOrder: true,
      },
    });
    if (!invoice) {
      return {
        flags: emptyFlags(0),
        items: [{ code: "invoice_missing", severity: "hard", detail: "Invoice not found" }],
        confidenceBps: 0,
      };
    }

    const items: RiskItem[] = [];
    let isNewVendor = false;
    let destinationChanged = false;
    let isDuplicate = false;
    let missingPo = false;
    let poMismatch = false;
    let unknownDestination = false;
    let supplierBlocked = false;

    const supplier = invoice.supplier;
    if (!supplier) {
      items.push({ code: "no_supplier", severity: "hard", detail: "Supplier not linked" });
      isNewVendor = true;
    } else {
      if (supplier.verificationStatus !== "verified") {
        isNewVendor = true;
        items.push({
          code: "new_vendor",
          severity: "hard",
          detail: "Supplier is not verified",
        });
      }
      if (supplier.riskStatus === "blocked") {
        supplierBlocked = true;
        items.push({ code: "supplier_blocked", severity: "hard", detail: "Supplier blocked" });
      } else if (supplier.riskStatus === "watch") {
        items.push({ code: "supplier_watch", severity: "warn", detail: "Supplier on watch" });
      }

      const paidCount = await this.prisma.payment.count({
        where: {
          organizationId: orgId,
          supplierId: supplier.id,
          status: { in: ["PAYMENT_CONFIRMED", "COMPLETED"] },
        },
      });
      if (paidCount === 0 && supplier.verificationStatus === "verified") {
        // Advisory only — hard new-vendor hold is for unverified suppliers.
        items.push({
          code: "first_payment_vendor",
          severity: "warn",
          detail: "No prior settled payments to this supplier",
        });
      }
    }

    if (invoice.invoiceNumber && invoice.supplierId) {
      const dup = await this.prisma.invoice.findFirst({
        where: {
          organizationId: orgId,
          invoiceNumber: invoice.invoiceNumber,
          supplierId: invoice.supplierId,
          id: { not: invoiceId },
          status: { notIn: ["CANCELLED", "REJECTED"] },
        },
      });
      if (dup) {
        isDuplicate = true;
        items.push({
          code: "duplicate_invoice",
          severity: "hard",
          detail: `Duplicate of ${dup.id}`,
        });
      }
    }

    if (invoice.documentHash) {
      const dupDoc = await this.prisma.invoice.findFirst({
        where: {
          organizationId: orgId,
          documentHash: invoice.documentHash,
          id: { not: invoiceId },
          status: { notIn: ["CANCELLED", "REJECTED"] },
        },
      });
      if (dupDoc) {
        isDuplicate = true;
        items.push({
          code: "duplicate_document_checksum",
          severity: "hard",
          detail: `Same document as ${dupDoc.id}`,
        });
      }
    }

    const dest = invoice.paymentDestination;
    if (!dest || dest.verificationStatus !== "verified" || !dest.active) {
      unknownDestination = true;
      items.push({
        code: "unknown_destination",
        severity: "hard",
        detail: "Payment destination not allowlisted",
      });
    } else if (dest.version > 1) {
      destinationChanged = true;
      items.push({
        code: "destination_change",
        severity: "hard",
        detail: `Destination version ${dest.version} — re-confirm wallet`,
      });
    }

    if (!invoice.purchaseOrderId) {
      missingPo = true;
      items.push({ code: "missing_po", severity: "warn", detail: "No purchase order linked" });
    } else if (invoice.purchaseOrder && invoice.totalAmountMinor) {
      if (BigInt(invoice.totalAmountMinor) > BigInt(invoice.purchaseOrder.totalAmountMinor)) {
        poMismatch = true;
        items.push({
          code: "po_amount_mismatch",
          severity: "hard",
          detail: "Invoice exceeds PO total",
        });
      }
      if (
        invoice.supplierId &&
        invoice.purchaseOrder.supplierId !== invoice.supplierId
      ) {
        poMismatch = true;
        items.push({
          code: "po_vendor_mismatch",
          severity: "hard",
          detail: "PO supplier differs from invoice supplier",
        });
      }
    }

    let confidenceBps = 8500;
    try {
      const raw = invoice.extractionJson ? openExtractionJson(invoice.extractionJson) : null;
      const extraction = raw ? (JSON.parse(raw) as { confidence?: number }) : null;
      if (typeof extraction?.confidence === "number") {
        confidenceBps = Math.round(Math.min(1, Math.max(0, extraction.confidence)) * 10_000);
      }
    } catch {
      /* keep default */
    }
    if (confidenceBps < 6000) {
      items.push({
        code: "low_confidence",
        severity: "hard",
        detail: `Extraction confidence ${confidenceBps} bps`,
      });
    }

    const flags: RiskFlags = {
      isNewVendor,
      destinationChanged,
      isDuplicate,
      missingPo,
      poMismatch,
      unknownDestination,
      supplierBlocked,
      confidenceBps,
    };

    return { flags, items, confidenceBps };
  }

  /** Risk for invoice-less direct / batch payouts to a verified payee. */
  async assessPayee(
    orgId: string,
    supplierId: string,
    destinationAddress: string,
  ): Promise<{ flags: RiskFlags; items: RiskItem[]; confidenceBps: number }> {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organizationId: orgId },
      include: { paymentDestinations: { where: { active: true } } },
    });
    const items: RiskItem[] = [];
    let isNewVendor = false;
    let destinationChanged = false;
    let unknownDestination = false;
    let supplierBlocked = false;

    if (!supplier) {
      return {
        flags: { ...emptyFlags(0), isNewVendor: true, unknownDestination: true },
        items: [{ code: "payee_missing", severity: "hard", detail: "Payee not found" }],
        confidenceBps: 0,
      };
    }

    if (supplier.verificationStatus !== "verified") {
      isNewVendor = true;
      items.push({
        code: "new_vendor",
        severity: "hard",
        detail: "Payee is not verified",
      });
    }
    if (supplier.riskStatus === "blocked") {
      supplierBlocked = true;
      items.push({ code: "supplier_blocked", severity: "hard", detail: "Payee blocked" });
    }

    const dest = supplier.paymentDestinations.find(
      (d) => d.walletAddress.toLowerCase() === destinationAddress.toLowerCase(),
    );
    if (!dest || dest.verificationStatus !== "verified") {
      unknownDestination = true;
      items.push({
        code: "unknown_destination",
        severity: "hard",
        detail: "Payment destination not allowlisted",
      });
    } else if (dest.version > 1) {
      destinationChanged = true;
      items.push({
        code: "destination_change",
        severity: "hard",
        detail: `Destination version ${dest.version} — re-confirm wallet`,
      });
    }

    const paidCount = await this.prisma.payment.count({
      where: {
        organizationId: orgId,
        supplierId: supplier.id,
        status: { in: ["PAYMENT_CONFIRMED", "COMPLETED"] },
      },
    });
    if (paidCount === 0 && supplier.verificationStatus === "verified") {
      items.push({
        code: "first_payment_vendor",
        severity: "warn",
        detail: "No prior settled payments to this payee",
      });
    }

    const confidenceBps = 9000;
    return {
      flags: {
        isNewVendor,
        destinationChanged,
        isDuplicate: false,
        missingPo: false,
        poMismatch: false,
        unknownDestination,
        supplierBlocked,
        confidenceBps,
      },
      items,
      confidenceBps,
    };
  }
}

function emptyFlags(confidenceBps: number): RiskFlags {
  return {
    isNewVendor: false,
    destinationChanged: false,
    isDuplicate: false,
    missingPo: false,
    poMismatch: false,
    unknownDestination: false,
    supplierBlocked: false,
    confidenceBps,
  };
}
