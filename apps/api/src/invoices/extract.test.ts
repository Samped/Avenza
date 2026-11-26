import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractInvoiceText, extractionToMinor } from "./extract";

describe("extractInvoiceText", () => {
  it("parses labeled text invoices", () => {
    const text = `
INVOICE
Invoice number: INV-10042
From: Lagos Components Supply
Invoice date: 2026-11-20
Due date: 2026-12-20
PO: PO-7788
Subtotal: $45.00
Tax: $5.00
Total amount due: $50.00
USDC
Wallet: 0x1111111111111111111111111111111111111111
Widgets 2 x $20.00 = $40.00
`;
    const r = extractInvoiceText(text, { documentKind: "text" });
    assert.equal(r.invoiceNumber.value, "INV-10042");
    assert.match(r.supplierName.value || "", /Lagos Components/i);
    assert.equal(r.totalAmount.value, "50.00");
    assert.equal(r.taxAmount.value, "5.00");
    assert.equal(r.purchaseOrderRef.value, "PO-7788");
    assert.equal(r.paymentDestination.value?.toLowerCase(), "0x1111111111111111111111111111111111111111");
    assert.ok((r.lineItems.value?.length || 0) >= 1);
    assert.equal(extractionToMinor(r.totalAmount.value), "50000000");
  });

  it("parses structured JSON invoices", () => {
    const json = JSON.stringify({
      invoiceNumber: "INV-JSON-9",
      supplierName: "Acme Parts",
      invoiceDate: "2026-01-15",
      currency: "USDC",
      subtotal: "100",
      tax: "0",
      totalAmount: "100.00",
      walletAddress: "0x2222222222222222222222222222222222222222",
      lineItems: [{ description: "Bolt kit", quantity: 1, unitPrice: 100, total: 100 }],
    });
    const r = extractInvoiceText(json, { documentKind: "json" });
    assert.equal(r.invoiceNumber.value, "INV-JSON-9");
    assert.equal(r.totalAmount.value, "100.00");
    assert.equal(r.supplierName.value, "Acme Parts");
    assert.equal(r.needsReview, false);
  });

  it("recovers invoice number from filename hint", () => {
    const r = extractInvoiceText("Total: 12.50 USDC\nfilename:INV-FILE-77.pdf", { documentKind: "pdf" });
    assert.equal(r.invoiceNumber.value, "INV-FILE-77");
    assert.equal(r.totalAmount.value, "12.50");
  });

  it("parses Arc Softgoods style PDF literals without Tj junk", () => {
    const text = `Vendor: Arc Softgoods Inc
Invoice Number: PAY-ARC-13200531
Issue Date: 2026-10-01
Due Date: 2026-10-20
Currency: USDC
Total: 145.31
Arc Address: 0xd9792bf937d9673ab08c452fe55ec4e26632be54`;
    const r = extractInvoiceText(text, { documentKind: "pdf" });
    assert.equal(r.invoiceNumber.value, "PAY-ARC-13200531");
    assert.equal(r.supplierName.value, "Arc Softgoods Inc");
    assert.equal(r.totalAmount.value, "145.31");
    assert.equal(r.paymentDestination.value?.toLowerCase(), "0xd9792bf937d9673ab08c452fe55ec4e26632be54");
  });
});

describe("extractPdfLiteralStrings", () => {
  it("pulls Tj strings from a minimal PDF buffer", async () => {
    const { extractPdfLiteralStrings } = await import("./document-text");
    const stream = `BT
/F1 11 Tf
(Vendor: Arc Softgoods Inc) Tj
T* (Invoice Number: PAY-ARC-13200531) Tj
T* (Total: 145.31) Tj
ET`;
    const buf = Buffer.from(`%PDF-1.4\nstream\n${stream}\nendstream\n`);
    const text = extractPdfLiteralStrings(buf);
    assert.match(text, /Arc Softgoods Inc/);
    assert.match(text, /PAY-ARC-13200531/);
    assert.match(text, /145\.31/);
    assert.doesNotMatch(text, /\)\s*Tj/);
  });
});
