"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, getOrgId } from "@/lib/api";
import { DashEmpty, DashHeader, DashPage, DashPanel, DashStatus } from "@/components/dash";
import { InvoiceUploadModal } from "@/components/InvoiceUploadModal";

type Invoice = {
  id: string;
  invoiceNumber: string | null;
  status: string;
  totalAmountMinor: string | null;
  supplier?: { legalName: string } | null;
};

function statusTone(status: string): "ok" | "wait" | "bad" | "neutral" {
  const s = status.toUpperCase();
  if (["COMPLETED", "PAYMENT_CONFIRMED", "VERIFIED", "APPROVED", "PAID"].includes(s)) return "ok";
  if (["PENDING", "PENDING_APPROVAL", "SUBMITTED", "DRAFT", "EXTRACTED"].includes(s)) return "wait";
  if (["REJECTED", "FAILED", "CANCELLED"].includes(s)) return "bad";
  return "neutral";
}

export default function InvoicesPage() {
  const [items, setItems] = useState<Invoice[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);

  async function load() {
    const orgId = getOrgId();
    if (!orgId) return;
    setItems(await api<Invoice[]>(`/organizations/${orgId}/invoices`, { orgId }));
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  return (
    <DashPage>
      <DashHeader
        eyebrow="Accounts payable"
        title="Invoices"
        lead="Upload, extract, and verify before money moves. Extraction assists review — it never authorizes settlement."
        actions={
          <>
            <Link href="/app/purchase-orders" className="btn-ghost">
              Purchase orders
            </Link>
            <Link href="/app/suppliers" className="btn-ghost">
              Payees
            </Link>
            <button type="button" className="btn-dark" onClick={() => setUploadOpen(true)}>
              New invoice
            </button>
          </>
        }
      />

      <DashPanel title="Inbox">
        {items.length === 0 ? (
          <DashEmpty>
            No invoices yet.{" "}
            <button type="button" className="btn-ghost btn-sm" onClick={() => setUploadOpen(true)}>
              Upload one
            </button>
          </DashEmpty>
        ) : (
          <ul className="dash-list">
            {items.map((inv) => (
              <li key={inv.id}>
                <Link href={`/app/invoices/${inv.id}`} className="dash-row !w-full">
                  <div className="dash-row-main">
                    <strong>{inv.invoiceNumber || "Untitled"}</strong>
                    <em>{inv.supplier?.legalName || "No supplier"}</em>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <DashStatus tone={statusTone(inv.status)}>{inv.status}</DashStatus>
                    <span className="font-mono text-sm">
                      {inv.totalAmountMinor ? `${Number(inv.totalAmountMinor) / 1e6} USDC` : "—"}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DashPanel>

      <InvoiceUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onCreated={() => {
          load().catch(console.error);
        }}
      />
    </DashPage>
  );
}
