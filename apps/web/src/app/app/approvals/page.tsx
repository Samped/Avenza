"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api, getOrgId } from "@/lib/api";
import { DashEmpty, DashHeader, DashPage, DashPanel, DashStatus } from "@/components/dash";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Request = {
  id: string;
  requiredApprovals: number;
  currentApprovals: number;
  status: string;
  expiresAt?: string | null;
  invoice: { id: string; invoiceNumber: string | null; totalAmountMinor: string | null };
};

type ApprovalPolicy = {
  id: string;
  name: string;
  versions: Array<{ version: number; rulesJson: string }>;
};

function formatUsdc(minor: string | null) {
  if (!minor) return "—";
  return (Number(minor) / 1e6).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type VerifiedInvoice = {
  id: string;
  invoiceNumber: string | null;
  status: string;
  totalAmountMinor: string | null;
  supplier?: { legalName: string } | null;
};

export default function ApprovalsPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<Request[]>([]);
  const [policies, setPolicies] = useState<ApprovalPolicy[]>([]);
  const [verified, setVerified] = useState<VerifiedInvoice[]>([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"ok" | "bad" | "wait" | "neutral">("neutral");
  const [policyName, setPolicyName] = useState("Default AP approvals");
  const [tierLow, setTierLow] = useState("1");
  const [tierMid, setTierMid] = useState("2");
  const [tierHigh, setTierHigh] = useState("2");
  const [busyId, setBusyId] = useState<string | null>(null);

  function flash(text: string, tone: "ok" | "bad" | "wait" | "neutral" = "neutral") {
    setMsg(text);
    setMsgTone(tone);
  }

  async function load() {
    const orgId = getOrgId()!;
    const [pending, pols, invoices] = await Promise.all([
      api<Request[]>(`/organizations/${orgId}/approvals`, { orgId }),
      api<ApprovalPolicy[]>(`/organizations/${orgId}/approvals/policies`, { orgId }).catch(() => []),
      api<VerifiedInvoice[]>(`/organizations/${orgId}/invoices`, { orgId }).catch(() => []),
    ]);
    setItems(pending);
    setPolicies(pols);
    setVerified(invoices.filter((i) => i.status.toUpperCase() === "VERIFIED"));
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function submit() {
    if (!invoiceId.trim()) {
      flash("Paste a verified invoice id first", "bad");
      return;
    }
    const orgId = getOrgId()!;
    flash("Submitting…", "wait");
    try {
      await api(`/organizations/${orgId}/approvals/submit/${invoiceId}`, { method: "POST", orgId });
      flash("Submitted for approval", "ok");
      setInvoiceId("");
      await load();
    } catch (e) {
      flash((e as Error).message || "Submit failed", "bad");
    }
  }

  async function decide(id: string, path: "approve" | "reject") {
    const orgId = getOrgId()!;
    setBusyId(id);
    flash(path === "approve" ? "Approving…" : "Rejecting…", "wait");
    try {
      await api(`/organizations/${orgId}/approvals/${id}/${path}`, {
        method: "POST",
        orgId,
        body: JSON.stringify({}),
      });
      flash(path === "approve" ? "Approved — invoice can be settled from Payments" : "Rejected", "ok");
      await load();
    } catch (e) {
      flash((e as Error).message || `${path} failed`, "bad");
    } finally {
      setBusyId(null);
    }
  }

  async function savePolicy(e: FormEvent) {
    e.preventDefault();
    const orgId = getOrgId()!;
    flash("Publishing policy…", "wait");
    try {
      await api(`/organizations/${orgId}/approvals/policies`, {
        method: "POST",
        orgId,
        body: JSON.stringify({
          name: policyName,
          rules: [
            { minAmount: "0", maxAmount: "500000000", requiredApprovals: Number(tierLow), requireNewSupplierExtra: false },
            {
              minAmount: "500000000",
              maxAmount: "5000000000",
              requiredApprovals: Number(tierMid),
              requireNewSupplierExtra: true,
            },
            {
              minAmount: "5000000000",
              maxAmount: null,
              requiredApprovals: Number(tierHigh),
              requireNewSupplierExtra: true,
            },
          ],
        }),
      });
      flash("Approval policy published.", "ok");
      await load();
    } catch (err) {
      flash((err as Error).message || "Policy publish failed", "bad");
    }
  }

  return (
    <DashPage>
      <DashHeader
        eyebrow={t("pages.approvalsEyebrow")}
        title={t("pages.approvalsTitle")}
        lead={t("approvalsPage.lead")}
        actions={
          <Link href="/app/invoices" className="btn-ghost">
            {t("nav.invoices")}
          </Link>
        }
      />

      <DashPanel title={t("approvalsPage.verifiedSubmit")}>
        {verified.length === 0 ? (
          <DashEmpty>
            {t("approvalsPage.noVerified")} <Link href="/app/invoices">{t("approvalsPage.reviewInbox")}</Link>
          </DashEmpty>
        ) : (
          <ul className="dash-list">
            {verified.map((inv) => (
              <li key={inv.id} className="dash-row">
                <div className="dash-row-main">
                  <strong>
                    <Link href={`/app/invoices/${inv.id}`}>{inv.invoiceNumber || inv.id.slice(0, 8)}</Link>
                  </strong>
                  <em>
                    {inv.supplier?.legalName || "Supplier"} · {formatUsdc(inv.totalAmountMinor)} USDC
                  </em>
                </div>
                <button
                  className="btn-dark"
                  disabled={busyId === inv.id}
                  onClick={async () => {
                    setBusyId(inv.id);
                    setInvoiceId(inv.id);
                    const orgId = getOrgId()!;
                    flash("Submitting…", "wait");
                    try {
                      await api(`/organizations/${orgId}/approvals/submit/${inv.id}`, { method: "POST", orgId });
                      flash("Submitted for approval", "ok");
                      await load();
                    } catch (e) {
                      flash((e as Error).message || "Submit failed", "bad");
                    } finally {
                      setBusyId(null);
                    }
                  }}
                >
                  {busyId === inv.id ? "Submitting…" : "Submit"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </DashPanel>

      <div className="dash-grid is-2">
        <DashPanel title={t("approvalsPage.submitById")}>
          <div className="dash-form">
            <div>
              <label className="label">{t("approvalsPage.invoiceUuid")}</label>
              <input
                className="input font-mono text-xs"
                placeholder={t("approvalsPage.invoiceIdPlaceholder")}
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
              />
            </div>
            <div className="dash-form-actions">
              <button className="btn-dark" type="button" onClick={submit}>
                Submit
              </button>
            </div>
          </div>
        </DashPanel>

        <DashPanel title={t("approvalsPage.policyTiers")}>
          <form onSubmit={savePolicy} className="dash-form">
            <div>
              <label className="label">{t("approvalsPage.policyName")}</label>
              <input className="input" value={policyName} onChange={(e) => setPolicyName(e.target.value)} />
            </div>
            <div className="dash-grid is-3" style={{ gap: "0.65rem" }}>
              <div>
                <label className="label">{"< $500"}</label>
                <input className="input" type="number" min={1} max={10} value={tierLow} onChange={(e) => setTierLow(e.target.value)} />
              </div>
              <div>
                <label className="label">$500–$5k</label>
                <input className="input" type="number" min={1} max={10} value={tierMid} onChange={(e) => setTierMid(e.target.value)} />
              </div>
              <div>
                <label className="label">{">$5k"}</label>
                <input className="input" type="number" min={1} max={10} value={tierHigh} onChange={(e) => setTierHigh(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-mute">{t("approvalsPage.newSupplierHint")}</p>
            <div className="dash-form-actions">
              <button className="btn-dark">{t("approvalsPage.publishTiers")}</button>
            </div>
          </form>
          {policies[0] ? (
            <p className="px-4 pb-4 text-xs text-mute">
              Active: {policies[0].name}
              {policies[0].versions[0] ? ` · v${policies[0].versions[0].version}` : ""}
            </p>
          ) : null}
        </DashPanel>
      </div>

      {msg ? (
        <p className={`dash-flash${msgTone === "ok" ? " is-ok" : msgTone === "bad" ? " is-bad" : msgTone === "wait" ? " is-wait" : ""}`}>
          {msg}
        </p>
      ) : null}

      <DashPanel title={t("approvalsPage.queue")}>
        {items.length === 0 ? (
          <DashEmpty>{t("approvalsPage.queueEmpty")}</DashEmpty>
        ) : (
          <ul className="dash-list">
            {items.map((r) => (
              <li key={r.id} className="dash-row">
                <div className="dash-row-main">
                  <strong>
                    <Link href={`/app/invoices/${r.invoice.id}`}>
                      {r.invoice.invoiceNumber || r.invoice.id.slice(0, 8)}
                    </Link>
                  </strong>
                  <em>
                    {r.currentApprovals}/{r.requiredApprovals} signatures · {formatUsdc(r.invoice.totalAmountMinor)} USDC
                    {r.expiresAt ? ` · expires ${new Date(r.expiresAt).toLocaleString()}` : ""}
                  </em>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <DashStatus tone="wait">{r.status}</DashStatus>
                  <button
                    type="button"
                    className="btn-dark"
                    disabled={busyId === r.id}
                    onClick={() => void decide(r.id, "approve")}
                  >
                    {busyId === r.id ? "Working…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busyId === r.id}
                    onClick={() => void decide(r.id, "reject")}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DashPanel>
    </DashPage>
  );
}
