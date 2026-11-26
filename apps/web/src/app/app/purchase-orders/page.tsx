"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api, getOrgId } from "@/lib/api";
import { DashEmpty, DashHeader, DashPage, DashPanel } from "@/components/dash";
import { useI18n } from "@/lib/i18n/LocaleProvider";

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
  const { t } = useI18n();
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
        eyebrow={t("purchaseOrdersPage.eyebrow")}
        title={t("purchaseOrdersPage.title")}
        lead={t("purchaseOrdersPage.lead")}
        actions={
          <Link href="/app/invoices" className="btn-ghost">
            {t("purchaseOrdersPage.backToInvoices")}
          </Link>
        }
      />
      <DashPanel title={t("purchaseOrdersPage.register")}>
        <form onSubmit={onCreate} className="dash-form is-3">
          <div>
            <label className="label">{t("purchaseOrdersPage.poNumber")}</label>
            <input className="input" value={number} onChange={(e) => setNumber(e.target.value)} required />
          </div>
          <div>
            <label className="label">{t("common.supplier")}</label>
            <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
              <option value="">{t("purchaseOrdersPage.selectSupplier")}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.legalName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t("common.amountUsdc")}</label>
            <input className="input" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="dash-form-actions dash-span-3">
            <button className="btn-dark">{t("common.create")}</button>
          </div>
          {msg ? <p className="text-sm text-mute dash-span-3">{msg}</p> : null}
        </form>
      </DashPanel>
      <DashPanel title={t("purchaseOrdersPage.openPos")}>
        {items.length === 0 ? (
          <DashEmpty>{t("purchaseOrdersPage.empty")}</DashEmpty>
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
