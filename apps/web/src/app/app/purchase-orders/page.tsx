"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api, getOrgId } from "@/lib/api";
import { DashEmpty, DashHeader, DashPage, DashPanel } from "@/components/dash";

type PO = {
  id: string;
  purchaseOrderNumber: string;
  totalAmountMinor: string;
  currency: string;
  status: string;
  supplier?: { legalName: string };
};

type Supplier = { id: string; legalName: string };

function formatUsdc(minor: string) {
  return (Number(minor) / 1e6).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Kept for deep links from invoices — not in primary nav */
export default function PurchaseOrdersPage() {
  const [items, setItems] = useState<PO[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [number, setNumber] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    const orgId = getOrgId()!;
    const [pos, sups] = await Promise.all([
      api<PO[]>(`/organizations/${orgId}/purchase-orders`, { orgId }).catch(() => []),
      api<Supplier[]>(`/organizations/${orgId}/suppliers`, { orgId }),
    ]);
    setItems(pos);
    setSuppliers(sups);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const orgId = getOrgId()!;
    setMsg("");
    try {
      await api(`/organizations/${orgId}/purchase-orders`, {
        method: "POST",
        orgId,
        body: JSON.stringify({
          purchaseOrderNumber: number,
          supplierId,
          totalAmountMinor: String(Math.round(Number(amount) * 1e6)),
          currency: "USDC",
        }),
      });
      setNumber("");
      setAmount("");
      await load();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  return (
    <DashPage>
      <DashHeader
        eyebrow="Supporting"
        title="Purchase orders"
        lead="Optional PO matching for controls. Primary invoice work stays in Invoices."
        actions={
          <Link href="/app/invoices" className="btn-ghost">
            Back to invoices
          </Link>
        }
      />
      <DashPanel title="Register PO">
        <form onSubmit={onCreate} className="dash-form is-3">
          <div>
            <label className="label">PO number</label>
            <input className="input" value={number} onChange={(e) => setNumber(e.target.value)} required />
          </div>
          <div>
            <label className="label">Supplier</label>
            <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
              <option value="">Select…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.legalName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Amount (USDC)</label>
            <input className="input" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="dash-form-actions dash-span-3">
            <button className="btn-dark">Create</button>
          </div>
          {msg ? <p className="text-sm text-mute dash-span-3">{msg}</p> : null}
        </form>
      </DashPanel>
      <DashPanel title="Open POs">
        {items.length === 0 ? (
          <DashEmpty>No purchase orders.</DashEmpty>
        ) : (
          <ul className="dash-list">
            {items.map((p) => (
              <li key={p.id} className="dash-row">
                <div className="dash-row-main">
                  <strong>{p.purchaseOrderNumber}</strong>
                  <em>
                    {p.supplier?.legalName || "—"} · {formatUsdc(p.totalAmountMinor)} {p.currency}
                  </em>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DashPanel>
    </DashPage>
  );
}
