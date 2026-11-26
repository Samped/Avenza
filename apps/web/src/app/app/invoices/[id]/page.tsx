"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, getOrgId } from "@/lib/api";
import { DashHeader, DashPage, DashStatus } from "@/components/dash";

function statusTone(status: string): "ok" | "wait" | "bad" | "neutral" {
  const s = status.toUpperCase();
  if (["COMPLETED", "PAYMENT_CONFIRMED", "VERIFIED", "APPROVED", "PAID", "AUTHORIZED"].includes(s))
    return "ok";
  if (
    ["PENDING", "PENDING_APPROVAL", "SUBMITTED", "DRAFT", "EXTRACTED", "AWAITING_APPROVAL", "UNDER_REVIEW"].includes(
      s,
    )
  )
    return "wait";
  if (["REJECTED", "FAILED", "CANCELLED", "POLICY_REJECTED", "PAYMENT_FAILED"].includes(s)) return "bad";
  return "neutral";
}

type Supplier = {
  id: string;
  legalName: string;
  paymentDestinations?: Array<{ id: string; walletAddress: string; verificationStatus: string }>;
};

type ExtractField<T = string> = { value?: T | null; confidence?: number };
type LineItem = {
  description: string;
  quantity: string;
  unitPrice: string;
  total: string;
};
type Extraction = {
  invoiceNumber?: ExtractField;
  supplierName?: ExtractField;
  totalAmount?: ExtractField;
  taxAmount?: ExtractField;
  subtotal?: ExtractField;
  invoiceDate?: ExtractField;
  dueDate?: ExtractField;
  currency?: ExtractField;
  purchaseOrderRef?: ExtractField;
  paymentDestination?: ExtractField;
  lineItems?: ExtractField<LineItem[]>;
  needsReview?: boolean;
  documentKind?: string;
};

type PayResult = {
  kind: "success" | "declined";
  title: string;
  detail: string;
  authorizeTx?: string;
  settleTx?: string;
  explorerAuthorize?: string;
  explorerSettle?: string;
};

type ApprovalRequest = {
  id: string;
  status: string;
  invoice: { id: string };
};

function formatUsdc(minor: string | number | null | undefined) {
  if (minor == null || minor === "") return "—";
  return (Number(minor) / 1e6).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function shortAddr(addr?: string | null) {
  if (!addr) return "—";
  if (addr.length < 14) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function friendlyPayError(raw: string): PayResult {
  const lower = raw.toLowerCase();
  if (lower.includes("insufficient") || lower.includes("no usdc") || lower.includes("fund the vault")) {
    return {
      kind: "declined",
      title: "Payment declined",
      detail: "Insufficient USDC balance in the vault. Fund the treasury, then try Pay again.",
    };
  }
  return {
    kind: "declined",
    title: "Payment declined",
    detail: raw || "Settlement could not complete.",
  };
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Record<string, unknown> | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"ok" | "bad" | "wait" | "neutral">("neutral");
  const [total, setTotal] = useState("");
  const [tax, setTax] = useState("0");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<"verify" | "approve" | "pay" | "release" | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [payResult, setPayResult] = useState<PayResult | null>(null);

  function flash(text: string, tone: "ok" | "bad" | "wait" | "neutral" = "neutral") {
    setMsg(text);
    setMsgTone(tone);
  }

  function resolveDestinationId(inv: Record<string, unknown> | null): string | undefined {
    if (destinationId) return destinationId;
    if (!inv) return undefined;
    const direct =
      (inv.paymentDestination as { id?: string } | null)?.id ||
      (inv.paymentDestinationId as string | undefined);
    if (direct) return direct;
    return (inv.supplier as { paymentDestinations?: Array<{ id: string }> } | null)
      ?.paymentDestinations?.[0]?.id;
  }

  function applyInvoiceFields(inv: Record<string, unknown>) {
    if (inv.invoiceNumber) setInvoiceNumber(String(inv.invoiceNumber));
    if (inv.totalAmountMinor) setTotal(String(Number(inv.totalAmountMinor) / 1e6));
    if (inv.taxAmountMinor) setTax(String(Number(inv.taxAmountMinor) / 1e6));
    else setTax("0");
    if (inv.invoiceDate) setInvoiceDate(String(inv.invoiceDate).slice(0, 10));
    else setInvoiceDate(new Date().toISOString().slice(0, 10));
    if (inv.supplierId) setSupplierId(String(inv.supplierId));
    const dest =
      (inv.paymentDestination as { id?: string } | null)?.id ||
      (inv.paymentDestinationId as string | undefined);
    if (dest) setDestinationId(String(dest));
    if (inv.extractionJson && typeof inv.extractionJson === "string") {
      try {
        setExtraction(JSON.parse(inv.extractionJson) as Extraction);
      } catch {
        /* ignore */
      }
    }
  }

  async function load() {
    const orgId = getOrgId()!;
    const [inv, supplierList] = await Promise.all([
      api<Record<string, unknown>>(`/organizations/${orgId}/invoices/${params.id}`, { orgId }),
      api<Supplier[]>(`/organizations/${orgId}/suppliers`, { orgId }).catch(() => []),
    ]);
    setInvoice(inv);
    setSuppliers(supplierList);
    applyInvoiceFields(inv);
  }

  useEffect(() => {
    load().catch(console.error);
  }, [params.id]);

  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setMsg("");
    try {
      const orgId = getOrgId()!;
      const fd = new FormData();
      fd.append("file", file, file.name);
      await api(`/organizations/${orgId}/invoices/${params.id}/upload`, {
        method: "POST",
        orgId,
        body: fd,
      });
      const extracted = await api<{ extraction: Extraction; invoice: Record<string, unknown> }>(
        `/organizations/${orgId}/invoices/${params.id}/extract`,
        { method: "POST", orgId },
      );
      setExtraction(extracted.extraction);
      await load();
      flash("Invoice extracted", "ok");
    } catch (err) {
      flash((err as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  }

  async function persistReview(orgId: string) {
    const sid = supplierId || (invoice?.supplierId as string | undefined);
    if (!sid) throw new Error("Link a supplier before verifying");
    if (!total || Number(total) <= 0) throw new Error("Amount is missing");
    const destId = resolveDestinationId(invoice);
    if (!destId) throw new Error("Payment destination is missing");

    await api(`/organizations/${orgId}/invoices/${params.id}/review`, {
      method: "POST",
      orgId,
      body: JSON.stringify({
        invoiceNumber: invoiceNumber || `INV-${params.id.slice(0, 6)}`,
        supplierId: sid,
        invoiceDate: invoiceDate || new Date().toISOString().slice(0, 10),
        currency: "USDC",
        subtotal: total,
        taxAmount: tax || "0",
        totalAmount: total,
        paymentDestinationId: destId,
      }),
    });
  }

  async function verifyInvoice() {
    setActionBusy("verify");
    setPayResult(null);
    flash("Verifying…", "wait");
    try {
      const orgId = getOrgId()!;
      await persistReview(orgId);
      const res = await api<{
        verification: { result: string; checks: Array<{ code: string; status: string; detail: string }> };
        controls?: { decision: string; reasonCode: string; source?: string };
        invoice: Record<string, unknown>;
      }>(`/organizations/${orgId}/invoices/${params.id}/verify`, { method: "POST", orgId });
      setInvoice(res.invoice);
      applyInvoiceFields(res.invoice);
      if (String(res.invoice.status).toUpperCase() === "ON_HOLD") {
        flash(
          `On-chain controls hold: ${res.controls?.reasonCode || (res.invoice.holdReason as string) || "review required"}`,
          "bad",
        );
      } else if (res.verification.result === "confirmed") {
        flash(
          res.controls?.decision === "auto_approve"
            ? "Verified · controls allow auto-approve"
            : "Verified",
          "ok",
        );
      } else {
        const fails = res.verification.checks
          .filter((c) => c.status === "fail")
          .map((c) => c.detail);
        flash(fails.join("; ") || "Verification blocked", "bad");
      }
      await load();
    } catch (err) {
      flash((err as Error).message || "Verify failed", "bad");
    } finally {
      setActionBusy(null);
    }
  }

  async function approveInvoice() {
    setActionBusy("approve");
    setPayResult(null);
    flash("Approving…", "wait");
    try {
      const orgId = getOrgId()!;
      const status = String(invoice?.status || "").toUpperCase();
      let requestId: string | undefined;

      if (status === "VERIFIED") {
        const req = await api<ApprovalRequest & { status?: string; requiredApprovals?: number }>(
          `/organizations/${orgId}/approvals/submit/${params.id}`,
          { method: "POST", orgId },
        );
        requestId = req.id;
        if (req.status === "approved" || req.requiredApprovals === 0) {
          flash("Auto-approved by on-chain controls", "ok");
          await load();
          return;
        }
      } else if (status === "AWAITING_APPROVAL") {
        const pending = await api<ApprovalRequest[]>(`/organizations/${orgId}/approvals`, { orgId });
        requestId = pending.find((r) => r.invoice?.id === params.id && r.status === "pending")?.id;
      }

      if (!requestId) throw new Error("No approval request found");
      await api(`/organizations/${orgId}/approvals/${requestId}/approve`, {
        method: "POST",
        orgId,
        body: JSON.stringify({}),
      });
      flash("Approved", "ok");
      await load();
    } catch (err) {
      flash((err as Error).message || "Approve failed", "bad");
    } finally {
      setActionBusy(null);
    }
  }

  async function releaseHold() {
    setActionBusy("release");
    flash("Releasing hold…", "wait");
    try {
      const orgId = getOrgId()!;
      const inv = await api<Record<string, unknown>>(
        `/organizations/${orgId}/controls/invoices/${params.id}/release-hold`,
        { method: "POST", orgId },
      );
      setInvoice(inv);
      applyInvoiceFields(inv);
      flash("Hold released — invoice verified for approval", "ok");
      await load();
    } catch (err) {
      flash((err as Error).message || "Release failed", "bad");
    } finally {
      setActionBusy(null);
    }
  }

  async function payInvoice() {
    setActionBusy("pay");
    setPayResult(null);
    flash("Paying…", "wait");
    try {
      const orgId = getOrgId()!;
      const payment = await api<{ id: string }>(`/organizations/${orgId}/payments`, {
        method: "POST",
        orgId,
        body: JSON.stringify({
          invoiceId: params.id,
          idempotencyKey: `pay-${params.id}-${Date.now()}`,
        }),
      });
      await api(`/organizations/${orgId}/payments/${payment.id}/authorize`, {
        method: "POST",
        orgId,
      });
      const executed = await api<{
        transactionHash?: string | null;
        authorizationTxHash?: string | null;
        settlement?: {
          authorizationTxHash: string;
          transactionHash: string;
          explorer: { authorize: string; settle: string };
        };
      }>(`/organizations/${orgId}/payments/${payment.id}/execute`, { method: "POST", orgId });
      await api(`/organizations/${orgId}/payments/${payment.id}/status`, { orgId }).catch(() => null);

      setPayResult({
        kind: "success",
        title: "Payment successful",
        detail: "USDC settled on X Layer.",
        authorizeTx: executed.settlement?.authorizationTxHash || executed.authorizationTxHash || undefined,
        settleTx: executed.settlement?.transactionHash || executed.transactionHash || undefined,
        explorerAuthorize: executed.settlement?.explorer.authorize,
        explorerSettle: executed.settlement?.explorer.settle,
      });
      flash("Payment successful", "ok");
      await load();
    } catch (err) {
      const result = friendlyPayError((err as Error).message || "Payment failed");
      setPayResult(result);
      flash(result.detail, "bad");
      await load().catch(() => null);
    } finally {
      setActionBusy(null);
    }
  }

  if (!invoice) {
    return (
      <DashPage>
        <p className="text-sm text-mute">Loading invoice…</p>
      </DashPage>
    );
  }

  const status = String(invoice.status || "");
  const upper = status.toUpperCase();
  const isVerified = [
    "VERIFIED",
    "ON_HOLD",
    "AWAITING_APPROVAL",
    "APPROVED",
    "AUTHORIZED",
    "PAYMENT_SUBMITTED",
    "PAYMENT_CONFIRMED",
    "COMPLETED",
    "PAYMENT_FAILED",
  ].includes(upper);
  const onHold = upper === "ON_HOLD";
  const canApprove = ["VERIFIED", "AWAITING_APPROVAL"].includes(upper);
  const canPay = upper === "APPROVED" || upper === "PAYMENT_FAILED";
  const paidDone = ["PAYMENT_SUBMITTED", "PAYMENT_CONFIRMED", "COMPLETED"].includes(upper);
  const hasExtract =
    Boolean(extraction) ||
    Boolean(invoice.totalAmountMinor) ||
    Boolean(invoice.invoiceNumber) ||
    upper !== "DRAFT";

  const supplierName =
    (invoice.supplier as { legalName?: string } | null)?.legalName ||
    suppliers.find((s) => s.id === supplierId)?.legalName ||
    extraction?.supplierName?.value ||
    "—";
  const wallet =
    (invoice.paymentDestination as { walletAddress?: string } | null)?.walletAddress ||
    extraction?.paymentDestination?.value ||
    "";
  const currency =
    extraction?.currency?.value ||
    (invoice.currency as string | undefined) ||
    "USDC";
  const dueDate =
    extraction?.dueDate?.value ||
    (invoice.dueDate ? String(invoice.dueDate).slice(0, 10) : "");
  const poRef =
    extraction?.purchaseOrderRef?.value ||
    (invoice.purchaseOrder as { purchaseOrderNumber?: string } | null)?.purchaseOrderNumber ||
    "";
  const subtotalDisplay =
    extraction?.subtotal?.value ||
    (invoice.subtotalMinor ? formatUsdc(invoice.subtotalMinor as string) : "");
  const taxDisplay =
    tax && Number(tax) > 0
      ? Number(tax).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : extraction?.taxAmount?.value ||
        (invoice.taxAmountMinor && Number(invoice.taxAmountMinor) > 0
          ? formatUsdc(invoice.taxAmountMinor as string)
          : "");
  const amountDisplay = total
    ? Number(total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : invoice.totalAmountMinor
      ? formatUsdc(invoice.totalAmountMinor as string)
      : extraction?.totalAmount?.value || "—";
  const lineItems = extraction?.lineItems?.value || [];
  const title =
    invoiceNumber ||
    (invoice.invoiceNumber as string) ||
    extraction?.invoiceNumber?.value ||
    "Invoice";

  function money(v: string | number | null | undefined) {
    if (v == null || v === "") return "—";
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return (
    <DashPage>
      <DashHeader
        eyebrow="Invoice"
        title={title}
        lead=""
        actions={
          <>
            <DashStatus tone={statusTone(status)}>{status}</DashStatus>
            <Link href="/app/invoices" className="btn-ghost">
              Inbox
            </Link>
          </>
        }
      />

      {msg ? (
        <p
          className={`dash-flash${msgTone === "ok" ? " is-ok" : msgTone === "bad" ? " is-bad" : msgTone === "wait" ? " is-wait" : ""}`}
        >
          {msg}
        </p>
      ) : null}

      {!hasExtract ? (
        <form onSubmit={upload} className="inv-sheet">
          <div className="inv-sheet-upload-pad">
            <p className="inv-sheet-kicker">Upload</p>
            <h2 className="inv-sheet-title">Add an invoice file</h2>
            <p className="inv-sheet-lead">PDF, image, or text — we extract the fields for you.</p>
          </div>
          <label className="inv-sheet-file">
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.json,application/pdf,image/*,application/json,text/plain"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <span>{file ? file.name : "Choose file"}</span>
          </label>
          <div className="inv-sheet-upload-pad" style={{ paddingTop: 0 }}>
            <button className="btn-dark inv-sheet-cta" disabled={busy || !file}>
              {busy ? "Extracting…" : "Extract"}
            </button>
          </div>
        </form>
      ) : (
        <article className="inv-sheet">
          <header className="inv-sheet-banner">
            <div className="inv-sheet-head">
              <div>
                <p className="inv-sheet-kicker">Extracted invoice</p>
                <h2 className="inv-sheet-title">{title}</h2>
                <p className="inv-sheet-supplier">{supplierName}</p>
              </div>
              <DashStatus tone={isVerified ? "ok" : extraction?.needsReview ? "wait" : "ok"}>
                {isVerified ? "Verified" : extraction?.needsReview ? "Review" : "Ready"}
              </DashStatus>
            </div>
            <div className="inv-sheet-amount">
              <div>
                <span>Amount due</span>
                <strong>{amountDisplay}</strong>
              </div>
              <em className="inv-sheet-currency">{currency}</em>
            </div>
          </header>

          <div className="inv-sheet-body">
            <dl className="inv-sheet-grid">
              <div>
                <dt>Invoice date</dt>
                <dd>{invoiceDate || extraction?.invoiceDate?.value || "—"}</dd>
              </div>
              <div>
                <dt>Due date</dt>
                <dd>{dueDate || "—"}</dd>
              </div>
              <div>
                <dt>Currency</dt>
                <dd>{currency}</dd>
              </div>
              <div>
                <dt>Purchase order</dt>
                <dd>{poRef || "—"}</dd>
              </div>
              <div>
                <dt>Document</dt>
                <dd>{extraction?.documentKind || "invoice"}</dd>
              </div>
              <div>
                <dt>Destination</dt>
                <dd className="inv-sheet-mono" title={wallet || undefined}>
                  {shortAddr(wallet)}
                </dd>
              </div>
            </dl>

            {lineItems.length > 0 ? (
              <section className="inv-sheet-section">
                <h3>Line items</h3>
                <table className="inv-sheet-lines">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th className="is-num">Qty</th>
                      <th className="is-num">Unit</th>
                      <th className="is-num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((line, i) => (
                      <tr key={`${line.description}-${i}`}>
                        <td>{line.description || "—"}</td>
                        <td className="is-num">{line.quantity || "—"}</td>
                        <td className="is-num">{money(line.unitPrice)}</td>
                        <td className="is-num">{money(line.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}

            <div className="inv-sheet-totals">
              <div>
                <span>Subtotal</span>
                <strong>{subtotalDisplay ? money(subtotalDisplay) : amountDisplay}</strong>
              </div>
              <div>
                <span>Tax</span>
                <strong>{taxDisplay ? money(taxDisplay) : "—"}</strong>
              </div>
              <div className="is-grand">
                <span>Total</span>
                <strong>
                  {amountDisplay} {currency}
                </strong>
              </div>
            </div>

            {wallet ? (
              <div className="inv-sheet-wallet">
                <span>Payment destination</span>
                <code>{wallet}</code>
              </div>
            ) : null}

            {(() => {
              let items: Array<{ code?: string; severity?: string; detail?: string }> = [];
              try {
                const raw = invoice.riskJson ? JSON.parse(String(invoice.riskJson)) : null;
                if (raw?.items && Array.isArray(raw.items)) items = raw.items;
              } catch {
                /* ignore */
              }
              if (!items.length) return null;
              return (
                <div className="flex flex-wrap gap-1.5 mt-3" aria-label="Risk signals">
                  {items.slice(0, 8).map((it, i) => (
                    <span
                      key={`${it.code || i}`}
                      className="home-chip"
                      title={it.detail || it.code}
                      style={{
                        opacity: it.severity === "hard" ? 1 : 0.75,
                        borderColor: it.severity === "hard" ? "var(--ink, #111)" : undefined,
                      }}
                    >
                      {it.code || "risk"}
                    </span>
                  ))}
                </div>
              );
            })()}

            {!isVerified ? (
              <div className="inv-sheet-foot">
                <button
                  type="button"
                  className="btn-dark inv-sheet-cta"
                  disabled={!!actionBusy || busy}
                  onClick={() => void verifyInvoice()}
                >
                  {actionBusy === "verify" ? "Verifying…" : "Verify"}
                </button>
              </div>
            ) : onHold ? (
              <div className="inv-sheet-foot">
                <p className="text-sm text-mute mb-2">
                  On-chain controls hold
                  {invoice.holdReason ? `: ${String(invoice.holdReason)}` : ""}
                </p>
                <button
                  type="button"
                  className="btn-dark inv-sheet-cta"
                  disabled={!!actionBusy}
                  onClick={() => void releaseHold()}
                >
                  {actionBusy === "release" ? "Releasing…" : "Release hold"}
                </button>
              </div>
            ) : (
              <div className="inv-sheet-foot inv-sheet-foot-split">
                {canApprove ? (
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={!!actionBusy}
                    onClick={() => void approveInvoice()}
                  >
                    {actionBusy === "approve" ? "Approving…" : "Approve"}
                  </button>
                ) : (
                  <span className="inv-sheet-done">Approved</span>
                )}
                {paidDone ? (
                  <span className="inv-sheet-done">Paid</span>
                ) : (
                  <button
                    type="button"
                    className="btn-dark inv-sheet-cta"
                    disabled={!!actionBusy || !canPay}
                    onClick={() => void payInvoice()}
                  >
                    {actionBusy === "pay" ? "Paying…" : "Pay"}
                  </button>
                )}
              </div>
            )}
          </div>
        </article>
      )}

      {payResult ? (
        <div className="inv-pay-result-root" role="dialog" aria-modal="true">
          <button
            type="button"
            className="inv-pay-result-backdrop"
            aria-label="Close"
            onClick={() => setPayResult(null)}
          />
          <div className={`inv-pay-result is-${payResult.kind}`}>
            <p className="inv-pay-result-eyebrow">
              {payResult.kind === "success" ? "Settled" : "Declined"}
            </p>
            <h3>{payResult.title}</h3>
            <p>{payResult.detail}</p>
            {payResult.kind === "success" && (payResult.authorizeTx || payResult.settleTx) ? (
              <div className="inv-pay-result-hashes">
                {payResult.authorizeTx ? (
                  <a
                    href={
                      payResult.explorerAuthorize ||
                      `https://www.oklink.com/xlayer-test/tx/${payResult.authorizeTx}`
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Authorize {payResult.authorizeTx.slice(0, 10)}…
                  </a>
                ) : null}
                {payResult.settleTx ? (
                  <a
                    href={
                      payResult.explorerSettle ||
                      `https://www.oklink.com/xlayer-test/tx/${payResult.settleTx}`
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Settle {payResult.settleTx.slice(0, 10)}…
                  </a>
                ) : null}
              </div>
            ) : null}
            <div className="inv-pay-result-actions">
              {payResult.kind === "declined" ? (
                <Link href="/app/treasury" className="btn-dark">
                  Fund treasury
                </Link>
              ) : (
                <Link href="/app/payments" className="btn-dark">
                  View payments
                </Link>
              )}
              <button type="button" className="btn-ghost" onClick={() => setPayResult(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DashPage>
  );
}
